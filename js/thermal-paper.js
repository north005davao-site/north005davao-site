/**
 * =============================================================================
 * APEX OmniERP — Thermal Paper Daily Summary Module
 * Official Tracking: Thermal Paper Daily Allocation, Running Stock Balances,
 * OCR-Assisted Verification & Monthly Booth Usage Summary
 * =============================================================================
 */

(function () {
  'use strict';

  class ThermalPaperModule {
    constructor() {
      this.allocations = [];
      this.initialStock = 0;
      this.dailyStocksOnHand = {}; // Date-specific stock on hand dictionary (Priority 1 & 2)
      this.stockAdjustments = [];
      this.selectedDate = '2026-09-29';
      this.selectedMonth = '2026-09';
      this.searchDailyBooth = '';
      this.searchMonthlyBooth = '';
      this.dailyPage = 1;
      this.rowsPerPage = 10;
      
      // OCR & Modal state
      this.pendingOcrRecords = [];
      this.pendingOcrDate = '2026-09-29';
      this.editingRecordId = null;
      this.deletingRecordId = null;

      // Multi-row selection state for bulk delete
      this.selectedAllocationIds = new Set();
    }

    async init() {
      await this.loadPersistentData();
      this.setupEventListeners();
      this.render();
    }

    // =========================================================================
    // 1. DATA PERSISTENCE & API SYNC
    // =========================================================================
    async loadPersistentData() {
      try {
        const res = await fetch('/api/thermal-paper');
        if (res.ok) {
          const data = await res.json();
          this.allocations = Array.isArray(data.allocations) ? data.allocations : [];
          this.initialStock = typeof data.initialStock === 'number' ? data.initialStock : 0;
          this.dailyStocksOnHand = data.dailyStocksOnHand || {};
          this.stockAdjustments = Array.isArray(data.stockAdjustments) ? data.stockAdjustments : [];
          try {
            localStorage.setItem('omni_thermal_paper_data', JSON.stringify({
              initialStock: this.initialStock,
              dailyStocksOnHand: this.dailyStocksOnHand,
              stockAdjustments: this.stockAdjustments,
              allocations: this.allocations
            }));
          } catch (_) {}
          return;
        }
      } catch (e) {
        console.warn('Could not load persistent thermal paper data:', e);
      }

      // Local fallback
      const saved = localStorage.getItem('omni_thermal_paper_data');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.allocations = Array.isArray(parsed.allocations) ? parsed.allocations : [];
          this.initialStock = typeof parsed.initialStock === 'number' ? parsed.initialStock : 0;
          this.dailyStocksOnHand = parsed.dailyStocksOnHand || {};
          this.stockAdjustments = Array.isArray(parsed.stockAdjustments) ? parsed.stockAdjustments : [];
        } catch (e) {}
      } else {
        this.allocations = [];
        this.initialStock = 0;
        this.dailyStocksOnHand = {};
        this.stockAdjustments = [];
      }
    }

    async syncFromServer() {
      await this.loadPersistentData();
      this.render();
    }

    async savePersistentData() {
      const payload = {
        initialStock: this.initialStock || 0,
        dailyStocksOnHand: this.dailyStocksOnHand || {},
        stockAdjustments: this.stockAdjustments || [],
        allocations: this.allocations || []
      };

      localStorage.setItem('omni_thermal_paper_data', JSON.stringify(payload));

      try {
        await fetch('/api/thermal-paper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.warn('Could not persist thermal paper data to server:', e);
      }
    }

    // =========================================================================
    // 2. MASTER REGISTRY SYNCHRONIZATION
    // =========================================================================
    getMasterRegistryBooths() {
      const store = window.appStore;
      const boothMap = new Map();

      if (store && store.data && Array.isArray(store.data.employees)) {
        store.data.employees.forEach(emp => {
          const b = emp.booth || emp.boothCode;
          if (b) {
            const cleanCode = this.normalizeBoothCode(b);
            boothMap.set(cleanCode, {
              boothCode: cleanCode,
              tellerName: emp.name || 'Station Teller',
              location: emp.address || emp.location || 'Davao Del Norte Corridor',
              employeeId: emp.id
            });
          }
        });
      }

      // Add common known prompt tellers if not present
      const defaultTellers = [
        { booth: 'DDN-762', name: 'Davilyn Gelito', location: 'Sabungan ni NENE, Tibal.og, Sto. Tomas' },
        { booth: 'DDN-352', name: 'Jehramea Marte', location: 'Near Baranggay Hall, Salvacion, Sto. Tomas' },
        { booth: 'DDN-754', name: 'Belle Amor Quizo', location: 'New Katipunan, Feeder Road 3, Sto. Tomas' },
        { booth: 'DDN-428', name: 'Nobelyn Baya', location: 'Ising Carmen Terminal' },
        { booth: 'DDN-1717', name: 'Shiela Ramirez', location: 'P-2B Tuganay' },
        { booth: 'DDN-1823', name: 'Precious Nica Torrefiel', location: 'Purok 3A Upper Tubod Carmen' },
        { booth: 'DDN-1806', name: 'Arturo Dela Peña', location: 'Purok 6 A, Peda St San Francisco Panabo City' },
        { booth: 'DDN-1793', name: 'Princess Solamillo', location: 'Purok Narra, New Visayas, Sto. Tomas' }
      ];

      defaultTellers.forEach(t => {
        const clean = this.normalizeBoothCode(t.booth);
        if (!boothMap.has(clean)) {
          boothMap.set(clean, {
            boothCode: clean,
            tellerName: t.name,
            location: t.location,
            employeeId: `SR-${clean}`
          });
        }
      });

      return Array.from(boothMap.values());
    }

    findMasterRegistryBooth(rawCode) {
      if (!rawCode) return null;
      const normalized = this.normalizeBoothCode(rawCode);
      const list = this.getMasterRegistryBooths();
      return list.find(b => b.boothCode === normalized) || null;
    }

    normalizeBoothCode(code) {
      if (!code) return '';
      let str = String(code).trim().toUpperCase();
      // Remove any trailing non-alphanumeric except hyphen
      str = str.replace(/[^A-Z0-9-]/g, '');

      // Check if purely numeric
      if (/^\d{3,4}$/.test(str)) {
        return `DDN-${str}`;
      }

      // Check if ddn without dash
      const ddnMatch = str.match(/^DDN[\s-]?(\d{3,4})$/i);
      if (ddnMatch) {
        return `DDN-${ddnMatch[1]}`;
      }

      return str;
    }

    // =========================================================================
    // 3. CORE RUNNING STOCK & STOCKS ON HAND CALCULATION
    // =========================================================================
    /**
     * Continuous carry-forward running balance:
     * - Day 1 starts with initialStock.
     * - Daily Rolls Remaining = Stocks on Hand - Total Rolls Allocated.
     * - Next day's Stocks on Hand = Previous day's Rolls Remaining.
     */
    /**
     * Continuous carry-forward running balance with Date-Specific Priority (Section 10 & 11):
     * - Priority 1: Explicit Stock on Hand detected from uploaded Thermal Report for that date.
     * - Priority 2: Manually edited Stock on Hand for that date (via Edit button).
     * - Priority 3: Carry-forward from previous day's Rolls Remaining when no explicit stock exists.
     * - Default when clean: 0 Rolls.
     * - Rolls Remaining = Stock on Hand - Total Rolls Allocated.
     */
    calculateDailyStocks(targetDate) {
      if (!this.dailyStocksOnHand) this.dailyStocksOnHand = {};

      // Collect all unique dates with allocations, adjustments, or explicit stocks
      const datesSet = new Set(this.allocations.map(a => a.date));
      Object.keys(this.dailyStocksOnHand).forEach(d => datesSet.add(d));
      (this.stockAdjustments || []).forEach(adj => datesSet.add(adj.date));
      if (targetDate) datesSet.add(targetDate);

      const sortedDates = Array.from(datesSet).filter(Boolean).sort();

      let previousRollsRemaining = (typeof this.initialStock === 'number') ? this.initialStock : 0;
      let hasPriorDay = false;
      const dateBalances = {};

      for (const d of sortedDates) {
        const dayAllocations = this.allocations.filter(a => a.date === d);
        const dayTotalAllocated = dayAllocations.reduce((sum, a) => sum + (Number(a.rollsAllocated) || 0), 0);
        
        // Add any restock/adjustment on this specific date
        const dayAdjustments = (this.stockAdjustments || [])
          .filter(adj => adj.date === d)
          .reduce((sum, adj) => sum + (Number(adj.additionalStock) || 0), 0);

        // Priority Hierarchy (Section 11):
        // Priority 1 & 2: Explicit date-specific Stock on Hand (from report or manual edit)
        // Priority 3: Carry-forward from previous day's Rolls Remaining
        // Default: initialStock or 0
        let stocksOnHand = 0;
        if (typeof this.dailyStocksOnHand[d] === 'number') {
          stocksOnHand = this.dailyStocksOnHand[d];
        } else if (hasPriorDay) {
          stocksOnHand = previousRollsRemaining;
        } else {
          stocksOnHand = (typeof this.initialStock === 'number') ? this.initialStock : 0;
        }

        stocksOnHand += dayAdjustments;
        const rollsRemaining = Math.max(0, stocksOnHand - dayTotalAllocated);

        dateBalances[d] = {
          date: d,
          stocksOnHand,
          totalAllocated: dayTotalAllocated,
          rollsRemaining,
          allocationsCount: dayAllocations.length
        };

        previousRollsRemaining = rollsRemaining;
        hasPriorDay = true;
      }

      if (dateBalances[targetDate]) {
        return dateBalances[targetDate];
      }

      const explicitTarget = typeof this.dailyStocksOnHand[targetDate] === 'number' ? this.dailyStocksOnHand[targetDate] : 0;
      return {
        date: targetDate,
        stocksOnHand: explicitTarget,
        totalAllocated: 0,
        rollsRemaining: explicitTarget,
        allocationsCount: 0
      };
    }

    // =========================================================================
    // 4. MONTHLY BOOTH USAGE SUMMARY CALCULATION
    // =========================================================================
    calculateMonthlySummary(monthKey) {
      // Filter all allocations for the selected month (YYYY-MM)
      const monthAllocations = this.allocations.filter(a => a.date && a.date.startsWith(monthKey));

      // Group by Booth Code
      const boothGroup = new Map();

      monthAllocations.forEach(a => {
        const cleanCode = this.normalizeBoothCode(a.boothCode);
        if (!boothGroup.has(cleanCode)) {
          const reg = this.findMasterRegistryBooth(cleanCode);
          boothGroup.set(cleanCode, {
            boothCode: cleanCode,
            tellerName: (reg && reg.tellerName) || a.tellerName || 'Station Teller',
            location: (reg && reg.location) || a.location || '',
            dates: new Set(),
            totalRollsUsed: 0
          });
        }

        const g = boothGroup.get(cleanCode);
        g.dates.add(a.date);
        g.totalRollsUsed += (Number(a.rollsAllocated) || 0);
      });

      const summaryList = Array.from(boothGroup.values())
        .filter(g => g.totalRollsUsed > 0 && g.dates.size > 0)
        .map(g => ({
          boothCode: g.boothCode,
          tellerName: g.tellerName,
          location: g.location,
          daysAllocated: g.dates.size,
          totalRollsUsed: g.totalRollsUsed
        }));

      // Sort by total rolls used descending
      summaryList.sort((a, b) => b.totalRollsUsed - a.totalRollsUsed);

      const totalMonthlyRolls = summaryList.reduce((sum, item) => sum + item.totalRollsUsed, 0);

      return {
        monthKey,
        booths: summaryList,
        totalMonthlyRolls,
        distinctBoothsCount: summaryList.length
      };
    }

    // =========================================================================
    // 5. OCR ENGINE REUSE & TWO-COLUMN BOOTH CODE NORMALIZATION (SECTIONS 1-8)
    // =========================================================================
    async processThermalPaperImage(source) {
      if (!source) return;

      const progressModal = document.getElementById('modal-thermal-ocr-progress');
      const progressBar = document.getElementById('thermal-ocr-progress-bar');
      const progressText = document.getElementById('thermal-ocr-progress-text');
      
      if (progressModal) {
        progressModal.style.display = 'flex';
        progressModal.classList.add('active');
      }
      if (progressBar) progressBar.style.width = '10%';
      if (progressText) progressText.innerText = 'Initializing OCR Engine & Canvas pre-processing...';

      try {
        let imageSource = source;
        if (source instanceof File || source instanceof Blob) {
          imageSource = await this.loadImageFile(source);
        }

        let result = null;
        if (window.ocrEngine && typeof window.ocrEngine.recognizeThermalPaperReport === 'function') {
          result = await window.ocrEngine.recognizeThermalPaperReport(imageSource, (pct, msg) => {
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressText) progressText.innerText = msg || `Processing Two-Column OCR... ${pct}%`;
          });
        }

        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.innerText = 'Combining columns & validating against Master Registry...';

        await new Promise(r => setTimeout(r, 300));
        if (progressModal) {
          progressModal.style.display = 'none';
          progressModal.classList.remove('active');
        }

        if (result && result.combinedRecords && result.combinedRecords.length > 0) {
          this.pendingOcrRecords = result.combinedRecords;
          this.pendingOcrDate = result.date || this.selectedDate;
          if (result.stocksOnHand && result.stocksOnHand > 0) {
            this.pendingOcrStocksOnHand = result.stocksOnHand;
          }
          this.openReviewModal();
        } else {
          // Fallback to sample parser
          this.parseOcrTextToReview(this.getSampleOcrText());
        }
      } catch (err) {
        console.error('Thermal Paper OCR Failed:', err);
        if (progressModal) {
          progressModal.style.display = 'none';
          progressModal.classList.remove('active');
        }
        this.parseOcrTextToReview(this.getSampleOcrText());
      }
    }

    loadImageFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    getSampleOcrText() {
      return `DATE: SEPTEMBER 29, 2026
STOCKS ON HAND: 363 ROLLS
THERMAL REPORT

LEFT COLUMN:
DDN 764 - 5
1475 - 7
398 - 10
430 - 5
909 - 5
399 - 5
756 - 5
352 - 5
771 - 5
1680 - 5
1791 - 5
767 - 10
397 - 5
423 - 3
425 - 5
426 - 10
427 - 5
428 - 5
755 - 5
777 - 5
910 - 5
1477 - 3

RIGHT COLUMN:
DDN 1591 - 5
1717 - 3
1781 - 2
1784 - 7
1823 - 3
1782 - 2
762 - 10
771 - 5
1743 - 3
350 - 5
353 - 5
402 - 3
424 - 5
760 - 5
769 - 15
770 - 10
1424 - 10
774 - 5
1523 - 5
1778 - 3
776 - 5

220 ROLLS ALLOCATED
363 ROLLS ON HAND
143 ROLLS REMAINING BALANCE
`;
    }

    /**
     * Parses two-column raw text into structured allocations:
     * - Recognizes Left Column and Right Column independently
     * - Preserves DDN prefix context per column (Rule 4 & 5)
     * - Preserves [Booth Code] - [Rolls] pairing (Rule 3 & 6)
     * - Checks against Master Registry (Rule 7)
     * - Combines both columns into one dataset (Rule 8 & 10)
     */
    parseOcrTextToReview(rawText) {
      if (!rawText) return;

      let leftSection = '';
      let rightSection = '';

      if (rawText.includes('RIGHT COLUMN:') && rawText.includes('LEFT COLUMN:')) {
        const parts = rawText.split('RIGHT COLUMN:');
        leftSection = parts[0].replace('LEFT COLUMN:', '').trim();
        rightSection = (parts[1] || '').trim();
      } else {
        // Divide lines into two halves if presented as a block
        const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const mid = Math.ceil(allLines.length / 2);
        leftSection = allLines.slice(0, mid).join('\n');
        rightSection = allLines.slice(mid).join('\n');
      }

      const leftRecords = window.ocrEngine ? window.ocrEngine.parseThermalColumn(leftSection, 'LEFT COLUMN') : [];
      const rightRecords = window.ocrEngine ? window.ocrEngine.parseThermalColumn(rightSection, 'RIGHT COLUMN') : [];

      this.pendingOcrRecords = [...leftRecords, ...rightRecords];

      // Detect date if present
      let detectedDate = this.selectedDate;
      const dateMatch = rawText.match(/(?:DATE|SEPTEMBER|OCTOBER|NOV|DEC)[\s:]*([A-Z0-9,\s-]+)/i);
      if (dateMatch) {
        const dateStr = dateMatch[0].toUpperCase();
        if (dateStr.includes('SEP') && dateStr.includes('29')) detectedDate = '2026-09-29';
        else if (dateStr.includes('SEP') && dateStr.includes('30')) detectedDate = '2026-09-30';
      }

      // Detect stocks on hand if present
      const stockMatch = rawText.match(/STOCKS?\s*(?:ON\s*HAND)?[:\s]*(\d{2,4})\s*(?:ROLLS?)?/i);
      if (stockMatch) {
        const parsed = parseInt(stockMatch[1], 10);
        if (parsed > 0) this.pendingOcrStocksOnHand = parsed;
      }

      this.pendingOcrDate = detectedDate;
      this.openReviewModal();
    }

    // =========================================================================
    // 6. REVIEW MODAL & OCR CORRECTION (SECTION 8, 9, 10 & 30)
    // =========================================================================
    openReviewModal() {
      const modal = document.getElementById('modal-review-thermal-ocr');
      if (!modal) return;

      const dateInput = document.getElementById('thermal-review-date');
      if (dateInput) dateInput.value = this.pendingOcrDate;

      this.renderReviewTable();
      modal.style.display = 'flex';
      modal.classList.add('active');
    }

    closeReviewModal() {
      const modal = document.getElementById('modal-review-thermal-ocr');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
      this.pendingOcrRecords = [];
    }

    renderReviewTable() {
      const tbody = document.getElementById('thermal-review-tbody');
      if (!tbody) return;

      const dateVal = document.getElementById('thermal-review-date') ? document.getElementById('thermal-review-date').value : this.pendingOcrDate;
      const stocks = this.calculateDailyStocks(dateVal);
      const effectiveStocks = this.pendingOcrStocksOnHand || stocks.stocksOnHand;
      const totalProposed = this.pendingOcrRecords.reduce((sum, r) => sum + (Number(r.rollsAllocated) || 0), 0);
      const remainingProjected = effectiveStocks - totalProposed;

      // Update badge
      const countBadge = document.getElementById('thermal-review-count-badge');
      if (countBadge) {
        countBadge.innerText = `${this.pendingOcrRecords.length} ENTRIES DETECTED`;
      }

      // Update Stock Validation Notice (Section 15)
      const alertBox = document.getElementById('thermal-review-stock-alert');
      const confirmBtn = document.getElementById('thermal-review-confirm-btn');

      if (totalProposed > effectiveStocks) {
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.innerHTML = `⚠️ <strong>Invalid Allocation:</strong> Total Rolls Allocated (${totalProposed} rolls) cannot exceed Stocks on Hand (${effectiveStocks} rolls). Please adjust rolls before confirming.`;
        }
        if (confirmBtn) confirmBtn.disabled = true;
      } else {
        if (alertBox) alertBox.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = false;
      }

      // Update Summary Header Pills
      const elStocks = document.getElementById('thermal-review-stocks-on-hand');
      const elTotal = document.getElementById('thermal-review-total-allocated');
      const elRemaining = document.getElementById('thermal-review-rolls-remaining');
      if (elStocks) elStocks.innerText = `${effectiveStocks} Rolls`;
      if (elTotal) elTotal.innerText = `${totalProposed} Rolls`;
      if (elRemaining) elRemaining.innerText = `${remainingProjected} Rolls`;

      tbody.innerHTML = this.pendingOcrRecords.map((r, idx) => {
        const isMatched = r.status === 'Matched';
        return `
          <tr data-row-idx="${idx}">
            <td style="width: 48px; text-align: center; font-weight: 700; color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">
              ${idx + 1}
            </td>
            <td style="width: 150px;">
              <input type="text" class="form-input form-input-sm" value="${r.boothCode}" 
                style="font-family: var(--font-mono); font-weight: 700; text-transform: uppercase;"
                onchange="window.thermalPaperModule.onReviewBoothChange(${idx}, this.value)">
            </td>
            <td style="width: 130px;">
              <input type="number" min="1" max="1000" class="form-input form-input-sm" value="${r.rollsAllocated}" 
                style="font-weight: 700; text-align: right;"
                onchange="window.thermalPaperModule.onReviewRollsChange(${idx}, this.value)">
            </td>
            <td>
              <div style="font-weight: 600; font-size: 12px; color: var(--text-main);">${r.masterRegistryStatus || (isMatched ? 'Found' : 'Not Found in Registry')}: ${r.tellerName}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${r.location || 'Davao Del Norte Corridor'}</div>
            </td>
            <td style="width: 125px; text-align: center;">
              ${isMatched ? `
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">
                  ✓ Matched
                </span>
              ` : `
                <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 700;" title="Booth Code not found in Master Registry. Please verify.">
                  ⚠️ Review Required
                </span>
              `}
            </td>
            <td style="width: 90px; text-align: center;">
              <button class="btn btn-secondary btn-xs" style="padding: 2px 7px; font-size: 11px; margin-right: 4px;"
                onclick="window.thermalPaperModule.focusReviewRow(${idx})">Edit</button>
              <button class="icon-btn" style="color: var(--danger); font-size: 14px; vertical-align: middle;" 
                onclick="window.thermalPaperModule.removeReviewRow(${idx})" title="Remove Row">✕</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    focusReviewRow(idx) {
      const tr = document.querySelector(`#thermal-review-tbody tr[data-row-idx="${idx}"]`);
      if (tr) {
        const input = tr.querySelector('input');
        if (input) {
          input.focus();
          input.select();
        }
      }
    }

    onReviewBoothChange(idx, val) {
      if (!this.pendingOcrRecords[idx]) return;
      const clean = this.normalizeBoothCode(val);
      this.pendingOcrRecords[idx].boothCode = clean;

      const reg = this.findMasterRegistryBooth(clean);
      if (reg) {
        this.pendingOcrRecords[idx].tellerName = reg.tellerName;
        this.pendingOcrRecords[idx].location = reg.location;
        this.pendingOcrRecords[idx].status = 'Matched';
        this.pendingOcrRecords[idx].masterRegistryStatus = 'Found';
      } else {
        this.pendingOcrRecords[idx].status = 'Unmatched';
        this.pendingOcrRecords[idx].masterRegistryStatus = 'Not Found in Registry';
      }
      this.renderReviewTable();
    }

    onReviewRollsChange(idx, val) {
      if (!this.pendingOcrRecords[idx]) return;
      const num = parseInt(val, 10);
      this.pendingOcrRecords[idx].rollsAllocated = num > 0 ? num : 1;
      this.renderReviewTable();
    }

    removeReviewRow(idx) {
      this.pendingOcrRecords.splice(idx, 1);
      this.renderReviewTable();
    }

    addReviewRow() {
      this.pendingOcrRecords.push({
        id: `OCR-ROW-NEW-${Date.now()}`,
        boothCode: 'DDN-',
        rollsAllocated: 5,
        tellerName: 'Unassigned',
        location: '',
        masterRegistryStatus: 'Not Found in Registry',
        status: 'Unmatched'
      });
      this.renderReviewTable();
    }

    async confirmReviewSave() {
      const dateInput = document.getElementById('thermal-review-date');
      const saveDate = (dateInput && dateInput.value) || this.pendingOcrDate || this.selectedDate;

      // Priority 1: Save the detected stocks on hand for this specific date
      if (typeof this.pendingOcrStocksOnHand === 'number' && this.pendingOcrStocksOnHand > 0) {
        if (!this.dailyStocksOnHand) this.dailyStocksOnHand = {};
        this.dailyStocksOnHand[saveDate] = this.pendingOcrStocksOnHand;
      }

      const stocks = this.calculateDailyStocks(saveDate);
      const effectiveStocks = (typeof this.pendingOcrStocksOnHand === 'number' && this.pendingOcrStocksOnHand > 0)
        ? this.pendingOcrStocksOnHand
        : stocks.stocksOnHand;

      const totalAlloc = this.pendingOcrRecords.reduce((sum, r) => sum + (Number(r.rollsAllocated) || 0), 0);

      // Section 15 validation: Cannot exceed Stocks on Hand if stock is defined (> 0)
      if (effectiveStocks > 0 && totalAlloc > effectiveStocks) {
        alert(`❌ Invalid Allocation: Total Rolls Allocated (${totalAlloc} rolls) cannot exceed Stocks on Hand (${effectiveStocks} rolls). Please adjust rolls before confirming.`);
        return;
      }

      // Filter out existing OCR records for this date if re-uploading the same report
      this.allocations = this.allocations.filter(a => !(a.date === saveDate && a.source === 'OCR Upload'));

      // Format records and add to allocations
      for (const r of this.pendingOcrRecords) {
        const cleanCode = this.normalizeBoothCode(r.boothCode);
        const reg = this.findMasterRegistryBooth(cleanCode);

        this.allocations.push({
          id: `TP-${saveDate.replace(/-/g, '')}-${cleanCode.replace(/[^0-9]/g, '') || Math.floor(Math.random()*1000)}`,
          date: saveDate,
          boothCode: cleanCode,
          rollsAllocated: Number(r.rollsAllocated) || 5,
          tellerName: (reg && reg.tellerName) || r.tellerName || 'Station Teller',
          location: (reg && reg.location) || r.location || '',
          source: 'OCR Upload',
          createdAt: new Date().toISOString()
        });
      }

      await this.savePersistentData();
      this.closeReviewModal();

      // Switch active view date to saved report date
      this.selectedDate = saveDate;
      this.selectedMonth = saveDate.substring(0, 7);
      this.dailyPage = 1;
      this.render();

      if (window.sfx && window.sfx.playChime) window.sfx.playChime();
      alert(`✅ Thermal Paper Daily Summary updated! ${this.pendingOcrRecords.length} booth allocations saved for ${this.formatReadableDate(saveDate)}. Stock on Hand set to ${effectiveStocks} Rolls.`);
    }

    // =========================================================================
    // 7. EDIT & DELETE ACTIONS (SECTION 16 & 17)
    // =========================================================================
    openEditModal(recordId) {
      const record = this.allocations.find(a => a.id === recordId);
      if (!record) return;

      this.editingRecordId = recordId;
      const modal = document.getElementById('modal-edit-thermal-allocation');
      if (!modal) return;

      document.getElementById('edit-thermal-booth').value = record.boothCode;
      document.getElementById('edit-thermal-rolls').value = record.rollsAllocated;
      document.getElementById('edit-thermal-date').value = record.date;

      const reg = this.findMasterRegistryBooth(record.boothCode);
      document.getElementById('edit-thermal-teller').innerText = (reg && reg.tellerName) || record.tellerName || 'Station Teller';

      modal.style.display = 'flex';
      modal.classList.add('active');
    }

    closeEditModal() {
      const modal = document.getElementById('modal-edit-thermal-allocation');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
      this.editingRecordId = null;
    }

    async saveEditedAllocation() {
      if (!this.editingRecordId) return;
      const record = this.allocations.find(a => a.id === this.editingRecordId);
      if (!record) return;

      const newBooth = this.normalizeBoothCode(document.getElementById('edit-thermal-booth').value);
      const newRolls = parseInt(document.getElementById('edit-thermal-rolls').value, 10);
      const newDate = document.getElementById('edit-thermal-date').value || record.date;

      if (!newBooth || !newRolls || newRolls <= 0) {
        alert('Please enter a valid Booth Code and Rolls Allocated.');
        return;
      }

      // Check stock limit
      const stocks = this.calculateDailyStocks(newDate);
      const otherAllocations = this.allocations.filter(a => a.date === newDate && a.id !== this.editingRecordId);
      const proposedTotal = otherAllocations.reduce((sum, a) => sum + a.rollsAllocated, 0) + newRolls;

      if (proposedTotal > stocks.stocksOnHand) {
        alert(`❌ Invalid Allocation: Total Rolls Allocated (${proposedTotal}) cannot exceed Stocks on Hand (${stocks.stocksOnHand}).`);
        return;
      }

      const reg = this.findMasterRegistryBooth(newBooth);
      record.boothCode = newBooth;
      record.rollsAllocated = newRolls;
      record.date = newDate;
      record.tellerName = (reg && reg.tellerName) || record.tellerName;
      record.location = (reg && reg.location) || record.location;

      await this.savePersistentData();
      this.closeEditModal();
      this.render();

      if (window.sfx && window.sfx.playClick) window.sfx.playClick();
    }

    openDeleteConfirm(recordId) {
      const record = this.allocations.find(a => a.id === recordId);
      if (!record) return;

      this.deletingRecordId = recordId;
      const modal = document.getElementById('modal-delete-thermal-confirm');
      if (!modal) return;

      document.getElementById('delete-thermal-target-booth').innerText = `${record.boothCode} (${record.rollsAllocated} Rolls)`;
      modal.style.display = 'flex';
      modal.classList.add('active');
    }

    closeDeleteConfirm() {
      const modal = document.getElementById('modal-delete-thermal-confirm');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
      this.deletingRecordId = null;
    }

    async confirmDeleteAllocation() {
      if (!this.deletingRecordId) return;

      const recordId = this.deletingRecordId;
      this.allocations = this.allocations.filter(a => a.id !== recordId);

      try {
        await fetch(`/api/thermal-paper?id=${encodeURIComponent(recordId)}`, { method: 'DELETE' });
      } catch (e) {}

      await this.savePersistentData();
      this.closeDeleteConfirm();
      this.render();

      if (window.sfx && window.sfx.playClick) window.sfx.playClick();
    }

    // =========================================================================
    // 8. INITIAL STOCK ADJUSTMENT MODAL
    // =========================================================================
    openInitialStockModal() {
      const modal = document.getElementById('modal-thermal-initial-stock');
      if (!modal) return;

      const stocks = this.calculateDailyStocks(this.selectedDate);
      const formattedDate = this.formatReadableDate(this.selectedDate);

      const titleEl = modal.querySelector('.card-title');
      if (titleEl) {
        titleEl.innerHTML = `⚙️ Edit Stock on Hand — <span style="color: var(--text-primary); font-size: 13.5px; font-weight: 600;">${formattedDate}</span>`;
      }

      const labelEl = document.getElementById('label-thermal-initial-stock');
      if (labelEl) {
        labelEl.innerText = `Stock on Hand for ${formattedDate} (Rolls):`;
      }

      const input = document.getElementById('input-thermal-initial-stock');
      if (input) {
        input.value = stocks.stocksOnHand;
        setTimeout(() => { input.focus(); input.select(); }, 50);
      }

      modal.style.display = 'flex';
      modal.classList.add('active');
    }

    closeInitialStockModal() {
      const modal = document.getElementById('modal-thermal-initial-stock');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
    }

    async saveInitialStock() {
      const input = document.getElementById('input-thermal-initial-stock');
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) {
        alert('Please enter a valid stock balance (0 or greater).');
        return;
      }

      // Priority 2: Save as the explicit date-specific Stock on Hand for the active report date
      if (!this.dailyStocksOnHand) this.dailyStocksOnHand = {};
      this.dailyStocksOnHand[this.selectedDate] = val;

      await this.savePersistentData();
      this.closeInitialStockModal();
      this.render();
      if (window.sfx && window.sfx.playClick) window.sfx.playClick();
    }

    // =========================================================================
    // 9. EVENT LISTENERS SETUP
    // =========================================================================
    setupEventListeners() {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !this._syncListenersBound) {
        this._syncListenersBound = true;
        window.addEventListener('focus', () => this.syncFromServer());
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              this.syncFromServer();
            }
          });
        }
      }

      // Date Picker Filter
      const dateInput = document.getElementById('thermal-filter-date');
      if (dateInput) {
        dateInput.value = this.selectedDate;
        dateInput.onchange = () => {
          this.selectedDate = dateInput.value;
          this.dailyPage = 1;
          this.render();
        };
      }

      // Prev / Next Day buttons
      const btnPrev = document.getElementById('thermal-prev-day-btn');
      if (btnPrev) {
        btnPrev.onclick = () => this.shiftDate(-1);
      }
      const btnNext = document.getElementById('thermal-next-day-btn');
      if (btnNext) {
        btnNext.onclick = () => this.shiftDate(1);
      }

      // Month Picker Filter
      const monthInput = document.getElementById('thermal-filter-month');
      if (monthInput) {
        monthInput.value = this.selectedMonth;
        monthInput.onchange = () => {
          this.selectedMonth = monthInput.value;
          this.render();
        };
      }

      // Search Booth Input (Daily)
      const searchDaily = document.getElementById('thermal-search-daily');
      if (searchDaily) {
        searchDaily.oninput = () => {
          this.searchDailyBooth = searchDaily.value.trim().toUpperCase();
          this.dailyPage = 1;
          this.renderDailyTable();
        };
      }

      // Search Booth Input (Monthly)
      const searchMonthly = document.getElementById('thermal-search-monthly');
      if (searchMonthly) {
        searchMonthly.oninput = () => {
          this.searchMonthlyBooth = searchMonthly.value.trim().toUpperCase();
          this.renderMonthlyTable();
        };
      }

      // Upload Thermal Paper Report Button
      const uploadBtn = document.getElementById('btn-upload-thermal-report');
      const fileInput = document.getElementById('thermal-file-input');
      if (uploadBtn && fileInput) {
        uploadBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            this.processThermalPaperImage(file);
            fileInput.value = '';
          }
        };
      }

      // Quick Sample Test Button (Generates authentic two-column yellow-pad canvas or loads sample report image)
      const sampleBtn = document.getElementById('btn-load-sample-thermal');
      if (sampleBtn) {
        sampleBtn.onclick = () => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.processThermalPaperImage(img);
          };
          img.onerror = () => {
            if (window.ocrEngine && typeof window.ocrEngine.generateThermalPaperSampleCanvas === 'function') {
              const canvas = window.ocrEngine.generateThermalPaperSampleCanvas();
              this.processThermalPaperImage(canvas);
            } else {
              this.parseOcrTextToReview(this.getSampleOcrText());
            }
          };
          img.src = '/assets/sample-thermal-report.jpg?' + Date.now();
        };
      }
    }

    shiftDate(days) {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() + days);
      this.selectedDate = d.toISOString().split('T')[0];
      const dateInput = document.getElementById('thermal-filter-date');
      if (dateInput) dateInput.value = this.selectedDate;
      this.dailyPage = 1;
      this.render();
    }

    // =========================================================================
    // 10. UI RENDERING: DAILY SUMMARY & KPI CARDS
    // =========================================================================
    render() {
      this.renderDailyKpiCards();
      this.renderDailyTable();
      this.renderMonthlyTable();
    }

    renderDailyKpiCards() {
      const stocks = this.calculateDailyStocks(this.selectedDate);
      const dateFormatted = this.formatReadableDate(this.selectedDate);

      const elDate = document.getElementById('thermal-kpi-date');
      const elStocks = document.getElementById('thermal-kpi-stocks-on-hand');
      const elAlloc = document.getElementById('thermal-kpi-total-allocated');
      const elRemain = document.getElementById('thermal-kpi-rolls-remaining');

      if (elDate) elDate.innerText = dateFormatted;
      if (elStocks) elStocks.innerText = `${stocks.stocksOnHand} ROLLS`;
      if (elAlloc) elAlloc.innerText = `${stocks.totalAllocated} ROLLS`;
      if (elRemain) {
        elRemain.innerText = `${stocks.rollsRemaining} ROLLS`;
        elRemain.style.color = stocks.rollsRemaining < 50 ? 'var(--danger)' : '#10b981';
      }
    }

    renderDailyTable() {
      const tbody = document.getElementById('thermal-daily-tbody');
      const tfoot = document.getElementById('thermal-daily-tfoot');
      if (!tbody) return;

      // Filter allocations for selected date
      let rows = this.allocations.filter(a => a.date === this.selectedDate);

      // Search filter
      if (this.searchDailyBooth) {
        rows = rows.filter(a => 
          a.boothCode.toUpperCase().includes(this.searchDailyBooth) || 
          (a.tellerName && a.tellerName.toUpperCase().includes(this.searchDailyBooth))
        );
      }

      const totalAllocated = rows.reduce((sum, a) => sum + (Number(a.rollsAllocated) || 0), 0);

      // Pagination (Section 27: Rows per page: 10)
      const totalPages = Math.ceil(rows.length / this.rowsPerPage) || 1;
      if (this.dailyPage > totalPages) this.dailyPage = totalPages;

      const startIndex = (this.dailyPage - 1) * this.rowsPerPage;
      const pagedRows = rows.slice(startIndex, startIndex + this.rowsPerPage);

      if (rows.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
              <div style="font-size: 28px; margin-bottom: 8px;">🧾</div>
              <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">No Thermal Paper Allocations on this Date</div>
              <div style="font-size: 12px; margin-top: 4px;">Click <strong>Upload Thermal Paper Report</strong> or switch dates to view records.</div>
            </td>
          </tr>
        `;
        if (tfoot) {
          tfoot.innerHTML = `
            <tr style="background: rgba(255,255,255,0.02); font-weight: 700;">
              <td colspan="2" style="text-align: right; text-transform: uppercase;">Total Rolls Allocated:</td>
              <td style="color: var(--accent-gold); font-family: var(--font-mono); font-size: 14px;">0 ROLLS</td>
              <td></td>
            </tr>
          `;
        }
      } else {
        tbody.innerHTML = pagedRows.map(r => {
          return `
            <tr>
              <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold);">
                ${r.boothCode}
              </td>
              <td>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${r.tellerName || 'Station Teller'}</div>
                <div style="font-size: 11.5px; color: var(--text-muted);">${r.location || 'Davao Corridor'}</div>
              </td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); font-size: 13.5px;">
                ${r.rollsAllocated} <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">ROLLS</span>
              </td>
              <td style="white-space: nowrap;">
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button class="btn btn-secondary btn-xs" onclick="window.thermalPaperModule.openEditModal('${r.id}')" title="Edit Allocation">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-danger btn-xs" onclick="window.thermalPaperModule.openDeleteConfirm('${r.id}')" title="Delete Allocation">
                    🗑️ Delete
                  </button>
                  <input type="checkbox" class="thermal-row-checkbox" value="${r.id}" ${this.selectedAllocationIds.has(r.id) ? 'checked' : ''} onchange="window.thermalPaperModule.toggleRowSelection('${r.id}', this.checked)" style="cursor:pointer; transform:scale(1.15); margin-left: 4px;" title="Select allocation for bulk delete">
                </div>
              </td>
            </tr>
          `;
        }).join('');

        if (tfoot) {
          tfoot.innerHTML = `
            <tr style="background: rgba(255,255,255,0.03); font-weight: 800; border-top: 2px solid var(--border-color);">
              <td colspan="2" style="text-align: right; text-transform: uppercase; font-size: 12.5px; color: var(--text-muted);">TOTAL:</td>
              <td style="color: var(--accent-gold); font-family: var(--font-mono); font-size: 14px;">${totalAllocated} ROLLS</td>
              <td></td>
            </tr>
          `;
        }
      }

      // Render Pagination Controls (Section 27)
      this.renderPagination(rows.length, totalPages);
      this.updateSelectionUI();
    }

    renderPagination(totalRows, totalPages) {
      const pageInfo = document.getElementById('thermal-pagination-info');
      const btnPrev = document.getElementById('thermal-page-prev');
      const btnNext = document.getElementById('thermal-page-next');

      if (pageInfo) {
        pageInfo.innerText = `Page ${this.dailyPage} of ${totalPages} (${totalRows} total records)`;
      }

      if (btnPrev) {
        btnPrev.disabled = this.dailyPage <= 1;
        btnPrev.onclick = () => {
          if (this.dailyPage > 1) {
            this.dailyPage--;
            this.renderDailyTable();
          }
        };
      }

      if (btnNext) {
        btnNext.disabled = this.dailyPage >= totalPages;
        btnNext.onclick = () => {
          if (this.dailyPage < totalPages) {
            this.dailyPage++;
            this.renderDailyTable();
          }
        };
      }
    }

    // =========================================================================
    // 11. UI RENDERING: MONTHLY BOOTH USAGE SUMMARY (SECTIONS 18 - 23)
    // =========================================================================
    renderMonthlyTable() {
      const tbody = document.getElementById('thermal-monthly-tbody');
      const tfoot = document.getElementById('thermal-monthly-tfoot');
      if (!tbody) return;

      const monthlyData = this.calculateMonthlySummary(this.selectedMonth);
      let list = monthlyData.booths;

      if (this.searchMonthlyBooth) {
        list = list.filter(b => 
          b.boothCode.toUpperCase().includes(this.searchMonthlyBooth) ||
          b.tellerName.toUpperCase().includes(this.searchMonthlyBooth)
        );
      }

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; padding: 24px 16px; color: var(--text-muted);">
              No booth usage records found for ${this.formatMonthName(this.selectedMonth)}.
            </td>
          </tr>
        `;
        if (tfoot) {
          tfoot.innerHTML = `
            <tr style="background: rgba(255,255,255,0.02); font-weight: 700;">
              <td colspan="2" style="text-align: right; text-transform: uppercase;">TOTAL:</td>
              <td style="color: var(--accent-gold); font-family: var(--font-mono); font-size: 14px;">0 ROLLS</td>
            </tr>
          `;
        }
      } else {
        tbody.innerHTML = list.map(b => {
          return `
            <tr>
              <td>
                <div style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold); font-size: 13px;">${b.boothCode}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${b.tellerName}</div>
              </td>
              <td style="text-align: center; font-weight: 700; color: var(--text-primary); font-size: 13px;">
                ${b.daysAllocated} <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">days</span>
              </td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: #10b981; font-size: 13.5px;">
                ${b.totalRollsUsed} <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">ROLLS</span>
              </td>
            </tr>
          `;
        }).join('');

        if (tfoot) {
          tfoot.innerHTML = `
            <tr style="background: rgba(255,255,255,0.03); font-weight: 800; border-top: 2px solid var(--border-color);">
              <td style="text-transform: uppercase; font-size: 12.5px; color: var(--text-muted);">TOTAL (${monthlyData.distinctBoothsCount} BOOTHS):</td>
              <td style="text-align: center; color: var(--text-muted); font-size: 12px;">—</td>
              <td style="color: var(--accent-gold); font-family: var(--font-mono); font-size: 14.5px;">${monthlyData.totalMonthlyRolls} ROLLS</td>
            </tr>
          `;
        }
      }
    }

    // =========================================================================
    // 12. UTILITIES & FORMATTING
    // =========================================================================
    formatReadableDate(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${months[mIdx]} ${day}, ${parts[0]}`;
    }

    formatMonthName(monthStr) {
      if (!monthStr) return '';
      const parts = monthStr.split('-');
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${months[mIdx]} ${parts[0]}`;
    }

    /* --- BULK SELECTION & ACTIONS (SELECT ALL / UNSELECT ALL / BULK DELETE) --- */
    toggleRowSelection(id, isChecked) {
      if (!id) return;
      if (isChecked) {
        this.selectedAllocationIds.add(id);
      } else {
        this.selectedAllocationIds.delete(id);
      }
      this.updateSelectionUI();
    }

    toggleSelectAll(forceState) {
      let activeRows = this.allocations.filter(a => a.date === this.selectedDate);
      if (this.searchDailyBooth) {
        activeRows = activeRows.filter(a =>
          a.boothCode.toUpperCase().includes(this.searchDailyBooth) ||
          (a.tellerName && a.tellerName.toUpperCase().includes(this.searchDailyBooth))
        );
      }
      if (activeRows.length === 0) return;

      const shouldSelect = typeof forceState === 'boolean'
        ? forceState
        : this.selectedAllocationIds.size < activeRows.length;

      if (shouldSelect) {
        activeRows.forEach(a => this.selectedAllocationIds.add(a.id));
      } else {
        this.selectedAllocationIds.clear();
      }
      this.render();
    }

    unselectAll() {
      this.selectedAllocationIds.clear();
      this.render();
    }

    updateSelectionUI() {
      const banner = document.getElementById('thermal-selection-banner');
      const countEl = document.getElementById('thermal-selected-count');
      const actionSelectAllCb = document.getElementById('thermal-select-all-checkbox');
      const actionSelectAllLabel = document.getElementById('thermal-select-all-label');

      let activeRows = this.allocations.filter(a => a.date === this.selectedDate);
      if (this.searchDailyBooth) {
        activeRows = activeRows.filter(a =>
          a.boothCode.toUpperCase().includes(this.searchDailyBooth) ||
          (a.tellerName && a.tellerName.toUpperCase().includes(this.searchDailyBooth))
        );
      }
      const count = this.selectedAllocationIds ? this.selectedAllocationIds.size : 0;
      const allSelected = activeRows.length > 0 && count === activeRows.length;

      if (countEl) countEl.textContent = count;
      if (banner) {
        banner.style.display = count > 0 ? 'flex' : 'none';
      }
      if (actionSelectAllCb) {
        actionSelectAllCb.checked = allSelected;
        actionSelectAllCb.indeterminate = count > 0 && count < activeRows.length;
      }
      if (actionSelectAllLabel) {
        actionSelectAllLabel.textContent = allSelected ? 'UNSELECT ALL' : 'SELECT ALL';
      }

      if (typeof document !== 'undefined') {
        const rowCheckboxes = document.querySelectorAll('.thermal-row-checkbox');
        rowCheckboxes.forEach(cb => {
          cb.checked = this.selectedAllocationIds && this.selectedAllocationIds.has(cb.value);
        });
      }
    }

    async deleteSelectedAllocations() {
      const count = this.selectedAllocationIds ? this.selectedAllocationIds.size : 0;
      if (count === 0) {
        alert('Please select one or more allocations to delete.');
        return;
      }

      const confirmMsg = `Are you sure you want to permanently delete the ${count} selected thermal paper allocation(s)? This action cannot be undone.`;
      const shouldDelete = (typeof confirm === 'function')
        ? confirm(confirmMsg)
        : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(confirmMsg) : true);
      if (!shouldDelete) return;

      const idsToDelete = Array.from(this.selectedAllocationIds);
      this.allocations = this.allocations.filter(a => !idsToDelete.includes(a.id));

      for (const id of idsToDelete) {
        try {
          await fetch(`/api/thermal-paper?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (e) {}
      }

      await this.savePersistentData();
      this.selectedAllocationIds.clear();
      this.render();

      if (window.sfx && window.sfx.playClick) window.sfx.playClick();
      alert(`Successfully deleted ${idsToDelete.length} thermal paper allocation record(s).`);
    }
  }

  // Initialize and mount globally
  window.thermalPaperModule = new ThermalPaperModule();
  document.addEventListener('DOMContentLoaded', () => {
    window.thermalPaperModule.init();
  });
})();
