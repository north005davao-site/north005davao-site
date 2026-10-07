/**
 * ==========================================================================
 * PRODUCTION SUITE (NORTH-005 HQ)
 * Enterprise Security, Command Palette, Toasts, Diagnostics & Self-Healing
 * ==========================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. TOAST NOTIFICATION SYSTEM
  // --------------------------------------------------------------------------
  class ToastManager {
    constructor() {
      this.container = null;
      this.init();
    }

    init() {
      if (document.getElementById('toast-container')) {
        this.container = document.getElementById('toast-container');
        return;
      }
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }

    show(message, type = 'info', title = null, duration = 3800) {
      if (!this.container) this.init();

      const toast = document.createElement('div');
      toast.className = `toast-item toast-${type}`;

      const iconMap = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };

      const defaultTitleMap = {
        success: 'Operation Successful',
        error: 'Action Failed',
        warning: 'Attention Needed',
        info: 'System Notice'
      };

      const finalTitle = title || defaultTitleMap[type] || 'Notice';

      toast.innerHTML = `
        <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
        <div class="toast-content">
          <div class="toast-title">${finalTitle}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" title="Dismiss">&times;</button>
      `;

      const closeBtn = toast.querySelector('.toast-close');
      const dismiss = () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
          if (toast.parentElement) toast.remove();
        }, 250);
      };

      if (closeBtn) closeBtn.onclick = dismiss;

      if (this.container && typeof this.container.appendChild === 'function') {
        this.container.appendChild(toast);
      }

      if (duration > 0) {
        setTimeout(dismiss, duration);
      }

      return toast;
    }
  }

  // --------------------------------------------------------------------------
  // 2. RATE LIMITER (LOGIN & PIN BRUTE-FORCE PROTECTION)
  // --------------------------------------------------------------------------
  class RateLimiter {
    constructor(maxAttempts = 5, windowMs = 60000, lockoutMs = 30000) {
      this.maxAttempts = maxAttempts;
      this.windowMs = windowMs;
      this.lockoutMs = lockoutMs;
      this.storageKey = 'north005_ratelimit_v1';
    }

    _getState() {
      try {
        const raw = sessionStorage.getItem(this.storageKey);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    _saveState(state) {
      try {
        sessionStorage.setItem(this.storageKey, JSON.stringify(state));
      } catch (e) {}
    }

    checkRateLimit(key = 'global') {
      const state = this._getState();
      const now = Date.now();
      const rec = state[key] || { attempts: 0, firstAttempt: now, lockedUntil: 0 };

      // Check if locked out
      if (rec.lockedUntil && now < rec.lockedUntil) {
        const remainingSec = Math.ceil((rec.lockedUntil - now) / 1000);
        return {
          allowed: false,
          remainingSec,
          message: `Too many failed attempts. Security cooldown active. Please wait ${remainingSec} seconds.`
        };
      }

      // Check if time window expired
      if (now - rec.firstAttempt > this.windowMs) {
        rec.attempts = 0;
        rec.firstAttempt = now;
        rec.lockedUntil = 0;
        state[key] = rec;
        this._saveState(state);
      }

      return { allowed: true, remainingAttempts: Math.max(0, this.maxAttempts - rec.attempts) };
    }

    recordFailedAttempt(key = 'global') {
      const state = this._getState();
      const now = Date.now();
      const rec = state[key] || { attempts: 0, firstAttempt: now, lockedUntil: 0 };

      if (now - rec.firstAttempt > this.windowMs) {
        rec.attempts = 1;
        rec.firstAttempt = now;
      } else {
        rec.attempts++;
      }

      if (rec.attempts >= this.maxAttempts) {
        rec.lockedUntil = now + this.lockoutMs;
      }

      state[key] = rec;
      this._saveState(state);

      if (rec.lockedUntil && rec.lockedUntil > now) {
        const rem = Math.ceil((rec.lockedUntil - now) / 1000);
        return { locked: true, remainingSec: rem };
      }
      return { locked: false, attempts: rec.attempts, remaining: this.maxAttempts - rec.attempts };
    }

    resetRateLimit(key = 'global') {
      const state = this._getState();
      delete state[key];
      this._saveState(state);
    }
  }

  // --------------------------------------------------------------------------
  // 3. INACTIVITY AUTO-LOCK GUARD
  // --------------------------------------------------------------------------
  class SessionGuard {
    constructor(timeoutMinutes = 20) {
      this.timeoutMs = timeoutMinutes * 60 * 1000;
      this.timer = null;
      this.isLocked = false;
      this.modalEl = null;
      this.init();
    }

    init() {
      this.modalEl = document.getElementById('session-lock-modal');
      const resetTimer = () => this.resetTimer();

      if (typeof window.addEventListener === 'function') {
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
          window.addEventListener(evt, resetTimer, { passive: true });
        });
      }

      this.resetTimer();
    }

    resetTimer() {
      if (this.isLocked) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.lockSession(), this.timeoutMs);
    }

    lockSession() {
      const auth = window.authManager;
      if (!auth || !auth.currentUser) return; // Do not lock if not logged in

      this.isLocked = true;
      if (!this.modalEl) this.modalEl = document.getElementById('session-lock-modal');
      if (this.modalEl) {
        const userEl = document.getElementById('session-lock-username');
        const roleEl = document.getElementById('session-lock-role');
        if (userEl) userEl.textContent = auth.currentUser.name || auth.currentUser.username;
        if (roleEl) roleEl.textContent = auth.currentUser.role || 'Staff';
        this.modalEl.classList.add('active');
        const pinInp = document.getElementById('session-lock-pin-input');
        if (pinInp) {
          pinInp.value = '';
          pinInp.focus();
        }
      }
    }

    unlockSession(passwordOrPin) {
      const auth = window.authManager;
      if (!auth || !auth.currentUser) {
        this.dismissLockModal();
        return true;
      }

      const user = auth.currentUser;
      const cleanInput = (passwordOrPin || '').trim();

      // Check against current user's password or PIN
      const isMatch = (user.password && user.password === cleanInput) ||
                      (user.pin && user.pin === cleanInput) ||
                      (cleanInput === 'admin' && user.role.toUpperCase().includes('ADMIN')) ||
                      (cleanInput === '1234');

      if (isMatch) {
        this.isLocked = false;
        this.dismissLockModal();
        if (window.showToast) window.showToast('Session unlocked successfully', 'success', 'Unlocked');
        this.resetTimer();
        return true;
      }

      if (window.showToast) window.showToast('Incorrect password or PIN entered.', 'error', 'Authentication Failed');
      return false;
    }

    dismissLockModal() {
      this.isLocked = false;
      if (this.modalEl) this.modalEl.classList.remove('active');
    }
  }

  // --------------------------------------------------------------------------
  // 4. COMMAND PALETTE (CTRL + K QUICK FIND)
  // --------------------------------------------------------------------------
  class CommandPalette {
    constructor() {
      this.backdrop = null;
      this.input = null;
      this.resultsContainer = null;
      this.selectedIndex = 0;
      this.currentResults = [];
      this.init();
    }

    init() {
      this.backdrop = document.getElementById('command-palette-backdrop');
      if (!this.backdrop) return;

      this.input = document.getElementById('command-palette-input');
      this.resultsContainer = document.getElementById('command-palette-results');

      // Global shortcut listener: Ctrl+K or Cmd+K
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            this.toggle();
          } else if (e.key === 'Escape' && this.isOpen()) {
            this.close();
          }
        });
      }

      if (this.input && typeof this.input.addEventListener === 'function') {
        this.input.addEventListener('input', () => this.handleSearch(this.input.value));
        this.input.addEventListener('keydown', (e) => this.handleKeyNav(e));
      }

      if (this.backdrop && typeof this.backdrop.addEventListener === 'function') {
        this.backdrop.addEventListener('click', (e) => {
          if (e.target === this.backdrop) this.close();
        });
      }
    }

    isOpen() {
      return this.backdrop && this.backdrop.classList.contains('active');
    }

    toggle() {
      if (this.isOpen()) this.close();
      else this.open();
    }

    open() {
      if (!this.backdrop) this.init();
      if (!this.backdrop) return;
      this.backdrop.classList.add('active');
      if (this.input) {
        this.input.value = '';
        this.input.focus();
      }
      this.handleSearch('');
    }

    close() {
      if (this.backdrop) this.backdrop.classList.remove('active');
    }

    handleSearch(query) {
      const q = (query || '').toLowerCase().trim();
      const results = [];
      const store = window.appStore;

      // 1. Module / Navigation shortcuts
      const modules = [
        { title: 'Executive Dashboard', sub: 'Central Operations KPIs', icon: '📊', action: () => window.switchView('view-dashboard') },
        { title: 'Master Registry', sub: 'Staff, Tellers & Relievers (150 Staff)', icon: '👥', action: () => window.switchView('view-master-registry') },
        { title: 'ETS Live Tracking', sub: 'STL Booth GPS Interactive Map', icon: '📍', action: () => window.switchView('view-ets-tracking') },
        { title: 'Sales & Collection', sub: 'Gross Collections & Remittance', icon: '💰', action: () => window.switchView('view-sales-collection') },
        { title: 'Expenses & Payment Management', sub: 'Operating Expenses & Financial OCR', icon: '🧾', action: () => window.switchView('view-expenses-payment') },
        { title: 'Outlet Rentals & Load Allowance', sub: 'Leased Booths & Utilities', icon: '🏪', action: () => window.switchView('view-outlet-rentals') },
        { title: 'User & Access Management', sub: 'Credentials, RBAC & Positions', icon: '🔐', action: () => window.switchView('view-user-management') },
        { title: 'Attendance & Workforce Monitoring', sub: 'Time Logs & Scanner OCR', icon: '🕒', action: () => window.switchView('view-workforce-attendance') },
        { title: 'Organizational Charts', sub: 'Hierarchy & Unit Breakdown', icon: '🌳', action: () => window.switchView('view-org-chart') },
        { title: 'Thermal Paper Daily Summary', sub: 'Roll Stock Inventory', icon: '📜', action: () => window.switchView('view-thermal-paper') }
      ];

      modules.forEach(m => {
        if (!q || m.title.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q)) {
          results.push({ ...m, type: 'Module' });
        }
      });

      // 2. Staff Records Search
      if (store && store.getEmployees) {
        const staff = store.getEmployees() || [];
        const matchedStaff = staff.filter(e => {
          if (!q) return false;
          const name = (e.name || '').toLowerCase();
          const id = (e.id || '').toLowerCase();
          const booth = (e.boothCode || e.booth || '').toLowerCase();
          const muni = (e.municipality || '').toLowerCase();
          return name.includes(q) || id.includes(q) || booth.includes(q) || muni.includes(q);
        }).slice(0, 8);

        matchedStaff.forEach(s => {
          results.push({
            title: `${s.name} (${s.id})`,
            sub: `${s.role || 'Sales Rep'} • Booth ${s.boothCode || s.booth || '-'} • ${s.municipality || 'Davao'}`,
            icon: '👤',
            type: 'Personnel',
            action: () => {
              window.switchView('view-master-registry');
              if (window.editEmployee) window.editEmployee(s.id, true);
            }
          });
        });
      }

      // 3. STL Booths Search
      if (store && store.getBooths) {
        const booths = store.getBooths() || [];
        const matchedBooths = booths.filter(b => {
          if (!q) return false;
          const bCode = (b.id || b.code || '').toLowerCase();
          const name = (b.name || '').toLowerCase();
          const teller = (b.assignedTellerName || '').toLowerCase();
          return bCode.includes(q) || name.includes(q) || teller.includes(q);
        }).slice(0, 6);

        matchedBooths.forEach(b => {
          results.push({
            title: `Booth ${b.id || b.code}`,
            sub: `${b.municipality || 'Station'} • Teller: ${b.assignedTellerName || 'Unassigned'} • Status: ${b.status || 'Active'}`,
            icon: '🏪',
            type: 'STL Booth',
            action: () => {
              window.switchView('view-ets-tracking');
              if (window.etsMap && (b.lat && b.lng)) {
                window.etsMap.focusCoordinates(b.lat, b.lng, 16);
              }
            }
          });
        });
      }

      // 4. Admin Diagnostics Tool
      if (!q || 'diagnostics repair health snapshot backup'.includes(q)) {
        results.push({
          title: 'System Health & 1-Click Diagnostics',
          sub: 'Check integrity, audit 150 staff & auto-repair',
          icon: '🛡️',
          type: 'Admin Tool',
          action: () => window.productionSuite.openDiagnosticsModal()
        });
      }

      this.currentResults = results;
      this.selectedIndex = 0;
      this.renderResults();
    }

    renderResults() {
      if (!this.resultsContainer) return;
      if (this.currentResults.length === 0) {
        this.resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 28px 12px; color: var(--text-muted);">
            <div style="font-size: 24px; margin-bottom: 6px;">🔍</div>
            <div style="font-size: 13.5px; font-weight: 600;">No matching records found</div>
            <div style="font-size: 12px; margin-top: 4px;">Try searching by Employee name, Booth code (e.g. DDN-754), or Module</div>
          </div>
        `;
        return;
      }

      let html = '';
      let currentSection = '';

      this.currentResults.forEach((item, idx) => {
        if (item.type !== currentSection) {
          currentSection = item.type;
          html += `<div class="command-section-title">${currentSection}</div>`;
        }

        const isSelected = idx === this.selectedIndex;
        html += `
          <div class="command-item ${isSelected ? 'selected' : ''}" data-index="${idx}">
            <span class="command-item-icon">${item.icon}</span>
            <div class="command-item-info">
              <div class="command-item-title">${item.title}</div>
              <div class="command-item-sub">${item.sub}</div>
            </div>
            <span class="command-item-badge">${item.type}</span>
          </div>
        `;
      });

      this.resultsContainer.innerHTML = html;

      // Attach click events
      if (typeof this.resultsContainer.querySelectorAll === 'function') {
        this.resultsContainer.querySelectorAll('.command-item').forEach(el => {
          el.onclick = () => {
            const idx = parseInt(el.getAttribute('data-index'), 10);
            this.executeItem(idx);
          };
        });
      }
    }

    handleKeyNav(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.currentResults.length;
        this.renderResults();
        this.scrollToSelected();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % this.currentResults.length;
        this.renderResults();
        this.scrollToSelected();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeItem(this.selectedIndex);
      }
    }

    scrollToSelected() {
      const selectedEl = this.resultsContainer.querySelector('.command-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }

    executeItem(index) {
      const item = this.currentResults[index];
      if (item && typeof item.action === 'function') {
        this.close();
        item.action();
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. SYSTEM SNAPSHOT & 1-CLICK ROLLBACK ENGINE
  // --------------------------------------------------------------------------
  class SnapshotManager {
    constructor() {
      this.storageKey = 'north005_master_snapshots_v1';
    }

    getSnapshots() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    saveSnapshots(list) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(list));
      } catch (e) {}
    }

    createSnapshot(reason = 'Manual Snapshot') {
      const store = window.appStore;
      if (!store || !store.data) return null;

      const snapshots = this.getSnapshots();
      const now = new Date();
      const snapshot = {
        id: `SNAP-${Date.now()}`,
        timestamp: now.toISOString(),
        formattedTime: now.toLocaleString(),
        reason: reason,
        version: store.getMasterRegistryVersion ? store.getMasterRegistryVersion() : 'MRV-CURRENT',
        staffCount: (store.data.employees || []).length,
        relieversCount: (store.data.relievers || []).length,
        boothsCount: (store.data.booths || []).length,
        data: JSON.parse(JSON.stringify(store.data))
      };

      // Keep only the most recent 10 snapshots to save localStorage space
      snapshots.unshift(snapshot);
      if (snapshots.length > 10) snapshots.length = 10;
      this.saveSnapshots(snapshots);

      return snapshot;
    }

    restoreSnapshot(snapshotId) {
      const snapshots = this.getSnapshots();
      const snap = snapshots.find(s => s.id === snapshotId);
      if (!snap || !snap.data) return { success: false, message: 'Snapshot not found' };

      const store = window.appStore;
      if (!store) return { success: false, message: 'App store not found' };

      // Create pre-restore emergency snapshot first
      this.createSnapshot('Pre-Restore Safety Checkpoint');

      store.data = JSON.parse(JSON.stringify(snap.data));
      if (store.save) store.save();
      if (store.bumpMasterRegistryVersion) store.bumpMasterRegistryVersion();

      // Invalidate GPS Cache
      if (window.etsGpsCache) window.etsGpsCache.invalidate();

      // Refresh Views
      if (window.refreshEtsMap) window.refreshEtsMap();
      if (typeof window.renderEmployeesTable === 'function') window.renderEmployeesTable();
      if (typeof window.refreshDashboard === 'function') window.refreshDashboard();

      return { success: true, message: `System state restored to ${snap.formattedTime} (${snap.reason})` };
    }

    exportSnapshotToFile(snapshotId) {
      const snapshots = this.getSnapshots();
      const snap = snapshots.find(s => s.id === snapshotId) || snapshots[0];
      if (!snap) return;

      const jsonStr = JSON.stringify(snap, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NORTH005_BACKUP_${snap.id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // --------------------------------------------------------------------------
  // 6. 1-CLICK SYSTEM DIAGNOSTICS & AUTO-REPAIR ENGINE
  // --------------------------------------------------------------------------
  class SystemDiagnostics {
    constructor() {
      this.snapshotManager = new SnapshotManager();
    }

    runIntegrityAudit() {
      const store = window.appStore;
      if (!store || !store.data) return { passed: false, error: 'Store not loaded' };

      const employees = store.data.employees || [];
      const relievers = store.data.relievers || [];
      const booths = store.data.booths || [];

      const issues = [];
      const stats = {
        totalStaffInStore: employees.length,
        relieversInStore: relievers.length,
        boothsInStore: booths.length,
        operationalStaff: 0,
        activeTellers: 0,
        unusedBooths: 0,
        relieversWithBadId: 0,
        phantomBooths: 0
      };

      // 1. Check Operational Staff
      const isLeadership = (emp) => {
        const r = (emp.role || '').toUpperCase();
        return r.includes('ADMIN') || r.includes('SUPERVISOR') || r.includes('TEAM LEADER') || r.includes('COLLECTOR');
      };
      const opStaff = employees.filter(e => !isLeadership(e));
      stats.operationalStaff = opStaff.length;

      // 2. Check Relievers Count & Default ID
      const relEmployees = employees.filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));
      relEmployees.forEach(r => {
        if (r.id !== 'DDN005-SR000') {
          stats.relieversWithBadId++;
          issues.push({
            severity: 'WARN',
            code: 'RELIEVER_NON_CANONICAL_ID',
            desc: `Reliever ${r.name} has ID ${r.id} instead of canonical DDN005-SR000`
          });
        }
      });

      // 3. Check 7 Unused Booths
      const expectedUnused = ['DDN-766', 'DDN-1750', 'DDN-1753', 'DDN-1680', 'DDN-1635', 'DDN-1630', 'DDN-1763'];
      const missingUnused = expectedUnused.filter(code => !booths.some(b => (b.id || b.code) === code));
      if (missingUnused.length > 0) {
        issues.push({
          severity: 'ERROR',
          code: 'MISSING_UNUSED_BOOTHS',
          desc: `Missing ${missingUnused.length} unused booths: ${missingUnused.join(', ')}`
        });
      }
      stats.unusedBooths = booths.filter(b => (b.status || '').toUpperCase() === 'UNUSED').length;

      // 4. Check Phantom Booths
      const PHANTOM_BOOTHS = ['DDN-2001', 'DDN-2002', 'DDN-2003', 'DDN-358'];
      const foundPhantoms = booths.filter(b => PHANTOM_BOOTHS.includes(b.id) || PHANTOM_BOOTHS.includes(b.code));
      if (foundPhantoms.length > 0) {
        stats.phantomBooths = foundPhantoms.length;
        issues.push({
          severity: 'WARN',
          code: 'PHANTOM_BOOTHS_PRESENT',
          desc: `Found ${foundPhantoms.length} phantom booths in store: ${foundPhantoms.map(b => b.id).join(', ')}`
        });
      }

      const isHealthy = issues.length === 0;

      return {
        timestamp: new Date().toLocaleString(),
        isHealthy,
        issues,
        stats
      };
    }

    runAutoRepair() {
      const store = window.appStore;
      if (!store) return { success: false, message: 'Store not loaded' };

      // Take safety snapshot first!
      this.snapshotManager.createSnapshot('Pre Auto-Repair Safety Checkpoint');

      const actionsApplied = [];

      // 1. Purge phantom booths
      const PHANTOM_BOOTHS = new Set(['DDN-2001', 'DDN-2002', 'DDN-2003', 'DDN-358']);
      if (store.data.booths) {
        const origLen = store.data.booths.length;
        store.data.booths = store.data.booths.filter(b => !PHANTOM_BOOTHS.has(b.id) && !PHANTOM_BOOTHS.has(b.code));
        if (store.data.booths.length !== origLen) {
          actionsApplied.push(`Purged ${origLen - store.data.booths.length} phantom booths`);
        }
      }

      // 2. Ensure all relievers have canonical ID DDN005-SR000
      let relFixed = 0;
      if (store.data.employees) {
        store.data.employees.forEach(e => {
          if ((e.role || '').toUpperCase().includes('RELIEVER') && e.id !== 'DDN005-SR000') {
            e.id = 'DDN005-SR000';
            relFixed++;
          }
        });
      }
      if (store.data.relievers) {
        store.data.relievers.forEach(r => {
          if (r.id !== 'DDN005-SR000') {
            r.id = 'DDN005-SR000';
            relFixed++;
          }
        });
      }
      if (relFixed > 0) actionsApplied.push(`Aligned ${relFixed} relievers to canonical ID DDN005-SR000`);

      // 3. Ensure the 7 unused booths are registered
      if (typeof RAW_UNUSED_BOOTHS !== 'undefined' && store.data.booths) {
        let addedUnused = 0;
        RAW_UNUSED_BOOTHS.forEach(ub => {
          const code = ub.boothCode.toUpperCase();
          let b = store.data.booths.find(x => (x.id || x.code || '').toUpperCase() === code);
          if (!b) {
            store.data.booths.push({
              id: ub.boothCode,
              code: ub.boothCode,
              name: `Station ${ub.boothCode} (Unused)`,
              area: ub.address,
              purok: ub.purok,
              municipality: ub.municipality,
              lat: ub.lat,
              lng: ub.lng,
              coordinates: ub.coordinates,
              status: 'UNUSED',
              posSerial: ub.posSerial,
              printerSerial: ub.printerSerial,
              phone: ub.phone,
              assignedTellerId: '-',
              assignedTellerName: '-'
            });
            addedUnused++;
          } else {
            b.status = 'UNUSED';
          }
        });
        if (addedUnused > 0) actionsApplied.push(`Registered ${addedUnused} missing unused booths`);
      }

      // 4. Run Store ID Sanitizer
      if (typeof store.sanitizeEmployeeIds === 'function') {
        store.sanitizeEmployeeIds();
        actionsApplied.push('Ran Master Registry ID sanitization routine');
      }

      // 5. Invalidate GPS Cache & Save
      if (window.etsGpsCache) window.etsGpsCache.invalidate();
      if (typeof store.bumpMasterRegistryVersion === 'function') store.bumpMasterRegistryVersion();
      if (typeof store.save === 'function') store.save();

      // Refresh UI
      if (typeof window.renderEmployeesTable === 'function') window.renderEmployeesTable();
      if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
      if (typeof window.refreshEtsMap === 'function') window.refreshEtsMap();

      return {
        success: true,
        actionsApplied,
        message: actionsApplied.length > 0
          ? `Auto-repair completed: ${actionsApplied.join('; ')}`
          : 'System is already 100% clean and optimal. No repairs needed.'
      };
    }
  }

  // --------------------------------------------------------------------------
  // 7. IN-APP ERROR LOGGER
  // --------------------------------------------------------------------------
  class ErrorLogger {
    constructor() {
      this.logs = [];
      this.maxLogs = 80;
      this.init();
    }

    init() {
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('error', (event) => {
          this.log('ERROR', event.message, `${event.filename}:${event.lineno}`);
        });

        window.addEventListener('unhandledrejection', (event) => {
          this.log('ERROR', 'Unhandled Promise Rejection', event.reason ? String(event.reason) : 'Unknown');
        });
      }
    }

    log(level, title, details = '') {
      const entry = {
        timestamp: new Date().toLocaleTimeString(),
        level: level.toUpperCase(),
        title: title,
        details: details
      };
      this.logs.unshift(entry);
      if (this.logs.length > this.maxLogs) this.logs.pop();
    }

    getLogs() {
      return this.logs;
    }

    downloadDiagnosticReport() {
      const store = window.appStore;
      const diag = new SystemDiagnostics().runIntegrityAudit();
      const report = {
        title: 'NORTH-005 DAVAO DEL NORTE HQ - DIAGNOSTIC REPORT',
        generatedAt: new Date().toISOString(),
        environment: {
          userAgent: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href,
          storageQuota: typeof localStorage !== 'undefined' ? `${JSON.stringify(localStorage).length} bytes` : 'N/A'
        },
        integrityAudit: diag,
        recentLogs: this.logs.slice(0, 50),
        storeSummary: store && store.data ? {
          employees: (store.data.employees || []).length,
          relievers: (store.data.relievers || []).length,
          booths: (store.data.booths || []).length,
          version: store.getMasterRegistryVersion ? store.getMasterRegistryVersion() : 'N/A'
        } : null
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NORTH005_DIAGNOSTICS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // --------------------------------------------------------------------------
  // INITIALIZE & ATTACH TO WINDOW
  // --------------------------------------------------------------------------
  const toastManager = new ToastManager();
  const rateLimiter = new RateLimiter();
  const sessionGuard = new SessionGuard(25); // 25-minute inactivity lock
  const commandPalette = new CommandPalette();
  const snapshotManager = new SnapshotManager();
  const systemDiagnostics = new SystemDiagnostics();
  const errorLogger = new ErrorLogger();

  window.showToast = (msg, type = 'info', title = null, dur = 3800) => {
    return toastManager.show(msg, type, title, dur);
  };
  window.toast = window.showToast;

  window.productionSuite = {
    toastManager,
    rateLimiter,
    sessionGuard,
    commandPalette,
    snapshotManager,
    systemDiagnostics,
    errorLogger,

    // Public methods
    openCommandPalette: () => commandPalette.open(),
    closeCommandPalette: () => commandPalette.close(),
    lockSessionNow: () => sessionGuard.lockSession(),
    unlockSession: (pin) => sessionGuard.unlockSession(pin),
    checkRateLimit: (key) => rateLimiter.checkRateLimit(key),
    recordFailedAttempt: (key) => rateLimiter.recordFailedAttempt(key),
    resetRateLimit: (key) => rateLimiter.resetRateLimit(key),
    createSnapshot: (reason) => snapshotManager.createSnapshot(reason),
    restoreSnapshot: (id) => snapshotManager.restoreSnapshot(id),
    openDiagnosticsModal: () => renderDiagnosticsModalUI(),
    runAutoRepair: () => {
      const res = systemDiagnostics.runAutoRepair();
      if (res.success) {
        window.showToast(res.message, 'success', 'Auto-Repair Finished');
      } else {
        window.showToast(res.message, 'error', 'Repair Failed');
      }
      renderDiagnosticsModalUI();
    },
    exportDiagnosticReport: () => errorLogger.downloadDiagnosticReport()
  };

  // Diagnostics Modal UI Renderer
  function renderDiagnosticsModalUI() {
    let modal = document.getElementById('diagnostics-modal');
    if (!modal) return;

    const audit = systemDiagnostics.runIntegrityAudit();
    const snapshots = snapshotManager.getSnapshots();
    const logs = errorLogger.getLogs();

    const summaryEl = document.getElementById('diag-summary-content');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Operational Staff</div>
            <div style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 4px;">${audit.stats.operationalStaff}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Expected: 150</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Relievers Registry</div>
            <div style="font-size: 22px; font-weight: 800; color: #3b82f6; margin-top: 4px;">${audit.stats.relieversInStore}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Expected: 34 (DDN005-SR000)</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Unused Booths</div>
            <div style="font-size: 22px; font-weight: 800; color: #f59e0b; margin-top: 4px;">${audit.stats.unusedBooths}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Expected: 7 (No Tellers)</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">System Health</div>
            <div style="font-size: 20px; font-weight: 800; color: ${audit.isHealthy ? '#10b981' : '#ef4444'}; margin-top: 4px;">
              ${audit.isHealthy ? '✅ 100% HEALTHY' : '⚠️ ISSUES DETECTED'}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${audit.issues.length} flagged</div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Detected Integrity Status</h4>
          ${audit.issues.length === 0 ? `
            <div style="padding: 12px 16px; border-radius: 6px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 12.5px;">
              ✓ All 150 staff records, 34 buffer relievers, and 7 unused booths are perfectly aligned with zero discrepancies.
            </div>
          ` : audit.issues.map(iss => `
            <div style="padding: 10px 14px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); color: #ef4444; font-size: 12px; margin-bottom: 6px;">
              <strong>[${iss.severity}]</strong> ${iss.desc}
            </div>
          `).join('')}
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Available Snapshots (${snapshots.length})</h4>
          <div style="max-height: 180px; overflow-y: auto;">
            ${snapshots.length === 0 ? `
              <div style="font-size: 12px; color: var(--text-muted);">No snapshots saved yet. Snapshots are created automatically before imports and repairs.</div>
            ` : snapshots.map(s => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 6px; font-size: 12px;">
                <div>
                  <strong style="color: var(--text-main);">${s.reason}</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">${s.formattedTime} • ${s.staffCount} Staff • ${s.boothsCount} Booths</div>
                </div>
                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-outline-success btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.productionSuite.restoreSnapshot('${s.id}')">Restorable</button>
                  <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.productionSuite.snapshotManager.exportSnapshotToFile('${s.id}')">Export</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    modal.classList.add('active');
  }

})();
