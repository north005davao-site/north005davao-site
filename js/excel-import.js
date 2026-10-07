/**
 * NORTH-005 DAVAO DEL NORTE HQ
 * Master Registry Excel Import & 7-Sheet Data Mapping Engine
 * 
 * Features:
 * 1. Strictly reads and processes 7 designated worksheets:
 *    - DDN 01 TAGUM -> Tagum
 *    - DDN 02 PANABO -> Panabo
 *    - DDN 03 CARMEN -> Carmen
 *    - DDN 04 STO. TOMAS -> Sto. Tomas
 *    - DDN 05 TALAINGOD -> Talaingod
 *    - DDN 06 KAPALONG -> Kapalong
 *    - DDN 10 SAMAL -> Samal
 * 2. Scans and disambiguates duplicate "ID NO." headers (Sales Rep ID vs Sales Coordinator ID).
 * 3. Maps SALES REPRESENTATIVE -> Full Name, combines PUROK + BARANGAY.
 * 4. Assigns Municipality strictly from worksheet tab name.
 * 5. Normalizes Booth Code (e.g. "DDN 352" -> "DDN-352").
 * 6. Preserves exact GPS Coordinates, SR Contact Phone, Status, and POS Serial No.
 * 7. IMPORTS ALL UNREGISTERED RECORDS (e.g. DDN 10 SAMAL completely new records are marked NEW).
 * 8. Compares against existing records (Primary: ID No., Secondary: Name + Booth Code) to UPDATE without duplicating.
 * 9. NEVER DELETES unrelated existing Master Registry records.
 * 10. Provides a detailed Import Preview report with Worksheet Scan table, KPI cards, and confirmation modal.
 */

