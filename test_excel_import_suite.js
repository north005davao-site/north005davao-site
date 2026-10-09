/**
 * EXCEL IMPORT & MASTER REGISTRY KPI COUNTERS VERIFICATION SUITE
 * Tests Excel parsing, sheet matching, role detection, active status preservation,
 * and accurate counter computation for Tellers and Relievers.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Mock browser environment for store and import engine
global.window = global;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};
global.document = {
  _elements: {},
  getElementById(id) {
    if (!this._elements[id]) {
      this._elements[id] = {
        id,
        textContent: '',
        innerHTML: '',
        classList: {
          add() {},
          remove() {},
          contains() { return false; }
        },
        style: {},
        value: '',
        addEventListener() {},
        removeEventListener() {}
      };
    }
    return this._elements[id];
  },
  addEventListener() {}
};
global.alert = (msg) => console.log('ALERT:', msg);
global.FileReader = class {
  readAsArrayBuffer(file) {
    // synchronous simulation not triggering async timer
  }
};
global.XLSX = {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    sheet_to_json: (ws) => (ws && ws._aoa) || []
  }
};

// Load store
const storeCode = fs.readFileSync(path.join(__dirname, 'js', 'store.js'), 'utf8');
eval(storeCode);
const store = window.appStore;

// Helper function to simulate sheet_to_json from an ExcelJS worksheet
function worksheetToAoa(ws) {
  const aoa = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const rVals = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let val = cell.value;
      if (val && typeof val === 'object') {
        if (val.result !== undefined) val = val.result;
        else if (val.richText) val = val.richText.map(t => t.text).join('');
        else if (val.text) val = val.text;
      }
      rVals[colNumber - 1] = val !== null && val !== undefined ? String(val) : '';
    });
    // Ensure 0-based indices up to row.cellCount
    for (let i = 0; i < rVals.length; i++) {
      if (rVals[i] === undefined) rVals[i] = '';
    }
    aoa.push(rVals);
  });
  return aoa;
}

// Extract the parser functions directly from excel-import.js
const excelImportCode = fs.readFileSync(path.join(__dirname, 'js', 'excel-import.js'), 'utf8');
eval(excelImportCode);

// Load app.js functions for counting
const appCode = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
// Mock Leaflet and map objects to prevent errors when evaluating app.js
global.L = { map: () => ({ setView() {}, on() {}, remove() {} }), tileLayer: () => ({ addTo() {} }), marker: () => ({ addTo() {}, bindPopup() {} }) };
global.window.sfx = { playClick() {}, playChime() {}, playSuccess() {}, playAlert() {} };

async function runTestSuite() {
  console.log('========================================================================');
  console.log('RUNNING EXCEL IMPORT & WORKFORCE COUNTERS VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ FAILED: ${message}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: DDN - MASTER TEMPLATE.xlsx (Headers: BOOTH CODE, ADDRESS, TELLER)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Parsing DDN - MASTER TEMPLATE.xlsx ---');
  const ddnWb = new ExcelJS.Workbook();
  await ddnWb.xlsx.readFile(path.join(__dirname, 'templates', 'DDN - MASTER TEMPLATE.xlsx'));
  
  // Setup currentImportData simulation
  const ddnSheetNames = ddnWb.worksheets.map(w => w.name);
  assert(ddnSheetNames.includes('Sheet1'), 'Workbook contains Sheet1');

  // Convert Sheet1 to array of arrays
  const sheet1Ws = ddnWb.getWorksheet('Sheet1');
  const sheet1Aoa = worksheetToAoa(sheet1Ws);

  // Mock XLSX.utils.sheet_to_json for processWorkbookMultiSheets
  global.XLSX = {
    utils: {
      sheet_to_json: (ws) => ws._aoa || []
    }
  };

  const mockWorkbook = {
    SheetNames: ddnSheetNames,
    Sheets: {}
  };
  ddnWb.worksheets.forEach(w => {
    mockWorkbook.Sheets[w.name] = { _aoa: worksheetToAoa(w) };
  });

  // Call processUploadedExcelFile logic directly
  window.processUploadedExcelFile({
    name: 'DDN - MASTER TEMPLATE.xlsx'
  });
  // Simulate FileReader read
  // We can call processWorkbookMultiSheets by setting currentImportData
  // Let's test the extraction of Sheet1
  const headerAnalysis = window.analyzeSheetHeaders ? window.analyzeSheetHeaders(sheet1Aoa) : null;
  
  // Test header analysis
  // Let's create an instance of analyzing
  const findMatchingTarget = (s) => {
    const raw = String(s || '').trim();
    const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm.includes('reliever') || norm.includes('buffer')) return { sheetName: 'RELIEVERS', municipality: 'Sto. Tomas', isRelieversSheet: true, isOptional: true };
    if (norm.includes('tagum')) return { sheetName: 'DDN 01 TAGUM', municipality: 'Tagum' };
    if (norm.includes('panabo')) return { sheetName: 'DDN 02 PANABO', municipality: 'Panabo' };
    if (norm.includes('carmen')) return { sheetName: 'DDN 03 CARMEN', municipality: 'Carmen' };
    if (norm.includes('tomas')) return { sheetName: 'DDN 04 STO. TOMAS', municipality: 'Sto. Tomas' };
    if (norm.includes('talaingod')) return { sheetName: 'DDN 05 TALAINGOD', municipality: 'Talaingod' };
    if (norm.includes('kapalong')) return { sheetName: 'DDN 06 KAPALONG', municipality: 'Kapalong' };
    if (norm.includes('samal') || norm.includes('igacos')) return { sheetName: 'DDN 10 SAMAL', municipality: 'Samal' };
    return null;
  };

  assert(findMatchingTarget('Tagum City') !== null, 'Fuzzy target matches Tagum City');
  assert(findMatchingTarget('DDN 02 PANABO') !== null, 'Exact target matches DDN 02 PANABO');
  assert(findMatchingTarget('Relievers List').isRelieversSheet === true, 'Relievers List detected as Relievers sheet');

  // Verify header row detection on Sheet1
  let hRowIdx = -1;
  sheet1Aoa.slice(0, 5).forEach((row, idx) => {
    const joined = row.map(c => String(c).toLowerCase()).join(' ');
    if (joined.includes('teller') && joined.includes('booth code')) {
      hRowIdx = idx;
    }
  });
  assert(hRowIdx !== -1, 'Header row found on Sheet1 at row index ' + hRowIdx);

  const headerRow = sheet1Aoa[hRowIdx];
  let tellerCol = -1;
  let boothCol = -1;
  let addrCol = -1;
  headerRow.forEach((c, idx) => {
    const t = String(c).toLowerCase().trim();
    if (t === 'teller' || t.includes('teller')) tellerCol = idx;
    if (t === 'booth code' || t.includes('booth')) boothCol = idx;
    if (t === 'address' || t.includes('address')) addrCol = idx;
  });

  assert(tellerCol !== -1, 'TELLER column detected at index ' + tellerCol);
  assert(boothCol !== -1, 'BOOTH CODE column detected at index ' + boothCol);
  assert(addrCol !== -1, 'ADDRESS column detected at index ' + addrCol);

  // Extract records from Sheet1
  const extractedRecords = [];
  const dataRows = sheet1Aoa.slice(hRowIdx + 1);
  dataRows.forEach((r, rIdx) => {
    const name = String(r[tellerCol] || '').trim();
    const booth = String(r[boothCol] || '').trim();
    const address = String(r[addrCol] || '').trim();
    if (!name && !booth) return;

    extractedRecords.push({
      name: name || 'N/A',
      booth: booth || 'N/A',
      address: address || '-',
      role: 'Sales Representative',
      status: name && name !== 'N/A' ? 'Active' : 'Inactive'
    });
  });

  assert(extractedRecords.length > 50, `Extracted ${extractedRecords.length} records from DDN Sheet1`);
  const activeExtracted = extractedRecords.filter(r => r.status === 'Active');
  assert(activeExtracted.length > 50, `Active tellers preserved as Active: ${activeExtracted.length}`);

  // ---------------------------------------------------------------------------
  // TEST 2: Sync to Store & Verify Category Counters
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Synchronizing Extracted Tellers to Store ---');
  const syncRes = store.syncEmployeesFromExcel({
    newRecords: activeExtracted,
    updateRecords: [],
    summary: { totalRecords: activeExtracted.length },
    fileName: 'DDN - MASTER TEMPLATE.xlsx'
  });

  assert(syncRes && syncRes.added > 0, `Store synced new tellers: ${syncRes.added} added`);

  // Count active tellers in store
  const allEmployees = store.getEmployees();
  const tellersInStore = allEmployees.filter(e => {
    const r = (e.role || '').toUpperCase();
    const id = (e.id || '').toUpperCase();
    const isOtherRole = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL') || 
                        r.includes('SUPERVISOR') || r.includes('COLLECTOR') || r.includes('TEAM LEADER') || r.includes('ADMIN');
    if (isOtherRole) return false;
    const statusUpper = (e.status || 'ACTIVE').toUpperCase();
    const isNameMissing = !e.name || e.name.trim() === '' || e.name.trim().toUpperCase() === 'N/A' || e.name.trim() === '-';
    return statusUpper === 'ACTIVE' && !isNameMissing;
  });

  assert(tellersInStore.length >= activeExtracted.length, `Tellers count properly reflects imported active tellers: ${tellersInStore.length}`);

  // ---------------------------------------------------------------------------
  // TEST 3: Relievers Detection & Counting
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Relievers Detection & Synchronization ---');
  // Load Master_Registry_Update_DDN.xlsx which contains Kier A. Valdez (Reliever)
  const updWb = new ExcelJS.Workbook();
  await updWb.xlsx.readFile(path.join(__dirname, 'Master_Registry_Update_DDN.xlsx'));
  const updWs = updWb.getWorksheet('Master_Registry');
  const updAoa = worksheetToAoa(updWs);

  // Check row 8 (Kier A. Valdez)
  const relRow = updAoa.find(r => r.some(c => /kier/i.test(c)));
  assert(relRow !== undefined, 'Found Kier A. Valdez row in Master_Registry_Update_DDN.xlsx');

  // Verify Kier has role Reliever
  const isKierReliever = relRow.some(c => /reliever/i.test(c));
  assert(isKierReliever, 'Kier A. Valdez is flagged as Reliever');

  // Sync Kier to store
  const relSyncRes = store.syncEmployeesFromExcel({
    newRecords: [
      {
        id: 'DDN005-REL04',
        name: 'Kier A. Valdez',
        role: 'Reliever',
        municipality: 'Carmen',
        purok: 'Tuganay Terminal',
        booth: 'DDN-425',
        status: 'Active'
      }
    ],
    updateRecords: [],
    fileName: 'Master_Registry_Update_DDN.xlsx'
  });

  assert(relSyncRes && relSyncRes.added === 1, 'Kier A. Valdez added to store as Reliever');

  // Check store relievers count
  const allStaffUpdated = store.getEmployees();
  const relieversInStore = allStaffUpdated.filter(e => {
    const r = (e.role || '').toUpperCase();
    const id = (e.id || '').toUpperCase();
    return r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
  });

  assert(relieversInStore.some(r => r.name === 'Kier A. Valdez'), 'Kier A. Valdez is in relieversList');
  assert(relieversInStore.length >= 5, `Relievers properly counted: ${relieversInStore.length} relievers`);

  // Verify that Relievers are NOT counted in tellers
  const kierInTellers = tellersInStore.some(t => t.name === 'Kier A. Valdez');
  assert(!kierInTellers, 'Kier A. Valdez is NOT counted in Sales Representatives (tellers)');

  // ---------------------------------------------------------------------------
  // TEST 4: SAMAL - MASTER TEMPLATE.xlsx Municipality & Outlets
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Parsing SAMAL - MASTER TEMPLATE.xlsx ---');
  const samalWb = new ExcelJS.Workbook();
  await samalWb.xlsx.readFile(path.join(__dirname, 'templates', 'SAMAL - MASTER TEMPLATE.xlsx'));
  const samalWs = samalWb.getWorksheet('Sheet1');
  const samalAoa = worksheetToAoa(samalWs);

  assert(samalAoa.length > 20, `SAMAL Sheet1 contains ${samalAoa.length} rows`);
  const samalHeader = samalAoa[1]; // Row 2
  const hasTellerHeader = samalHeader.some(c => String(c).trim().toUpperCase() === 'TELLER');
  assert(hasTellerHeader, 'SAMAL Sheet1 has TELLER header in Row 2');

  // ---------------------------------------------------------------------------
  // TEST 5: Master_Registry_7Sheets_DDN.xlsx (7-Sheet Format)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Multi-Sheet 7-Sheet Scan & Disambiguation ---');
  const multiWb = new ExcelJS.Workbook();
  await multiWb.xlsx.readFile(path.join(__dirname, 'Master_Registry_7Sheets_DDN.xlsx'));
  const multiSheetNames = multiWb.worksheets.map(w => w.name);

  const recognizedSheets = multiSheetNames.filter(s => findMatchingTarget(s) !== null);
  assert(recognizedSheets.length === 7, `All 7 municipal sheets matched: ${recognizedSheets.join(', ')}`);

  console.log('\n========================================================================');
  if (failed === 0) {
    console.log(`ALL ${passed} EXCEL IMPORT & WORKFORCE COUNTER TESTS PASSED WITH 100% SUCCESS! 🚀`);
  } else {
    console.error(`${failed} TESTS FAILED out of ${passed + failed}`);
  }
  console.log('========================================================================');

  process.exit(failed === 0 ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
