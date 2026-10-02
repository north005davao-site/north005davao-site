/**
 * APEX OmniERP - Expenses & Payment Module v2.0
 * Single-Source-of-Truth synchronized transaction model.
 * Full OCR + Shortage/CA Tracking + Ledger History & Real-Time Balance Synchronization
 */
class ExpensesPaymentController {
  constructor() {
    this.activeTab = 'expenses';
    this.searchQuery = '';
    this.selectedTeller = '';
    this.selectedTellerId = '';
    this.selectedCollector = '';
    this.selectedCollectorId = '';
    this.currentCalendarYear = 2026;
    this.currentCalendarMonth = 8;
    this.pendingOcrResult = null;
    this.uploadedImageSrc = null;
    this.uploadedImageHash = null;
    this.zoomLevel = 1;
    this.initialized = false;

    // Pagination states
    this.expensesPage = 1;
    this.expensesPageSize = 10;
    this.shortLedgerPage = 1;
    this.shortLedgerPageSize = 10;
    this.caLedgerPage = 1;
    this.caLedgerPageSize = 10;
    this.paymentsPage = 1;
    this.paymentsPageSize = 10;

    // Editing & Confirm state
    this._editingTxnId = null;
    this._editingSection = 'expense';
    this._editingOriginalAmount = 0;
    this._confirmCallback = null;
    this._confirmCancelCallback = null;
  }

  init() {
    this.ensureSeedData();
    if (!this.initialized) {
      this.attachEventListeners();
      if (window.appStore && typeof window.appStore.subscribe === 'function') {
        window.appStore.subscribe(() => {
          if (this.initialized) {
            if (this.activeTab === 'short-tracker') {
              this.setupSearchableTellerSelect();
            } else if (this.activeTab === 'ca-tracker') {
              this.setupSearchableCollectorSelect();
            }
          }
        });
      }
      this.initialized = true;
    }
    this.render();
  }