(function () {
  'use strict';

  // 7 Designated DDN Worksheets & Relievers Registry
  const TARGET_SHEETS = [
    { sheetName: 'DDN 01 TAGUM', municipality: 'Tagum' },
    { sheetName: 'DDN 02 PANABO', municipality: 'Panabo' },
    { sheetName: 'DDN 03 CARMEN', municipality: 'Carmen' },
    { sheetName: 'DDN 04 STO. TOMAS', municipality: 'Sto. Tomas' },
    { sheetName: 'DDN 05 TALAINGOD', municipality: 'Talaingod' },
    { sheetName: 'DDN 06 KAPALONG', municipality: 'Kapalong' },
    { sheetName: 'DDN 10 SAMAL', municipality: 'Samal' },
    { sheetName: 'RELIEVERS', municipality: 'Sto. Tomas', isRelieversSheet: true, isOptional: true }
  ];

  // Global state for current import session
  let currentImportData = {
    file: null,
    fileName: '',
    workbook: null,
    sheetNames: [],
    targetSheetsStatus: [],
    missingSheetsCount: 0,
    allRows: [],
    comparisonResults: [],
    summary: {
      total: 0,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      duplicateCount: 0,
      invalidCount: 0
    },
    activeFilter: 'all',
    activeSheetFilter: 'all'
  };

  // Expose current import session state for inspection & tests
  window.getCurrentImportData = function () {
    return currentImportData;
  };

  // Helper: Normalize string
  function cleanStr(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  }

  // Helper: Normalize Booth Code (e.g. "DDN 352" -> "DDN-352", "ddn-352" -> "DDN-352")
  function normalizeBoothCode(code) {
    const s = cleanStr(code).toUpperCase();
    if (!s || s === '-' || s === 'N/A') return '-';
    const m = s.match(/^DDN[\s\-_]*(\d+)$/i);
    if (m) {
      return `DDN-${m[1]}`;
    }
    return s.replace(/\s+/g, '-');
  }

  // Helper: Match target sheet name flexibly (ignoring spaces, punctuation, case)
  function findMatchingTarget(sheetName) {
    const raw = cleanStr(sheetName);
    const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm.includes('reliever') || norm.includes('buffer')) {
      return { sheetName: 'RELIEVERS', municipality: 'Davao Sector', isRelieversSheet: true, isOptional: true };
    }
    // Municipality checks
    if (norm.includes('tagum')) return { sheetName: 'DDN 01 TAGUM', municipality: 'Tagum' };
    if (norm.includes('panabo')) return { sheetName: 'DDN 02 PANABO', municipality: 'Panabo' };
    if (norm.includes('carmen')) return { sheetName: 'DDN 03 CARMEN', municipality: 'Carmen' };
    if (norm.includes('tomas')) return { sheetName: 'DDN 04 STO. TOMAS', municipality: 'Sto. Tomas' };
    if (norm.includes('talaingod')) return { sheetName: 'DDN 05 TALAINGOD', municipality: 'Talaingod' };
    if (norm.includes('kapalong')) return { sheetName: 'DDN 06 KAPALONG', municipality: 'Kapalong' };
    if (norm.includes('samal') || norm.includes('igacos')) return { sheetName: 'DDN 10 SAMAL', municipality: 'Samal' };

    return TARGET_SHEETS.find(t => {
      const targetNorm = t.sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm === targetNorm;
    }) || null;
  }

  // 1. Trigger File Selection / Open Upload Dialog
  window.triggerExcelUpload = function () {
    const dialog = document.getElementById('modal-excel-upload-dialog');
    if (dialog) {
      dialog.classList.add('active');
    } else {
      const input = document.getElementById('excel-file-input');
      if (input) {
        input.value = '';
        input.click();
      }
    }
  };

  window.openExcelUploadDialog = function () {
    const dialog = document.getElementById('modal-excel-upload-dialog');
    if (dialog) dialog.classList.add('active');
  };

  window.closeExcelUploadDialog = function () {
    const dialog = document.getElementById('modal-excel-upload-dialog');
    if (dialog) dialog.classList.remove('active');
  };

  // 2. Handle File Selection & Drag-and-Drop Processing
  window.processUploadedExcelFile = function (file) {
    if (!file) return;

    const fileName = file.name || '';
    const ext = fileName.slice((fileName.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();

    // Validate Extension: must be .xlsx or .xls
    if (ext !== 'xlsx' && ext !== 'xls') {
      window.showUnsupportedFileModal();
      return;
    }

    window.closeExcelUploadDialog();

    // Read File using SheetJS (XLSX)
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        if (typeof XLSX === 'undefined') {
          alert('Error: Excel parser library (SheetJS) is loading. Please try again in a moment.');
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        
        currentImportData.file = file;
        currentImportData.fileName = fileName;
        currentImportData.workbook = workbook;
        currentImportData.sheetNames = workbook.SheetNames || [];

        // Process all target worksheets in the workbook
        processWorkbookMultiSheets();
      } catch (err) {
        console.error('Error parsing Excel workbook:', err);
        alert('Failed to read Excel workbook. Please ensure it is a valid, uncorrupted Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  window.handleExcelFileSelected = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    window.processUploadedExcelFile(file);
    event.target.value = '';
  };

  // Display Unsupported File Modal
  window.showUnsupportedFileModal = function () {
    const modal = document.getElementById('modal-excel-unsupported');
    if (modal) {
      modal.classList.add('active');
    } else {
      alert("Unsupported File\nPlease upload a valid Excel file (.xlsx or .xls).");
    }
  };

  window.closeUnsupportedFileModal = function () {
    const modal = document.getElementById('modal-excel-unsupported');
    if (modal) modal.classList.remove('active');
  };

  // 3. Process All Target Sheets in the Workbook
  function processWorkbookMultiSheets() {
    const workbook = currentImportData.workbook;
    const availableSheetNames = currentImportData.sheetNames;

    const sheetsStatus = [];
    let missingCount = 0;
    const sheetsToProcess = [];

    // Helper: Identify non-operational / report sheets to ignore
    const isExcludedSheet = (sName) => {
      const l = cleanStr(sName).toLowerCase();
      return l.startsWith('eod') || l.startsWith('low sales') || l.startsWith('draw date') || 
             l.startsWith('accounting') || l.startsWith('summary') || l.startsWith('pivot');
    };

    // 1. Scan for each of the designated municipal target sheets
    const matchedTargets = [];
    TARGET_SHEETS.forEach(target => {
      const actualName = availableSheetNames.find(s => {
        const match = findMatchingTarget(s);
        return match && match.sheetName === target.sheetName;
      });
      if (actualName) {
        matchedTargets.push({
          targetSheet: target.sheetName,
          actualSheet: actualName,
          municipality: target.municipality,
          isRelieversSheet: !!target.isRelieversSheet
        });
      }
    });

    // Check if separate RELIEVERS sheet exists under any variant
    availableSheetNames.forEach(sheetName => {
      const norm = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.includes('reliever') || norm.includes('buffer')) {
        if (!matchedTargets.some(m => m.actualSheet === sheetName)) {
          matchedTargets.push({
            targetSheet: 'RELIEVERS',
            actualSheet: sheetName,
            municipality: 'Davao Sector',
            isRelieversSheet: true
          });
        }
      }
    });

    // Determine format: Multi-sheet (2+ designated sheets) vs Master Consolidated sheet
    const hasConsolidatedSheet = availableSheetNames.some(s => /^(sheet1|master[\s_\-]*registry|master|registry|tellers|staff)$/i.test(s.trim()));
    const is7SheetFormat = matchedTargets.length >= 2 || (matchedTargets.length === 1 && !hasConsolidatedSheet);

    if (is7SheetFormat) {
      TARGET_SHEETS.forEach(target => {
        const found = matchedTargets.find(m => m.targetSheet === target.sheetName);
        if (found) {
          sheetsStatus.push({
            targetSheet: target.sheetName,
            actualSheet: found.actualSheet,
            municipality: target.municipality,
            isRelieversSheet: !!target.isRelieversSheet,
            found: true,
            recordCount: 0
          });
          sheetsToProcess.push(found);
        } else {
          if (!target.isOptional) {
            missingCount++;
          }
          sheetsStatus.push({
            targetSheet: target.sheetName,
            actualSheet: null,
            municipality: target.municipality,
            isRelieversSheet: !!target.isRelieversSheet,
            found: false,
            recordCount: 0
          });
        }
      });
    } else {
      // Consolidated Master Format (e.g. DDN - MASTER TEMPLATE.xlsx, SAMAL - MASTER TEMPLATE.xlsx, Master_Registry_Update_DDN.xlsx)
      const primarySheet = availableSheetNames.find(s => /^(sheet1|master[\s_\-]*registry|master|registry|tellers|staff)$/i.test(s.trim()))
        || availableSheetNames.find(s => !isExcludedSheet(s));

      if (primarySheet) {
        let defMuni = 'Sto. Tomas';
        const fileLow = (currentImportData.fileName || '').toLowerCase();
        if (fileLow.includes('samal')) defMuni = 'Samal';
        else if (fileLow.includes('tagum')) defMuni = 'Tagum';
        else if (fileLow.includes('panabo')) defMuni = 'Panabo';
        else if (fileLow.includes('carmen')) defMuni = 'Carmen';

        sheetsStatus.push({
          targetSheet: primarySheet,
          actualSheet: primarySheet,
          municipality: defMuni,
          isRelieversSheet: false,
          found: true,
          recordCount: 0
        });
        sheetsToProcess.push({
          actualSheet: primarySheet,
          targetSheet: primarySheet,
          municipality: defMuni,
          isRelieversSheet: false
        });
      }

      // Also process any dedicated Relievers sheet if present
      availableSheetNames.forEach(sheetName => {
        const norm = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if ((norm.includes('reliever') || norm.includes('buffer')) && !sheetsToProcess.some(sp => sp.actualSheet === sheetName)) {
          sheetsStatus.push({
            targetSheet: 'RELIEVERS',
            actualSheet: sheetName,
            municipality: 'Sto. Tomas',
            isRelieversSheet: true,
            found: true,
            recordCount: 0
          });
          sheetsToProcess.push({
            actualSheet: sheetName,
            targetSheet: 'RELIEVERS',
            municipality: 'Sto. Tomas',
            isRelieversSheet: true
          });
        }
      });
    }

    currentImportData.targetSheetsStatus = sheetsStatus;
    currentImportData.missingSheetsCount = missingCount;

    // Process records across all identified sheets
    const allExtractedRecords = [];
    const store = window.appStore;
    const rawExisting = store ? store.getEmployees() : [];
    // Permanent clean filter for existing employees
    const allExisting = rawExisting.filter(e => !e.name || !e.name.includes('Buffer Reliever'));

    const seenInBatch = new Map(); // For in-file duplicate detection

    sheetsToProcess.forEach(sheetInfo => {
      const ws = workbook.Sheets[sheetInfo.actualSheet];
      if (!ws) return;

      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rawRows || rawRows.length === 0) return;

      // Detect Header Row: Scan first 15 rows for columns
      const headerAnalysis = analyzeSheetHeaders(rawRows);
      if (!headerAnalysis) return;

      const dataRows = rawRows.slice(headerAnalysis.headerRowIndex + 1);
      let sheetRecordCount = 0;

      dataRows.forEach((row, rowIdx) => {
        // Skip completely empty rows
        if (!row || !Array.isArray(row) || row.every(cell => cleanStr(cell) === '')) return;

        sheetRecordCount++;
        const record = extractRowData(row, rowIdx + headerAnalysis.headerRowIndex + 2, headerAnalysis, sheetInfo);

        // Skip empty spacer or template rows
        if ((!record.name || record.name === 'N/A') && (!record.id || record.id === 'N/A') && (!record.booth || record.booth === 'N/A' || record.booth === '-')) {
          return;
        }

        // In-file Duplicate Detection (across entire workbook)
        let fileKey = '';
        if (record.id && record.id !== 'N/A') {
          fileKey = `ID:${record.id.toUpperCase()}`;
        } else if (record.name && record.name !== 'N/A' && record.booth && record.booth !== 'N/A' && record.booth !== '-') {
          fileKey = `NAME:${record.name.toLowerCase()}|BOOTH:${record.booth.toUpperCase()}`;
        } else if (record.name && record.name !== 'N/A') {
          fileKey = `NAME:${record.name.toLowerCase()}`;
        } else if (record.booth && record.booth !== 'N/A' && record.booth !== '-') {
          fileKey = `BOOTH:${record.booth.toUpperCase()}`;
        } else {
          fileKey = `ROW:${sheetInfo.targetSheet}_${record.rowNum}`;
        }

        if (seenInBatch.has(fileKey)) {
          record.action = 'DUPLICATE';
          record.notes = `Duplicate in workbook: identical to ${seenInBatch.get(fileKey)}`;
          allExtractedRecords.push(record);
          return;
        }
        seenInBatch.set(fileKey, `${sheetInfo.targetSheet} (Row ${record.rowNum})`);

        // Check against existing Master Registry (Primary: ID No., Secondary: Full Name)
        const normId = (record.id && record.id !== 'N/A') ? record.id.toLowerCase().trim() : '';
        const normName = (record.name && record.name !== 'N/A') ? record.name.toLowerCase().trim() : '';
        const normBooth = (record.booth && record.booth !== 'N/A' && record.booth !== '-') ? record.booth.toUpperCase().trim() : '';

        const isRelSheet = !!sheetInfo.isRelieversSheet;
        const existingMatch = allExisting.find(e => {
          const eIsRel = (e.role || '').toUpperCase().includes('RELIEVER');
          if (isRelSheet && !eIsRel) return false;
          if (!isRelSheet && eIsRel && normBooth) return false;
          if (normId && normId !== 'ddn005-sr000' && e.id && e.id.toLowerCase().trim() === normId) return true;
          if (normName && e.name && e.name.toLowerCase().trim() === normName) {
            return true;
          }
          if (normBooth && (!normName || normName === 'n/a')) {
            const eb = normalizeBoothCode(e.boothCode || e.booth);
            if (eb === normBooth) return true;
          }
          return false;
        });

        if (existingMatch) {
          // Record already exists in Master Registry -> Evaluate for UPDATE or UNCHANGED
          record.matchId = existingMatch.id;
          record.matchName = existingMatch.name;

          const changes = [];
          if (record.name && record.name !== 'N/A' && existingMatch.name && record.name.toLowerCase() !== existingMatch.name.toLowerCase()) {
            changes.push(`Name: ${existingMatch.name} → ${record.name}`);
          }
          if (record.role && record.role !== 'N/A' && existingMatch.role && record.role.toLowerCase() !== existingMatch.role.toLowerCase()) {
            changes.push(`Role: ${existingMatch.role} → ${record.role}`);
          }
          if (record.purok && record.purok !== 'N/A' && existingMatch.purok && record.purok.toLowerCase() !== existingMatch.purok.toLowerCase()) {
            changes.push(`Address: ${existingMatch.purok} → ${record.purok}`);
          }
          if (record.municipality && record.municipality !== 'N/A' && existingMatch.municipality && record.municipality.toLowerCase() !== existingMatch.municipality.toLowerCase()) {
            changes.push(`Muni: ${existingMatch.municipality} → ${record.municipality}`);
          }
          const existingBooth = normalizeBoothCode(existingMatch.boothCode || existingMatch.booth);
          if (record.booth && record.booth !== 'N/A' && record.booth !== '-' && existingBooth !== record.booth) {
            changes.push(`Booth: ${existingBooth} → ${record.booth}`);
          }
          if (record.lat !== null && record.lng !== null) {
            const exLat = existingMatch.lat !== undefined ? existingMatch.lat : (existingMatch.coordinates ? existingMatch.coordinates.lat : null);
            const exLng = existingMatch.lng !== undefined ? existingMatch.lng : (existingMatch.coordinates ? existingMatch.coordinates.lng : null);
            if (exLat === null || Math.abs(record.lat - exLat) > 0.0001 || Math.abs(record.lng - exLng) > 0.0001) {
              changes.push(`GPS: Coordinates updated`);
            }
          }
          const exPhone = existingMatch.phone || existingMatch.contact || '';
          if (record.phone && record.phone !== 'N/A' && exPhone && record.phone !== exPhone) {
            changes.push(`Phone: ${exPhone} → ${record.phone}`);
          }
          if (record.status && existingMatch.status && record.status.toLowerCase() !== existingMatch.status.toLowerCase()) {
            changes.push(`Status: ${existingMatch.status} → ${record.status}`);
          }
          const exPos = existingMatch.posSerial || existingMatch.pos || '';
          if (record.posSerial && record.posSerial !== 'N/A' && exPos && record.posSerial !== exPos) {
            changes.push(`POS: ${exPos} → ${record.posSerial}`);
          }
          const exPr = existingMatch.printerName || existingMatch.printerSerial || '';
          if (record.printerName && record.printerName !== 'N/A' && exPr && record.printerName !== exPr) {
            changes.push(`Printer: ${exPr} → ${record.printerName}`);
          }

          if (changes.length === 0) {
            record.action = 'UNCHANGED';
            record.notes = 'Identical to existing Master Registry record';
          } else {
            record.action = 'UPDATE';
            record.changes = changes;
            record.notes = changes.join('; ');
          }
        } else {
          // DOES NOT EXIST IN SYSTEM -> CREATE NEW MASTER REGISTRY RECORD!
          record.action = 'NEW';
          if (record.hasMissingRequired) {
            record.notes = `New record with missing data (${record.missingFields.join(', ')}) — Status set to INACTIVE`;
          } else {
            record.notes = record.role === 'Reliever'
              ? `New Reliever to be added to Reliever Registry (${record.municipality || 'Davao Sector'})`
              : `New Sales Representative to be added to Master Registry (${record.municipality})`;
          }
        }

        allExtractedRecords.push(record);
      });

      // Update status table count for this sheet
      const statusEntry = sheetsStatus.find(s => s.actualSheet === sheetInfo.actualSheet || s.targetSheet === sheetInfo.targetSheet);
      if (statusEntry) {
        statusEntry.recordCount = sheetRecordCount;
      }
    });

    currentImportData.comparisonResults = allExtractedRecords;

    // Calculate Summary KPI Counts
    let newCount = 0, updateCount = 0, unchangedCount = 0, duplicateCount = 0, invalidCount = 0;
    allExtractedRecords.forEach(r => {
      if (r.action === 'NEW') newCount++;
      else if (r.action === 'UPDATE') updateCount++;
      else if (r.action === 'UNCHANGED') unchangedCount++;
      else if (r.action === 'DUPLICATE') duplicateCount++;
      else if (r.action === 'ERROR') invalidCount++;
    });

    currentImportData.summary = {
      total: allExtractedRecords.length,
      newCount,
      updateCount,
      unchangedCount,
      duplicateCount,
      invalidCount
    };

    // Render Preview Modal with Scan Summary
    renderExcelImportPreview();
  }

  // 4. Header Detection & Disambiguation of Dual "ID NO." Headers
  function analyzeSheetHeaders(rawRows) {
    let bestRowIdx = 0;
    let maxMatches = -1;

    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;

      // Ignore merged banner/title rows where cells repeat the same text
      const nonEmpties = row.map(c => cleanStr(c).toLowerCase()).filter(Boolean);
      if (nonEmpties.length === 0) continue;
      const uniqueTexts = new Set(nonEmpties);
      // If a row has multiple cells but very few unique values, it's a merged title banner!
      if (nonEmpties.length >= 3 && uniqueTexts.size <= 2) {
        continue;
      }

      let matches = 0;
      uniqueTexts.forEach(text => {
        if (
          text.includes('teller') || text.includes('sales rep') || text.includes('sales coordinator') || 
          text.includes('sales supervisor') || text.includes('operations administrator') ||
          text.includes('booth code') || text.includes('pos no') || text.includes('id no') || 
          text.includes('employee id') || text.includes('employee name') || text.includes('full name') ||
          text.includes('outlets')
        ) {
          matches += 4;
        } else if (
          text.includes('purok') || text.includes('barangay') || text.includes('address') || 
          text.includes('coordinates') || text.includes('status') || text.includes('contact') || 
          text.includes('phone') || text.includes('role') || text.includes('position') || text.includes('booth') ||
          text.includes('relievers')
        ) {
          matches += 2;
        }
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIdx = i;
      }
    }

    const headerRow = rawRows[bestRowIdx] || [];
    
    // Find all column indices
    let srCol = -1;
    let scCol = -1;
    let brgyCol = -1;
    let purokCol = -1;
    let addrCol = -1;
    let statusCol = -1;
    let phoneCol = -1;
    let boothCol = -1;
    let outletCol = -1;
    let posCol = -1;
    let coordsCol = -1;
    let muniCol = -1;
    let printerCol = -1;
    let roleCol = -1;
    const idCols = [];

    headerRow.forEach((cell, idx) => {
      const txt = cleanStr(cell).toLowerCase();
      if (!txt) return;

      // Identify ID columns (Sales Rep ID, Employee ID, Teller ID, Staff ID)
      if (
        txt === 'id no.' || txt === 'id no' || txt === 'id number' || txt === 'id' || 
        txt.includes('id no') || txt.includes('employee id') || txt.includes('emp id') || 
        txt.includes('emp. id') || txt.includes('teller id') || txt.includes('sr id') || 
        txt.includes('staff id') || txt.includes('control no') || txt.includes('id #')
      ) {
        idCols.push({ idx, header: cleanStr(cell) });
      }

      // Sales Representative / Teller Name
      const isCoord = txt.includes('coordinator') || txt.includes('supervisor') || txt.includes('administrator');
      const isPrt = txt.includes('printer');
      if (!isCoord && !isPrt) {
        if (
          txt === 'teller' || txt === 'tellers' || txt === 'station teller' || 
          txt.includes('teller name') || txt.includes('sales rep') || 
          txt.includes('sales representative') || txt.includes('representative') ||
          txt === 'employee name' || txt === 'emp name' || txt === 'staff name' ||
          txt === 'personnel name' || txt === 'full name' || txt === 'reliever name' ||
          txt === 'reliever' || txt === 'relievers' || txt === 'cashier'
        ) {
          srCol = idx;
        }
      }

      // Sales Coordinator / Sales Supervisor / Operations Administrator
      if (
        txt.includes('sales coordinator') || txt.includes('coordinator') ||
        txt.includes('sales supervisor') || txt.includes('supervisor') ||
        txt.includes('operations administrator')
      ) {
        if (!txt.includes('id no') && !txt.includes('id #') && !txt.includes('id')) {
          scCol = idx;
        }
      }

      // Barangay
      if (txt.includes('barangay') || txt.includes('brgy')) {
        brgyCol = idx;
      }

      // Purok
      if (txt.includes('purok') || txt.includes('prk')) {
        purokCol = idx;
      }

      // Address / Location general
      if (txt.includes('address') || txt.includes('location') || txt.includes('area')) {
        addrCol = idx;
      }

      // Status
      if (txt === 'status' || txt.includes('status')) {
        statusCol = idx;
      }

      // Contact Phone
      if (txt.includes('contact') || txt.includes('phone') || txt.includes('mobile') || txt.includes('sr contact')) {
        phoneCol = idx;
      }

      // Booth Code
      if (txt.includes('booth code') || txt === 'booth' || txt === 'booth no' || txt === 'booth #') {
        boothCol = idx;
      } else if (txt.includes('booth')) {
        if (boothCol === -1) boothCol = idx;
      }

      // Outlets column
      if (txt === 'outlet' || txt === 'outlets' || txt.includes('outlet code') || txt.includes('station')) {
        outletCol = idx;
      }

      // POS No.
      if (txt.includes('pos') || txt.includes('terminal')) {
        posCol = idx;
      }

      // Coordinates
      if (txt.includes('coord') || txt.includes('gps')) {
        coordsCol = idx;
      }

      // Municipality / City / Location / Area
      if (txt.includes('municipality') || txt.includes('city') || txt.includes('town') || txt === 'location' || txt === 'area') {
        muniCol = idx;
      }

      // Portable Printer
      if (txt.includes('printer')) {
        printerCol = idx;
      }

      // Role
      if (txt === 'role' || txt.includes('designation') || txt.includes('position') || txt.includes('job title')) {
        roleCol = idx;
      }
    });

    // Fallbacks
    if (boothCol === -1 && outletCol !== -1) {
      boothCol = outletCol;
    }

    if (srCol === -1) {
      headerRow.forEach((cell, idx) => {
        const txt = cleanStr(cell).toLowerCase();
        if (
          (txt.includes('name') || txt.includes('teller') || txt.includes('reliever') || 
           txt.includes('personnel') || txt.includes('employee') || txt.includes('staff')) && 
          !txt.includes('coordinator') && !txt.includes('printer') && !txt.includes('outlet') && !txt.includes('booth')
        ) {
          srCol = idx;
        }
      });
    }

    // DISAMBIGUATE DUAL ID NO. COLUMNS:
    let srIdCol = -1;
    let scIdCol = -1;

    if (idCols.length >= 2) {
      // Find the ID column positioned before Sales Coordinator or closest to Sales Rep
      idCols.forEach(colObj => {
        if (scCol !== -1 && colObj.idx < scCol) {
          srIdCol = colObj.idx;
        } else if (scCol !== -1 && colObj.idx > scCol) {
          scIdCol = colObj.idx;
        }
      });

      // Proximity check if column order is non-standard
      if (srIdCol === -1) {
        let minDist = 999;
        idCols.forEach(colObj => {
          const dist = Math.abs(colObj.idx - srCol);
          if (dist < minDist) {
            minDist = dist;
            srIdCol = colObj.idx;
          }
        });
      }
    } else if (idCols.length === 1) {
      srIdCol = idCols[0].idx;
    }

    return {
      headerRowIndex: bestRowIdx,
      srCol,
      scCol,
      srIdCol,
      scIdCol,
      brgyCol,
      purokCol,
      addrCol,
      statusCol,
      phoneCol,
      boothCol,
      posCol,
      coordsCol,
      muniCol,
      printerCol,
      roleCol
    };
  }

  // 5. Extract Single Row Data & Map to Master Registry Fields
  function extractRowData(row, rowNum, headerAnalysis, sheetInfo) {
    const getCell = (colIdx) => {
      if (colIdx !== -1 && colIdx !== undefined && row[colIdx] !== undefined) {
        const cell = row[colIdx];
        if (cell && typeof cell === 'object' && cell.result !== undefined) {
          return cleanStr(cell.result);
        }
        return cleanStr(cell);
      }
      return '';
    };

    // 1. Full Name (SALES REPRESENTATIVE or RELIEVER)
    const rawName = getCell(headerAnalysis.srCol);

    // 2. ID No. (Sales Representative / Reliever ID NO.)
    const rawId = getCell(headerAnalysis.srIdCol);

    // 3. Booth Code (Normalized format: DDN 352 -> DDN-352)
    let rawBooth = getCell(headerAnalysis.boothCol);
    if (rawBooth) {
      const m = rawBooth.match(/DDN[\s\-_]*\d+/i);
      if (m) {
        rawBooth = normalizeBoothCode(m[0]);
      } else {
        rawBooth = normalizeBoothCode(rawBooth);
      }
    } else {
      rawBooth = '-';
    }

    // 4. Role detection (Tellers vs Relievers)
    let isReliever = !!sheetInfo.isRelieversSheet;
    let explicitRole = headerAnalysis.roleCol !== -1 ? getCell(headerAnalysis.roleCol) : '';

    if (explicitRole) {
      const erUpper = explicitRole.toUpperCase();
      if (erUpper.includes('RELIEVER') || erUpper.includes('RELIVER') || erUpper.includes('BUFFER')) {
        isReliever = true;
      }
    }
    if (rawId && (rawId.toUpperCase().includes('-REL') || rawId.toUpperCase().startsWith('REL'))) {
      isReliever = true;
    }
    if (rawName && (/reliever/i.test(rawName) || /buffer/i.test(rawName))) {
      isReliever = true;
    }
    if (rawBooth && (/reliever/i.test(rawBooth) || /buffer/i.test(rawBooth) || /roving/i.test(rawBooth))) {
      isReliever = true;
    }

    let roleVal = 'Sales Representative';
    if (!rawName) {
      roleVal = 'N/A';
    } else if (isReliever) {
      roleVal = 'Reliever';
    } else if (explicitRole) {
      const erUpper = explicitRole.toUpperCase();
      if (erUpper.includes('SUPERVISOR')) roleVal = 'Supervisor';
      else if (erUpper.includes('COLLECTOR')) roleVal = 'Collector';
      else if (erUpper.includes('TEAM LEADER')) roleVal = 'Team Leader';
      else if (erUpper.includes('TELLER') || erUpper.includes('REP')) roleVal = 'Sales Representative';
      else roleVal = explicitRole;
    }

    // 5. Purok / Street / Barangay (Combine PUROK + BARANGAY or ADDRESS)
    const rawPurok = getCell(headerAnalysis.purokCol);
    const rawBarangay = getCell(headerAnalysis.brgyCol);
    const rawAddr = getCell(headerAnalysis.addrCol);
    let combinedAddress = '';
    if (rawPurok && rawBarangay) {
      combinedAddress = `${rawPurok}, ${rawBarangay}`;
    } else if (rawPurok) {
      combinedAddress = rawPurok;
    } else if (rawBarangay) {
      combinedAddress = rawBarangay;
    } else if (rawAddr) {
      combinedAddress = rawAddr;
    }

    // 6. Municipality (Determined from worksheet tab name, column, or address)
    let muniVal = sheetInfo.municipality || '';
    if (headerAnalysis.muniCol !== -1) {
      const rawMuni = getCell(headerAnalysis.muniCol);
      if (rawMuni) {
        const parsed = (typeof parseAddress === 'function' ? parseAddress(rawMuni) : { municipality: rawMuni });
        muniVal = parsed.municipality || rawMuni;
      }
    }
    if (!muniVal || muniVal === 'Davao Sector' || muniVal === 'Davao Del Norte' || muniVal === 'N/A' || muniVal === '-') {
      const testText = `${combinedAddress} ${sheetInfo.targetSheet} ${sheetInfo.actualSheet || ''}`.toLowerCase();
      if (testText.includes('tagum')) muniVal = 'Tagum City';
      else if (testText.includes('panabo')) muniVal = 'Panabo City';
      else if (testText.includes('carmen')) muniVal = 'Carmen';
      else if (testText.includes('tomas') || testText.includes('salvacion') || testText.includes('tibal.og') || testText.includes('tibal-og')) muniVal = 'Sto. Tomas';
      else if (testText.includes('talaingod')) muniVal = 'Talaingod';
      else if (testText.includes('kapalong')) muniVal = 'Kapalong';
      else if (testText.includes('samal') || testText.includes('babak') || testText.includes('penaplata') || testText.includes('kaputian') || testText.includes('igacos')) muniVal = 'Samal';
      else muniVal = 'Sto. Tomas';
    }

    // 7. GPS Coordinates (Parsed accurately from COORDINATES or authentic registry)
    const rawCoords = getCell(headerAnalysis.coordsCol);
    let parsedLat = null;
    let parsedLng = null;
    if (rawCoords) {
      const m = rawCoords.match(/(-?\d+\.?\d*)[,\s;]+(-?\d+\.?\d*)/);
      if (m) {
        let lat = parseFloat(m[1]);
        let lng = parseFloat(m[2]);
        if (lat > 50 && lng < 50) {
          const temp = lat;
          lat = lng;
          lng = temp;
        }
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          parsedLat = parseFloat(lat.toFixed(6));
          parsedLng = parseFloat(lng.toFixed(6));
        }
      }
    }
    // Authentic Master Registry coordinate match if valid booth
    if (parsedLat === null && rawBooth && rawBooth !== '-' && rawBooth !== 'N/A') {
      const normB = normalizeBoothCode(rawBooth);
      if (typeof AUTHENTIC_MASTER_REGISTRY_COORDINATES !== 'undefined' && AUTHENTIC_MASTER_REGISTRY_COORDINATES[normB]) {
        parsedLat = AUTHENTIC_MASTER_REGISTRY_COORDINATES[normB].lat;
        parsedLng = AUTHENTIC_MASTER_REGISTRY_COORDINATES[normB].lng;
      }
    }

    // 8. Contact Phone (Never invent 0917-000-0000 or fake phone)
    const rawPhone = getCell(headerAnalysis.phoneCol);
    const cleanPhone = (rawPhone && rawPhone !== '0917-000-0000' && rawPhone !== '-') ? rawPhone : '';

    // 9. POS Serial No.
    const rawPos = getCell(headerAnalysis.posCol);

    // 10. Portable Printer (Dropdown: WITH PORTABLE PRINTER or N/A)
    let rawPrinter = '';
    if (headerAnalysis.printerCol !== -1) {
      rawPrinter = getCell(headerAnalysis.printerCol).toUpperCase();
    }
    const printerVal = rawPrinter ? ((rawPrinter.includes('WITH') || rawPrinter.includes('PRT-') || rawPrinter.includes('YES') || rawPrinter.includes('TRUE')) ? 'WITH PORTABLE PRINTER' : 'N/A') : '';

    // 11. Status Determination (BUG FIX: Missing ID never sets Status to INACTIVE)
    // 11. Status Determination (BUG FIX: Missing ID never sets Status to INACTIVE; Missing Name = Unused Booth)
    let statusVal = 'Active';
    let hasMissingRequired = false;
    const missingFields = [];

    if (!rawName || rawName === 'N/A') {
      missingFields.push('Personnel Name');
      hasMissingRequired = true;
      statusVal = 'Unused';
    }

    const rawStatus = getCell(headerAnalysis.statusCol);
    if (rawStatus) {
      const sUp = rawStatus.toUpperCase();
      if (sUp === 'INACTIVE' || sUp === 'OFFLINE' || sUp === 'SUSPENDED' || sUp === 'DEACTIVATED' || sUp === 'DEACTIVED') {
        statusVal = (!rawName || rawName === 'N/A') ? 'Unused' : 'Inactive';
      } else if (sUp === 'TERMINATED') {
        statusVal = 'Terminated';
      } else if (sUp === 'UNUSED') {
        statusVal = 'Unused';
      } else if (sUp === 'ACTIVE') {
        statusVal = (!rawName || rawName === 'N/A') ? 'Unused' : 'Active';
      }
    }

    if (combinedAddress && (combinedAddress.toUpperCase().includes('DEACTIVATED') || combinedAddress.toUpperCase().includes('TEMPORARY DEACTIVATED'))) {
      statusVal = (!rawName || rawName === 'N/A') ? 'Unused' : 'Inactive';
    }

    let finalId = rawId || 'N/A';
    if (isReliever) {
      finalId = (rawId && !rawId.startsWith('DDN005-REL') && rawId !== 'N/A') ? rawId : 'DDN005-SR000';
    }

    return {
      rowNum: rowNum,
      sheetName: sheetInfo.targetSheet,
      id: finalId,
      name: rawName || 'N/A',
      role: roleVal,
      purok: combinedAddress || 'N/A',
      barangay: rawBarangay || 'N/A',
      municipality: muniVal || 'N/A',
      booth: (rawBooth && rawBooth !== '-') ? rawBooth : 'N/A',
      boothCode: (rawBooth && rawBooth !== '-') ? rawBooth : 'N/A',
      coordinates: (parsedLat !== null && parsedLng !== null) ? { lat: parsedLat, lng: parsedLng } : null,
      lat: parsedLat,
      lng: parsedLng,
      rawCoordinates: rawCoords,
      phone: cleanPhone || 'N/A',
      contact: cleanPhone || 'N/A',
      status: statusVal,
      posSerial: rawPos || 'N/A',
      pos: rawPos || 'N/A',
      printerName: printerVal || 'N/A',
      printerSerial: printerVal || 'N/A',
      hasMissingRequired: hasMissingRequired,
      missingFields: missingFields,
      action: '',
      matchId: '',
      matchName: '',
      changes: [],
    };
  }

  // 6. Render Import Preview Modal
  function renderExcelImportPreview() {
    const modal = document.getElementById('modal-excel-preview');
    if (!modal) return;

    // File name & record count
    const fileNameEl = document.getElementById('excel-prev-filename');
    if (fileNameEl) fileNameEl.textContent = currentImportData.fileName;

    const recordsCountEl = document.getElementById('excel-prev-recordscount');
    if (recordsCountEl) recordsCountEl.textContent = currentImportData.summary.total;

    // Render Worksheet Scan Report Table
    const sheetsTbody = document.getElementById('excel-sheets-summary-tbody');
    const sheetsBadge = document.getElementById('excel-sheets-status-badge');

    if (sheetsTbody) {
      sheetsTbody.innerHTML = '';
      currentImportData.targetSheetsStatus.forEach(item => {
        const tr = document.createElement('tr');
        const statusHtml = item.found 
          ? `<span class="badge badge-success" style="font-weight: 700; font-size: 11px; padding: 2px 8px;">✅ Found (${item.recordCount} records)</span>`
          : `<span class="badge badge-danger" style="font-weight: 700; font-size: 11px; padding: 2px 8px;">⚠️ Missing Worksheet</span>`;

        tr.innerHTML = `
          <td style="font-weight: 700; color: var(--text-main);">${item.targetSheet}</td>
          <td style="color: var(--primary); font-weight: 600;">${item.municipality}</td>
          <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${item.recordCount}</td>
          <td style="text-align: center;">${statusHtml}</td>
        `;
        sheetsTbody.appendChild(tr);
      });
    }

    if (sheetsBadge) {
      const foundCount = currentImportData.targetSheetsStatus.filter(s => s.found).length;
      const totalCount = currentImportData.targetSheetsStatus.length;
      sheetsBadge.textContent = `${foundCount} of ${totalCount} Sheets Found`;
      if (foundCount === totalCount) {
        sheetsBadge.className = 'badge badge-success';
      } else {
        sheetsBadge.className = 'badge badge-warning';
      }
    }

    // Populate Sheet Filter Dropdown
    const sheetFilterSelect = document.getElementById('excel-prev-sheet-filter');
    if (sheetFilterSelect) {
      sheetFilterSelect.innerHTML = '<option value="all">All Worksheets (Combined)</option>';
      currentImportData.targetSheetsStatus.filter(s => s.found).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.targetSheet;
        opt.textContent = `${s.targetSheet} — ${s.municipality} (${s.recordCount} records)`;
        sheetFilterSelect.appendChild(opt);
      });
    }

    // KPI Badges
    document.getElementById('prev-count-new').textContent = currentImportData.summary.newCount;
    document.getElementById('prev-count-update').textContent = currentImportData.summary.updateCount;
    document.getElementById('prev-count-unchanged').textContent = currentImportData.summary.unchangedCount;
    document.getElementById('prev-count-duplicate').textContent = currentImportData.summary.duplicateCount;
    document.getElementById('prev-count-invalid').textContent = currentImportData.summary.invalidCount;

    // Filter Buttons Text
    document.getElementById('tab-prev-all').textContent = `All (${currentImportData.summary.total})`;
    document.getElementById('tab-prev-new').textContent = `New (${currentImportData.summary.newCount})`;
    document.getElementById('tab-prev-update').textContent = `Update (${currentImportData.summary.updateCount})`;
    document.getElementById('tab-prev-unchanged').textContent = `Unchanged (${currentImportData.summary.unchangedCount})`;
    document.getElementById('tab-prev-duplicate').textContent = `Duplicate (${currentImportData.summary.duplicateCount})`;
    document.getElementById('tab-prev-invalid').textContent = `Invalid (${currentImportData.summary.invalidCount})`;

    // Filter and Render Table Rows
    window.filterPreviewTable('all');

    // Enable/Disable Confirm Button
    const confirmBtn = document.getElementById('btn-excel-confirm-sync');
    if (confirmBtn) {
      const actionable = currentImportData.summary.newCount + currentImportData.summary.updateCount;
      confirmBtn.disabled = actionable === 0 && currentImportData.summary.unchangedCount === 0;
      confirmBtn.title = actionable === 0 ? 'No records to synchronize' : 'Proceed to update Master Registry';
    }

    modal.classList.add('active');
  }

  // 7. Filter Preview Table by Action Type and Sheet
  window.filterPreviewTable = function (actionType) {
    currentImportData.activeFilter = actionType;

    // Update active tab buttons
    ['all', 'new', 'update', 'unchanged', 'duplicate', 'invalid'].forEach(t => {
      const btn = document.getElementById(`tab-prev-${t}`);
      if (btn) {
        if (t === actionType) {
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
    });

    renderPreviewRows();
  };

  window.filterPreviewBySheet = function (sheetVal) {
    currentImportData.activeSheetFilter = sheetVal;
    renderPreviewRows();
  };

  function renderPreviewRows() {
    const tbody = document.getElementById('excel-preview-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let list = currentImportData.comparisonResults;

    // Filter by Sheet
    if (currentImportData.activeSheetFilter && currentImportData.activeSheetFilter !== 'all') {
      list = list.filter(r => r.sheetName === currentImportData.activeSheetFilter);
    }

    // Filter by Action
    if (currentImportData.activeFilter !== 'all') {
      const filterKey = currentImportData.activeFilter === 'invalid' ? 'ERROR' : currentImportData.activeFilter.toUpperCase();
      list = list.filter(r => r.action === filterKey);
    }

    if (list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="12" style="text-align: center; padding: 30px; color: var(--text-muted);">No records match the selected filters.</td>`;
      tbody.appendChild(tr);
      return;
    }

    list.slice(0, 250).forEach(r => {
      const tr = document.createElement('tr');

      // Status Badge (Action)
      let badgeHtml = '';
      if (r.action === 'NEW') {
        badgeHtml = '<span class="badge badge-success" style="font-weight: 800; font-size: 11px; padding: 2px 7px;">NEW</span>';
      } else if (r.action === 'UPDATE') {
        badgeHtml = '<span class="badge badge-primary" style="font-weight: 800; font-size: 11px; padding: 2px 7px; background: #2563eb; color: #ffffff;">UPDATE</span>';
      } else if (r.action === 'UNCHANGED') {
        badgeHtml = '<span class="badge badge-neutral" style="font-weight: 600; font-size: 11px; padding: 2px 7px;">UNCHANGED</span>';
      } else if (r.action === 'DUPLICATE') {
        badgeHtml = '<span class="badge badge-warning" style="font-weight: 800; font-size: 11px; padding: 2px 7px;">DUPLICATE</span>';
      } else if (r.action === 'ERROR') {
        badgeHtml = '<span class="badge badge-danger" style="font-weight: 800; font-size: 11px; padding: 2px 7px;">ERROR</span>';
      }

      // Record Status Badge (Active / Inactive)
      const isInactive = (r.status || '').toUpperCase() === 'INACTIVE';
      const statusBadge = isInactive
        ? '<span class="badge badge-danger" style="font-weight: 800; font-size: 10.5px; padding: 2px 7px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">INACTIVE</span>'
        : '<span class="badge badge-success" style="font-weight: 800; font-size: 10.5px; padding: 2px 7px;">ACTIVE</span>';

      // Format missing cells as Blank / N/A
      const idDisplay = (r.id && r.id !== 'N/A')
        ? `<span style="font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; color: var(--primary);">${r.id}</span>`
        : `<span style="color: var(--text-dim); font-style: italic; font-size: 11px;">Blank / N/A</span>`;

      const nameDisplay = (r.name && r.name !== 'N/A')
        ? `<strong style="color: var(--text-main);">${r.name}</strong>`
        : `<span style="color: var(--text-dim); font-style: italic; font-weight: 600;">Blank / N/A</span>`;

      const roleDisplay = `<span class="badge badge-info" style="font-size: 10px; font-weight: 700; text-transform: uppercase;">${r.role || 'N/A'}</span>`;

      const purokDisplay = (r.purok && r.purok !== 'N/A' && r.purok !== '-')
        ? `<span style="font-size: 11.5px; color: var(--text-main);">${r.purok}</span>`
        : `<span style="color: var(--text-dim); font-style: italic;">N/A</span>`;

      const muniDisplay = (r.municipality && r.municipality !== 'N/A')
        ? `<strong style="font-size: 11.5px; color: var(--text-main);">${r.municipality}</strong>`
        : `<span style="color: var(--text-dim); font-style: italic;">N/A</span>`;

      const boothDisplay = (r.booth && r.booth !== 'N/A' && r.booth !== '-')
        ? `<code style="font-weight: 700; font-size: 11.5px; color: var(--primary);">${r.booth}</code>`
        : `<span style="color: var(--text-dim); font-style: italic;">N/A</span>`;

      const coordDisplay = (r.lat !== null && r.lng !== null) 
        ? `<span style="font-family: var(--font-mono); font-size: 11px;">${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}</span>` 
        : (r.rawCoordinates ? `<span style="color:var(--warning); font-size: 11px;">${r.rawCoordinates}</span>` : `<span style="color: var(--text-dim); font-style: italic;">N/A</span>`);

      const phoneDisplay = (r.phone && r.phone !== 'N/A' && r.phone !== '-')
        ? `<span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted);">${r.phone}</span>`
        : `<span style="color: var(--text-dim); font-style: italic;">N/A</span>`;

      const posDisplay = (r.posSerial && r.posSerial !== 'N/A' && r.posSerial !== '-')
        ? `<span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted);">${r.posSerial}</span>`
        : `<span style="color: var(--text-dim); font-style: italic;">N/A</span>`;

      tr.innerHTML = `
        <td style="text-align: center;">${badgeHtml}</td>
        <td>${idDisplay}</td>
        <td>${nameDisplay}</td>
        <td>${roleDisplay}</td>
        <td style="text-align: center;">${statusBadge}</td>
        <td>${purokDisplay}</td>
        <td>${muniDisplay}</td>
        <td>${boothDisplay}</td>
        <td>${coordDisplay}</td>
        <td>${phoneDisplay}</td>
        <td>${posDisplay}</td>
        <td style="font-size: 11px; color: ${r.action === 'ERROR' ? 'var(--danger)' : r.action === 'UPDATE' ? '#60a5fa' : isInactive ? '#fbbf24' : 'var(--text-muted)'}; line-height: 1.4;">
          ${r.notes}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 8. Close Preview Modal
  window.closeExcelPreviewModal = function () {
    const modal = document.getElementById('modal-excel-preview');
    if (modal) modal.classList.remove('active');
    const input = document.getElementById('excel-file-input');
    if (input) input.value = '';
  };

  // 9. Open Confirmation Modal
  window.openExcelConfirmModal = function () {
    const actionable = currentImportData.summary.newCount + currentImportData.summary.updateCount;
    if (actionable === 0 && currentImportData.summary.unchangedCount === 0) {
      alert('There are no records to synchronize.');
      return;
    }
    const confirmModal = document.getElementById('modal-excel-confirm');
    if (confirmModal) {
      confirmModal.classList.add('active');
    }
  };

  window.closeExcelConfirmModal = function () {
    const confirmModal = document.getElementById('modal-excel-confirm');
    if (confirmModal) confirmModal.classList.remove('active');
  };

  // 10. Execute Synchronization (ADD + UPDATE, NEVER REPLACE ALL)
  window.confirmExecuteExcelSync = function () {
    window.closeExcelConfirmModal();
    window.closeExcelPreviewModal();

    const store = window.appStore;
    if (!store) {
      alert('Error: Data store is unavailable.');
      return;
    }

    const newRecords = currentImportData.comparisonResults.filter(r => r.action === 'NEW');
    const updateRecords = currentImportData.comparisonResults.filter(r => r.action === 'UPDATE');

    // Create safety snapshot before synchronizing Excel records
    if (window.productionSuite && typeof window.productionSuite.createSnapshot === 'function') {
      window.productionSuite.createSnapshot(`Pre-Import: ${currentImportData.fileName || 'Excel File'}`);
    }

    // Execute Store Synchronization
    const syncRes = store.syncEmployeesFromExcel({
      newRecords,
      updateRecords,
      summary: {
        totalRecords: currentImportData.summary.total,
        unchanged: currentImportData.summary.unchangedCount,
        duplicates: currentImportData.summary.duplicateCount,
        invalid: currentImportData.summary.invalidCount
      },
      fileName: currentImportData.fileName,
      user: 'Peter John Carrillo'
    });

    if (syncRes && syncRes.success) {
      if (window.sfx) window.sfx.playChime();

      // Display Result Modal
      showImportResultModal(syncRes);

      // Refresh Master Registry Table & Category Counts
      if (typeof window.renderEmployeesTable === 'function') {
        window.renderEmployeesTable();
      }

      // Refresh Sidebar Badges
      if (typeof window.updateSidebarBadges === 'function') {
        window.updateSidebarBadges();
      }

      // Refresh Property Dropdowns
      if (typeof window.populatePropertyDropdowns === 'function') {
        window.populatePropertyDropdowns();
      }

      // Refresh Dashboard
      if (typeof window.renderDashboard === 'function') {
        window.renderDashboard();
      }

      // Refresh GIS Map Pins with force cache invalidation
      if (window.etsMap && typeof window.etsMap.renderAllMarkers === 'function') {
        window.etsMap.renderAllMarkers(true);
      }
      if (typeof window.renderFleetTrackingList === 'function') {
        window.renderFleetTrackingList();
      }
    }
  };

  // 11. Show Import Result Modal
  function showImportResultModal(syncRes) {
    const modal = document.getElementById('modal-excel-result');
    if (!modal) return;

    document.getElementById('res-count-new').textContent = syncRes.added;
    document.getElementById('res-count-update').textContent = syncRes.updated;
    document.getElementById('res-count-unchanged').textContent = syncRes.unchanged;
    document.getElementById('res-count-issues').textContent = syncRes.issues;

    modal.classList.add('active');
  }

  window.closeExcelResultModal = function () {
    const modal = document.getElementById('modal-excel-result');
    if (modal) modal.classList.remove('active');
  };

  window.viewMasterRegistryFromResult = function () {
    window.closeExcelResultModal();
    if (typeof window.switchView === 'function') {
      window.switchView('view-employees');
    }
  };

  // 12. Import History Modal
  window.openImportHistoryModal = function () {
    const modal = document.getElementById('modal-excel-history');
    if (!modal) return;

    const tbody = document.getElementById('excel-history-tbody');
    if (tbody && window.appStore) {
      tbody.innerHTML = '';
      const history = window.appStore.getImportHistory();

      if (!history || history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">No import history records found.</td></tr>`;
      } else {
        history.forEach(h => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-size: 12.5px; font-weight: 600; color: var(--text-main);">${h.dateTime}</td>
            <td style="font-size: 12.5px; font-weight: 700; color: var(--primary);"><span style="margin-right: 4px;">📊</span>${h.fileName}</td>
            <td style="font-size: 12px; color: var(--text-muted);">${h.user || 'Peter John Carrillo'}</td>
            <td style="text-align: right; font-weight: 700;">${h.totalRecords}</td>
            <td style="text-align: right; font-weight: 700; color: var(--success);">+${h.added}</td>
            <td style="text-align: right; font-weight: 700; color: #60a5fa;">${h.updated}</td>
            <td style="text-align: right; font-weight: 700; color: ${h.issues > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${h.issues}</td>
            <td style="text-align: center;"><span class="badge badge-success" style="font-size: 11px; padding: 2px 8px;">${h.status || 'Completed'}</span></td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    modal.classList.add('active');
  };

  window.closeImportHistoryModal = function () {
    const modal = document.getElementById('modal-excel-history');
    if (modal) modal.classList.remove('active');
  };

  // 13. Download Master Registry 7-Sheet Official Excel Template
  window.downloadMasterRegistryTemplate = function () {
    if (typeof XLSX === 'undefined') {
      alert('Template generator is loading, please try again in a second.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    const sampleDataBySheet = {
      'DDN 01 TAGUM': [
        {
          "SALES REPRESENTATIVE": "Elvie Oñez",
          "BARANGAY": "Magdum",
          "PUROK": "Merville Subdivision",
          "ID NO.": "DDN005-SR760",
          "SALES COORDINATOR": "Rodolfo B. Tan",
          "ID NO. (Coord)": "DDN005-SC001",
          "STATUS": "Active",
          "SR CONTACT #": "0917-760-0001",
          "BOOTH CODE": "DDN-760",
          "POS NO.": "POS-DDN-760",
          "COORDINATES": "7.447500, 125.807800"
        },
        {
          "SALES REPRESENTATIVE": "Analyn Lucida",
          "BARANGAY": "Pagsabangan",
          "PUROK": "Near Cemetery",
          "ID NO.": "DDN005-SR766",
          "SALES COORDINATOR": "Rodolfo B. Tan",
          "ID NO. (Coord)": "DDN005-SC001",
          "STATUS": "Active",
          "SR CONTACT #": "0917-766-0002",
          "BOOTH CODE": "DDN-766",
          "POS NO.": "POS-DDN-766",
          "COORDINATES": "7.448500, 125.809200"
        }
      ],
      'DDN 02 PANABO': [
        {
          "SALES REPRESENTATIVE": "Liza Calibud",
          "BARANGAY": "Gredu",
          "PUROK": "Crystal Plain",
          "ID NO.": "DDN005-SR398",
          "SALES COORDINATOR": "John Paul Santos",
          "ID NO. (Coord)": "DDN005-SC002",
          "STATUS": "Active",
          "SR CONTACT #": "0917-398-0003",
          "BOOTH CODE": "DDN-398",
          "POS NO.": "POS-DDN-398",
          "COORDINATES": "7.307800, 125.683300"
        }
      ],
      'DDN 03 CARMEN': [
        {
          "SALES REPRESENTATIVE": "Maria Fe N. Gomez",
          "BARANGAY": "Carmen",
          "PUROK": "Near Carmen Market",
          "ID NO.": "DDN005-SR397",
          "SALES COORDINATOR": "Fredlie Mahinay",
          "ID NO. (Coord)": "DDN005-SC003",
          "STATUS": "Active",
          "SR CONTACT #": "0917-397-0004",
          "BOOTH CODE": "DDN-397",
          "POS NO.": "POS-DDN-397",
          "COORDINATES": "7.358600, 125.706100"
        }
      ],
      'DDN 04 STO. TOMAS': [
        {
          "SALES REPRESENTATIVE": "Jehramea Marte",
          "BARANGAY": "Salvacion",
          "PUROK": "Near Baranggay Hall",
          "ID NO.": "DDN005-SR352",
          "SALES COORDINATOR": "Jason Pacana",
          "ID NO. (Coord)": "DDN005-SC004",
          "STATUS": "Active",
          "SR CONTACT #": "0917-888-3352",
          "BOOTH CODE": "DDN-352",
          "POS NO.": "POS-DDN-352",
          "COORDINATES": "7.523500, 125.624100"
        }
      ],
      'DDN 05 TALAINGOD': [
        {
          "SALES REPRESENTATIVE": "Marjorie Andil",
          "BARANGAY": "Sto. Nino Talaingod",
          "PUROK": "Purok 4B Saw Mill",
          "ID NO.": "DDN005-SR1424",
          "SALES COORDINATOR": "Jason Pacana",
          "ID NO. (Coord)": "DDN005-SC004",
          "STATUS": "Active",
          "SR CONTACT #": "0917-424-0005",
          "BOOTH CODE": "DDN-1424",
          "POS NO.": "POS-DDN-1424",
          "COORDINATES": "7.653600, 125.641700"
        }
      ],
      'DDN 06 KAPALONG': [
        {
          "SALES REPRESENTATIVE": "Annabelle Semblante",
          "BARANGAY": "Capungagan",
          "PUROK": "Central Purok",
          "ID NO.": "DDN005-SR1523",
          "SALES COORDINATOR": "Muhlen Carillo",
          "ID NO. (Coord)": "DDN005-SC005",
          "STATUS": "Active",
          "SR CONTACT #": "0917-523-0006",
          "BOOTH CODE": "DDN-1523",
          "POS NO.": "POS-DDN-1523",
          "COORDINATES": "7.585500, 125.707200"
        }
      ],
      'DDN 10 SAMAL': [
        {
          "SALES REPRESENTATIVE": "Kirsten Joy Alcantara",
          "BARANGAY": "Babak",
          "PUROK": "Purok Bougainvillea",
          "ID NO.": "DDN005-SR2001",
          "SALES COORDINATOR": "Muhlen Carillo",
          "ID NO. (Coord)": "DDN005-SC005",
          "STATUS": "Active",
          "SR CONTACT #": "0919-200-1001",
          "BOOTH CODE": "DDN-2001",
          "POS NO.": "POS-DDN-2001",
          "COORDINATES": "7.073600, 125.712800"
        },
        {
          "SALES REPRESENTATIVE": "Darwin Dave Morales",
          "BARANGAY": "Peñaplata",
          "PUROK": "Purok 2 Seaside",
          "ID NO.": "DDN005-SR2002",
          "SALES COORDINATOR": "Muhlen Carillo",
          "ID NO. (Coord)": "DDN005-SC005",
          "STATUS": "Active",
          "SR CONTACT #": "0919-200-1002",
          "BOOTH CODE": "DDN-2002",
          "POS NO.": "POS-DDN-2002",
          "COORDINATES": "7.085000, 125.719000"
        }
      ]
    };

    // Build each sheet with identical headers
    TARGET_SHEETS.forEach(t => {
      const rows = sampleDataBySheet[t.sheetName] || [];
      const aoa = [
        [
          "SALES REPRESENTATIVE",
          "BARANGAY",
          "PUROK",
          "ID NO.",
          "SALES COORDINATOR",
          "ID NO.",
          "STATUS",
          "SR CONTACT #",
          "BOOTH CODE",
          "POS NO.",
          "COORDINATES"
        ]
      ];

      rows.forEach(r => {
        aoa.push([
          r["SALES REPRESENTATIVE"],
          r["BARANGAY"],
          r["PUROK"],
          r["ID NO."],
          r["SALES COORDINATOR"],
          r["ID NO. (Coord)"] || "DDN005-SC001",
          r["STATUS"],
          r["SR CONTACT #"],
          r["BOOTH CODE"],
          r["POS NO."],
          r["COORDINATES"]
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 25 }, // SALES REPRESENTATIVE
        { wch: 20 }, // BARANGAY
        { wch: 24 }, // PUROK
        { wch: 16 }, // ID NO. (Sales Rep)
        { wch: 22 }, // SALES COORDINATOR
        { wch: 16 }, // ID NO. (Sales Coordinator)
        { wch: 12 }, // STATUS
        { wch: 18 }, // SR CONTACT #
        { wch: 14 }, // BOOTH CODE
        { wch: 16 }, // POS NO.
        { wch: 24 }  // COORDINATES
      ];

      XLSX.utils.book_append_sheet(workbook, ws, t.sheetName);
    });

    XLSX.writeFile(workbook, "NORTH005_Master_Registry_7Sheets.xlsx");
  };

  // Initialize dropzone events
  function initDropzone() {
    const dropzone = document.getElementById('excel-drop-zone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'rgba(59, 130, 246, 0.12)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        dropzone.style.background = 'rgba(15, 23, 42, 0.6)';
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt && dt.files;
      if (files && files.length > 0) {
        window.processUploadedExcelFile(files[0]);
      }
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropzone);
  } else {
    setTimeout(initDropzone, 100);
  }

})();
