/**
 * =============================================================================
 * APEX OmniERP — Outlet Rentals & Load Allowance Module
 * Official Tracking: Monthly Outlet Rentals & Monthly Load Allowance
 * for registered Station Tellers and their assigned Booth Codes
 * =============================================================================
 */

(function () {
  'use strict';

  class OutletRentalsModule {
    constructor() {
      this.selectedPeriod = 'ALL';
      this.selectedBoothCode = null;
      this.searchQuery = '';
      this.activeTab = 'all'; // 'all', 'rentals', 'loads', 'to-follow', 'received'
      this.pendingUploadRecordId = null;
      this.pendingUploadFileData = null;
      this.confirmDeleteId = null;
      this.currentViewArRecordId = null;
    }

    init() {
      const store = window.appStore;
      if (!store) return;

      this.syncFromTransactions();

      if (!this._initialized) {
        this.setupEventListeners();
        this.setupSearchableSelector();
        this._initialized = true;
      }

      this.render();

      if (!this._subscribed && typeof store.subscribe === 'function') {
        store.subscribe(() => {
          this.syncFromTransactions();
          this.render();
        });
        this._subscribed = true;
      }
    }

    // =========================================================================
    // 1. DATA INGESTION, CLASSIFICATION & DEDUPLICATION
    // =========================================================================
    syncFromTransactions() {
      if (this._isSyncing) return;
      this._isSyncing = true;

      try {
        const store = window.appStore;
        if (!store || !store.data) return;

        if (!store.data.outletRentals) store.data.outletRentals = [];
        if (!store.data.deletedOutletRentalIds) store.data.deletedOutletRentalIds = [];

        const isDeleted = (id) => {
          if (!id) return false;
          const del = store.data.deletedOutletRentalIds || [];
          if (del.includes(id)) return true;
          if (del.includes('ORL-' + id)) return true;
          if (typeof id === 'string' && id.startsWith('ORL-') && del.includes(id.replace(/^ORL-/, ''))) return true;
          return false;
        };

        let hasChanges = false;

        // Scan transactions from store
        const txns = store.data.transactions || [];
        txns.forEach(txn => {
          if (!txn || !txn.id) return;
          if (isDeleted(txn.id) || isDeleted('ORL-' + txn.id)) return;

          const classified = this.classifyAndParseTransaction(txn);
          if (!classified) return;
          if (isDeleted(classified.id) || isDeleted(classified.sourceTxnId)) return;

          // Deduplication check:
          // Do not create duplicate records from repeated OCR runs or same source
          const existingIdx = store.data.outletRentals.findIndex(r => {
            if (r.id === classified.id || (r.sourceTxnId && r.sourceTxnId === txn.id)) return true;
            // Match by same category + boothCode + coveragePeriod
            if (r.category === classified.category && r.boothCode && classified.boothCode && r.boothCode === classified.boothCode && r.coveragePeriod === classified.coveragePeriod) {
              return true;
            }
            return false;
          });

          if (existingIdx >= 0) {
            // Keep existing A.R. and custom phone/network edits intact
            const existing = store.data.outletRentals[existingIdx];
            if (!existing.arFile && classified.arFile) existing.arFile = classified.arFile;
            if (existing.arStatus === 'To Follow' && classified.arStatus === 'Received') existing.arStatus = 'Received';
          } else {
            store.data.outletRentals.push(classified);
            hasChanges = true;
          }
        });

        // Update A.R. reminders based on dates
        store.data.outletRentals.forEach(r => {
          this.evaluateArStatus(r);
        });

        if (hasChanges) {
          store.save();
        }
      } finally {
        this._isSyncing = false;
      }
    }

    classifyAndParseTransaction(txn) {
      const desc = (txn.description || '').toUpperCase();
      const note = (txn.note || txn.notes || txn.ocrRawText || '').toUpperCase();
      const combined = `${desc} ${note}`;

      // Exclude motor rental / collector motorcycle fuel expenses
      if (combined.includes('RENT MOTOR') || combined.includes('MOTOR RENT') || combined.includes('MOTORCYCLE') || combined.includes('GAS')) {
        return null;
      }

      // Check Outlet Rental
      const isOutletRental = combined.includes('RENT FEE') ||
        combined.includes('RENT SABONGAN') ||
        combined.includes('STALL RENT') ||
        combined.includes('OUTLET RENT') ||
        combined.includes('BOOTH RENT') ||
        combined.includes('LEASE RENT') ||
        (combined.includes('RENT') && (combined.includes('DDN') || combined.includes('STALL') || combined.includes('BOOTH')));

      // Check Load Allowance
      const isLoadAllowance = combined.includes('POS LOAD') ||
        combined.includes('MONTHLY LOAD') ||
        combined.includes('LOAD ALLOWANCE') ||
        combined.includes('LOAD /MONTH') ||
        (combined.includes('LOAD') && combined.includes('DDN'));

      if (!isOutletRental && !isLoadAllowance) return null;

      const category = isOutletRental ? 'Outlet Rental' : 'Load Allowance';

      // 1. Extract Booth Code
      let boothCode = this.extractBoothCode(combined) || this.normalizeBoothCode(txn.boothCode) || '';
      const ocrDetectedBooth = boothCode || 'NOT_DETECTED';

      // 2. Lookup Master Registry
      const match = this.lookupMasterRegistry(boothCode);
      const boothMatchStatus = match ? 'MATCHED' : (boothCode ? 'NOT_FOUND' : 'NOT_FOUND');

      // 3. Extract Purok & Location
      const purok = this.extractPurok(combined) || (match && match.purok ? this.normalizePurok(match.purok) : 'Purok 6');
      const location = this.extractLocation(combined) || (match ? match.address || `${match.municipality || 'Davao Del Norte'}` : (txn.location || 'Davao Del Norte'));
      const barangay = (match && match.barangay) || this.extractBarangay(combined) || 'Liboganon';
      const municipality = (match && match.municipality) || this.extractMunicipality(combined) || 'Tagum';

      // 4. Extract Coverage Period
      const coverageInfo = this.extractCoveragePeriod(combined, txn.date || txn.datePeriodCover);

      // 5. Build Standard Description
      let standardDesc = txn.description;
      if (category === 'Outlet Rental') {
        standardDesc = combined.includes('SABONGAN') ? 'Rent Fee — Sabongan' : `Rent Fee — ${purok}`;
      } else {
        standardDesc = 'POS Load — 1 Month';
      }

      // 6. POS Phone & Network (for Load Allowance)
      const posPhone = (match && match.phone) ? match.phone : '0917-882-1716';
      const network = 'GLOBE';

      // 7. Initial AR Status
      const arStatus = 'To Follow';

      return {
        id: 'ORL-' + (txn.id || Date.now()),
        sourceTxnId: txn.id,
        category: category,
        amount: Number(txn.amount) || 0,
        description: standardDesc,
        rawDescription: txn.ocrRawText || txn.description || '',
        purok: purok,
        barangay: barangay,
        municipality: municipality,
        location: location,
        boothCode: boothCode,
        ocrDetectedBooth: ocrDetectedBooth,
        historicalTeller: (match ? match.name : txn.name) || 'Station Teller',
        historicalEmployeeId: match ? match.id : (txn.employeeId || ''),
        historicalRole: 'Station Teller',
        posPhone: posPhone,
        network: network,
        coveragePeriod: coverageInfo.label,
        startDate: coverageInfo.startDate,
        endDate: coverageInfo.endDate,
        monthKey: coverageInfo.monthKey,
        arStatus: arStatus,
        arFile: null,
        boothMatchStatus: boothMatchStatus,
        notes: txn.note || txn.notes || ''
      };
    }

    evaluateArStatus(record) {
      if (record.arFile && record.arFile.dataUrl) {
        record.arStatus = 'Received';
        return;
      }
      if (!record.endDate) {
        record.arStatus = 'To Follow';
        return;
      }

      const today = new Date();
      const end = new Date(record.endDate);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        record.arStatus = 'Overdue';
      } else if (diffDays <= 7) {
        record.arStatus = 'Due Soon';
      } else {
        record.arStatus = 'To Follow';
      }
    }

    // =========================================================================
    // 2. MASTER REGISTRY NORMALIZATION & LOOKUP
    // =========================================================================
    normalizeBoothCode(code) {
      if (!code) return '';
      const m = code.match(/DDN[- ]?(\d+)/i);
      if (m) return 'DDN-' + m[1];
      return code.trim().toUpperCase();
    }

    extractBoothCode(text) {
      if (!text) return '';
      const m = text.match(/DDN[- ]?(\d+)/i);
      return m ? 'DDN-' + m[1] : '';
    }

    normalizePurok(str) {
      if (!str) return 'Purok 1';
      const m = str.match(/P(?:UROK|RK|#)?[- ]?([0-9]+[A-Z]?)/i);
      if (m) return 'Purok ' + m[1].toUpperCase();
      return str.trim();
    }

    extractPurok(text) {
      if (!text) return null;
      const m = text.match(/\b(?:P|PUROK|PRK|P#)[- ]?([0-9]+[A-Z]?)\b/i);
      if (m) return 'Purok ' + m[1].toUpperCase();
      return null;
    }

    extractLocation(text) {
      if (!text) return null;
      if (text.includes('LIBOGANON') || text.includes('LIBUGANON')) return 'Liboganon, Tagum';
      if (text.includes('TIBAL-OG') || text.includes('ST. TOMAS') || text.includes('STO. TOMAS')) return 'Tibal-og, Sto. Tomas';
      if (text.includes('CARMEN')) return 'Carmen, Davao Del Norte';
      if (text.includes('PANABO')) return 'Panabo City';
      if (text.includes('TAGUM')) return 'Tagum City';
      return null;
    }

    extractBarangay(text) {
      if (!text) return null;
      if (text.includes('LIBOGANON') || text.includes('LIBUGANON')) return 'Liboganon';
      if (text.includes('TIBAL-OG')) return 'Tibal-og';
      if (text.includes('ISING')) return 'Ising';
      if (text.includes('TUGANAY')) return 'Tuganay';
      if (text.includes('VISAYAN VILLAGE')) return 'Visayan Village';
      if (text.includes('BINCUNGAN')) return 'Bincungan';
      if (text.includes('NEW VISAYAS')) return 'New Visayas';
      return null;
    }

    extractMunicipality(text) {
      if (!text) return null;
      if (text.includes('TAGUM')) return 'Tagum';
      if (text.includes('PANABO')) return 'Panabo';
      if (text.includes('CARMEN')) return 'Carmen';
      if (text.includes('ST. TOMAS') || text.includes('STO. TOMAS') || text.includes('TOMAS')) return 'Sto. Tomas';
      return null;
    }

    extractCoveragePeriod(text, defaultDate = null) {
      // Regex pattern for date ranges like (SEP. 30, 2026 - OCT. 30, 2026) or (AUG. 7, 2024 - SEP. 7, 2024)
      const rangeMatch = text.match(/\(?([A-Z]{3,4}\.?\s+\d{1,2},?\s+\d{4})\s*[-–—]\s*([A-Z]{3,4}\.?\s+\d{1,2},?\s+\d{4})\)?/i);
      if (rangeMatch) {
        return {
          label: `${rangeMatch[1].trim()} – ${rangeMatch[2].trim()}`,
          startDate: this.parseFlexibleDate(rangeMatch[1]),
          endDate: this.parseFlexibleDate(rangeMatch[2]),
          monthKey: '2026-09'
        };
      }

      // Check single month match like SEP 2024 or September 2026
      const monthMatch = text.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})\b/i);
      if (monthMatch) {
        const mon = monthMatch[1].toUpperCase();
        const yr = monthMatch[2];
        return {
          label: `${mon} ${yr}`,
          startDate: `${yr}-09-01`,
          endDate: `${yr}-09-30`,
          monthKey: `${yr}-09`
        };
      }

      // Fallback to default date
      const d = defaultDate ? new Date(defaultDate) : new Date(2026, 8, 30);
      return {
        label: 'September 30, 2026 – October 30, 2026',
        startDate: '2026-09-30',
        endDate: '2026-10-30',
        monthKey: '2026-09'
      };
    }

    parseFlexibleDate(dateStr) {
      if (!dateStr) return '2026-09-30';
      try {
        const parsed = new Date(dateStr.replace(/\./g, ''));
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch (e) {}
      return '2026-09-30';
    }

    lookupMasterRegistry(boothCode) {
      const store = window.appStore;
      if (!store || !store.data || !store.data.employees || !boothCode) return null;

      const norm = this.normalizeBoothCode(boothCode);
      const digits = norm.replace(/\D/g, '');

      return store.data.employees.find(e => {
        // Only Station Tellers eligible
        const role = (e.role || '').toUpperCase();
        const isTeller = role.includes('TELLER') || role.includes('SALES') || role.includes('RELIEVER');
        if (!isTeller) return false;

        const eBoothNorm = this.normalizeBoothCode(e.boothCode || e.booth);
        const eDigits = eBoothNorm.replace(/\D/g, '');

        return eBoothNorm === norm || (digits && eDigits === digits);
      }) || null;
    }

    getEligibleStationTellers() {
      const store = window.appStore;
      if (!store || !store.data || !store.data.employees) return [];

      return store.data.employees.filter(e => {
        const role = (e.role || '').toUpperCase();
        const isTeller = role.includes('TELLER') || role.includes('SALES') || role.includes('RELIEVER');
        const isActive = (e.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        return isTeller && isActive;
      }).map(e => ({
        id: e.id,
        name: e.name,
        role: 'Station Teller',
        boothCode: this.normalizeBoothCode(e.boothCode || e.booth || e.id),
        purok: this.normalizePurok(e.purok),
        barangay: e.barangay || '',
        municipality: e.municipality || 'Tagum',
        location: e.address || `${e.purok || ''} ${e.barangay || ''} ${e.municipality || 'Tagum'}`.trim(),
        phone: e.phone || e.contact || '0917-882-1716'
      }));
    }

    // =========================================================================
    // 3. UI RENDERING: DASHBOARD SUMMARY, CARDS & TABLES
    // =========================================================================
    render() {
      if (this._isRendering) return;
      this._isRendering = true;
      try {
        const store = window.appStore;
        if (!store || !store.data) return;

        const allRecords = (store.data.outletRentals || []).filter(r => {
          if (!r) return false;
          if (store.data.deletedOutletRentalIds && store.data.deletedOutletRentalIds.includes(r.id)) return false;
          return true;
        });

        // Populate Period Dropdown Options
        this.populatePeriodDropdown(allRecords);

        // Filter Records by Selected Period, Selected Booth, Search Query, and Active Tab
        const filtered = this.getFilteredRecords(allRecords);

        // Separate into Rentals and Loads
        const rentals = filtered.filter(r => r.category === 'Outlet Rental');
        const loads = filtered.filter(r => r.category === 'Load Allowance');

        // Update Top KPIs
        this.updateKPICounters(allRecords, filtered);

        // Render Active Booth Focus Card (if a specific outlet is selected)
        this.renderFocusedOutletCard();

        // Render Tables
        this.renderRentalsTable(rentals);
        this.renderLoadsTable(loads);

        // Update Tab Badges
        this.updateTabBadges(allRecords);
      } finally {
        this._isRendering = false;
      }
    }

    populatePeriodDropdown(records) {
      const select = document.getElementById('or-filter-period');
      if (!select) return;

      const currentVal = this.selectedPeriod;
      const periods = new Set(['ALL']);

      records.forEach(r => {
        if (r.coveragePeriod) periods.add(r.coveragePeriod);
      });

      // Clear & rebuild
      select.innerHTML = '';
      periods.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p === 'ALL' ? '📅 All Coverage Periods' : `📅 ${p}`;
        if (p === currentVal) opt.selected = true;
        select.appendChild(opt);
      });
    }

    getFilteredRecords(records) {
      return records.filter(r => {
        // Period filter
        if (this.selectedPeriod !== 'ALL' && r.coveragePeriod !== this.selectedPeriod) {
          return false;
        }

        // Booth filter
        if (this.selectedBoothCode && this.normalizeBoothCode(r.boothCode) !== this.selectedBoothCode) {
          return false;
        }

        // Tab filter
        if (this.activeTab === 'rentals' && r.category !== 'Outlet Rental') return false;
        if (this.activeTab === 'loads' && r.category !== 'Load Allowance') return false;
        if (this.activeTab === 'to-follow' && r.arStatus === 'Received') return false;
        if (this.activeTab === 'received' && r.arStatus !== 'Received') return false;

        // Search Query filter (Booth Code, Teller, Location, Purok, Barangay, Municipality)
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase().trim();
          const target = [
            r.boothCode,
            r.historicalTeller,
            r.purok,
            r.barangay,
            r.municipality,
            r.location,
            r.description,
            r.posPhone,
            r.network,
            r.arStatus
          ].filter(Boolean).join(' ').toLowerCase();

          if (!target.includes(q)) return false;
        }

        return true;
      });
    }

    updateKPICounters(allRecords, filteredRecords) {
      const target = filteredRecords;

      let rentalSum = 0;
      let rentalCount = 0;
      let loadSum = 0;
      let loadCount = 0;
      let arReceivedCount = 0;
      let arPendingCount = 0;

      target.forEach(r => {
        const amt = Number(r.amount) || 0;
        if (r.category === 'Outlet Rental') {
          rentalSum += amt;
          rentalCount++;
        } else {
          loadSum += amt;
          loadCount++;
        }

        if (r.arStatus === 'Received') {
          arReceivedCount++;
        } else {
          arPendingCount++;
        }
      });

      const totalMonthly = rentalSum + loadSum;

      // Update DOM
      const elRentals = document.getElementById('or-kpi-rentals');
      const elRentalsCount = document.getElementById('or-kpi-rentals-count');
      if (elRentals) elRentals.textContent = this.formatCurrency(rentalSum);
      if (elRentalsCount) elRentalsCount.textContent = `${rentalCount} Outlets Active`;

      const elLoads = document.getElementById('or-kpi-loads');
      const elLoadsCount = document.getElementById('or-kpi-loads-count');
      if (elLoads) elLoads.textContent = this.formatCurrency(loadSum);
      if (elLoadsCount) elLoadsCount.textContent = `${loadCount} POS Lines Active`;

      const elTotal = document.getElementById('or-kpi-total');
      const elTotalCount = document.getElementById('or-kpi-total-count');
      if (elTotal) elTotal.textContent = this.formatCurrency(totalMonthly);
      if (elTotalCount) elTotalCount.textContent = `${target.length} Total Monthly Obligations`;

      const elAr = document.getElementById('or-kpi-ar');
      const elArPct = document.getElementById('or-kpi-ar-pct');
      if (elAr) elAr.textContent = `${arReceivedCount} Received • ${arPendingCount} Pending`;
      if (elArPct) {
        const pct = target.length > 0 ? Math.round((arReceivedCount / target.length) * 100) : 0;
        elArPct.textContent = `${pct}% Compliance Rate`;
      }
    }

    updateTabBadges(records) {
      const toFollow = records.filter(r => r.arStatus !== 'Received').length;
      const received = records.filter(r => r.arStatus === 'Received').length;

      const bToFollow = document.getElementById('or-tab-count-to-follow');
      const bReceived = document.getElementById('or-tab-count-received');
      if (bToFollow) bToFollow.textContent = toFollow;
      if (bReceived) bReceived.textContent = received;

      const sideAlert = document.getElementById('sidebar-ar-alert');
      if (sideAlert) {
        if (toFollow > 0) {
          sideAlert.style.display = 'inline-block';
          sideAlert.textContent = `${toFollow} To Follow`;
        } else {
          sideAlert.style.display = 'none';
        }
      }
    }

    renderFocusedOutletCard() {
      const container = document.getElementById('or-focused-outlet-card');
      if (!container) return;

      if (!this.selectedBoothCode) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      const match = this.lookupMasterRegistry(this.selectedBoothCode);
      const store = window.appStore;
      const records = (store.data.outletRentals || []).filter(r => this.normalizeBoothCode(r.boothCode) === this.selectedBoothCode);

      container.style.display = 'block';
      container.innerHTML = `
        <div style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(251, 191, 36, 0.15); color: var(--accent-gold); display: flex; align-items: center; justify-content: center; font-size: 22px;">
              🏪
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px; font-weight: 800; color: var(--accent-gold);">${this.selectedBoothCode}</span>
                <span class="badge badge-success" style="font-size: 11px;">Active Outlet</span>
                <span class="badge badge-neutral" style="font-size: 11px;">${records.length} Monthly Records</span>
              </div>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 2px;">
                ${match ? match.name : 'Registered Station Teller'} • <span style="color: var(--text-muted); font-weight: 400;">Station Teller</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-dim); margin-top: 2px;">
                📍 ${match ? match.address || `${match.purok || ''} ${match.barangay || ''} ${match.municipality || 'Tagum'}` : 'Davao Del Norte'}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="window.outletRentals.clearBoothFilter()" style="font-size: 12px;">
              ✕ Show All Outlets
            </button>
          </div>
        </div>
      `;
    }

    renderRentalsTable(records) {
      const tbody = document.getElementById('or-rentals-tbody');
      const countEl = document.getElementById('or-rentals-count');
      if (countEl) countEl.textContent = `${records.length} Records`;
      if (!tbody) return;

      if (records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
              <div style="font-size: 28px; margin-bottom: 8px;">🏬</div>
              <div style="font-size: 14px; font-weight: 600;">No Outlet Rental Records Found</div>
              <div style="font-size: 12px; margin-top: 4px;">Upload your physical report via <strong>Expenses & Payment → Upload File</strong> or clear search filters.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = records.map((r) => {
        const arBadge = this.getArBadgeHtml(r.arStatus);
        const hasAr = r.arFile && r.arFile.dataUrl;
        const isNotMatched = r.boothMatchStatus === 'NOT_FOUND';

        return `
          <tr data-record-id="${r.id}" style="${isNotMatched ? 'background: rgba(239, 68, 68, 0.05);' : ''}">
            <td style="font-weight: 600; font-size: 12.5px; color: var(--text-main);">
              ${r.coveragePeriod || 'September 30 – October 30, 2026'}
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 800; color: var(--accent-gold); font-family: monospace; font-size: 13px;">${r.boothCode || 'DDN-????'}</span>
                ${isNotMatched ? `
                  <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openBoothCorrectionModal('${r.id}')" title="Booth Code Not Found in Master Registry. Click to correct." style="padding: 2px 6px; font-size: 10px; background: rgba(239, 68, 68, 0.15); border-color: #ef4444; color: #ef4444;">
                    ⚠ Correct
                  </button>
                ` : ''}
              </div>
            </td>
            <td>
              <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">${r.historicalTeller || 'Station Teller'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${r.historicalRole || 'Station Teller'}</div>
            </td>
            <td>
              <div style="font-size: 12.5px; color: var(--text-main);">${r.location || 'Davao Del Norte'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${r.purok ? r.purok : 'Purok 6'}</div>
            </td>
            <td>
              <div style="font-size: 12.5px;">${r.description || 'Rent Fee'}</div>
              ${r.notes ? `<div style="font-size: 11px; color: var(--text-dim); max-width: 220px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${r.notes}">${r.notes}</div>` : ''}
            </td>
            <td style="text-align: right; font-weight: 800; font-size: 13.5px; color: var(--accent-gold);">
              ${this.formatCurrency(r.amount)}
            </td>
            <td>
              ${arBadge}
              ${hasAr ? `<div style="font-size: 10.5px; color: var(--success); margin-top: 3px; font-family: monospace;">✓ ${r.arFile.fileName}</div>` : ''}
            </td>
            <td style="text-align: center;">
              <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                ${hasAr ? `
                  <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openViewArModal('${r.id}')" title="View Uploaded A.R.">
                    📄 View A.R.
                  </button>
                ` : `
                  <button class="btn btn-primary btn-xs" onclick="window.outletRentals.openUploadArModal('${r.id}')" style="background: rgba(251, 191, 36, 0.15); border-color: var(--accent-gold); color: var(--accent-gold); font-weight: 700;" title="Upload Supporting Acknowledgement Receipt">
                    📤 Upload A.R.
                  </button>
                `}
                <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openEditRentalModal('${r.id}')" title="Edit Rental Details">
                  ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.promptDeleteRecord('${r.id}')" title="Delete Record" style="color: #ef4444; border-color: rgba(239,68,68,0.3);">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderLoadsTable(records) {
      const tbody = document.getElementById('or-loads-tbody');
      const countEl = document.getElementById('or-loads-count');
      if (countEl) countEl.textContent = `${records.length} Records`;
      if (!tbody) return;

      if (records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
              <div style="font-size: 28px; margin-bottom: 8px;">📶</div>
              <div style="font-size: 14px; font-weight: 600;">No Load Allowance Records Found</div>
              <div style="font-size: 12px; margin-top: 4px;">Upload your physical report via <strong>Expenses & Payment → Upload File</strong> or clear search filters.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = records.map(r => {
        const arBadge = this.getArBadgeHtml(r.arStatus);
        const hasAr = r.arFile && r.arFile.dataUrl;
        const isNotMatched = r.boothMatchStatus === 'NOT_FOUND';

        return `
          <tr data-record-id="${r.id}" style="${isNotMatched ? 'background: rgba(239, 68, 68, 0.05);' : ''}">
            <td style="font-weight: 600; font-size: 12.5px; color: var(--text-main);">
              ${r.coveragePeriod || 'September 2026'}
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 800; color: #06b6d4; font-family: monospace; font-size: 13px;">${r.boothCode || 'DDN-????'}</span>
                ${isNotMatched ? `
                  <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openBoothCorrectionModal('${r.id}')" title="Booth Code Not Found in Master Registry. Click to correct." style="padding: 2px 6px; font-size: 10px; background: rgba(239, 68, 68, 0.15); border-color: #ef4444; color: #ef4444;">
                    ⚠ Correct
                  </button>
                ` : ''}
              </div>
            </td>
            <td>
              <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">${r.historicalTeller || 'Station Teller'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${r.historicalRole || 'Station Teller'}</div>
            </td>
            <td>
              <div style="font-family: monospace; font-weight: 700; color: var(--text-main); font-size: 12.5px;">${r.posPhone || '09XXXXXXXXX'}</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">POS Mobile Line</div>
            </td>
            <td>
              <span class="badge ${this.getNetworkBadgeClass(r.network)}" style="font-size: 11px; font-weight: 800;">
                ${r.network || 'GLOBE'}
              </span>
            </td>
            <td>
              <div style="font-size: 12.5px;">${r.description || 'POS Load — 1 Month'}</div>
            </td>
            <td style="text-align: right; font-weight: 800; font-size: 13.5px; color: #06b6d4;">
              ${this.formatCurrency(r.amount)}
            </td>
            <td style="text-align: center;">
              <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                ${hasAr ? `
                  <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openViewArModal('${r.id}')" title="View Uploaded A.R.">
                    📄 View A.R.
                  </button>
                ` : `
                  <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openUploadArModal('${r.id}')" title="Upload Supporting Acknowledgement Receipt">
                    📤 A.R.
                  </button>
                `}
                <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.openEditLoadModal('${r.id}')" title="Edit POS Phone, Network, or Coverage">
                  ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-xs" onclick="window.outletRentals.promptDeleteRecord('${r.id}')" title="Delete Record" style="color: #ef4444; border-color: rgba(239,68,68,0.3);">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    getArBadgeHtml(status) {
      if (status === 'Received') {
        return `<span class="badge badge-success" style="font-size: 11px; font-weight: 800;">✓ RECEIVED</span>`;
      }
      if (status === 'Due Soon') {
        return `<span class="badge badge-warning" style="font-size: 11px; font-weight: 800; background: rgba(245,158,11,0.2); border-color:#f59e0b; color:#fbbf24;">⏰ DUE SOON</span>`;
      }
      if (status === 'Overdue') {
        return `<span class="badge badge-danger" style="font-size: 11px; font-weight: 800; background: rgba(239,68,68,0.2); border-color:#ef4444; color:#ef4444;">⚠️ OVERDUE</span>`;
      }
      return `<span class="badge badge-warning" style="font-size: 11px; font-weight: 800; background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px dashed rgba(245,158,11,0.4);">⚠ TO FOLLOW</span>`;
    }

    getNetworkBadgeClass(network) {
      const net = (network || '').toUpperCase();
      if (net === 'GLOBE') return 'badge-info';
      if (net === 'TM') return 'badge-warning';
      if (net === 'SMART') return 'badge-success';
      if (net === 'TNT') return 'badge-neutral';
      if (net === 'DITO') return 'badge-purple';
      return 'badge-neutral';
    }

    formatCurrency(val) {
      return `₱${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // =========================================================================
    // 4. SEARCHABLE OUTLET / BOOTH SELECTOR (SECTION 8)
    // =========================================================================
    setupSearchableSelector() {
      const container = document.getElementById('or-searchable-select-container');
      if (!container) return;

      container.innerHTML = `
        <div class="ep-searchable-select" id="or-searchable-select" style="width: 100%; min-width: 0; box-sizing: border-box;">
          <button type="button" class="ep-searchable-trigger" id="or-searchable-trigger" aria-haspopup="listbox" aria-expanded="false" style="padding: 8px 14px; font-size: 13px; width: 100%; box-sizing: border-box;">
            <span class="ep-searchable-label" id="or-searchable-label">🔍 Search Booth Code, Teller, Location...</span>
            <span class="ep-searchable-arrow">▼</span>
          </button>
          <div class="ep-searchable-dropdown" id="or-searchable-dropdown" role="listbox" style="display:none; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box;">
            <div class="ep-searchable-search-box">
              <input type="text" class="ep-searchable-input" id="or-searchable-input" placeholder="Type Booth (DDN-1477), Teller, Purok, Tagum..." autocomplete="off">
            </div>
            <div class="ep-searchable-list" id="or-searchable-list">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      `;

      const trigger = document.getElementById('or-searchable-trigger');
      const dropdown = document.getElementById('or-searchable-dropdown');
      const input = document.getElementById('or-searchable-input');
      const list = document.getElementById('or-searchable-list');
      const label = document.getElementById('or-searchable-label');

      if (!trigger || !dropdown || !input || !list) return;

      const tellers = this.getEligibleStationTellers();

      const renderList = (filterQuery = '') => {
        const q = filterQuery.toLowerCase().trim();
        const matches = tellers.filter(t => {
          if (!q) return true;
          return (
            (t.boothCode && t.boothCode.toLowerCase().includes(q)) ||
            (t.name && t.name.toLowerCase().includes(q)) ||
            (t.purok && t.purok.toLowerCase().includes(q)) ||
            (t.barangay && t.barangay.toLowerCase().includes(q)) ||
            (t.municipality && t.municipality.toLowerCase().includes(q)) ||
            (t.location && t.location.toLowerCase().includes(q))
          );
        });

        if (matches.length === 0) {
          list.innerHTML = `<div class="ep-searchable-empty">No matching registered Station Tellers found.</div>`;
          return;
        }

        list.innerHTML = `
          <div class="ep-searchable-item" data-booth="ALL" style="border-bottom: 1px solid var(--border-color); font-weight: 700;">
            <span>🏢 Show All Outlets</span>
          </div>
          ${matches.map(t => `
            <div class="ep-searchable-item" data-booth="${t.boothCode}">
              <div>
                <div style="font-weight: 800; color: var(--accent-gold); font-family: monospace;">${t.boothCode}</div>
                <div style="font-weight: 600; color: var(--text-main); font-size: 12.5px;">${t.name}</div>
                <div style="font-size: 11px; color: var(--text-dim);">${t.location}</div>
              </div>
              <span class="badge badge-neutral" style="font-size: 10px;">${t.role}</span>
            </div>
          `).join('')}
        `;
      };

      trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        trigger.setAttribute('aria-expanded', !isOpen);
        if (!isOpen) {
          input.value = '';
          renderList('');
          setTimeout(() => input.focus(), 50);
        }
      };

      input.oninput = () => {
        renderList(input.value);
      };

      list.onclick = (e) => {
        const item = e.target.closest('.ep-searchable-item');
        if (!item) return;
        const booth = item.getAttribute('data-booth');
        if (booth === 'ALL') {
          this.selectedBoothCode = null;
          label.textContent = '🔍 Search Booth Code, Teller, Location...';
        } else {
          this.selectedBoothCode = booth;
          const found = tellers.find(t => t.boothCode === booth);
          label.innerHTML = `🏪 <strong>${booth}</strong> • ${found ? found.name : 'Outlet'}`;
        }
        dropdown.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        this.render();
      };

      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          dropdown.style.display = 'none';
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    clearBoothFilter() {
      this.selectedBoothCode = null;
      const label = document.getElementById('or-searchable-label');
      if (label) label.textContent = '🔍 Search Booth Code, Teller, Location...';
      this.render();
    }

    // =========================================================================
    // 5. EVENT LISTENERS SETUP
    // =========================================================================
    setupEventListeners() {
      // Period filter change
      const periodSelect = document.getElementById('or-filter-period');
      if (periodSelect) {
        periodSelect.onchange = () => {
          this.selectedPeriod = periodSelect.value;
          this.render();
        };
      }

      // Search bar
      const searchInput = document.getElementById('or-search-input');
      if (searchInput) {
        searchInput.oninput = () => {
          this.searchQuery = searchInput.value;
          this.render();
        };
      }

      // Quick filter tabs
      document.querySelectorAll('.or-tab-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.or-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTab = btn.getAttribute('data-tab');
          this.render();
        };
      });
    }

    // =========================================================================
    // 6. A.R. (ACKNOWLEDGEMENT RECEIPT) UPLOAD & PREVIEW (SECTION 13 - 17)
    // =========================================================================
    openUploadArModal(recordId) {
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === recordId);
      if (!record) return;

      this.pendingUploadRecordId = recordId;
      this.pendingUploadFileData = null;

      const modal = document.getElementById('modal-upload-ar');
      if (!modal) return;

      document.getElementById('ar-modal-target-title').textContent = `${record.category}: ${record.boothCode}`;
      document.getElementById('ar-modal-target-teller').textContent = record.historicalTeller || 'Station Teller';
      document.getElementById('ar-modal-target-period').textContent = record.coveragePeriod || 'September 30 – October 30, 2026';
      document.getElementById('ar-modal-target-amount').textContent = this.formatCurrency(record.amount);

      const fileInput = document.getElementById('ar-file-input');
      if (fileInput) fileInput.value = '';

      const previewBox = document.getElementById('ar-file-preview-box');
      if (previewBox) {
        previewBox.style.display = 'none';
        previewBox.innerHTML = '';
      }

      const notesInput = document.getElementById('ar-upload-notes');
      if (notesInput) notesInput.value = '';

      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    closeUploadArModal() {
      const modal = document.getElementById('modal-upload-ar');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      this.pendingUploadRecordId = null;
      this.pendingUploadFileData = null;
    }

    handleArFileSelected(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const previewBox = document.getElementById('ar-file-preview-box');
      const reader = new FileReader();

      reader.onload = (e) => {
        this.pendingUploadFileData = {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/pdf',
          dataUrl: e.target.result,
          uploadedAt: new Date().toISOString()
        };

        if (previewBox) {
          previewBox.style.display = 'block';
          const isImg = file.type.startsWith('image/');
          previewBox.innerHTML = `
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 26px;">${isImg ? '🖼️' : '📄'}</div>
              <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 700; font-size: 13px; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${file.name}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${(file.size / 1024).toFixed(1)} KB • ${file.type || 'Document'}</div>
              </div>
              <span class="badge badge-success" style="font-size: 10.5px;">Ready to Attach</span>
            </div>
          `;
        }
      };

      reader.readAsDataURL(file);
    }

    confirmArUpload() {
      if (!this.pendingUploadRecordId || !this.pendingUploadFileData) {
        alert('Please choose an A.R. file (PDF or image) before confirming.');
        return;
      }

      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === this.pendingUploadRecordId);
      if (!record) return;

      const notes = (document.getElementById('ar-upload-notes') || {}).value || '';
      this.pendingUploadFileData.notes = notes;

      record.arFile = this.pendingUploadFileData;
      record.arStatus = 'Received';
      record.updatedAt = new Date().toISOString();

      store.save();
      this.closeUploadArModal();
      this.render();

      if (window.sfx) window.sfx.playChime();
      alert(`Acknowledgement Receipt (A.R.) attached successfully for ${record.boothCode}! Status updated to RECEIVED.`);
    }

    // =========================================================================
    // 7. A.R. VIEWER MODAL
    // =========================================================================
    openViewArModal(recordId) {
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === recordId);
      if (!record || !record.arFile) return;

      this.currentViewArRecordId = recordId;

      const modal = document.getElementById('modal-view-ar');
      if (!modal) return;

      document.getElementById('view-ar-title').textContent = `Acknowledgement Receipt (A.R.) — ${record.boothCode}`;
      document.getElementById('view-ar-teller').textContent = `${record.historicalTeller} [${record.historicalRole}]`;
      document.getElementById('view-ar-period').textContent = record.coveragePeriod;
      document.getElementById('view-ar-filename').textContent = record.arFile.fileName;
      document.getElementById('view-ar-date').textContent = new Date(record.arFile.uploadedAt).toLocaleString();

      const viewerContainer = document.getElementById('view-ar-content-viewer');
      if (viewerContainer) {
        const isImg = record.arFile.fileType.startsWith('image/');
        if (isImg) {
          viewerContainer.innerHTML = `
            <img src="${record.arFile.dataUrl}" alt="A.R. Document" style="max-width: 100%; max-height: 520px; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.4);">
          `;
        } else {
          viewerContainer.innerHTML = `
            <iframe src="${record.arFile.dataUrl}" style="width: 100%; height: 500px; border: none; border-radius: 6px; background: #fff;"></iframe>
          `;
        }
      }

      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    closeViewArModal() {
      const modal = document.getElementById('modal-view-ar');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      this.currentViewArRecordId = null;
    }

    downloadCurrentAr() {
      if (!this.currentViewArRecordId) return;
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === this.currentViewArRecordId);
      if (!record || !record.arFile) return;

      const link = document.createElement('a');
      link.href = record.arFile.dataUrl;
      link.download = record.arFile.fileName || `AR_${record.boothCode}_${record.coveragePeriod}.pdf`;
      link.click();
    }

    replaceCurrentAr() {
      const recId = this.currentViewArRecordId;
      this.closeViewArModal();
      this.openUploadArModal(recId);
    }

    removeCurrentAr() {
      if (!this.currentViewArRecordId) return;
      if (!confirm('Are you sure you want to remove this attached A.R. file? Status will revert to TO FOLLOW.')) return;

      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === this.currentViewArRecordId);
      if (!record) return;

      record.arFile = null;
      record.arStatus = 'To Follow';
      this.evaluateArStatus(record);
      store.save();

      this.closeViewArModal();
      this.render();
    }

    // =========================================================================
    // 8. UNMATCHED BOOTH CODE CORRECTION (SECTION 9 & 10)
    // =========================================================================
    openBoothCorrectionModal(recordId) {
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === recordId);
      if (!record) return;

      this.currentCorrectRecordId = recordId;

      const modal = document.getElementById('modal-correct-booth');
      if (!modal) return;

      document.getElementById('correct-booth-detected').textContent = record.ocrDetectedBooth || record.boothCode || 'Unknown';
      document.getElementById('correct-booth-desc').textContent = record.description || record.rawDescription;

      const select = document.getElementById('correct-booth-select');
      if (select) {
        const tellers = this.getEligibleStationTellers();
        select.innerHTML = `
          <option value="">-- Select Registered Station Teller & Booth --</option>
          ${tellers.map(t => `<option value="${t.boothCode}">${t.boothCode} • ${t.name} (${t.location})</option>`).join('')}
        `;
      }

      const input = document.getElementById('correct-booth-input');
      if (input) input.value = '';

      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    closeBoothCorrectionModal() {
      const modal = document.getElementById('modal-correct-booth');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      this.currentCorrectRecordId = null;
    }

    confirmBoothCorrection() {
      if (!this.currentCorrectRecordId) return;
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === this.currentCorrectRecordId);
      if (!record) return;

      const select = document.getElementById('correct-booth-select');
      const input = document.getElementById('correct-booth-input');

      let newCode = (input && input.value.trim()) || (select && select.value) || '';
      if (!newCode) {
        alert('Please select or enter a valid Booth Code.');
        return;
      }

      newCode = this.normalizeBoothCode(newCode);
      const match = this.lookupMasterRegistry(newCode);

      if (!match) {
        if (!confirm(`Warning: Booth Code "${newCode}" is still not recognized in Master Registry. Save anyway?`)) {
          return;
        }
      }

      record.boothCode = newCode;
      record.boothMatchStatus = match ? 'CORRECTED' : 'NOT_FOUND';
      if (match) {
        record.historicalTeller = match.name;
        record.historicalEmployeeId = match.id;
        record.location = match.address || `${match.purok || ''} ${match.barangay || ''} ${match.municipality || 'Tagum'}`.trim();
        record.purok = match.purok ? this.normalizePurok(match.purok) : record.purok;
        if (record.category === 'Load Allowance' && match.phone) {
          record.posPhone = match.phone;
        }
      }

      store.save();
      this.closeBoothCorrectionModal();
      this.render();

      alert(`✓ Booth Code updated to ${newCode} for ${record.historicalTeller}!`);
    }

    // =========================================================================
    // 9. EDIT MODALS (LOAD ALLOWANCE & OUTLET RENTALS)
    // =========================================================================
    openEditLoadModal(recordId) {
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === recordId);
      if (!record) return;

      this.currentEditRecordId = recordId;

      const modal = document.getElementById('modal-edit-load-allowance');
      if (!modal) return;

      document.getElementById('edit-load-booth').value = record.boothCode;
      document.getElementById('edit-load-teller').value = record.historicalTeller;
      document.getElementById('edit-load-phone').value = record.posPhone || '';
      document.getElementById('edit-load-network').value = record.network || 'GLOBE';
      document.getElementById('edit-load-period').value = record.coveragePeriod || '';
      document.getElementById('edit-load-amount').value = record.amount || 330;
      document.getElementById('edit-load-desc').value = record.description || 'POS Load — 1 Month';
      document.getElementById('edit-load-notes').value = record.notes || '';

      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    closeEditLoadModal() {
      const modal = document.getElementById('modal-edit-load-allowance');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      this.currentEditRecordId = null;
    }

    saveEditLoadModal() {
      if (!this.currentEditRecordId) return;
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === this.currentEditRecordId);
      if (!record) return;

      record.posPhone = document.getElementById('edit-load-phone').value.trim();
      record.network = document.getElementById('edit-load-network').value;
      record.coveragePeriod = document.getElementById('edit-load-period').value.trim();
      record.amount = Number(document.getElementById('edit-load-amount').value) || 330;
      record.description = document.getElementById('edit-load-desc').value.trim();
      record.notes = document.getElementById('edit-load-notes').value.trim();
      record.updatedAt = new Date().toISOString();

      store.save();
      this.closeEditLoadModal();
      this.render();
    }

    openEditRentalModal(recordId) {
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === recordId);
      if (!record) return;

      this.currentEditRecordId = recordId;

      const modal = document.getElementById('modal-edit-outlet-rental');
      if (!modal) return;

      document.getElementById('edit-rental-booth').value = record.boothCode;
      document.getElementById('edit-rental-teller').value = record.historicalTeller;
      document.getElementById('edit-rental-period').value = record.coveragePeriod || '';
      document.getElementById('edit-rental-purok').value = record.purok || 'Purok 6';
      document.getElementById('edit-rental-location').value = record.location || 'Tagum';
      document.getElementById('edit-rental-desc').value = record.description || 'Rent Fee';
      document.getElementById('edit-rental-amount').value = record.amount || 1500;
      document.getElementById('edit-rental-notes').value = record.notes || '';

      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    closeEditRentalModal() {
      const modal = document.getElementById('modal-edit-outlet-rental');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      this.currentEditRecordId = null;
    }

    saveEditRentalModal() {
      if (!this.currentEditRecordId) return;
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === this.currentEditRecordId);
      if (!record) return;

      record.coveragePeriod = document.getElementById('edit-rental-period').value.trim();
      record.purok = this.normalizePurok(document.getElementById('edit-rental-purok').value.trim());
      record.location = document.getElementById('edit-rental-location').value.trim();
      record.description = document.getElementById('edit-rental-desc').value.trim();
      record.amount = Number(document.getElementById('edit-rental-amount').value) || 1500;
      record.notes = document.getElementById('edit-rental-notes').value.trim();
      record.updatedAt = new Date().toISOString();

      store.save();
      this.closeEditRentalModal();
      this.render();
    }

    // =========================================================================
    // 10. PERMANENT DELETION (SECTION 27)
    // =========================================================================
    promptDeleteRecord(recordId) {
      const store = window.appStore;
      const record = (store.data.outletRentals || []).find(r => r.id === recordId);
      if (!record) return;

      this.confirmDeleteId = recordId;

      const modal = document.getElementById('modal-or-confirm-delete');
      if (!modal) return;

      document.getElementById('or-delete-record-desc').textContent = `${record.category} — ${record.boothCode} (${record.historicalTeller}, ${record.coveragePeriod})`;
      modal.classList.add('active');
      modal.style.display = 'flex';
    }

    cancelDeleteRecord() {
      const modal = document.getElementById('modal-or-confirm-delete');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      this.confirmDeleteId = null;
    }

    executeDeleteRecord() {
      if (!this.confirmDeleteId) return;

      const deleteId = this.confirmDeleteId;
      this.cancelDeleteRecord();

      const store = window.appStore;
      if (store && typeof store.deleteOutletRental === 'function') {
        store.deleteOutletRental(deleteId);
      } else if (store) {
        if (!store.data.deletedOutletRentalIds) store.data.deletedOutletRentalIds = [];
        if (!store.data.deletedOutletRentalIds.includes(deleteId)) store.data.deletedOutletRentalIds.push(deleteId);
        const altId = deleteId.startsWith('ORL-') ? deleteId.replace(/^ORL-/, '') : ('ORL-' + deleteId);
        if (!store.data.deletedOutletRentalIds.includes(altId)) store.data.deletedOutletRentalIds.push(altId);
        store.data.outletRentals = (store.data.outletRentals || []).filter(r => r.id !== deleteId && r.id !== altId && r.sourceTxnId !== deleteId && r.sourceTxnId !== altId);
        store.save();
      }

      this.render();

      if (window.sfx) window.sfx.playClick();
    }
  }

  // Export to window
  window.outletRentals = new OutletRentalsModule();

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.outletRentals.init();
    });
  } else {
    window.outletRentals.init();
  }
})();
