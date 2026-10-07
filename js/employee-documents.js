/**
 * NORTH-005 OmniERP — Employee Documents & Compliance Repository Module
 * Dedicated to COMMISSION BASED TELLER AGREEMENT (CBTA)
 * Supports PDF & Images (JPG, PNG, WEBP), Live Previews, Master Registry Synchronization,
 * Automatic "Missing CBTA" Tracking for Active Tellers & Relievers,
 * Expiration tracking, and In-Browser PDF/Image Viewer.
 */

(function () {
  'use strict';

  const DOCS_STORAGE_KEY = 'north005_employee_documents_v5';

  function notify(msg) {
    if (typeof window !== 'undefined' && window.toast && typeof window.toast.info === 'function') {
      window.toast.info(msg);
      return;
    }
    if (typeof alert === 'function') {
      alert(msg);
    } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg);
    }
  }

  class EmployeeDocumentsModule {
    constructor() {
      this.searchQuery = '';
      this.typeFilter = 'all';
      this.statusFilter = 'all';
      this.activeKpiTab = 'all'; // 'all', 'Complete', 'Expiring Soon', 'Expired', 'Missing'

      // Pagination
      this.currentPage = 1;
      this.pageSize = 10;

      // Pending upload state (for confirmation and replace modals)
      this.pendingUpload = {
        employeeId: null,
        employeeName: null,
        employeeRole: null,
        documentType: 'CBTA',
        fileName: null,
        fileSize: null,
        fileDataUrl: null,
        fileType: null,
        dateUploaded: null,
        expiryDate: null,
        notes: null
      };

      // Temporary in-modal file buffer for CBTA
      this.fileBuffers = {
        'CBTA': null
      };

      this.documents = this.loadDocuments();
    }

    init() {
      this.populateDatalist();
      this.render();

      // Close employee search dropdown when clicking outside
      document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.searchable-select-wrapper');
        const results = document.getElementById('doc-emp-search-results');
        if (wrapper && results && !wrapper.contains(e.target)) {
          results.classList.remove('active');
        }
      });
    }

    loadDocuments() {
      try {
        const stored = localStorage.getItem(DOCS_STORAGE_KEY);
        if (!stored) {
          // Check if previous version stored any valid CBTA documents
          const v4Stored = localStorage.getItem('north005_employee_documents_v4');
          if (v4Stored) {
            const parsed = JSON.parse(v4Stored);
            // Migrate only genuine CBTA documents, purge legacy mock types (Resume/Clearance)
            const cbtaOnly = parsed.filter(d => d && (d.documentType === 'CBTA' || (d.fileName && d.fileName.toUpperCase().includes('CBTA'))));
            return cbtaOnly;
          }
          return [];
        }
        const parsed = JSON.parse(stored);
        // Ensure only CBTA documents are present
        return Array.isArray(parsed) ? parsed.filter(d => d && d.documentType === 'CBTA') : [];
      } catch (e) {
        return [];
      }
    }

    saveDocuments() {
      localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(this.documents));
    }

    // Returns all active employees in Master Registry
    getEmployees() {
      const store = window.appStore;
      if (!store) return [];
      const emps = (typeof store.getEmployees === 'function') ? store.getEmployees() : (store.data ? (store.data.employees || []) : []);
      return emps.filter(e => e && e.name && !e.name.includes('Buffer Reliever'));
    }

    // Returns the 150 active field personnel who legally require CBTA: Tellers / Sales Reps & Relievers
    getFieldPersonnel() {
      const emps = this.getEmployees();
      return emps.filter(e => {
        const role = (e.role || e.position || '').toUpperCase();
        const dept = (e.department || '').toUpperCase();
        if (role.includes('ADMIN') || role.includes('SUPERVISOR') || role.includes('COLLECTOR') ||
            dept.includes('COLLECTOR') || dept.includes('ADMIN') || dept.includes('SUPERVISOR')) {
          return false;
        }
        return true;
      });
    }

    populateDatalist() {
      const datalist = document.getElementById('docs-search-datalist');
      if (!datalist) return;
      const emps = this.getEmployees();
      datalist.innerHTML = emps.map(e => `
        <option value="${e.name}">
        <option value="${e.id}">
        <option value="${e.role || ''}">
      `).concat([
        '<option value="CBTA">',
        '<option value="Commission Based Teller Agreement">'
      ]).join('');
    }

    setKpiTab(tabKey) {
      this.activeKpiTab = tabKey;
      this.currentPage = 1;

      // Update card active classes
      const cardMap = {
        'all': 'doc-tab-all',
        'Complete': 'doc-tab-valid',
        'Expiring Soon': 'doc-tab-expiring',
        'Expired': 'doc-tab-expired',
        'Missing': 'doc-tab-missing'
      };

      document.querySelectorAll('#view-employee-documents .kpi-card-tab').forEach(c => c.classList.remove('active'));
      const activeCard = document.getElementById(cardMap[tabKey]);
      if (activeCard) activeCard.classList.add('active');

      // Sync status dropdown
      const statusEl = document.getElementById('docs-filter-status');
      if (statusEl) {
        statusEl.value = tabKey === 'all' ? 'all' : tabKey;
        this.statusFilter = statusEl.value;
      }

      this.render();
    }

    filterDocuments() {
      const searchEl = document.getElementById('docs-search-input');
      const typeEl = document.getElementById('docs-filter-type');
      const statusEl = document.getElementById('docs-filter-status');

      if (searchEl) this.searchQuery = searchEl.value.trim().toLowerCase();
      if (typeEl) this.typeFilter = typeEl.value;
      if (statusEl) {
        this.statusFilter = statusEl.value;
        this.activeKpiTab = statusEl.value;
      }

      this.currentPage = 1;
      this.render();
    }

    setPage(page) {
      this.currentPage = page;
      this.render();
    }

    setPageSize(size) {
      this.pageSize = parseInt(size, 10) || 10;
      this.currentPage = 1;
      this.render();
    }

    /* --- DEDICATED CBTA FILE UPLOAD LOGIC (PDF & IMAGES) --- */
    handleFileSelected(docType, inputEl) {
      const file = inputEl.files && inputEl.files[0];
      if (!file) return;

      const validTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
        'application/pdf'
      ];

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = validTypes.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

      if (!isPdf && !isImage) {
        notify('Validation Error: Only PDF documents (.pdf) or image files (.jpg, .jpeg, .png, .webp) are supported.');
        inputEl.value = '';
        return;
      }

      // Max size: 15MB
      if (file.size > 15 * 1024 * 1024) {
        notify('Validation Error: File size exceeds the 15MB limit. Please compress or select a smaller file.');
        inputEl.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        this.fileBuffers['CBTA'] = {
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024)} KB`,
          fileDataUrl: dataUrl,
          fileType: isPdf ? 'application/pdf' : file.type
        };

        // Update UI status
        const statusEl = document.getElementById('doc-status-cbta');
        if (statusEl) {
          statusEl.textContent = '✓ Ready to save';
          statusEl.style.color = '#4ade80';
        }

        const previewIcon = document.getElementById('doc-preview-icon-cbta');
        const previewImg = document.getElementById('doc-preview-img-cbta');

        if (isPdf) {
          if (previewIcon) previewIcon.style.display = 'flex';
          if (previewImg) previewImg.style.display = 'none';
        } else {
          if (previewIcon) previewIcon.style.display = 'none';
          if (previewImg) {
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
          }
        }

        const filenameEl = document.getElementById('doc-filename-cbta');
        if (filenameEl) filenameEl.textContent = file.name;

        const filesizeEl = document.getElementById('doc-filesize-cbta');
        if (filesizeEl) filesizeEl.textContent = `${Math.round(file.size / 1024)} KB`;

        const previewBox = document.getElementById('doc-preview-box-cbta');
        if (previewBox) previewBox.style.display = 'flex';

        const removeBtn = document.getElementById('doc-remove-cbta');
        if (removeBtn) removeBtn.style.display = 'inline-block';
      };

      reader.readAsDataURL(file);
    }

    removeFile(docType = 'CBTA') {
      this.fileBuffers['CBTA'] = null;

      const fileInput = document.getElementById('doc-file-cbta');
      if (fileInput) fileInput.value = '';

      const statusEl = document.getElementById('doc-status-cbta');
      if (statusEl) {
        statusEl.textContent = 'No file selected';
        statusEl.style.color = 'var(--text-muted)';
      }

      const previewBox = document.getElementById('doc-preview-box-cbta');
      if (previewBox) previewBox.style.display = 'none';

      const removeBtn = document.getElementById('doc-remove-cbta');
      if (removeBtn) removeBtn.style.display = 'none';
    }

    openUploadModal() {
      if (!window.authManager || !window.authManager.isAdmin()) {
        notify('Permission Denied: Only Administrators can upload compliance documents.');
        return;
      }

      this.clearSelectedEmployee();
      this.removeFile('CBTA');

      document.getElementById('doc-upload-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('doc-upload-expiry').value = '';
      document.getElementById('doc-upload-notes').value = '';

      const modal = document.getElementById('modal-upload-document');
      if (modal) modal.classList.add('active');
    }

    // Direct 1-click upload trigger for a specific employee from the Missing Records table
    openUploadModalForEmp(empId) {
      if (!window.authManager || !window.authManager.isAdmin()) {
        notify('Permission Denied: Only Administrators can upload compliance documents.');
        return;
      }

      this.openUploadModal();
      this.selectEmployee(empId);
    }

    closeUploadModal() {
      const modal = document.getElementById('modal-upload-document');
      if (modal) modal.classList.remove('active');
    }

    /* --- SEARCHABLE MASTER REGISTRY EMPLOYEE SELECTOR --- */
    handleEmpSearchInput(query) {
      this.renderEmpSearchResults(query);
    }

    showEmpDropdown() {
      const input = document.getElementById('doc-emp-search-input');
      this.renderEmpSearchResults(input ? input.value : '');
    }

    renderEmpSearchResults(filter = '') {
      const resultsContainer = document.getElementById('doc-emp-search-results');
      if (!resultsContainer) return;

      const emps = this.getEmployees();
      const q = (filter || '').trim().toLowerCase();

      const matched = emps.filter(e => {
        if (!q) return true;
        return e.name.toLowerCase().includes(q) ||
               e.id.toLowerCase().includes(q) ||
               (e.role || '').toLowerCase().includes(q) ||
               (e.boothCode || '').toLowerCase().includes(q);
      });

      if (matched.length === 0) {
        resultsContainer.innerHTML = `
          <div style="padding:10px 14px; font-size:12px; color:var(--text-muted);">
            No matching Master Registry staff found.
          </div>
        `;
        resultsContainer.classList.add('active');
        return;
      }

      resultsContainer.innerHTML = matched.slice(0, 30).map(e => `
        <div class="searchable-select-item" onclick="window.employeeDocumentsModule.selectEmployee('${e.id}')">
          <span>${e.id}</span> — <strong>${e.name}</strong> <small style="color:var(--text-muted);">(${e.role || 'Sales Rep'})</small>
        </div>
      `).join('');

      resultsContainer.classList.add('active');
    }

    selectEmployee(empId) {
      const emps = this.getEmployees();
      const emp = emps.find(e => e.id === empId);
      if (!emp) return;

      document.getElementById('doc-selected-emp-id').value = emp.id;
      document.getElementById('doc-selected-emp-name').value = emp.name;
      document.getElementById('doc-selected-emp-role').value = emp.role || 'Staff';

      document.getElementById('doc-badge-id').textContent = emp.id;
      document.getElementById('doc-badge-name').textContent = emp.name;
      document.getElementById('doc-badge-role').textContent = emp.role || 'Staff';

      document.getElementById('doc-selected-emp-badge').style.display = 'flex';
      document.getElementById('doc-emp-search-input').style.display = 'none';

      const resultsContainer = document.getElementById('doc-emp-search-results');
      if (resultsContainer) resultsContainer.classList.remove('active');
    }

    clearSelectedEmployee() {
      document.getElementById('doc-selected-emp-id').value = '';
      document.getElementById('doc-selected-emp-name').value = '';
      document.getElementById('doc-selected-emp-role').value = '';

      document.getElementById('doc-selected-emp-badge').style.display = 'none';
      const input = document.getElementById('doc-emp-search-input');
      if (input) {
        input.value = '';
        input.style.display = 'block';
        input.focus();
      }
    }

    /* --- INITIATE SAVE & CONFIRMATION FLOW --- */
    initiateSaveDocument() {
      if (!window.authManager || !window.authManager.isAdmin()) return;

      const empId = document.getElementById('doc-selected-emp-id').value;
      const empName = document.getElementById('doc-selected-emp-name').value;
      const empRole = document.getElementById('doc-selected-emp-role').value || 'Staff';
      const docType = 'CBTA';

      // 1. Validation: Employee selected
      if (!empId) {
        notify('Validation Error: Please search and select an employee from Master Registry.');
        return;
      }

      // 2. Validation: CBTA file selected
      const fileData = this.fileBuffers['CBTA'];
      if (!fileData || !fileData.fileDataUrl) {
        notify('Validation Error: Please select and upload the COMMISSION BASED TELLER AGREEMENT (CBTA) file (PDF or Image).');
        return;
      }

      const dateUploaded = document.getElementById('doc-upload-date').value || new Date().toISOString().split('T')[0];
      const expiryDate = document.getElementById('doc-upload-expiry').value || '—';
      const notes = document.getElementById('doc-upload-notes').value.trim() || 'Verified Commission Based Teller Agreement (CBTA) on file.';

      // Determine status based on expiration date
      let status = 'Complete';
      if (expiryDate && expiryDate !== '—') {
        const exp = new Date(expiryDate);
        const now = new Date();
        const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) status = 'Expired';
        else if (diffDays <= 30) status = 'Expiring Soon';
      }

      this.pendingUpload = {
        employeeId: empId,
        employeeName: empName,
        employeeRole: empRole,
        documentType: docType,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileDataUrl: fileData.fileDataUrl,
        fileType: fileData.fileType,
        dateUploaded,
        expiryDate,
        status,
        notes
      };

      // Check if employee already has a CBTA
      const existingDoc = this.documents.find(d => d.employeeId === empId && d.documentType === 'CBTA');
      if (existingDoc) {
        // Show Replace confirmation modal
        document.getElementById('doc-replace-emp-name').textContent = `${empName} (${empId})`;
        document.getElementById('doc-replace-type').textContent = 'COMMISSION BASED TELLER AGREEMENT (CBTA)';
        document.getElementById('doc-replace-modal-title').textContent = 'Replace Existing CBTA?';

        const replaceModal = document.getElementById('modal-doc-confirm-replace');
        if (replaceModal) replaceModal.classList.add('active');
      } else {
        // Show Standard Save confirmation modal
        document.getElementById('doc-confirm-emp-name').textContent = `${empName} (${empId})`;
        document.getElementById('doc-confirm-type').textContent = 'COMMISSION BASED TELLER AGREEMENT (CBTA)';
        document.getElementById('doc-confirm-filename').textContent = fileData.fileName;

        const confirmModal = document.getElementById('modal-doc-confirm-upload');
        if (confirmModal) confirmModal.classList.add('active');
      }
    }

    cancelUploadConfirmation() {
      const modal = document.getElementById('modal-doc-confirm-upload');
      if (modal) modal.classList.remove('active');
    }

    cancelReplaceConfirmation() {
      const modal = document.getElementById('modal-doc-confirm-replace');
      if (modal) modal.classList.remove('active');
    }

    executeUpload() {
      this.cancelUploadConfirmation();
      this.commitDocumentSave(false);
    }

    executeReplace() {
      this.cancelReplaceConfirmation();
      this.commitDocumentSave(true);
    }

    commitDocumentSave(isReplace = false) {
      const p = this.pendingUpload;
      if (!p || !p.employeeId) return;

      if (isReplace) {
        this.documents = this.documents.filter(d => !(d.employeeId === p.employeeId && d.documentType === 'CBTA'));
      }

      const newDoc = {
        id: `DOC-${p.employeeId}-${Date.now()}`,
        employeeId: p.employeeId,
        employeeName: p.employeeName,
        position: p.employeeRole,
        documentType: 'CBTA',
        status: p.status,
        dateUploaded: p.dateUploaded,
        expiryDate: p.expiryDate,
        fileName: p.fileName,
        fileSize: p.fileSize,
        fileDataUrl: p.fileDataUrl,
        fileType: p.fileType,
        notes: p.notes
      };

      this.documents.unshift(newDoc);
      this.saveDocuments();
      this.closeUploadModal();
      this.render();

      const actionWord = isReplace ? 'replaced' : 'uploaded';
      notify(`Success: Commission Based Teller Agreement (CBTA) for ${p.employeeName} (${p.employeeId}) ${actionWord} successfully.`);
    }

    /* --- REPOSITORY TABLE RENDERING & LIVE MISSING TRACKING --- */
    render() {
      const tbody = document.getElementById('employee-documents-tbody');
      if (!tbody) return;

      const isAdmin = window.authManager && window.authManager.isAdmin();

      // Update upload button visibility
      const uploadBtns = document.querySelectorAll('.admin-only-action');
      uploadBtns.forEach(btn => {
        btn.style.display = isAdmin ? 'inline-flex' : 'none';
      });

      // 1. Gather all active field personnel who legally require CBTA (150 staff: 116 Tellers + 34 Relievers)
      const fieldPersonnel = this.getFieldPersonnel();
      const coveredEmpIds = new Set(this.documents.map(d => d.employeeId));

      // Build missing list
      const missingStaff = fieldPersonnel.filter(emp => !coveredEmpIds.has(emp.id));

      // 2. Compute KPI counts
      const totalDocs = this.documents.length;
      const validCount = this.documents.filter(d => d.status === 'Complete').length;
      const expiringCount = this.documents.filter(d => d.status === 'Expiring Soon').length;
      const expiredCount = this.documents.filter(d => d.status === 'Expired').length;
      const missingCount = missingStaff.length;

      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setTxt('kpi-docs-total', totalDocs);
      setTxt('kpi-docs-valid', validCount);
      setTxt('kpi-docs-expiring', expiringCount);
      setTxt('kpi-docs-expired', expiredCount);
      setTxt('kpi-docs-missing', missingCount);

      // 3. Determine records to display based on active tab / filters
      let displayItems = [];

      if (this.activeKpiTab === 'Missing' || this.statusFilter === 'Missing') {
        // Display Missing Staff Roster
        displayItems = missingStaff.map(emp => ({
          isMissingPlaceholder: true,
          id: `MISSING-${emp.id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          position: emp.role || 'Sales Representative',
          documentType: 'CBTA',
          status: 'Missing',
          dateUploaded: '—',
          expiryDate: '—',
          fileName: null,
          notes: 'Awaiting signed CBTA contract submission'
        }));
      } else {
        // Display Uploaded Documents
        displayItems = this.documents.filter(doc => {
          if (this.activeKpiTab !== 'all' && doc.status !== this.activeKpiTab) {
            return false;
          }
          if (this.typeFilter !== 'all' && doc.documentType !== this.typeFilter) return false;
          if (this.statusFilter !== 'all' && doc.status !== this.statusFilter) return false;
          return true;
        });
      }

      // Apply Search Filter
      if (this.searchQuery) {
        displayItems = displayItems.filter(item => {
          const target = `${item.employeeName} ${item.employeeId} ${item.position} ${item.documentType} ${item.notes || ''}`.toLowerCase();
          return target.includes(this.searchQuery);
        });
      }

      // 4. Pagination Calculation
      const totalRecords = displayItems.length;
      const totalPages = Math.max(1, Math.ceil(totalRecords / this.pageSize));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      if (this.currentPage < 1) this.currentPage = 1;

      const startIndex = (this.currentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, totalRecords);
      const paginated = displayItems.slice(startIndex, endIndex);

      this.renderPagination(totalRecords, totalPages);

      if (paginated.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.6;">📁</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">No Document Records Found</div>
              <div style="font-size: 12px;">No employee compliance records match your search query, filters, or active card tab.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = paginated.map(doc => {
        let badgeHtml = '';
        if (doc.status === 'Complete') {
          badgeHtml = `<span class="badge badge-success" style="padding:3px 8px;font-size:11px;">✓ Complete / Valid</span>`;
        } else if (doc.status === 'Expiring Soon') {
          badgeHtml = `<span class="badge badge-warning" style="background:rgba(245,158,11,0.2);color:#fbbf24;border:1px solid #f59e0b;padding:3px 8px;font-size:11px;font-weight:700;">⏰ Expiring Soon</span>`;
        } else if (doc.status === 'Expired') {
          badgeHtml = `<span class="badge badge-danger" style="padding:3px 8px;font-size:11px;">⚠️ Expired</span>`;
        } else {
          badgeHtml = `<span class="badge badge-neutral" style="background:rgba(239,68,68,0.12);color:#fca5a5;padding:3px 8px;font-size:11px;font-weight:700;">❌ Missing / Pending</span>`;
        }

        const isPdf = (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf')) || (doc.fileType === 'application/pdf');
        const fileIcon = isPdf ? '📄' : '🖼️';

        const filePill = doc.fileName
          ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:#60a5fa;background:rgba(96,165,250,0.1);padding:2px 8px;border-radius:4px;font-family:monospace;">${fileIcon} ${doc.fileName}</span>`
          : `<span style="font-size:11.5px;color:var(--text-muted);font-style:italic;">No attachment</span>`;

        let actionBtns = '';
        if (doc.isMissingPlaceholder) {
          if (isAdmin) {
            actionBtns = `
              <button class="btn btn-xs btn-primary" onclick="window.employeeDocumentsModule.openUploadModalForEmp('${doc.employeeId}')" style="background:var(--accent-gold);border-color:var(--accent-gold);color:#000;font-weight:800;padding:3px 8px;font-size:11px;" title="Upload CBTA for this employee">
                ➕ Upload CBTA
              </button>
            `;
          } else {
            actionBtns = `<span style="font-size:11px;color:var(--text-muted);">Pending Admin</span>`;
          }
        } else {
          actionBtns = `
            <button class="btn btn-xs btn-secondary" onclick="window.employeeDocumentsModule.viewDocument('${doc.id}')" style="padding:3px 8px;font-size:11px;margin-right:4px;" title="View Document Info">
              👁️ View
            </button>
          `;
          if (isAdmin) {
            actionBtns += `
              <button class="btn btn-xs btn-secondary" onclick="window.employeeDocumentsModule.deleteDocument('${doc.id}')" style="color:#ef4444;padding:3px 8px;font-size:11px;" title="Delete Document Record">
                🗑️ Delete
              </button>
            `;
          }
        }

        return `
          <tr>
            <td><code style="font-size:11.5px;color:var(--accent-gold);font-weight:700;">${doc.employeeId}</code></td>
            <td>
              <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">${doc.employeeName}</div>
            </td>
            <td><div style="font-size: 12px;">${doc.position || 'Staff'}</div></td>
            <td><div style="font-size: 12px; font-weight: 700; color: #e2e8f0;">${doc.documentType}</div></td>
            <td style="text-align: center;">${badgeHtml}</td>
            <td style="font-size: 11.5px; color: var(--text-muted);">${doc.dateUploaded || '-'}</td>
            <td style="font-size: 11.5px; color: ${doc.status === 'Expired' ? '#f87171' : (doc.status === 'Expiring Soon' ? '#fbbf24' : 'var(--text-muted)')}; font-weight: ${doc.status === 'Expired' || doc.status === 'Expiring Soon' ? '700' : '400'};">
              ${doc.expiryDate || '—'}
            </td>
            <td>${filePill}</td>
            <td style="font-size: 11.5px; color: var(--text-muted); max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${doc.notes || '-'}
            </td>
            <td style="text-align: center; white-space: nowrap;">${actionBtns}</td>
          </tr>
        `;
      }).join('');
    }

    renderPagination(totalRecords, totalPages) {
      const container = document.getElementById('employee-documents-pagination');
      if (!container) return;

      let pagesHtml = '';
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
          pagesHtml += `
            <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="window.employeeDocumentsModule.setPage(${i})">
              ${i}
            </button>
          `;
        } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
          pagesHtml += `<span style="color:var(--text-muted);padding:0 2px;">...</span>`;
        }
      }

      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
            Rows per page:
            <select class="form-select" onchange="window.employeeDocumentsModule.setPageSize(this.value)" style="padding:2px 8px;font-size:12px;width:auto;display:inline-block;margin-left:4px;">
              <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="15" ${this.pageSize === 15 ? 'selected' : ''}>15</option>
              <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20</option>
              <option value="25" ${this.pageSize === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
          </div>
          <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
            Page ${this.currentPage} of ${totalPages} <span style="opacity:0.6;">(${totalRecords} records)</span>
          </div>
        </div>
        <div class="pagination-controls">
          <button class="pagination-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.employeeDocumentsModule.setPage(${this.currentPage - 1})">
            Previous
          </button>
          ${pagesHtml}
          <button class="pagination-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="window.employeeDocumentsModule.setPage(${this.currentPage + 1})">
            Next
          </button>
        </div>
      `;
    }

    /* --- DOCUMENT VIEWER (PDF & IMAGE IN-BROWSER) --- */
    viewDocument(id) {
      const doc = this.documents.find(d => d.id === id);
      if (!doc) return;

      document.getElementById('view-doc-title').textContent = `CBTA — ${doc.employeeName}`;
      const contentEl = document.getElementById('view-doc-content');
      if (contentEl) {
        const isPdf = (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf')) || (doc.fileType === 'application/pdf');

        let filePreviewHtml = '';
        if (doc.fileDataUrl) {
          if (isPdf) {
            filePreviewHtml = `
              <div style="margin-top:14px; text-align:center;">
                <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px; font-weight:700;">📄 PDF AGREEMENT PREVIEW:</div>
                <iframe src="${doc.fileDataUrl}" style="width:100%; height:380px; border-radius:8px; border:1px solid rgba(245,158,11,0.3); background:#0f172a;" title="CBTA PDF Viewer"></iframe>
                <div style="margin-top:10px;">
                  <a href="${doc.fileDataUrl}" download="${doc.fileName || 'CBTA-Document.pdf'}" class="btn btn-secondary btn-xs" style="font-weight:700; color:var(--accent-gold);">
                    ⬇️ Download Official PDF File
                  </a>
                </div>
              </div>
            `;
          } else {
            filePreviewHtml = `
              <div style="margin-top:14px; text-align:center;">
                <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:6px; font-weight:700;">🖼️ DOCUMENT IMAGE PREVIEW:</div>
                <img src="${doc.fileDataUrl}" style="max-width:100%; max-height:280px; border-radius:8px; border:1px solid rgba(245,158,11,0.3); object-fit:contain; background:#000;" alt="CBTA Agreement">
                <div style="margin-top:10px;">
                  <a href="${doc.fileDataUrl}" download="${doc.fileName || 'CBTA-Document.jpg'}" class="btn btn-secondary btn-xs" style="font-weight:700; color:var(--accent-gold);">
                    ⬇️ Download Image File
                  </a>
                </div>
              </div>
            `;
          }
        } else {
          filePreviewHtml = `<div style="margin-top:10px; font-size:12px; color:var(--text-muted); font-style:italic;">No digital file attachment stored.</div>`;
        }

        contentEl.innerHTML = `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
              <div>
                <div style="font-size: 15px; font-weight: 800; color: #fff;">${doc.employeeName}</div>
                <div style="font-size: 12px; color: var(--accent-gold); font-family: monospace;">Master Registry ID: ${doc.employeeId} • ${doc.position || 'Staff'}</div>
              </div>
              <span class="badge ${doc.status === 'Complete' ? 'badge-success' : (doc.status === 'Expiring Soon' ? 'badge-warning' : 'badge-danger')}">
                ${doc.status}
              </span>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
              <div>
                <span style="color:var(--text-muted);">Document Type:</span><br>
                <strong style="color:#fff;">COMMISSION BASED TELLER AGREEMENT (CBTA)</strong>
              </div>
              <div>
                <span style="color:var(--text-muted);">Effective / Signed Date:</span><br>
                <strong>${doc.dateUploaded || '-'}</strong>
              </div>
              <div>
                <span style="color:var(--text-muted);">Expiration Date:</span><br>
                <strong>${doc.expiryDate || '—'}</strong>
              </div>
              <div>
                <span style="color:var(--text-muted);">Attachment:</span><br>
                <code style="color:var(--accent-cyan);">${doc.fileName || 'None'}</code>
              </div>
            </div>
            ${filePreviewHtml}
          </div>
          <div style="font-size: 12.5px; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 6px;">
            <strong>Verification Details:</strong><br>
            ${doc.notes || 'No special notes recorded.'}
          </div>
        `;
      }

      const modal = document.getElementById('modal-view-document');
      if (modal) modal.classList.add('active');
    }

    closeViewModal() {
      const modal = document.getElementById('modal-view-document');
      if (modal) modal.classList.remove('active');
    }

    deleteDocument(id) {
      if (!window.authManager || !window.authManager.isAdmin()) return;
      if (confirm('Are you sure you want to permanently delete this CBTA record?')) {
        this.documents = this.documents.filter(d => d.id !== id);
        this.saveDocuments();
        this.render();
      }
    }
  }

  window.employeeDocumentsModule = new EmployeeDocumentsModule();
})();