  // =========================================================================
  // SEED DATA
  // =========================================================================
  ensureSeedData() {
    const store = window.appStore;
    if (!store) return;
    if (!store.data.transactions) store.data.transactions = [];
    if (!store.data.deletedTransactionIds) store.data.deletedTransactionIds = [];
    if (!store.data.uploadedImageHashes) store.data.uploadedImageHashes = [];
    if (!store.data.employees) store.data.employees = [];

    // Purge any lingering deleted transactions
    if (store.data.deletedTransactionIds.length > 0) {
      store.data.transactions = store.data.transactions.filter(t => t && !store.data.deletedTransactionIds.includes(t.id));
    }

    // Purge any lingering deletedFromTracker records and deduplicate identical IDs
    const seen = new Set();
    const clean = [];
    let modified = false;

    store.data.transactions.forEach(t => {
      if (!t) return;
      if (t.deletedFromTracker || store.data.deletedTransactionIds.includes(t.id)) {
        modified = true;
        return;
      }
      if (t.name && t.name.toUpperCase().includes('JENYVA')) {
        t.name = 'JUVYLYN H. TURA';
        modified = true;
      }
      if (!t.id) {
        t.id = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        modified = true;
      }
      if (seen.has(t.id)) {
        t.id = t.id + '-DUP-' + Math.random().toString(36).substr(2, 6);
        modified = true;
      }
      seen.add(t.id);
      clean.push(t);
    });

    if (modified || clean.length !== store.data.transactions.length) {
      store.data.transactions = clean;
      store.save();
    }

    if (!store.data.employees.find(e => e.name && e.name.toUpperCase().includes('TURA'))) {
      store.data.employees.push({
        id: 'DDN005-TEL-TURA',
        name: 'JUVYLYN H. TURA',
        role: 'Teller',
        department: 'dept-tel',
        area: 'Tagum City Station',
        boothCode: 'DDN-1140',
        status: 'Terminated',
        etsStatus: 'Offline'
      });
    }

    // User Request: Delete/Reset to 0 the stored data for Expenses & Payment Management
    // Purge any legacy sample demo transactions (TXN-TURA, TXN-MAC, TXN-EXP, TXN-2024)
    if (store.data.transactions && Array.isArray(store.data.transactions)) {
      const isLegacyDemo = (id) => typeof id === 'string' && (id.startsWith('TXN-TURA-') || id.startsWith('TXN-MAC-') || id.startsWith('TXN-EXP-') || id.startsWith('TXN-2024-') || id.startsWith('TXN-SAMPLE-'));
      store.data.transactions = store.data.transactions.filter(t => t && !isLegacyDemo(t.id));
    }

    store.data.epSeedInitialized = true;
    store.save();
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  attachEventListeners() {
    const searchInput = document.getElementById('ep-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').trim();
        this.expensesPage = 1;
        this.shortLedgerPage = 1;
        this.caLedgerPage = 1;
        this.paymentsPage = 1;
        this.renderCurrentTab();
      });
    }

    document.querySelectorAll('.ep-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
    });

    const fileInput = document.getElementById('ep-image-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.handleImageFile(file);
        }
        fileInput.value = ''; // Reset value so re-selecting same file triggers change
      });
    }

    const dropZone = document.getElementById('ep-upload-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    const editAmountInput = document.getElementById('ep-edit-txn-amount');
    if (editAmountInput) {
      editAmountInput.addEventListener('input', () => this.handleEditAmountInput());
    }
    const editTypeSelect = document.getElementById('ep-edit-txn-type');
    if (editTypeSelect) {
      editTypeSelect.addEventListener('change', () => this.handleEditAmountInput());
    }

    // Delegated click handler for Edit and Delete buttons across all tabs
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.ep-btn-edit') || e.target.closest('[data-ep-action="edit"]');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        const txnId = editBtn.getAttribute('data-id');
        const section = editBtn.getAttribute('data-section') || 'expense';
        if (txnId) {
          this.openEditModal(txnId, section);
        }
        return;
      }

      const delBtn = e.target.closest('.ep-btn-delete') || e.target.closest('[data-ep-action="delete"]');
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        const txnId = delBtn.getAttribute('data-id');
        const section = delBtn.getAttribute('data-section') || 'expense';
        if (txnId) {
          if (section === 'expense') this.onDeleteExpenseClicked(txnId);
          else if (section === 'short') this.onDeleteShortClicked(txnId);
          else if (section === 'ca') this.onDeleteCAClicked(txnId);
          else if (section === 'payment') this.onDeletePaymentClicked(txnId);
        }
        return;
      }
    });
  }

  triggerImageUpload() {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot upload receipt documents.');
      return;
    }
    const fileInput = document.getElementById('ep-image-upload-input');
    if (fileInput) fileInput.click();
  }

  switchTab(tabName) {
    if (window.authManager && window.authManager.isCollector()) {
      if (tabName !== 'ca-tracker') {
        alert('Permission Denied: Collector accounts can only access the Cash Advance Tracker in view-only mode.');
        return;
      }
    }
    if (window.sfx) window.sfx.playClick();
    this.activeTab = tabName;
    document.querySelectorAll('.ep-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.ep-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === ('ep-tab-' + tabName));
    });
    this.renderCurrentTab();
  }

  // =========================================================================
  // IMAGE UPLOAD + DUPLICATE DETECTION
  // =========================================================================
  async handleImageFile(file) {
    if (!file) return;
    const sig = file.name + '::' + file.size + '::' + file.lastModified;
    const reader = new FileReader();
    reader.onload = async (e) => {
      this.uploadedImageSrc = e.target.result;
      this.uploadedImageHash = sig;
      const store = window.appStore;
      const hashes = (store && store.data.uploadedImageHashes) || [];
      const existing = hashes.find(h => h.hash === sig);
      if (existing) {
        this.showDuplicateWarning(existing);
        return;
      }
      await this.runOcrProcess(this.uploadedImageSrc);
    };
    reader.readAsDataURL(file);
  }

  showDuplicateWarning(existingRecord) {
    const modal = document.getElementById('modal-ep-duplicate-warning');
    if (!modal) return;
    const dateEl = document.getElementById('ep-dup-existing-date');
    if (dateEl) dateEl.textContent = (existingRecord && existingRecord.date) || 'Previous Upload Session';
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  closeDuplicateModal() {
    const modal = document.getElementById('modal-ep-duplicate-warning');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  proceedDespiteDuplicate() {
    this.closeDuplicateModal();
    if (this.uploadedImageSrc) this.runOcrProcess(this.uploadedImageSrc);
  }

  async runOcrProcess(imageSrc) {
    this.showOcrLoading(true);
    const pText = document.getElementById('ep-ocr-progress-text');
    const pBar = document.getElementById('ep-ocr-progress-bar');
    if (pText) pText.textContent = 'Preprocessing handwritten image with OpenCV filters...';
    if (pBar) pBar.style.width = '35%';

    try {
      await new Promise(r => setTimeout(r, 400));
      if (pBar) pBar.style.width = '70%';
      if (pText) pText.textContent = 'Reading handwritten entries line-by-line...';

      if (window.ocrEngine && typeof window.ocrEngine.recognize === 'function') {
        const result = await window.ocrEngine.recognize(imageSrc, (pct) => {
          if (pBar) pBar.style.width = Math.max(35, pct) + '%';
        });
        this.pendingOcrResult = (result && result.reportData) || window.ocrEngine.parseHandwrittenReport('');
      } else if (window.ocrEngine && typeof window.ocrEngine.parseHandwrittenReport === 'function') {
        this.pendingOcrResult = window.ocrEngine.parseHandwrittenReport('');
      } else {
        this.pendingOcrResult = { items: [] };
      }
      if (pBar) pBar.style.width = '100%';
      await new Promise(r => setTimeout(r, 200));
      this.showOcrLoading(false);
      this.openReviewModal();
    } catch (err) {
      console.warn('OCR fallback:', err);
      this.pendingOcrResult = window.ocrEngine ? window.ocrEngine.parseHandwrittenReport('') : { items: [] };
      this.showOcrLoading(false);
      this.openReviewModal();
    }
  }

  openReviewModalFromButton() {
    if (this.uploadedImageSrc && !this.pendingOcrResult) {
      this.runOcrProcess(this.uploadedImageSrc);
      return;
    }
    if (!this.pendingOcrResult) {
      this.pendingOcrResult = window.ocrEngine ? window.ocrEngine.parseHandwrittenReport('') : { items: [] };
    }
    this.openReviewModal();
  }

  showOcrLoading(show) {
    const overlay = document.getElementById('ep-ocr-loading-overlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
      overlay.classList.toggle('active', show);
    }
  }

  openReviewModal() {
    if (!this.pendingOcrResult) {
      this.pendingOcrResult = window.ocrEngine ? window.ocrEngine.parseHandwrittenReport('') : { items: [] };
    }
    const modal = document.getElementById('modal-ep-ocr-review');
    if (!modal) return;
    const imgEl = document.getElementById('ep-review-modal-img');
    if (imgEl) {
      imgEl.src = this.uploadedImageSrc || '';
      imgEl.style.display = this.uploadedImageSrc ? 'block' : 'none';
      this.zoomLevel = 1;
      imgEl.style.transform = 'scale(1)';
    }
    const noMsg = document.getElementById('ep-review-no-img-msg');
    if (noMsg) noMsg.style.display = this.uploadedImageSrc ? 'none' : 'flex';
    this.renderReviewTable();
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  closeReviewModal() {
    const modal = document.getElementById('modal-ep-ocr-review');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  // =========================================================================
  // OCR VERIFICATION / REVIEW TABLE
  // =========================================================================
  renderReviewTable() {
    const tbody = document.getElementById('ep-review-tbody');
    if (!tbody) return;
    if (!this.pendingOcrResult || !this.pendingOcrResult.items) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted);">No records detected.</td></tr>';
      return;
    }
    const items = this.pendingOcrResult.items;
    let html = '';
    items.forEach((item, idx) => {
      const isShort = item.type === 'SHORT';
      const isCA = item.type === 'CASH ADVANCE';
      const isPay = item.type === 'PAYMENT';
      let statusBadge = '<span class="badge badge-info" style="font-size:10px;">EXPENSE</span>';
      if (isShort) statusBadge = '<span class="badge badge-danger" style="font-size:10px;background:#ef4444;color:#fff;">SHORT</span>';
      else if (isCA) statusBadge = '<span class="badge" style="font-size:10px;background:#8b5cf6;color:#fff;">C.A.</span>';
      else if (isPay) statusBadge = '<span class="badge badge-success" style="font-size:10px;background:#10b981;color:#fff;">PAYMENT</span>';

      const violates = isCA && (item.role || '').toUpperCase().includes('TELLER');
      const caWarn = violates ? '<div style="color:#ef4444;font-size:11px;font-weight:700;">TELLERS cannot have CASH ADVANCE!</div>' : '';

      html += '<tr data-index="' + idx + '" style="' + (violates ? 'background:rgba(239,68,68,0.1);' : '') + '">' +
        '<td style="text-align:center;font-weight:700;color:var(--text-muted);">' + (idx + 1) + '</td>' +
        '<td><input type="number" class="form-input form-input-sm" value="' + item.amount + '" style="width:95px;font-weight:700;text-align:right;" onchange="window.expensesPayment.updateReviewRow(' + idx + ', \'amount\', this.value)"></td>' +
        '<td><input type="text" class="form-input form-input-sm" value="' + this.escapeHtml(item.description || '') + '" style="min-width:140px;" onchange="window.expensesPayment.updateReviewRow(' + idx + ', \'description\', this.value)"></td>' +
        '<td><input type="text" class="form-input form-input-sm" value="' + this.escapeHtml(item.employee || '') + '" style="min-width:130px;" onchange="window.expensesPayment.updateReviewRow(' + idx + ', \'employee\', this.value)"></td>' +
        '<td><select class="form-select form-select-sm" style="font-size:11.5px;" onchange="window.expensesPayment.updateReviewRow(' + idx + ', \'type\', this.value)">' +
        '<option value="EXPENSE"' + (item.type === 'EXPENSE' ? ' selected' : '') + '>EXPENSE</option>' +
        '<option value="SHORT"' + (item.type === 'SHORT' ? ' selected' : '') + '>SHORT (Teller)</option>' +
        '<option value="CASH ADVANCE"' + (item.type === 'CASH ADVANCE' ? ' selected' : '') + '>CASH ADVANCE (Collector)</option>' +
        '<option value="PAYMENT"' + (item.type === 'PAYMENT' ? ' selected' : '') + '>PAYMENT</option>' +
        '<option value="OTHER"' + (item.type === 'OTHER' ? ' selected' : '') + '>OTHER</option>' +
        '</select>' + caWarn + '</td>' +
        '<td><input type="text" class="form-input form-input-sm" value="' + (item.date || '') + '" style="width:105px;" onchange="window.expensesPayment.updateReviewRow(' + idx + ', \'date\', this.value)"></td>' +
        '<td style="text-align:center;">' + statusBadge + '</td>' +
        '<td><input type="text" class="form-input form-input-sm" value="' + this.escapeHtml(item.notes || item.originalEntry || '') + '" placeholder="Notes" style="min-width:120px;font-size:11px;" onchange="window.expensesPayment.updateReviewRow(' + idx + ', \'notes\', this.value)"></td>' +
        '<td style="text-align:center;"><button class="btn btn-secondary btn-xs" onclick="window.expensesPayment.removeReviewRow(' + idx + ')" style="color:#ef4444;">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    const countEl = document.getElementById('ep-review-count');
    if (countEl) countEl.textContent = items.length + ' Records Detected';
    const expSum = items.filter(i => i.type === 'EXPENSE').reduce((s, i) => s + Number(i.amount || 0), 0);
    const shortSum = items.filter(i => i.type === 'SHORT').reduce((s, i) => s + Number(i.amount || 0), 0);
    const caSum = items.filter(i => i.type === 'CASH ADVANCE').reduce((s, i) => s + Number(i.amount || 0), 0);
    const paySum = items.filter(i => i.type === 'PAYMENT').reduce((s, i) => s + Number(i.amount || 0), 0);
    const sumEl = document.getElementById('ep-review-sums');
    if (sumEl) sumEl.innerHTML = '<span><b>Expenses:</b> P' + expSum.toFixed(2) + '</span> <span style="color:#ef4444"><b>Shortages:</b> P' + shortSum.toFixed(2) + '</span> <span style="color:#8b5cf6"><b>C.A.:</b> P' + caSum.toFixed(2) + '</span> <span style="color:#10b981"><b>Payments:</b> P' + paySum.toFixed(2) + '</span>';
  }

  updateReviewRow(idx, field, value) {
    if (!this.pendingOcrResult || !this.pendingOcrResult.items[idx]) return;
    const item = this.pendingOcrResult.items[idx];
    if (field === 'amount') item.amount = parseFloat(value) || 0;
    else if (field === 'type') {
      item.type = value;
      if (value === 'SHORT') {
        item.classification = 'SHORT';
        item.transactionType = 'SHORT_TELLER';
        item.isShortage = true;
        item.isExpense = false;
        item.role = 'Teller';
      } else if (value === 'CASH ADVANCE') {
        item.classification = 'CA';
        item.transactionType = 'CASH_ADVANCE';
        item.isCashAdvance = true;
        item.isExpense = false;
        item.role = 'Collector';
      } else if (value === 'PAYMENT') {
        item.classification = 'PAYMENT';
        item.transactionType = 'PAYMENT';
        item.isExpense = false;
      } else {
        item.classification = 'OTHER';
        item.transactionType = 'EXPENSE';
        item.isExpense = true;
      }
    } else if (field === 'employee') item.employee = value;
    else if (field === 'description') item.description = value;
    else if (field === 'date') item.date = value;
    else if (field === 'notes') item.notes = value;
    this.renderReviewTable();
  }

  removeReviewRow(idx) {
    if (!this.pendingOcrResult || !this.pendingOcrResult.items) return;
    this.pendingOcrResult.items.splice(idx, 1);
    this.renderReviewTable();
  }

  addReviewRow() {
    if (!this.pendingOcrResult) this.pendingOcrResult = { items: [] };
    this.pendingOcrResult.items.push({
      id: 'OCR-MANUAL-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      amount: 100.00,
      description: 'Manual Added Entry',
      employee: 'Staff Member',
      role: 'Teller',
      type: 'EXPENSE',
      classification: 'OTHER',
      transactionType: 'EXPENSE',
      status: 'Verified',
      notes: ''
    });
    this.renderReviewTable();
  }

  zoomImage(direction) {
    const imgEl = document.getElementById('ep-review-modal-img');
    if (!imgEl) return;
    if (direction === 'in') this.zoomLevel = Math.min(3.0, this.zoomLevel + 0.25);
    else if (direction === 'out') this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
    else this.zoomLevel = 1;
    imgEl.style.transform = 'scale(' + this.zoomLevel + ')';
  }

  // =========================================================================
  // CONFIRM & SAVE (OCR)
  // =========================================================================
  confirmAndSave() {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot save or modify financial entries.');
      return;
    }
    if (!this.pendingOcrResult || !this.pendingOcrResult.items) return;
    const invalid = this.pendingOcrResult.items.filter(i => i.type === 'CASH ADVANCE' && (i.role || '').toUpperCase().includes('TELLER'));
    if (invalid.length > 0) {
      alert('Policy Violation: TELLERS cannot have CASH ADVANCE records! Please change type or re-assign to a Collector.');
      return;
    }
    const store = window.appStore;
    if (!store) return;
    const ts = Date.now();
    const itemsToSave = this.pendingOcrResult.items.map((item, i) => {
      const isShort = item.type === 'SHORT', isCA = item.type === 'CASH ADVANCE', isPay = item.type === 'PAYMENT';
      let applyToCA = false, appliedTo = '';
      if (isPay) {
        if ((item.role || '').toUpperCase().includes('COLLECTOR')) {
          applyToCA = true;
          appliedTo = 'Cash Advance';
        } else {
          appliedTo = 'Short Teller';
        }
      }
      return {
        id: 'TXN-OCR-' + ts + '-' + i,
        date: item.date || new Date().toISOString().split('T')[0],
        amount: Number(item.amount) || 0,
        description: item.description || 'OCR Entry',
        name: item.employee || 'General',
        employeeId: item.employeeId || '',
        role: item.role || 'Staff',
        boothCode: item.boothCode || '',
        location: item.location || '',
        note: item.notes || item.originalEntry || '',
        classification: item.classification || (isShort ? 'SHORT' : (isCA ? 'CA' : (isPay ? 'PAYMENT' : 'OTHER'))),
        type: item.type,
        transactionType: item.transactionType || item.type,
        isExpense: item.type === 'EXPENSE',
        isShortage: isShort,
        isCashAdvance: isCA,
        applyToCA: applyToCA,
        appliedTo: appliedTo,
        verificationStatus: 'VERIFIED',
        status: item.status || 'Verified'
      };
    });

    store.data.transactions.push(...itemsToSave);
    if (this.uploadedImageHash) {
      if (!store.data.uploadedImageHashes) store.data.uploadedImageHashes = [];
      store.data.uploadedImageHashes.push({
        hash: this.uploadedImageHash,
        date: new Date().toISOString().split('T')[0],
        count: itemsToSave.length
      });
    }
    store.save();
    if (window.sfx) window.sfx.playChime();
    this.closeReviewModal();
    this.pendingOcrResult = null;
    alert('Successfully saved ' + itemsToSave.length + ' entries into the system!');
    this.render();
  }

  deleteTransaction(txnId) {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot delete records.');
      return;
    }
    const store = window.appStore;
    const txn = store ? (store.data.transactions || []).find(t => t.id === txnId) : null;
    const typeLabel = txn ? (txn.classification || txn.type || 'record') : 'record';
    const amountStr = txn ? `₱${Number(txn.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '';
    const nameStr = txn ? (txn.name || txn.description || '') : '';
    const detailStr = (amountStr || nameStr) ? ` (${[amountStr, nameStr].filter(Boolean).join(' • ')})` : '';

    this.showConfirmModal({
      title: 'Permanently Delete Record?',
      message: `Are you sure you want to permanently delete this ${typeLabel}${detailStr}? This action cannot be undone and will permanently remove the record from all ledgers and financial histories.`,
      yesText: 'YES, DELETE',
      noText: 'NO, KEEP RECORD',
      isDanger: true,
      onConfirm: () => {
        if (!store) return;
        store.deleteTransaction(txnId);
        if (window.sfx) window.sfx.playChime();
        this.render();
      },
      onCancel: () => {
        // User clicked NO: cancellation, keep record
      }
    });
  }

  // =========================================================================
  // UNIVERSAL CONFIRMATION MODAL HELPER
  // =========================================================================
  showConfirmModal({ title, message, yesText, noText, isDanger, onConfirm, onCancel }) {
    const modal = document.getElementById('modal-ep-confirm');
    if (!modal) {
      if (window.confirm(message)) {
        if (onConfirm) onConfirm();
      } else {
        if (onCancel) onCancel();
      }
      return;
    }
    const titleEl = document.getElementById('ep-confirm-title');
    const msgEl = document.getElementById('ep-confirm-message');
    const yesBtn = document.getElementById('ep-confirm-yes-btn');
    const noBtn = document.getElementById('ep-confirm-no-btn');

    if (titleEl) titleEl.textContent = title || 'Confirm Action';
    if (msgEl) msgEl.textContent = message || '';
    if (yesBtn) {
      yesBtn.textContent = yesText || 'YES';
      if (isDanger) {
        yesBtn.style.background = '#ef4444';
        yesBtn.style.borderColor = '#ef4444';
        yesBtn.style.color = '#ffffff';
      } else {
        yesBtn.style.background = 'var(--accent-gold)';
        yesBtn.style.borderColor = 'var(--accent-gold)';
        yesBtn.style.color = '#000000';
      }
    }
    if (noBtn) {
      noBtn.textContent = noText || 'NO';
    }

    this._confirmCallback = onConfirm;
    this._confirmCancelCallback = onCancel;
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  executeConfirmAction() {
    const cb = this._confirmCallback;
    this.closeConfirmModal();
    if (cb) cb();
  }

  cancelConfirmAction() {
    const cb = this._confirmCancelCallback;
    this.closeConfirmModal();
    if (cb) cb();
  }

  closeConfirmModal() {
    const modal = document.getElementById('modal-ep-confirm');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    this._confirmCallback = null;
    this._confirmCancelCallback = null;
  }

  // =========================================================================
  // RENDERING
  // =========================================================================
  render() {
    const isCollector = window.authManager && window.authManager.isCollector();
    if (isCollector) {
      this.activeTab = 'ca-tracker';
      // Hide non-CA tabs and upload buttons
      document.querySelectorAll('.ep-tab-btn').forEach(b => {
        const tab = b.getAttribute('data-tab');
        if (tab !== 'ca-tracker') {
          b.style.display = 'none';
        } else {
          b.style.display = 'inline-flex';
          b.classList.add('active');
        }
      });
      document.querySelectorAll('.ep-tab-content').forEach(c => {
        c.classList.toggle('active', c.id === 'ep-tab-ca-tracker');
      });

      // Hide top header view-actions (Upload image, review OCR)
      const topActions = document.querySelector('#view-finance .view-actions');
      if (topActions) topActions.style.display = 'none';

      const uploadBtn = document.getElementById('ep-btn-upload-receipt');
      if (uploadBtn) uploadBtn.style.display = 'none';
      const sampleBtn = document.getElementById('ep-btn-load-sample');
      if (sampleBtn) sampleBtn.style.display = 'none';
      const ocrReviewBtn = document.getElementById('ep-btn-review-ocr');
      if (ocrReviewBtn) ocrReviewBtn.style.display = 'none';

      // Hide payment record trigger buttons in CA tracker tab
      const caPayBtn = document.getElementById('ep-btn-record-ca-payment');
      if (caPayBtn) caPayBtn.style.display = 'none';
      document.querySelectorAll('button[onclick*="openPaymentModal"]').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.ep-record-payment-trigger').forEach(el => el.style.display = 'none');
    } else {
      const topActions = document.querySelector('#view-finance .view-actions');
      if (topActions) topActions.style.display = 'flex';

      document.querySelectorAll('.ep-tab-btn').forEach(b => {
        b.style.display = 'inline-flex';
      });
      const uploadBtn = document.getElementById('ep-btn-upload-receipt');
      if (uploadBtn) uploadBtn.style.display = 'inline-flex';
      const sampleBtn = document.getElementById('ep-btn-load-sample');
      if (sampleBtn) sampleBtn.style.display = 'inline-flex';
      const caPayBtn = document.getElementById('ep-btn-record-ca-payment');
      if (caPayBtn) caPayBtn.style.display = '';
      document.querySelectorAll('button[onclick*="openPaymentModal"]').forEach(el => el.style.display = '');
    }

    this.updateKpiCounters();
    this.renderCurrentTab();
  }

  updateKpiCounters() {
    const store = window.appStore;
    const txns = store ? (store.data.transactions || []) : [];
    let exp = 0, short = 0, ca = 0, pay = 0;
    txns.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.classification === 'OTHER' || t.type === 'EXPENSE' || t.isExpense) exp += a;
      else if (t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'))) short += a;
      else if (t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'))) ca += a;
      else if (t.classification === 'PAYMENT' || t.type === 'PAYMENT') pay += a;
    });
    const fmt = v => 'P' + v.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const e1 = document.getElementById('ep-kpi-expenses'); if (e1) e1.textContent = fmt(exp);
    const e2 = document.getElementById('ep-kpi-short'); if (e2) e2.textContent = fmt(short);
    const e3 = document.getElementById('ep-kpi-ca'); if (e3) e3.textContent = fmt(ca);
    const e4 = document.getElementById('ep-kpi-payments'); if (e4) e4.textContent = fmt(pay);
  }

  renderCurrentTab() {
    if (this.activeTab === 'expenses') this.renderExpensesTab();
    else if (this.activeTab === 'short-tracker') this.renderShortTrackerTab();
    else if (this.activeTab === 'ca-tracker') this.renderCashAdvanceTrackerTab();
    else if (this.activeTab === 'payment-history') this.renderPaymentHistoryTab();
  }

  // =========================================================================
  // TAB 1: OPERATING EXPENSES — pagination + ACTION (Edit / Delete)
  // =========================================================================
  renderExpensesTab() {
    const store = window.appStore;
    const txns = store ? (store.data.transactions || []) : [];
    const q = this.searchQuery.toLowerCase();
    const filtered = txns.filter(t => {
      if (!(t.classification === 'OTHER' || t.type === 'EXPENSE' || t.isExpense)) return false;
      if (!q) return true;
      return (
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.boothCode && t.boothCode.toLowerCase().includes(q)) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.date && t.date.toLowerCase().includes(q)) ||
        (t.note && t.note.toLowerCase().includes(q)) ||
        String(t.amount).includes(q)
      );
    });

    const total = filtered.length, ps = this.expensesPageSize, tp = Math.max(1, Math.ceil(total / ps));
    if (this.expensesPage > tp) this.expensesPage = tp;
    const start = (this.expensesPage - 1) * ps;
    const pg = filtered.slice(start, start + ps);
    const tbody = document.getElementById('ep-expenses-tbody');
    if (!tbody) return;

    if (pg.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted);">No operating expenses found' +
        (this.searchQuery ? ' matching "' + this.escapeHtml(this.searchQuery) + '"' : '') + '</td></tr>';
    } else {
      tbody.innerHTML = pg.map((t, i) =>
        '<tr>' +
        '<td style="text-align:center;font-weight:700;color:var(--text-muted);">' + (start + i + 1) + '</td>' +
        '<td style="font-weight:600;">' + this.escapeHtml(t.date || '') + '</td>' +
        '<td style="font-weight:700;">' + this.escapeHtml(t.description || 'Expense') + '</td>' +
        '<td><div style="font-weight:600;">' + this.escapeHtml(t.name || 'HQ base') + '</div><div style="font-size:11px;color:var(--text-muted);">' + this.escapeHtml(t.role || 'Staff') + (t.boothCode ? ' [' + t.boothCode + ']' : '') + '</div></td>' +
        '<td><span class="badge badge-secondary" style="font-size:11px;">' + this.escapeHtml(t.location || 'Davao Sector') + '</span></td>' +
        '<td style="font-weight:800;color:var(--accent-gold);text-align:right;">P' + Number(t.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="font-size:11.5px;color:var(--text-muted);">' + this.escapeHtml(t.note || 'Verified ledger entry') + '</td>' +
        '<td style="text-align:center; white-space:nowrap;">' +
        '<button type="button" class="btn btn-secondary btn-xs ep-btn-edit" data-ep-action="edit" data-id="' + t.id + '" data-section="expense" onclick="window.expensesPayment.openEditModal(\'' + t.id + '\', \'expense\')" style="color:var(--accent-gold);border-color:var(--accent-gold);font-size:11px;padding:3px 8px;margin-right:4px;cursor:pointer;">Edit</button>' +
        '<button type="button" class="btn btn-secondary btn-xs ep-btn-delete" data-ep-action="delete" data-id="' + t.id + '" data-section="expense" onclick="window.expensesPayment.onDeleteExpenseClicked(\'' + t.id + '\')" style="color:#ef4444;border-color:rgba(239,68,68,0.4);font-size:11px;padding:3px 8px;cursor:pointer;">Delete</button>' +
        '</td>' +
        '</tr>'
      ).join('');
    }
    this.renderPagination('ep-expenses-pagination', total, this.expensesPage, ps, 'expenses');
  }

  onDeleteExpenseClicked(txnId) {
    this.deleteTransaction(txnId);
  }

  // =========================================================================
  // TAB 2: SHORT TRACKER (TELLERS) — Ledger History & Balance Sync
  // =========================================================================
  renderShortTrackerTab() {
    const store = window.appStore;
    if (!store) return;
    this.populateTellerSelect();

    const name = this.selectedTeller;
    const selId = (this.selectedTellerId || '').toUpperCase();
    const txns = store.data.transactions || [];
    const qU = (name || '').toUpperCase();

    const ttxns = txns.filter(t => {
      if (!t || !t.name) return false;
      const tU = t.name.toUpperCase();
      const tId = (t.employeeId || '').toUpperCase();
      const idMatch = selId && tId && (selId === tId);
      const nameMatch = qU && (tU.includes(qU) || qU.includes(tU));
      if (!idMatch && !nameMatch) return false;

      const isShort = t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'));
      const isPy = (t.classification === 'PAYMENT' || t.type === 'PAYMENT') && !t.applyToCA;
      return isShort || isPy;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let activeOrigShort = 0, activePaid = 0;
    ttxns.forEach(t => {
      const a = Number(t.amount) || 0;
      const isShort = t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'));
      if (isShort) activeOrigShort += a;
      else activePaid += a;
    });
    const activeRem = Math.max(0, activeOrigShort - activePaid);
    const activeFull = activeOrigShort > 0 && activeRem === 0;

    let runningShort = 0, runningPaid = 0;
    const rows = [];
    ttxns.forEach(t => {
      const a = Number(t.amount) || 0;
      const isShort = t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'));
      if (isShort) {
        runningShort += a;
      } else {
        runningPaid += a;
      }
      const remBalance = Math.max(0, runningShort - runningPaid);
      
      let settlementStatus;
      if (remBalance === 0 && runningShort > 0) {
        settlementStatus = 'Fully Paid';
      } else if (runningPaid > 0 && remBalance > 0) {
        settlementStatus = 'Partially Paid';
      } else if (runningShort > 0) {
        settlementStatus = 'Pending';
      } else {
        settlementStatus = t.settlement || 'Fully Paid';
      }

      rows.push({
        id: t.id,
        date: t.date,
        transaction: isShort ? 'SHORT' : 'PAYMENT',
        amount: a,
        remaining: remBalance,
        note: t.note || (isShort ? 'Teller Shortage' : 'Payment against Shortage'),
        isShort: isShort,
        settlement: settlementStatus
      });
    });

    const fmt = v => 'P' + v.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const n = document.getElementById('ep-short-teller-name'); if (n) n.textContent = name;
    const o = document.getElementById('ep-short-original-amt'); if (o) o.textContent = fmt(activeOrigShort);
    const p = document.getElementById('ep-short-total-paid'); if (p) p.textContent = fmt(activePaid);
    const r = document.getElementById('ep-short-remaining'); if (r) r.textContent = fmt(activeRem);

    const sb = document.getElementById('ep-short-status-badge');
    if (sb) {
      if (activeOrigShort === 0) {
        sb.className = 'badge badge-secondary';
        sb.textContent = 'NO SHORTAGES';
        sb.removeAttribute('style');
      } else if (activeFull) {
        sb.className = 'badge badge-success';
        sb.style.cssText = 'background:#10b981;color:#fff;';
        sb.textContent = 'STATUS: FULLY PAID';
      } else {
        sb.className = 'badge badge-warning';
        sb.style.cssText = 'background:#f59e0b;color:#fff;';
        sb.textContent = 'STATUS: PARTIALLY PAID';
      }
    }

    const activeCalendarTxns = ttxns;
    this.renderCalendarGrid('ep-short-calendar-container', activeCalendarTxns, 'SHORT');

    const totalRows = rows.length;
    const ps = this.shortLedgerPageSize;
    const tp = Math.max(1, Math.ceil(totalRows / ps));
    if (this.shortLedgerPage > tp) this.shortLedgerPage = tp;
    const start = (this.shortLedgerPage - 1) * ps;
    const pageRows = rows.slice(start, start + ps);

    const tb = document.getElementById('ep-short-history-tbody');
    if (tb) {
      if (totalRows === 0) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No records found for ' + this.escapeHtml(name) + '</td></tr>';
      } else {
        tb.innerHTML = pageRows.map(row => {
          let badgeColor = '#f59e0b';
          if (row.settlement === 'Fully Paid') badgeColor = '#10b981';
          else if (row.settlement === 'Pending') badgeColor = '#ef4444';

          const actionHtml =
            '<button type="button" class="btn btn-secondary btn-xs ep-btn-edit" data-ep-action="edit" data-id="' + row.id + '" data-section="short" onclick="window.expensesPayment.openEditModal(\'' + row.id + '\', \'short\')" style="color:var(--accent-gold);border-color:var(--accent-gold);font-size:11px;padding:3px 8px;margin-right:4px;cursor:pointer;">Edit</button>' +
            '<button type="button" class="btn btn-secondary btn-xs ep-btn-delete" data-ep-action="delete" data-id="' + row.id + '" data-section="short" onclick="window.expensesPayment.onDeleteShortClicked(\'' + row.id + '\')" style="color:#ef4444;border-color:rgba(239,68,68,0.4);font-size:11px;padding:3px 8px;cursor:pointer;">Delete</button>';

          return '<tr style="' + (row.remaining === 0 && !row.isShort ? 'background:rgba(16,185,129,0.06);' : '') + '">' +
            '<td style="font-weight:700;">' + this.escapeHtml(row.date) + '</td>' +
            '<td><span class="badge" style="' + (row.isShort ? 'background:#ef4444;' : 'background:#10b981;') + 'color:#fff;">' + row.transaction + '</span></td>' +
            '<td style="font-weight:800;text-align:right;color:' + (row.isShort ? '#ef4444' : '#10b981') + ';">P' + row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '<td style="font-weight:800;text-align:right;color:' + (row.remaining === 0 ? '#10b981' : 'var(--accent-gold)') + ';">P' + row.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '<td style="font-size:11.5px;color:var(--text-muted);">' + this.escapeHtml(row.note) + '</td>' +
            '<td style="text-align:center;"><span class="badge" style="background:' + badgeColor + ';color:#fff;font-size:10px;">' + this.escapeHtml(row.settlement) + '</span></td>' +
            '<td style="text-align:center; white-space:nowrap;">' + actionHtml + '</td>' +
            '</tr>';
        }).join('');
      }
    }

    this.renderPagination('ep-short-pagination', totalRows, this.shortLedgerPage, ps, 'short');
  }

  onDeleteShortClicked(txnId) {
    this.deleteTransaction(txnId);
  }

  // =========================================================================
  // TAB 3: CASH ADVANCE TRACKER (COLLECTORS) — Ledger History & Balance Sync
  // =========================================================================
  renderCashAdvanceTrackerTab() {
    const store = window.appStore;
    if (!store) return;
    this.populateCollectorSelect();

    const name = this.selectedCollector;
    const selId = (this.selectedCollectorId || '').toLowerCase();
    const txns = store.data.transactions || [];
    const qN = (name || '').toLowerCase();

    const ctxns = txns.filter(t => {
      if (!t || !t.name) return false;
      const tN = t.name.toLowerCase();
      const tId = (t.employeeId || '').toLowerCase();
      const idMatch = selId && tId && (selId === tId);
      const nameMatch = qN && (tN.includes(qN) || qN.includes(tN));
      if (!idMatch && !nameMatch) return false;

      const isCA = t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'));
      const isPy = (t.classification === 'PAYMENT' || t.type === 'PAYMENT') && t.applyToCA;
      return isCA || isPy;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let activeOrigCA = 0, activePaid = 0;
    ctxns.forEach(t => {
      const a = Number(t.amount) || 0;
      const isCA = t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'));
      if (isCA) activeOrigCA += a;
      else activePaid += a;
    });
    const activeRem = Math.max(0, activeOrigCA - activePaid);
    const activeFull = activeOrigCA > 0 && activeRem === 0;

    let runningCA = 0, runningPaid = 0;
    const rows = [];
    ctxns.forEach(t => {
      const a = Number(t.amount) || 0;
      const isCA = t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'));
      if (isCA) runningCA += a;
      else runningPaid += a;
      const remBalance = Math.max(0, runningCA - runningPaid);

      let settlementStatus;
      if (remBalance === 0 && runningCA > 0) {
        settlementStatus = 'Fully Paid';
      } else if (runningPaid > 0 && remBalance > 0) {
        settlementStatus = 'Partially Paid';
      } else if (runningCA > 0) {
        settlementStatus = 'Pending';
      } else {
        settlementStatus = t.settlement || 'Fully Paid';
      }

      rows.push({
        id: t.id,
        date: t.date,
        transaction: isCA ? 'CASH ADVANCE' : 'PAYMENT',
        amount: a,
        remaining: remBalance,
        note: t.note || (isCA ? 'Collector Field Operational Advance' : 'Payment against Cash Advance'),
        isCA: isCA,
        settlement: settlementStatus
      });
    });

    const fmt = v => 'P' + v.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const n = document.getElementById('ep-ca-collector-name'); if (n) n.textContent = name;
    const o = document.getElementById('ep-ca-original-amt'); if (o) o.textContent = fmt(activeOrigCA);
    const p = document.getElementById('ep-ca-total-paid'); if (p) p.textContent = fmt(activePaid);
    const r = document.getElementById('ep-ca-remaining'); if (r) r.textContent = fmt(activeRem);

    const sb = document.getElementById('ep-ca-status-badge');
    if (sb) {
      if (activeOrigCA === 0) {
        sb.className = 'badge badge-secondary';
        sb.textContent = 'NO CASH ADVANCE';
        if (typeof sb.removeAttribute === 'function') sb.removeAttribute('style');
        else sb.style.cssText = '';
      } else if (activeFull) {
        sb.className = 'badge badge-success';
        sb.style.cssText = 'background:#10b981;color:#fff;';
        sb.textContent = 'STATUS: FULLY PAID';
      } else {
        sb.className = 'badge badge-warning';
        sb.style.cssText = 'background:#f59e0b;color:#fff;';
        sb.textContent = 'STATUS: PARTIALLY PAID';
      }
    }

    const activeCalendarTxns = ctxns;
    this.renderCalendarGrid('ep-ca-calendar-container', activeCalendarTxns, 'CA');

    const totalRows = rows.length;
    const ps = this.caLedgerPageSize;
    const tp = Math.max(1, Math.ceil(totalRows / ps));
    if (this.caLedgerPage > tp) this.caLedgerPage = tp;
    const start = (this.caLedgerPage - 1) * ps;
    const pageRows = rows.slice(start, start + ps);

    const tb = document.getElementById('ep-ca-history-tbody');
    if (tb) {
      if (totalRows === 0) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No records found for ' + this.escapeHtml(name) + '</td></tr>';
      } else {
        tb.innerHTML = pageRows.map(row => {
          let badgeColor = '#f59e0b';
          if (row.settlement === 'Fully Paid') badgeColor = '#10b981';
          else if (row.settlement === 'Pending') badgeColor = '#ef4444';

          const isCollector = window.authManager && window.authManager.isCollector();
          const actionHtml = isCollector
            ? '<span style="font-size:11px;color:var(--text-muted);font-style:italic;">View-only</span>'
            : ('<button type="button" class="btn btn-secondary btn-xs ep-btn-edit" data-ep-action="edit" data-id="' + row.id + '" data-section="ca" onclick="window.expensesPayment.openEditModal(\'' + row.id + '\', \'ca\')" style="color:var(--accent-gold);border-color:var(--accent-gold);font-size:11px;padding:3px 8px;margin-right:4px;cursor:pointer;">Edit</button>' +
               '<button type="button" class="btn btn-secondary btn-xs ep-btn-delete" data-ep-action="delete" data-id="' + row.id + '" data-section="ca" onclick="window.expensesPayment.onDeleteCAClicked(\'' + row.id + '\')" style="color:#ef4444;border-color:rgba(239,68,68,0.4);font-size:11px;padding:3px 8px;cursor:pointer;">Delete</button>');

          return '<tr style="' + (row.remaining === 0 && !row.isCA ? 'background:rgba(16,185,129,0.06);' : '') + '">' +
            '<td style="font-weight:700;">' + this.escapeHtml(row.date) + '</td>' +
            '<td><span class="badge" style="' + (row.isCA ? 'background:#8b5cf6;' : 'background:#10b981;') + 'color:#fff;">' + row.transaction + '</span></td>' +
            '<td style="font-weight:800;text-align:right;color:' + (row.isCA ? '#8b5cf6' : '#10b981') + ';">P' + row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '<td style="font-weight:800;text-align:right;color:' + (row.remaining === 0 ? '#10b981' : 'var(--accent-gold)') + ';">P' + row.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '<td style="font-size:11.5px;color:var(--text-muted);">' + this.escapeHtml(row.note) + '</td>' +
            '<td style="text-align:center;"><span class="badge" style="background:' + badgeColor + ';color:#fff;font-size:10px;">' + this.escapeHtml(row.settlement) + '</span></td>' +
            '<td style="text-align:center; white-space:nowrap;">' + actionHtml + '</td>' +
            '</tr>';
        }).join('');
      }
    }

    this.renderPagination('ep-ca-pagination', totalRows, this.caLedgerPage, ps, 'ca');
  }

  onDeleteCAClicked(txnId) {
    this.deleteTransaction(txnId);
  }

  // =========================================================================
  // TAB 4: MASTER PAYMENT HISTORY — pagination + ACTION (Edit / Delete)
  // =========================================================================
  renderPaymentHistoryTab() {
    const store = window.appStore;
    const txns = store ? (store.data.transactions || []) : [];
    const q = this.searchQuery.toLowerCase();

    const payments = txns.filter(t => {
      if (!(t.classification === 'PAYMENT' || t.type === 'PAYMENT')) return false;
      if (!q) return true;
      return (
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.role && t.role.toLowerCase().includes(q)) ||
        (t.date && t.date.toLowerCase().includes(q)) ||
        (t.appliedTo && t.appliedTo.toLowerCase().includes(q)) ||
        (t.note && t.note.toLowerCase().includes(q)) ||
        String(t.amount).includes(q)
      );
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const total = payments.length, ps = this.paymentsPageSize, tp = Math.max(1, Math.ceil(total / ps));
    if (this.paymentsPage > tp) this.paymentsPage = tp;
    const start = (this.paymentsPage - 1) * ps;
    const pg = payments.slice(start, start + ps);

    const tbody = document.getElementById('ep-payments-tbody');
    if (!tbody) return;

    if (pg.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted);">No payment records found' +
        (this.searchQuery ? ' matching "' + this.escapeHtml(this.searchQuery) + '"' : '') + '</td></tr>';
    } else {
      tbody.innerHTML = pg.map((t, i) => {
        const isCA = t.applyToCA || (t.appliedTo && t.appliedTo.toUpperCase().includes('ADVANCE'));
        const statusText = t.settlement || 'CREDITED';
        return '<tr>' +
          '<td style="text-align:center;font-weight:700;color:var(--text-muted);">' + (start + i + 1) + '</td>' +
          '<td style="font-weight:700;">' + this.escapeHtml(t.date || '') + '</td>' +
          '<td><div style="font-weight:800;">' + this.escapeHtml(t.name || 'Personnel') + '</div><div style="font-size:11px;color:var(--text-muted);">' + this.escapeHtml(t.role || 'Staff') + (t.boothCode ? ' ' + t.boothCode : '') + '</div></td>' +
          '<td><span class="badge" style="' + (isCA ? 'background:#8b5cf6;' : 'background:#ef4444;') + 'color:#fff;font-size:11px;">' + (isCA ? 'Cash Advance Payment' : 'Short Teller Payment') + '</span></td>' +
          '<td style="font-weight:800;color:#10b981;text-align:right;">P' + Number(t.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
          '<td style="font-size:11.5px;color:var(--text-muted);">' + this.escapeHtml(t.note || 'Receipt acknowledged') + '</td>' +
          '<td style="text-align:center;"><span class="badge" style="background:#10b981;color:#fff;font-size:10px;">' + this.escapeHtml(statusText) + '</span></td>' +
          '<td style="text-align:center; white-space:nowrap;">' +
          '<button type="button" class="btn btn-secondary btn-xs ep-btn-edit" data-ep-action="edit" data-id="' + t.id + '" data-section="payment" onclick="window.expensesPayment.openEditModal(\'' + t.id + '\', \'payment\')" style="color:var(--accent-gold);border-color:var(--accent-gold);font-size:11px;padding:3px 8px;margin-right:4px;cursor:pointer;">Edit</button>' +
          '<button type="button" class="btn btn-secondary btn-xs ep-btn-delete" data-ep-action="delete" data-id="' + t.id + '" data-section="payment" onclick="window.expensesPayment.onDeletePaymentClicked(\'' + t.id + '\')" style="color:#ef4444;border-color:rgba(239,68,68,0.4);font-size:11px;padding:3px 8px;cursor:pointer;">Delete</button>' +
          '</td>' +
          '</tr>';
      }).join('');
    }

    this.renderPagination('ep-payments-pagination', total, this.paymentsPage, ps, 'payments');
  }

  onDeletePaymentClicked(txnId) {
    this.deleteTransaction(txnId);
  }

  // =========================================================================
  // PAGINATION COMPONENT & HANDLERS
  // =========================================================================
  renderPagination(containerId, total, currentPage, pageSize, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const tp = Math.max(1, Math.ceil(total / pageSize));
    const sizes = [10, 25, 50, 100];
    let pageButtons = '';
    const maxV = 5;
    const sp = Math.max(1, currentPage - Math.floor(maxV / 2));
    const ep = Math.min(tp, sp + maxV - 1);
    const sp2 = Math.max(1, ep - maxV + 1);

    if (sp2 > 1) {
      pageButtons += '<button class="ep-page-btn" onclick="window.expensesPayment.goToPage(\'' + type + '\', 1)">1</button>';
      if (sp2 > 2) pageButtons += '<span style="padding:0 4px;color:var(--text-muted)">...</span>';
    }

    for (let pp = sp2; pp <= ep; pp++) {
      pageButtons += '<button class="ep-page-btn' + (pp === currentPage ? ' active' : '') + '" onclick="window.expensesPayment.goToPage(\'' + type + '\', ' + pp + ')">' + pp + '</button>';
    }

    if (ep < tp) {
      if (ep < tp - 1) pageButtons += '<span style="padding:0 4px;color:var(--text-muted)">...</span>';
      pageButtons += '<button class="ep-page-btn" onclick="window.expensesPayment.goToPage(\'' + type + '\', ' + tp + ')">' + tp + '</button>';
    }

    const sOpts = sizes.map(s => '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + '</option>').join('');
    const showing = total === 0 ? 'No records' : ((currentPage - 1) * pageSize + 1) + '-' + Math.min(currentPage * pageSize, total) + ' of ' + total + ' records';

    container.innerHTML =
      '<div class="ep-pagination-bar">' +
      '<div class="ep-pagination-left">' +
      '<span style="font-size:12.5px;color:var(--text-muted);font-weight:600;">Rows per page:</span>' +
      '<select class="form-select" style="width:70px;font-size:12.5px;padding:4px 8px;" onchange="window.expensesPayment.changePageSize(\'' + type + '\', parseInt(this.value))">' + sOpts + '</select>' +
      '<span style="font-size:12.5px;color:var(--text-muted);margin-left:8px;">' + showing + '</span>' +
      '</div>' +
      '<div class="ep-pagination-right">' +
      '<span style="font-size:12.5px;color:var(--text-muted);font-weight:600;margin-right:6px;">Page ' + currentPage + ' of ' + tp + '</span>' +
      '<button class="ep-page-btn ep-page-nav" onclick="window.expensesPayment.goToPage(\'' + type + '\', ' + (currentPage - 1) + ')"' + (currentPage <= 1 ? ' disabled' : '') + '>&#8249;</button>' +
      pageButtons +
      '<button class="ep-page-btn ep-page-nav" onclick="window.expensesPayment.goToPage(\'' + type + '\', ' + (currentPage + 1) + ')"' + (currentPage >= tp ? ' disabled' : '') + '>&#8250;</button>' +
      '</div>' +
      '</div>';
  }

  goToPage(type, page) {
    const store = window.appStore, txns = store ? (store.data.transactions || []) : [];
    if (type === 'expenses') {
      const tp = Math.max(1, Math.ceil(txns.filter(t => (t.classification === 'OTHER' || t.type === 'EXPENSE' || t.isExpense)).length / this.expensesPageSize));
      this.expensesPage = Math.max(1, Math.min(page, tp));
      this.renderExpensesTab();
    } else if (type === 'short') {
      this.shortLedgerPage = Math.max(1, page);
      this.renderShortTrackerTab();
    } else if (type === 'ca') {
      this.caLedgerPage = Math.max(1, page);
      this.renderCashAdvanceTrackerTab();
    } else if (type === 'payments') {
      const tp = Math.max(1, Math.ceil(txns.filter(t => (t.classification === 'PAYMENT' || t.type === 'PAYMENT')).length / this.paymentsPageSize));
      this.paymentsPage = Math.max(1, Math.min(page, tp));
      this.renderPaymentHistoryTab();
    }
  }

  changePageSize(type, size) {
    if (type === 'expenses') {
      this.expensesPageSize = size;
      this.expensesPage = 1;
      this.renderExpensesTab();
    } else if (type === 'short') {
      this.shortLedgerPageSize = size;
      this.shortLedgerPage = 1;
      this.renderShortTrackerTab();
    } else if (type === 'ca') {
      this.caLedgerPageSize = size;
      this.caLedgerPage = 1;
      this.renderCashAdvanceTrackerTab();
    } else if (type === 'payments') {
      this.paymentsPageSize = size;
      this.paymentsPage = 1;
      this.renderPaymentHistoryTab();
    }
  }

  // =========================================================================
  // CALENDAR RENDERER
  // =========================================================================
  renderCalendarGrid(containerId, personTxns, trackerType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const yr = this.currentCalendarYear, mo = this.currentCalendarMonth;
    const mNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dim = new Date(yr, mo + 1, 0).getDate(), fdi = new Date(yr, mo, 1).getDay(), sOff = (fdi + 6) % 7;
    const dayMap = {};

    personTxns.forEach(t => {
      if (!t.date) return;
      const parts = t.date.split('-');
      if (parts.length === 3 && parseInt(parts[0]) === yr && parseInt(parts[1]) === mo + 1) {
        const d = parseInt(parts[2]);
        if (!dayMap[d]) dayMap[d] = [];
        dayMap[d].push(t);
      }
    });

    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:6px;">' +
      '<div style="font-size:16px;font-weight:800;color:var(--accent-gold);">' + mNames[mo] + ' ' + yr + '</div>' +
      '<div style="display:flex;gap:6px;">' +
      '<button class="btn btn-secondary btn-xs" onclick="window.expensesPayment.changeMonth(-1, \'' + containerId + '\', \'' + trackerType + '\')">Prev</button>' +
      '<button class="btn btn-secondary btn-xs" onclick="window.expensesPayment.resetMonth(\'' + containerId + '\', \'' + trackerType + '\')">Today</button>' +
      '<button class="btn btn-secondary btn-xs" onclick="window.expensesPayment.changeMonth(1, \'' + containerId + '\', \'' + trackerType + '\')">Next</button>' +
      '</div></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;font-size:12px;">';
    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach(d => {
      html += '<div style="text-align:center;font-weight:800;color:var(--text-muted);padding:6px 0;">' + d + '</div>';
    });

    for (let i = 0; i < sOff; i++) {
      html += '<div style="min-height:76px;background:rgba(0,0,0,0.1);border:1px dashed rgba(255,255,255,0.05);border-radius:4px;"></div>';
    }

    for (let day = 1; day <= dim; day++) {
      const txs = dayMap[day] || [], has = txs.length > 0;
      let pills = '';
      txs.forEach(t => {
        const isSh = t.classification === 'SHORT' || t.type === 'SHORT';
        const isCA2 = t.classification === 'CA' || t.type === 'CASH ADVANCE';
        const isPy = t.classification === 'PAYMENT' || t.type === 'PAYMENT';
        if (isSh) pills += '<div style="background:#ef4444;color:#fff;font-size:10px;font-weight:800;padding:2px 4px;border-radius:3px;margin-top:2px;">SHORT P' + Number(t.amount).toLocaleString() + '</div>';
        else if (isCA2) pills += '<div style="background:#8b5cf6;color:#fff;font-size:10px;font-weight:800;padding:2px 4px;border-radius:3px;margin-top:2px;">C.A. P' + Number(t.amount).toLocaleString() + '</div>';
        else if (isPy) pills += '<div style="background:#10b981;color:#fff;font-size:10px;font-weight:800;padding:2px 4px;border-radius:3px;margin-top:2px;">PAY P' + Number(t.amount).toLocaleString() + '</div>';
      });
      html += '<div style="min-height:76px;background:' + (has ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (has ? 'var(--accent-gold)' : 'var(--border-color)') + ';border-radius:4px;padding:4px 6px;display:flex;flex-direction:column;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;font-weight:' + (has ? 800 : 600) + ';color:' + (has ? 'var(--accent-gold)' : 'var(--text-muted)') + ';">' + day + '</span>' + (has ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--accent-gold);"></span>' : '') + '</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;">' + pills + '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  changeMonth(delta, containerId, trackerType) {
    this.currentCalendarMonth += delta;
    if (this.currentCalendarMonth > 11) { this.currentCalendarMonth = 0; this.currentCalendarYear++; }
    if (this.currentCalendarMonth < 0) { this.currentCalendarMonth = 11; this.currentCalendarYear--; }
    this.renderCurrentTab();
  }

  resetMonth(containerId, trackerType) {
    this.currentCalendarMonth = 8;
    this.currentCalendarYear = 2026;
    this.renderCurrentTab();
  }

  // =========================================================================
  // MASTER REGISTRY SYNCHRONIZATION & SEARCHABLE DROPDOWNS
  // =========================================================================

  getEligibleTellers() {
    const store = window.appStore;
    if (!store || !store.data) return [];
    const eligible = [];
    const seen = new Set();

    const emps = Array.isArray(store.data.employees) ? store.data.employees : [];
    const rels = Array.isArray(store.data.relievers) ? store.data.relievers : [];
    const all = [...emps, ...rels];

    all.forEach(e => {
      if (!e || !e.name) return;
      const name = e.name.trim();
      if (!name || name === 'N/A' || name === '-') return;

      const status = (e.status || 'ACTIVE').toUpperCase();
      if (status !== 'ACTIVE') return; // Master Registry Active filter

      const role = (e.role || '').toUpperCase();
      const isReliever = role.includes('RELIEVER') || role.includes('RELIVER');
      const isTeller = role.includes('TELLER') || role.includes('SALES REPRESENTATIVE');
      const isCollector = role.includes('COLLECTOR');
      const isSupervisor = role.includes('SUPERVISOR');
      const isTeamLeader = role.includes('TEAM LEADER');

      // Requirement: Only Station Teller and Reliever roles are eligible
      if ((isTeller || isReliever) && !isCollector && !isSupervisor && !isTeamLeader) {
        const key = (e.id || name).trim().toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          eligible.push({
            id: e.id || '',
            name: name,
            role: isReliever ? 'Reliever' : 'Station Teller',
            boothCode: e.boothCode || e.booth || '',
            area: e.area || e.municipality || 'Davao Sector',
            status: e.status || 'Active'
          });
        }
      }
    });

    eligible.sort((a, b) => a.name.localeCompare(b.name));
    return eligible;
  }

  getEligibleCollectors() {
    const store = window.appStore;
    if (!store || !store.data) return [];
    const eligible = [];
    const seen = new Set();

    const emps = Array.isArray(store.data.employees) ? store.data.employees : [];
    emps.forEach(e => {
      if (!e || !e.name) return;
      const name = e.name.trim();
      if (!name || name === 'N/A' || name === '-') return;

      const status = (e.status || 'ACTIVE').toUpperCase();
      if (status !== 'ACTIVE') return; // Master Registry Active filter

      const role = (e.role || '').toUpperCase();
      const isCollector = role.includes('COLLECTOR');
      const isTeller = role.includes('TELLER') || role.includes('SALES REPRESENTATIVE');
      const isSupervisor = role.includes('SUPERVISOR');

      // Requirement: Only Collector role is eligible
      if (isCollector && !isTeller && !isSupervisor) {
        const key = (e.id || name).trim().toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          eligible.push({
            id: e.id || '',
            name: name,
            role: 'Collector',
            boothCode: '',
            area: e.area || e.municipality || 'Field Route',
            status: e.status || 'Active'
          });
        }
      }
    });

    eligible.sort((a, b) => a.name.localeCompare(b.name));
    return eligible;
  }

  populateTellerSelect() {
    this.setupSearchableTellerSelect();
  }

  setupSearchableTellerSelect() {
    const container = document.getElementById('ep-teller-selector-container');
    if (!container) return;

    const eligibleList = this.getEligibleTellers();

    // Default selection if unset
    if (!this.selectedTeller && eligibleList.length > 0) {
      this.selectedTeller = eligibleList[0].name;
      this.selectedTellerId = eligibleList[0].id;
    }

    const currentPerson = eligibleList.find(e => 
      (this.selectedTellerId && e.id === this.selectedTellerId) ||
      (this.selectedTeller && e.name.toUpperCase() === this.selectedTeller.toUpperCase())
    );

    const displayName = currentPerson ? currentPerson.name : (this.selectedTeller || 'Select Teller');
    const badgeText = currentPerson ? (currentPerson.boothCode ? `Booth: ${currentPerson.boothCode}` : currentPerson.role) : 'Historical Record';
    const badgeBg = currentPerson ? (currentPerson.role === 'Reliever' ? 'rgba(139,92,246,0.15)' : 'rgba(251,191,36,0.15)') : 'rgba(148,163,184,0.15)';
    const badgeColor = currentPerson ? (currentPerson.role === 'Reliever' ? '#a78bfa' : 'var(--accent-gold)') : 'var(--text-muted)';

    container.innerHTML = `
      <div class="ep-searchable-select" id="ep-teller-searchable-wrapper">
        <div class="ep-searchable-trigger" id="ep-teller-searchable-trigger" tabindex="0">
          <div class="ep-searchable-label">
            <span>${this.escapeHtml(displayName)}</span>
            <span class="badge" style="font-size:11px; margin-left:6px; background:${badgeBg}; color:${badgeColor}; font-weight:700;">${this.escapeHtml(badgeText)}</span>
          </div>
          <span class="ep-searchable-arrow">▼</span>
        </div>
        <div class="ep-searchable-dropdown" id="ep-teller-searchable-dropdown">
          <div class="ep-searchable-search-box">
            <span style="font-size:13px; color:var(--text-muted);">🔍</span>
            <input type="text" class="ep-searchable-input" id="ep-teller-search-input" placeholder="Search teller by name, ID, or booth..." autocomplete="off">
          </div>
          <div class="ep-searchable-list" id="ep-teller-searchable-list">
            <!-- Populated dynamically -->
          </div>
        </div>
        <select id="ep-teller-selector" style="display:none;">
          ${eligibleList.map(e => `<option value="${this.escapeHtml(e.name)}" ${e.name.toUpperCase() === (this.selectedTeller || '').toUpperCase() ? 'selected' : ''}>${this.escapeHtml(e.name)}</option>`).join('')}
        </select>
      </div>
    `;

    const wrapper = document.getElementById('ep-teller-searchable-wrapper');
    const trigger = document.getElementById('ep-teller-searchable-trigger');
    const dropdown = document.getElementById('ep-teller-searchable-dropdown');
    const searchInput = document.getElementById('ep-teller-search-input');
    const listEl = document.getElementById('ep-teller-searchable-list');

    const renderList = (filterText = '') => {
      const q = filterText.toLowerCase().trim();
      const filtered = eligibleList.filter(e => 
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.boothCode && e.boothCode.toLowerCase().includes(q)) ||
        (e.role && e.role.toLowerCase().includes(q))
      );

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="ep-searchable-empty">No active tellers matching "${this.escapeHtml(filterText)}"</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(e => {
        const isSelected = (this.selectedTeller && e.name.toUpperCase() === this.selectedTeller.toUpperCase()) ||
                           (this.selectedTellerId && e.id === this.selectedTellerId);
        return `
          <div class="ep-searchable-item ${isSelected ? 'selected' : ''}" data-id="${this.escapeHtml(e.id)}" data-name="${this.escapeHtml(e.name)}">
            <div>
              <div style="font-weight:700; color:var(--text-main); font-size:13px;">${this.escapeHtml(e.name)}</div>
              <div style="font-size:11px; color:var(--text-muted); display:flex; gap:6px; align-items:center; margin-top:2px;">
                <span class="badge" style="font-size:10px; padding:1px 5px; background:${e.role === 'Reliever' ? 'rgba(139,92,246,0.15);color:#a78bfa;' : 'rgba(251,191,36,0.15);color:var(--accent-gold);'}">${this.escapeHtml(e.role)}</span>
                ${e.boothCode ? `<span>Booth: <strong>${this.escapeHtml(e.boothCode)}</strong></span>` : ''}
                ${e.id ? `<span>(${this.escapeHtml(e.id)})</span>` : ''}
              </div>
            </div>
            ${isSelected ? '<span style="color:var(--accent-gold); font-weight:800; font-size:14px;">✓</span>' : ''}
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.ep-searchable-item').forEach(item => {
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const chosenName = item.getAttribute('data-name');
          const chosenId = item.getAttribute('data-id');
          this.selectedTeller = chosenName;
          this.selectedTellerId = chosenId;
          this.shortLedgerPage = 1;
          wrapper.classList.remove('open');
          this.renderShortTrackerTab();
        });
      });
    };

    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isOpen = wrapper.classList.contains('open');
      document.querySelectorAll('.ep-searchable-select.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) {
        wrapper.classList.add('open');
        renderList('');
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 60);
      }
    });

    searchInput.addEventListener('input', (ev) => {
      renderList(ev.target.value);
    });

    searchInput.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });

    document.addEventListener('click', (ev) => {
      if (!wrapper.contains(ev.target)) {
        wrapper.classList.remove('open');
      }
    });
  }

  populateCollectorSelect() {
    this.setupSearchableCollectorSelect();
  }

  setupSearchableCollectorSelect() {
    const container = document.getElementById('ep-collector-selector-container');
    if (!container) return;

    const eligibleList = this.getEligibleCollectors();

    // Default selection if unset
    if (!this.selectedCollector && eligibleList.length > 0) {
      this.selectedCollector = eligibleList[0].name;
      this.selectedCollectorId = eligibleList[0].id;
    }

    const currentPerson = eligibleList.find(e => 
      (this.selectedCollectorId && e.id === this.selectedCollectorId) ||
      (this.selectedCollector && e.name.toLowerCase() === this.selectedCollector.toLowerCase())
    );

    const displayName = currentPerson ? currentPerson.name : (this.selectedCollector || 'Select Collector');
    const badgeText = currentPerson ? 'Collector' : 'Historical Record';

    container.innerHTML = `
      <div class="ep-searchable-select" id="ep-collector-searchable-wrapper">
        <div class="ep-searchable-trigger" id="ep-collector-searchable-trigger" tabindex="0">
          <div class="ep-searchable-label">
            <span>${this.escapeHtml(displayName)}</span>
            <span class="badge" style="font-size:11px; margin-left:6px; background:rgba(139,92,246,0.15); color:#a78bfa; font-weight:700;">${this.escapeHtml(badgeText)}</span>
          </div>
          <span class="ep-searchable-arrow">▼</span>
        </div>
        <div class="ep-searchable-dropdown" id="ep-collector-searchable-dropdown">
          <div class="ep-searchable-search-box">
            <span style="font-size:13px; color:var(--text-muted);">🔍</span>
            <input type="text" class="ep-searchable-input" id="ep-collector-search-input" placeholder="Search collector by name, ID, or route..." autocomplete="off">
          </div>
          <div class="ep-searchable-list" id="ep-collector-searchable-list">
            <!-- Populated dynamically -->
          </div>
        </div>
        <select id="ep-collector-selector" style="display:none;">
          ${eligibleList.map(e => `<option value="${this.escapeHtml(e.name)}" ${e.name.toLowerCase() === (this.selectedCollector || '').toLowerCase() ? 'selected' : ''}>${this.escapeHtml(e.name)}</option>`).join('')}
        </select>
      </div>
    `;

    const wrapper = document.getElementById('ep-collector-searchable-wrapper');
    const trigger = document.getElementById('ep-collector-searchable-trigger');
    const dropdown = document.getElementById('ep-collector-searchable-dropdown');
    const searchInput = document.getElementById('ep-collector-search-input');
    const listEl = document.getElementById('ep-collector-searchable-list');

    const renderList = (filterText = '') => {
      const q = filterText.toLowerCase().trim();
      const filtered = eligibleList.filter(e => 
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.area && e.area.toLowerCase().includes(q))
      );

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="ep-searchable-empty">No active collectors matching "${this.escapeHtml(filterText)}"</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(e => {
        const isSelected = (this.selectedCollector && e.name.toLowerCase() === this.selectedCollector.toLowerCase()) ||
                           (this.selectedCollectorId && e.id === this.selectedCollectorId);
        return `
          <div class="ep-searchable-item ${isSelected ? 'selected' : ''}" data-id="${this.escapeHtml(e.id)}" data-name="${this.escapeHtml(e.name)}">
            <div>
              <div style="font-weight:700; color:var(--text-main); font-size:13px;">${this.escapeHtml(e.name)}</div>
              <div style="font-size:11px; color:var(--text-muted); display:flex; gap:6px; align-items:center; margin-top:2px;">
                <span class="badge" style="font-size:10px; padding:1px 5px; background:rgba(139,92,246,0.15); color:#a78bfa;">Collector</span>
                ${e.area ? `<span>Route: <strong>${this.escapeHtml(e.area)}</strong></span>` : ''}
                ${e.id ? `<span>(${this.escapeHtml(e.id)})</span>` : ''}
              </div>
            </div>
            ${isSelected ? '<span style="color:var(--accent-gold); font-weight:800; font-size:14px;">✓</span>' : ''}
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.ep-searchable-item').forEach(item => {
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const chosenName = item.getAttribute('data-name');
          const chosenId = item.getAttribute('data-id');
          this.selectedCollector = chosenName;
          this.selectedCollectorId = chosenId;
          this.caLedgerPage = 1;
          wrapper.classList.remove('open');
          this.renderCashAdvanceTrackerTab();
        });
      });
    };

    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isOpen = wrapper.classList.contains('open');
      document.querySelectorAll('.ep-searchable-select.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) {
        wrapper.classList.add('open');
        renderList('');
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 60);
      }
    });

    searchInput.addEventListener('input', (ev) => {
      renderList(ev.target.value);
    });

    searchInput.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });

    document.addEventListener('click', (ev) => {
      if (!wrapper.contains(ev.target)) {
        wrapper.classList.remove('open');
      }
    });
  }

  // =========================================================================
  // MANUAL PAYMENT MODAL & BALANCES
  // =========================================================================
  openPaymentModal(targetPerson, targetRole) {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot record payments.');
      return;
    }
    const person = targetPerson || (this.activeTab === 'short-tracker' ? this.selectedTeller : this.selectedCollector);
    const role = targetRole || (this.activeTab === 'short-tracker' ? 'Teller' : 'Collector');
    const modal = document.getElementById('modal-ep-record-payment');
    if (!modal) return;
    const nm = document.getElementById('ep-paymodal-person'); if (nm) nm.value = person;
    const rl = document.getElementById('ep-paymodal-role'); if (rl) rl.value = role;
    const dt = document.getElementById('ep-paymodal-date'); if (dt) dt.value = new Date().toISOString().split('T')[0];
    const am = document.getElementById('ep-paymodal-amount'); if (am) am.value = '';
    const nt = document.getElementById('ep-paymodal-notes'); if (nt) nt.value = '';
    const ti = document.getElementById('ep-paymodal-title');
    if (ti) ti.textContent = role === 'Collector' ? 'Record Payment Against Cash Advance' : 'Record Payment Against Shortage';
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  closePaymentModal() {
    const modal = document.getElementById('modal-ep-record-payment');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  submitManualPayment() {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot record payments.');
      return;
    }
    const person = (document.getElementById('ep-paymodal-person') ? document.getElementById('ep-paymodal-person').value : '').trim();
    const role = document.getElementById('ep-paymodal-role') ? document.getElementById('ep-paymodal-role').value : 'Teller';
    const date = document.getElementById('ep-paymodal-date') ? document.getElementById('ep-paymodal-date').value : new Date().toISOString().split('T')[0];
    const amt = parseFloat(document.getElementById('ep-paymodal-amount') ? document.getElementById('ep-paymodal-amount').value : '0');
    const notes = (document.getElementById('ep-paymodal-notes') ? document.getElementById('ep-paymodal-notes').value : '').trim();
    if (!person || amt <= 0) {
      alert('Please provide a valid person name and payment amount greater than zero.');
      return;
    }
    const isCA = role === 'Collector' || (role && role.toUpperCase().includes('COLLECTOR'));
    const store = window.appStore;
    if (!store) return;

    // Master Registry Person lookup for stable relationship
    const allEmps = [...(store.data.employees || []), ...(store.data.relievers || [])];
    const matchedEmp = allEmps.find(e => e && e.name && e.name.trim().toUpperCase() === person.toUpperCase()) ||
                      allEmps.find(e => e && e.id && (e.id === this.selectedTellerId || e.id === this.selectedCollectorId));

    const empId = matchedEmp ? matchedEmp.id : (isCA ? (this.selectedCollectorId || '') : (this.selectedTellerId || ''));
    const finalRole = matchedEmp ? matchedEmp.role : role;
    const boothCode = matchedEmp ? (matchedEmp.boothCode || matchedEmp.booth || '') : '';
    const loc = matchedEmp ? (matchedEmp.area || matchedEmp.municipality || '') : '';

    // Calculate outstanding balance to prevent negative balance or overpayment
    const txns = store.data.transactions || [];
    let orig = 0, paid = 0;
    if (!isCA) {
      const qU = person.toUpperCase();
      txns.forEach(t => {
        if (!t || !t.name) return;
        const tU = t.name.toUpperCase();
        const idMatch = empId && t.employeeId && (t.employeeId === empId);
        const nameMatch = tU.includes(qU) || qU.includes(tU);
        if (!idMatch && !nameMatch) return;
        const isSh = t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'));
        const isPy = (t.classification === 'PAYMENT' || t.type === 'PAYMENT') && !t.applyToCA;
        if (isSh) orig += Number(t.amount) || 0;
        else if (isPy) paid += Number(t.amount) || 0;
      });
      const curRem = Math.max(0, orig - paid);
      if (curRem === 0 && orig > 0) {
        alert(`Cannot record payment: ${person}'s shortages are already FULLY PAID (Remaining Balance: ₱0.00).`);
        return;
      }
      if (amt > curRem && curRem > 0) {
        alert(`Payment amount (₱${amt.toLocaleString('en-US', {minimumFractionDigits: 2})}) exceeds the remaining shortage balance of ₱${curRem.toLocaleString('en-US', {minimumFractionDigits: 2})}. Overpayments are not allowed.`);
        return;
      }
    } else {
      const qN = person.toLowerCase();
      txns.forEach(t => {
        if (!t || !t.name) return;
        const tN = t.name.toLowerCase();
        const idMatch = empId && t.employeeId && (t.employeeId === empId);
        const nameMatch = tN.includes(qN) || qN.includes(tN);
        if (!idMatch && !nameMatch) return;
        const isC = t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'));
        const isPy = (t.classification === 'PAYMENT' || t.type === 'PAYMENT') && t.applyToCA;
        if (isC) orig += Number(t.amount) || 0;
        else if (isPy) paid += Number(t.amount) || 0;
      });
      const curRem = Math.max(0, orig - paid);
      if (curRem === 0 && orig > 0) {
        alert(`Cannot record payment: ${person}'s Cash Advances are already FULLY PAID (Remaining Balance: ₱0.00).`);
        return;
      }
      if (amt > curRem && curRem > 0) {
        alert(`Payment amount (₱${amt.toLocaleString('en-US', {minimumFractionDigits: 2})}) exceeds the remaining CA balance of ₱${curRem.toLocaleString('en-US', {minimumFractionDigits: 2})}. Overpayments are not allowed.`);
        return;
      }
    }

    const newPayment = {
      id: 'TXN-PAY-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      date: date,
      amount: amt,
      description: isCA ? `PAYMENT - C.A. - ${person}` : `PAYMENT - SHORT - ${person}`,
      name: matchedEmp ? matchedEmp.name : person,
      employeeId: empId,
      role: finalRole,
      boothCode: boothCode,
      location: loc,
      classification: 'PAYMENT',
      type: 'PAYMENT',
      transactionType: 'PAYMENT',
      applyToCA: isCA,
      appliedTo: isCA ? 'Cash Advance' : 'Short Teller',
      note: notes || (isCA ? 'CA Payment - ' + person : 'Shortage Payment - ' + person),
      settlement: 'CREDITED',
      verificationStatus: 'VERIFIED',
      status: 'Verified'
    };

    store.addTransaction(newPayment);
    if (window.sfx) window.sfx.playChime();
    this.closePaymentModal();
    this.render();
  }

  // =========================================================================
  // UNIFIED EDIT MODAL & REAL-TIME RECALCULATION
  // =========================================================================
  openEditModal(txnId, section) {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot edit financial records.');
      return;
    }
    const store = window.appStore;
    if (!store) return;
    const txn = store.data.transactions.find(t => t.id === txnId);
    if (!txn) {
      alert('Transaction record not found.');
      return;
    }

    this._editingTxnId = txnId;
    this._editingSection = section || 'expense';
    this._editingOriginalAmount = Number(txn.amount) || 0;

    const modal = document.getElementById('modal-ep-edit-txn');
    if (!modal) return;

    const idEl = document.getElementById('ep-edit-txn-id');
    const secEl = document.getElementById('ep-edit-txn-section');
    if (idEl) idEl.value = txnId;
    if (secEl) secEl.value = this._editingSection;

    const fDate = document.getElementById('ep-edit-txn-date');
    const fType = document.getElementById('ep-edit-txn-type');
    const fAmount = document.getElementById('ep-edit-txn-amount');
    const fRemaining = document.getElementById('ep-edit-txn-remaining');
    const fSettlement = document.getElementById('ep-edit-txn-settlement');
    const fName = document.getElementById('ep-edit-txn-name');
    const fDesc = document.getElementById('ep-edit-txn-description');
    const fLoc = document.getElementById('ep-edit-txn-location');
    const fBooth = document.getElementById('ep-edit-txn-boothcode');
    const fNotes = document.getElementById('ep-edit-txn-notes');

    if (fDate) fDate.value = txn.date || '';
    if (fType) fType.value = txn.type || txn.classification || 'EXPENSE';
    if (fAmount) fAmount.value = Number(txn.amount) || 0;
    if (fName) fName.value = txn.name || '';
    if (fDesc) fDesc.value = txn.description || '';
    if (fLoc) fLoc.value = txn.location || '';
    if (fBooth) fBooth.value = txn.boothCode || '';
    if (fNotes) fNotes.value = txn.note || '';

    const oad = document.getElementById('ep-edit-orig-amount-display');
    if (oad) oad.textContent = 'P' + this._editingOriginalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 });

    const titleEl = document.getElementById('ep-edit-modal-title');
    const grpRemaining = document.getElementById('ep-edit-grp-remaining');
    const grpSettlement = document.getElementById('ep-edit-grp-settlement');
    const grpSettlementRow = document.getElementById('ep-edit-grp-settlement-row');
    const grpDesc = document.getElementById('ep-edit-grp-desc');
    const grpLocRow = document.getElementById('ep-edit-grp-loc-row');
    const typeLabel = document.getElementById('ep-edit-type-label');
    const descLabel = document.getElementById('ep-edit-desc-label');
    const personLabel = document.getElementById('ep-edit-personnel-label');

    if (this._editingSection === 'expense') {
      if (titleEl) titleEl.textContent = '✏️ Edit Operating Expense';
      if (grpRemaining) grpRemaining.style.display = 'none';
      if (grpSettlement) grpSettlement.style.display = 'none';
      if (grpSettlementRow) grpSettlementRow.style.gridTemplateColumns = '1fr';
      if (grpDesc) grpDesc.style.display = 'block';
      if (grpLocRow) grpLocRow.style.display = 'grid';
      if (descLabel) descLabel.textContent = 'Expense Item / Description:';
      if (personLabel) personLabel.textContent = 'Staff / Station Allocation:';
    } else if (this._editingSection === 'short') {
      if (titleEl) titleEl.textContent = '✏️ Edit Shortage / Payment Record (Teller)';
      if (grpRemaining) grpRemaining.style.display = 'block';
      if (grpSettlement) grpSettlement.style.display = 'block';
      if (grpSettlementRow) grpSettlementRow.style.gridTemplateColumns = '1fr 1fr';
      if (grpDesc) grpDesc.style.display = 'block';
      if (grpLocRow) grpLocRow.style.display = 'grid';
      if (typeLabel) typeLabel.textContent = 'Transaction Type (SHORT / PAYMENT):';
      if (personLabel) personLabel.textContent = 'Teller Name:';
    } else if (this._editingSection === 'ca') {
      if (titleEl) titleEl.textContent = '✏️ Edit Cash Advance / Payment Record (Collector)';
      if (grpRemaining) grpRemaining.style.display = 'block';
      if (grpSettlement) grpSettlement.style.display = 'block';
      if (grpSettlementRow) grpSettlementRow.style.gridTemplateColumns = '1fr 1fr';
      if (grpDesc) grpDesc.style.display = 'block';
      if (grpLocRow) grpLocRow.style.display = 'grid';
      if (typeLabel) typeLabel.textContent = 'Transaction Type (CASH ADVANCE / PAYMENT):';
      if (personLabel) personLabel.textContent = 'Collector Name:';
    } else if (this._editingSection === 'payment') {
      if (titleEl) titleEl.textContent = '✏️ Edit Payment Record';
      if (grpRemaining) grpRemaining.style.display = 'block';
      if (grpSettlement) grpSettlement.style.display = 'block';
      if (grpSettlementRow) grpSettlementRow.style.gridTemplateColumns = '1fr 1fr';
      if (grpDesc) grpDesc.style.display = 'block';
      if (grpLocRow) grpLocRow.style.display = 'none';
      if (typeLabel) typeLabel.textContent = 'Settlement Category:';
      if (personLabel) personLabel.textContent = 'Personnel & Role:';
    }

    this.handleEditAmountInput();

    if (txn.settlement && fSettlement) {
      fSettlement.value = txn.settlement;
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  handleEditAmountInput() {
    const txnId = this._editingTxnId;
    const store = window.appStore;
    if (!store || !txnId) return;

    const amountInput = document.getElementById('ep-edit-txn-amount');
    const remInput = document.getElementById('ep-edit-txn-remaining');
    const setSelect = document.getElementById('ep-edit-txn-settlement');
    const typeSelect = document.getElementById('ep-edit-txn-type');
    const nameInput = document.getElementById('ep-edit-txn-name');

    if (!amountInput || !remInput) return;

    const newAmt = parseFloat(amountInput.value) || 0;
    const currType = typeSelect ? typeSelect.value : 'EXPENSE';
    const currPerson = (nameInput ? nameInput.value : '').trim().toUpperCase();

    if (this._editingSection === 'short' || currType === 'SHORT' || (currType === 'PAYMENT' && !this._isCASection())) {
      const txns = store.data.transactions || [];
      let totalShort = 0, totalPaid = 0;
      txns.forEach(t => {
        if (t.id === txnId) return;
        if (currPerson && t.name && !t.name.toUpperCase().includes(currPerson) && !currPerson.includes(t.name.toUpperCase())) return;

        const isSh = t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'));
        const isPy = (t.classification === 'PAYMENT' || t.type === 'PAYMENT') && !t.applyToCA;
        if (isSh) totalShort += Number(t.amount) || 0;
        else if (isPy) totalPaid += Number(t.amount) || 0;
      });

      if (currType === 'SHORT') totalShort += newAmt;
      else totalPaid += newAmt;

      const calcRem = Math.max(0, totalShort - totalPaid);
      remInput.value = calcRem.toFixed(2);

      if (setSelect && !setSelect.dataset.userModified) {
        if (calcRem === 0 && totalShort > 0) setSelect.value = 'Fully Paid';
        else if (totalPaid > 0) setSelect.value = 'Partially Paid';
        else setSelect.value = 'Pending';
      }
    } else if (this._editingSection === 'ca' || currType === 'CASH ADVANCE' || (currType === 'PAYMENT' && this._isCASection())) {
      const txns = store.data.transactions || [];
      let totalCA = 0, totalPaid = 0;
      txns.forEach(t => {
        if (t.id === txnId) return;
        if (currPerson && t.name && !t.name.toUpperCase().includes(currPerson) && !currPerson.includes(t.name.toUpperCase())) return;

        const isCA = t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'));
        const isPy = (t.classification === 'PAYMENT' || t.type === 'PAYMENT') && t.applyToCA;
        if (isCA) totalCA += Number(t.amount) || 0;
        else if (isPy) totalPaid += Number(t.amount) || 0;
      });

      if (currType === 'CASH ADVANCE') totalCA += newAmt;
      else totalPaid += newAmt;

      const calcRem = Math.max(0, totalCA - totalPaid);
      remInput.value = calcRem.toFixed(2);

      if (setSelect && !setSelect.dataset.userModified) {
        if (calcRem === 0 && totalCA > 0) setSelect.value = 'Fully Paid';
        else if (totalPaid > 0) setSelect.value = 'Partially Paid';
        else setSelect.value = 'Pending';
      }
    }
  }

  _isCASection() {
    return this._editingSection === 'ca';
  }

  onEditCancelClicked() {
    this.showConfirmModal({
      title: 'Cancel Changes?',
      message: 'You have unsaved changes. Are you sure you want to cancel and discard them?',
      yesText: 'YES',
      noText: 'NO',
      isDanger: false,
      onConfirm: () => {
        this.closeEditModal();
      },
      onCancel: () => {
      }
    });
  }

  onEditSaveClicked() {
    let saveMsg = 'Are you sure you want to save the changes made to this record?';
    if (this._editingSection === 'short') {
      saveMsg = 'Are you sure you want to save the changes made to this shortage record?';
    } else if (this._editingSection === 'ca') {
      saveMsg = 'Are you sure you want to save the changes made to this cash advance record?';
    } else if (this._editingSection === 'payment') {
      saveMsg = 'Are you sure you want to save the changes made to this payment record?';
    }

    this.showConfirmModal({
      title: 'Save Changes?',
      message: saveMsg,
      yesText: 'YES',
      noText: 'NO',
      isDanger: false,
      onConfirm: () => {
        this._executeSaveTransaction();
      },
      onCancel: () => {
      }
    });
  }

  _executeSaveTransaction() {
    if (window.authManager && window.authManager.isCollector()) {
      alert('Permission Denied: Collector accounts cannot save or modify financial records.');
      return;
    }
    const txnId = this._editingTxnId;
    if (!txnId) return;

    const store = window.appStore;
    if (!store) return;
    const idx = store.data.transactions.findIndex(t => t.id === txnId);
    if (idx === -1) {
      alert('Transaction record not found.');
      return;
    }

    const nAmt = parseFloat(document.getElementById('ep-edit-txn-amount') ? document.getElementById('ep-edit-txn-amount').value : '0');
    const nType = document.getElementById('ep-edit-txn-type') ? document.getElementById('ep-edit-txn-type').value : '';
    const nDate = document.getElementById('ep-edit-txn-date') ? document.getElementById('ep-edit-txn-date').value : '';
    const nName = (document.getElementById('ep-edit-txn-name') ? document.getElementById('ep-edit-txn-name').value : '').trim();
    const nDesc = (document.getElementById('ep-edit-txn-description') ? document.getElementById('ep-edit-txn-description').value : '').trim();
    const nLoc = (document.getElementById('ep-edit-txn-location') ? document.getElementById('ep-edit-txn-location').value : '').trim();
    const nBooth = (document.getElementById('ep-edit-txn-boothcode') ? document.getElementById('ep-edit-txn-boothcode').value : '').trim();
    const nNotes = (document.getElementById('ep-edit-txn-notes') ? document.getElementById('ep-edit-txn-notes').value : '').trim();
    const nSettlement = document.getElementById('ep-edit-txn-settlement') ? document.getElementById('ep-edit-txn-settlement').value : '';

    const txn = store.data.transactions[idx];
    txn.amount = nAmt;
    txn.type = nType;
    txn.classification = this._getClassificationFromType(nType);
    txn.date = nDate;
    txn.name = nName;
    txn.description = nDesc;
    txn.location = nLoc;
    txn.boothCode = nBooth;
    txn.note = nNotes;
    txn.settlement = nSettlement;

    txn.isExpense = nType === 'EXPENSE';
    txn.isShortage = nType === 'SHORT';
    txn.isCashAdvance = nType === 'CASH ADVANCE';
    if (nType === 'CASH ADVANCE') {
      txn.applyToCA = true;
      txn.appliedTo = 'Cash Advance';
    } else if (nType === 'SHORT') {
      txn.applyToCA = false;
      txn.appliedTo = 'Short Teller';
    }

    store.save();
    if (window.sfx) window.sfx.playChime();
    this.closeEditModal();
    this.render();
  }

  closeEditModal() {
    const modal = document.getElementById('modal-ep-edit-txn');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    this._editingTxnId = null;
    this._editingOriginalAmount = 0;
  }

  _getClassificationFromType(type) {
    if (type === 'SHORT') return 'SHORT';
    if (type === 'CASH ADVANCE') return 'CA';
    if (type === 'PAYMENT') return 'PAYMENT';
    return 'OTHER';
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\'/g, '&#039;');
  }
}

window.expensesPayment = new ExpensesPaymentController();
document.addEventListener('DOMContentLoaded', function() {
  window.expensesPayment.init();
});