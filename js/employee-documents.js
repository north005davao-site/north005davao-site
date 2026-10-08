/**
 * NORTH-005 OmniERP — Employee Documents & Compliance Repository Module
 * 4 Document Upload Fields:
 *   1. RESUME (Image File)
 *   2. PHOTOCOPY OF VALID ID (Image File)
 *   3. BARANGAY CLEARANCE / POLICE CLEARANCE (Image File)
 *   4. COMMISSION BASED TELLER AGREEMENT (CBTA) (PDF or Image File)
 * 
 * Storage Engine:
 *   - Powered by IndexedDB (North005ComplianceDocsDB) for unlimited storage of large PDFs & images (no 5MB quota crashes).
 *   - Automatic lightweight metadata mirror in localStorage with try/catch quota protection.
 *   - Full persistence across page refreshes and browser restarts.
 */

(function () {
  'use strict';

  const DOCS_STORAGE_KEY = 'north005_employee_documents_v6';
  const DB_NAME = 'North005ComplianceDocsDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'employee_documents';

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

  // --- IndexedDB Native Storage Helpers ---
  function openDocsDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function getAllDocsFromDB() {
    return new Promise(async (resolve) => {
      try {
        const db = await openDocsDB();
        if (!db) { resolve([]); return; }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (err) {
        resolve([]);
      }
    });
  }

  function getDocFromDB(id) {
    return new Promise(async (resolve) => {
      try {
        const db = await openDocsDB();
        if (!db) { resolve(null); return; }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function saveAllDocsToDB(documents) {
    return new Promise(async (resolve) => {
      try {
        const db = await openDocsDB();
        if (!db) { resolve(false); return; }
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const doc of documents) {
          store.put(doc);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  function deleteDocFromDB(id) {
    return new Promise(async (resolve) => {
      try {
        const db = await openDocsDB();
        if (!db) { resolve(false); return; }
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
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

      // Pending uploads array (supports uploading multiple documents at once)
      this.pendingUploads = [];

      // Temporary in-modal file buffers for all 4 document types
      this.fileBuffers = {
        'RESUME': null,
        'PHOTOCOPY OF VALID ID': null,
        'BARANGAY CLEARANCE/POLICE CLEARANCE': null,
        'CBTA': null
      };

      this.documents = this.loadDocuments();
    }

    async init() {
      this.populateDatalist();
      this.render();

      // 1. Asynchronously load & merge from local IndexedDB
      await this.loadFromIndexedDB();

      // 2. Asynchronously sync across devices via Supabase Cloud and Node Server API
      await this.syncWithCloud();

      // 3. Periodic cloud background sync (every 30 seconds)
      this.syncTimer = setInterval(() => {
        this.syncWithCloud(false);
      }, 30000);
      if (this.syncTimer && typeof this.syncTimer.unref === 'function') {
        this.syncTimer.unref();
      }

      // 4. Auto-sync when window or mobile tab gains focus/visibility
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', () => this.syncWithCloud(false));
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.syncWithCloud(false);
          }
        });
      }

      // Close employee search dropdown when clicking outside
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', (e) => {
          const wrapper = document.querySelector('.searchable-select-wrapper');
          const results = document.getElementById('doc-emp-search-results');
          if (wrapper && results && !wrapper.contains(e.target)) {
            results.classList.remove('active');
          }
        });
      }
    }

    async loadFromIndexedDB() {
      if (typeof indexedDB === 'undefined') return;
      try {
        const idbDocs = await getAllDocsFromDB();
        if (idbDocs && idbDocs.length > 0) {
          // Merge IndexedDB docs with this.documents
          const mergedMap = new Map();
          // IndexedDB has authoritative full data (with binary data URLs)
          idbDocs.forEach(d => { if (d && d.id) mergedMap.set(d.id, d); });
          this.documents.forEach(d => {
            if (d && d.id && !mergedMap.has(d.id)) {
              mergedMap.set(d.id, d);
            }
          });
          this.documents = Array.from(mergedMap.values());
          this.render();
        } else if (this.documents.length > 0) {
          // Seed IndexedDB from existing documents
          await saveAllDocsToDB(this.documents);
        }
      } catch (err) {
        console.warn('[ComplianceDocs] loadFromIndexedDB error:', err);
      }
    }

    loadDocuments() {
      try {
        const candidateKeys = [
          DOCS_STORAGE_KEY,
          'north005_employee_documents_v5',
          'north005_employee_documents_v4',
          'north005_employee_documents_v3',
          'north005_employee_documents_v2',
          'north005_employee_documents_v1',
          'north005_employee_documents'
        ];
        for (const key of candidateKeys) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
              }
            } catch (e) {}
          }
        }
        return [];
      } catch (e) {
        return [];
      }
    }

    /* --- CROSS-DEVICE CLOUD SYNCHRONIZATION (STATIC SEED + SUPABASE + SERVER REST) --- */
    async syncWithCloud(showToast = false) {
      this.updateSyncStatus('syncing');
      let fetchedRemote = false;
      const remoteDocs = [];

      try {
        // 1. Fetch from static data file (instant cross-device baseline on Vercel / Web)
        if (typeof fetch === 'function') {
          try {
            const staticRes = await fetch('/data/employee_documents.json');
            if (staticRes.ok) {
              const staticData = await staticRes.json();
              const sDocs = Array.isArray(staticData) ? staticData : (staticData && Array.isArray(staticData.documents) ? staticData.documents : []);
              sDocs.forEach(d => {
                if (d && d.id && !remoteDocs.some(r => r.id === d.id)) {
                  remoteDocs.push(d);
                }
              });
              if (sDocs.length > 0) fetchedRemote = true;
            }
          } catch (eStatic) {}

          // 2. Fetch from Node Server REST API (/api/employee-documents) if running locally
          try {
            const srvRes = await fetch('/api/employee-documents');
            const ct = srvRes.headers ? (srvRes.headers.get('content-type') || '') : '';
            if (srvRes.ok && ct.includes('application/json')) {
              const srvData = await srvRes.json();
              const srvDocs = Array.isArray(srvData) ? srvData : (srvData && Array.isArray(srvData.documents) ? srvData.documents : []);
              srvDocs.forEach(d => {
                if (d && d.id && !remoteDocs.some(r => r.id === d.id)) {
                  remoteDocs.push(d);
                }
              });
              if (srvDocs.length > 0) fetchedRemote = true;
            }
          } catch (eSrv) {}
        }

        // 3. Fetch from Supabase Cloud Database (if online)
        try {
          if (window.supabaseSync && typeof window.supabaseSync.fetchEmployeeDocuments === 'function') {
            const supaDocs = await window.supabaseSync.fetchEmployeeDocuments();
            if (Array.isArray(supaDocs)) {
              supaDocs.forEach(d => {
                if (d && d.id && !remoteDocs.some(r => r.id === d.id)) {
                  remoteDocs.push(d);
                }
              });
              if (supaDocs.length > 0) fetchedRemote = true;
            }
          }
        } catch (eSupa) {
          console.warn('[ComplianceDocs] Supabase sync fetch notice:', eSupa);
        }

        // 4. Bidirectional Merge: Blend remote documents with local documents
        if (fetchedRemote && remoteDocs.length > 0) {
          const docMap = new Map();
          remoteDocs.forEach(d => { if (d && d.id) docMap.set(d.id, d); });

          // Retain and protect local documents, preserving local binary data URLs
          this.documents.forEach(d => {
            if (d && d.id) {
              if (!docMap.has(d.id)) {
                docMap.set(d.id, d);
              } else {
                const rDoc = docMap.get(d.id);
                if (!rDoc.fileDataUrl && d.fileDataUrl) {
                  rDoc.fileDataUrl = d.fileDataUrl;
                }
              }
            }
          });

          this.documents = Array.from(docMap.values());
          await this.saveDocuments();
          this.render();
        }

        // 5. Auto-Push Local Documents: Any document in local storage not yet on remote is pushed up
        await this.autoPushLocalDocuments(remoteDocs);
      } catch (err) {
        console.warn('[ComplianceDocs] Sync notice:', err);
      } finally {
        this.updateSyncStatus('synced');
        if (showToast) {
          notify(`Cloud Synced: ${this.documents.length} compliance document(s) verified on file.`);
        }
      }
    }

    async autoPushLocalDocuments(remoteDocs = []) {
      if (!this.documents || this.documents.length === 0) return;
      try {
        const remoteIds = new Set((remoteDocs || []).map(r => r.id));
        const missingFromRemote = this.documents.filter(d => !remoteIds.has(d.id));
        if (missingFromRemote.length > 0) {
          console.log(`[ComplianceDocs] Auto-uploading ${missingFromRemote.length} local document(s) to cloud...`);
          // Push to Supabase Cloud
          if (window.supabaseSync && typeof window.supabaseSync.syncEmployeeDocument === 'function') {
            for (const doc of missingFromRemote) {
              await window.supabaseSync.syncEmployeeDocument(doc).catch(() => {});
            }
          }
          // Push to Server REST API
          if (typeof fetch === 'function') {
            try {
              await fetch('/api/employee-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documents: this.documents })
              }).catch(() => {});
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('[ComplianceDocs] autoPushLocalDocuments notice:', err);
      }
    }

    handleRealtimeUpdate(payload) {
      if (!payload) return;
      const { eventType, new: newRec, old: oldRec } = payload;
      console.log('[ComplianceDocs] Received live cloud event:', eventType, newRec || oldRec);

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRec || !newRec.id) return;
        const mapped = {
          id: newRec.id,
          employeeId: newRec.employee_id,
          employeeName: newRec.employee_name,
          position: newRec.position,
          documentType: newRec.document_type,
          status: newRec.status,
          dateUploaded: newRec.date_uploaded,
          expiryDate: newRec.expiry_date,
          fileName: newRec.file_name,
          fileSize: newRec.file_size,
          fileType: newRec.file_type,
          fileDataUrl: newRec.file_data_url,
          notes: newRec.notes
        };
        const idx = this.documents.findIndex(d => d.id === mapped.id);
        if (idx !== -1) {
          if (!mapped.fileDataUrl && this.documents[idx].fileDataUrl) {
            mapped.fileDataUrl = this.documents[idx].fileDataUrl;
          }
          this.documents[idx] = mapped;
        } else {
          this.documents.unshift(mapped);
        }
        this.saveDocuments();
        this.render();
      } else if (eventType === 'DELETE') {
        if (!oldRec || !oldRec.id) return;
        this.documents = this.documents.filter(d => d.id !== oldRec.id);
        this.saveDocuments();
        this.render();
      }
    }

    updateSyncStatus(status) {
      const badge = document.getElementById('docs-sync-status-badge');
      if (!badge) return;
      if (status === 'syncing') {
        badge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;color:#60a5fa;font-size:11px;font-weight:700;"><span class="spinner-border spinner-border-sm" style="width:10px;height:10px;border-width:1.5px;display:inline-block;"></span> Syncing...</span>`;
      } else if (status === 'synced') {
        badge.innerHTML = `<span style="color:#4ade80;font-size:11px;font-weight:700;">☁️ Cloud Synced (${this.documents.length})</span>`;
      } else {
        badge.innerHTML = `<span style="color:var(--text-muted);font-size:11px;">⚪ Local Cache (${this.documents.length})</span>`;
      }
    }

    async saveDocuments() {
      // 1. Persist complete files to IndexedDB (virtually unlimited browser storage)
      if (typeof indexedDB !== 'undefined') {
        try {
          await saveAllDocsToDB(this.documents);
        } catch (err) {
          console.warn('[ComplianceDocs] IndexedDB save warning:', err);
        }
      }

      // 2. Persist to localStorage with automatic quota safety
      try {
        localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(this.documents));
      } catch (quotaErr) {
        console.warn('[ComplianceDocs] localStorage quota reached. Saving lightweight metadata mirror to localStorage.');
        try {
          // Strip heavy base64 fileDataUrl for localStorage mirror; IndexedDB keeps the full files!
          const lightweightDocs = this.documents.map(d => {
            const clone = Object.assign({}, d);
            delete clone.fileDataUrl;
            return clone;
          });
          localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(lightweightDocs));
        } catch (e2) {
          console.warn('[ComplianceDocs] localStorage mirror failed, full data safely preserved in IndexedDB.');
        }
      }

      this.updateSyncStatus('synced');
    }

    // Helper: Map document type to HTML element ID key
    getFieldKey(docType) {
      if (docType === 'RESUME') return 'resume';
      if (docType === 'PHOTOCOPY OF VALID ID') return 'validid';
      if (docType === 'BARANGAY CLEARANCE/POLICE CLEARANCE') return 'clearance';
      if (docType === 'CBTA') return 'cbta';
      return 'cbta';
    }

    // Helper: Safely compare if a document belongs to an employee (disambiguates shared reliever ID DDN005-SR000 by name)
    isSameEmployee(d, empId, empName) {
      if (!d) return false;
      const targetId = (empId || '').trim();
      const targetName = (empName || '').trim().toLowerCase();
      const docId = (d.employeeId || '').trim();
      const docName = (d.employeeName || '').trim().toLowerCase();

      if (targetId === 'DDN005-SR000' || docId === 'DDN005-SR000') {
        return docId === targetId && docName === targetName;
      }
      return docId === targetId;
    }

    // Returns all active employees in Master Registry
    getEmployees() {
      const store = window.appStore;
      if (!store) return [];
      const emps = (typeof store.getEmployees === 'function') ? store.getEmployees() : (store.data ? (store.data.employees || []) : []);
      return emps.filter(e => e && e.name && !e.name.includes('Buffer Reliever'));
    }

    // Returns the 150 active field personnel: Tellers / Sales Reps & Relievers
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
        '<option value="RESUME">',
        '<option value="PHOTOCOPY OF VALID ID">',
        '<option value="BARANGAY CLEARANCE/POLICE CLEARANCE">',
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

    /* --- FOUR DEDICATED UPLOAD FIELDS LOGIC --- */
    handleFileSelected(docType, inputEl) {
      const file = inputEl.files && inputEl.files[0];
      if (!file) return;

      const key = this.getFieldKey(docType);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

      if (docType === 'CBTA') {
        if (!isPdf && !isImage) {
          notify('Validation Error: Only PDF documents (.pdf) or image files (.jpg, .jpeg, .png, .webp) are supported.');
          inputEl.value = '';
          return;
        }
      } else {
        if (!isImage) {
          notify(`Validation Error: Only image files (.jpg, .jpeg, .png, .webp) are supported for ${docType}.`);
          inputEl.value = '';
          return;
        }
      }

      // Max size: 25MB
      if (file.size > 25 * 1024 * 1024) {
        notify('Validation Error: File size exceeds the 25MB limit. Please compress or select a smaller file.');
        inputEl.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        this.fileBuffers[docType] = {
          docType: docType,
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024)} KB`,
          fileDataUrl: dataUrl,
          fileType: isPdf ? 'application/pdf' : (file.type || 'image/jpeg')
        };

        // Update UI status
        const statusEl = document.getElementById(`doc-status-${key}`);
        if (statusEl) {
          statusEl.textContent = '✓ Ready to save';
          statusEl.style.color = '#4ade80';
        }

        const previewIcon = document.getElementById(`doc-preview-icon-${key}`);
        const previewImg = document.getElementById(`doc-preview-img-${key}`);

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

        const filenameEl = document.getElementById(`doc-filename-${key}`);
        if (filenameEl) filenameEl.textContent = file.name;

        const filesizeEl = document.getElementById(`doc-filesize-${key}`);
        if (filesizeEl) filesizeEl.textContent = `${Math.round(file.size / 1024)} KB`;

        const previewBox = document.getElementById(`doc-preview-box-${key}`);
        if (previewBox) previewBox.style.display = 'flex';

        const removeBtn = document.getElementById(`doc-remove-${key}`);
        if (removeBtn) removeBtn.style.display = 'inline-block';
      };

      reader.readAsDataURL(file);
    }

    removeFile(docType) {
      const key = this.getFieldKey(docType);
      this.fileBuffers[docType] = null;

      const fileInput = document.getElementById(`doc-file-${key}`);
      if (fileInput) fileInput.value = '';

      const empIdEl = document.getElementById('doc-selected-emp-id');
      const empNameEl = document.getElementById('doc-selected-emp-name');
      const empId = empIdEl ? empIdEl.value : '';
      const empName = empNameEl ? empNameEl.value : '';

      if (empId) {
        this.updateSingleDocBadge(empId, empName, docType);
      } else {
        const statusEl = document.getElementById(`doc-status-${key}`);
        if (statusEl) {
          statusEl.textContent = 'No file selected';
          statusEl.style.color = 'var(--text-muted)';
        }
      }

      const previewBox = document.getElementById(`doc-preview-box-${key}`);
      if (previewBox) previewBox.style.display = 'none';

      const removeBtn = document.getElementById(`doc-remove-${key}`);
      if (removeBtn) removeBtn.style.display = 'none';
    }

    openUploadModal() {
      if (!window.authManager || !window.authManager.isAdmin()) {
        notify('Permission Denied: Only Administrators can upload compliance documents.');
        return;
      }

      this.clearSelectedEmployee();
      this.removeFile('RESUME');
      this.removeFile('PHOTOCOPY OF VALID ID');
      this.removeFile('BARANGAY CLEARANCE/POLICE CLEARANCE');
      this.removeFile('CBTA');

      document.getElementById('doc-upload-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('doc-upload-expiry').value = '';
      document.getElementById('doc-upload-notes').value = '';

      const modal = document.getElementById('modal-upload-document');
      if (modal) modal.classList.add('active');
    }

    openUploadModalForEmp(empId, empName) {
      if (!window.authManager || !window.authManager.isAdmin()) {
        notify('Permission Denied: Only Administrators can upload compliance documents.');
        return;
      }

      this.openUploadModal();
      this.selectEmployee(empId, empName);
    }

    closeUploadModal() {
      const modal = document.getElementById('modal-upload-document');
      if (modal) modal.classList.remove('active');
      this.clearSelectedEmployee();
      this.removeFile('RESUME');
      this.removeFile('PHOTOCOPY OF VALID ID');
      this.removeFile('BARANGAY CLEARANCE/POLICE CLEARANCE');
      this.removeFile('CBTA');
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

      resultsContainer.innerHTML = matched.slice(0, 30).map(e => {
        const safeName = (e.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
          <div class="searchable-select-item" onclick="window.employeeDocumentsModule.selectEmployee('${e.id}', '${safeName}')">
            <span>${e.id}</span> — <strong>${e.name}</strong> <small style="color:var(--text-muted);">(${e.role || 'Sales Rep'})</small>
          </div>
        `;
      }).join('');

      resultsContainer.classList.add('active');
    }

    selectEmployee(empId, empName) {
      const emps = this.getEmployees();
      let emp = null;
      if (empName) {
        const cleanTargetName = empName.trim().toLowerCase();
        emp = emps.find(e => e.id === empId && (e.name || '').trim().toLowerCase() === cleanTargetName);
        if (!emp) {
          emp = emps.find(e => (e.name || '').trim().toLowerCase() === cleanTargetName);
        }
      }
      if (!emp) {
        emp = emps.find(e => e.id === empId);
      }
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

      // Enhancement A: Scan employee's documents and update the 4 upload field badges
      this.updateExistingDocBadges(emp.id, emp.name);
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

      // Reset all 4 upload field badges
      this.clearExistingDocBadges();
    }

    /* --- VISUAL ON-FILE BADGE INDICATORS (ENHANCEMENT A) --- */
    updateExistingDocBadges(empId, empName) {
      const docTypes = ['RESUME', 'PHOTOCOPY OF VALID ID', 'BARANGAY CLEARANCE/POLICE CLEARANCE', 'CBTA'];
      docTypes.forEach(type => this.updateSingleDocBadge(empId, empName, type));
    }

    updateSingleDocBadge(empId, empName, type) {
      const key = this.getFieldKey(type);
      const cardEl = document.getElementById(`doc-card-${key}`);
      const statusEl = document.getElementById(`doc-status-${key}`);
      const uploadBtn = (cardEl && typeof cardEl.querySelector === 'function') ? cardEl.querySelector('.btn-secondary') : null;

      // If user has already chosen a new file in this session buffer, keep the ready status
      if (this.fileBuffers[type] && this.fileBuffers[type].fileDataUrl) {
        if (statusEl) {
          statusEl.textContent = '✓ Ready to save';
          statusEl.style.color = '#4ade80';
        }
        return;
      }

      const defaultBtn = (type === 'CBTA') ? '📁 UPLOAD FILE (PDF / IMAGE)' : '📁 UPLOAD IMAGE FILE';
      const existing = this.documents.find(d => this.isSameEmployee(d, empId, empName) && d.documentType === type);

      if (existing) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #4ade80; font-weight: 700;">✅ On File: ${existing.fileName || 'Verified'}</span>`;
        }
        if (cardEl && cardEl.style) {
          cardEl.style.borderColor = 'rgba(74, 222, 128, 0.4)';
          cardEl.style.background = 'rgba(74, 222, 128, 0.04)';
        }
        if (uploadBtn) {
          uploadBtn.textContent = '📁 REPLACE FILE (OPTIONAL)';
        }
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">⚪ Pending submission</span>`;
        }
        if (cardEl && cardEl.style) {
          cardEl.style.borderColor = (key === 'cbta') ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)';
          cardEl.style.background = 'rgba(255, 255, 255, 0.02)';
        }
        if (uploadBtn) {
          uploadBtn.textContent = defaultBtn;
        }
      }
    }

    clearExistingDocBadges() {
      const docTypes = [
        { type: 'RESUME', key: 'resume', defaultBtn: '📁 UPLOAD IMAGE FILE' },
        { type: 'PHOTOCOPY OF VALID ID', key: 'validid', defaultBtn: '📁 UPLOAD IMAGE FILE' },
        { type: 'BARANGAY CLEARANCE/POLICE CLEARANCE', key: 'clearance', defaultBtn: '📁 UPLOAD IMAGE FILE' },
        { type: 'CBTA', key: 'cbta', defaultBtn: '📁 UPLOAD FILE (PDF / IMAGE)' }
      ];

      docTypes.forEach(({ key, defaultBtn }) => {
        const cardEl = document.getElementById(`doc-card-${key}`);
        const statusEl = document.getElementById(`doc-status-${key}`);
        const uploadBtn = (cardEl && typeof cardEl.querySelector === 'function') ? cardEl.querySelector('.btn-secondary') : null;

        if (statusEl) {
          statusEl.textContent = 'No file selected';
          statusEl.style.color = 'var(--text-muted)';
        }
        if (cardEl) {
          cardEl.style.borderColor = (key === 'cbta') ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)';
          cardEl.style.background = 'rgba(255, 255, 255, 0.02)';
        }
        if (uploadBtn) {
          uploadBtn.textContent = defaultBtn;
        }
      });
    }

    /* --- INITIATE SAVE & CONFIRMATION FLOW (SUPPORTS BATCH UPLOADS) --- */
    initiateSaveDocument() {
      if (!window.authManager || !window.authManager.isAdmin()) return;

      const empId = document.getElementById('doc-selected-emp-id').value;
      const empName = document.getElementById('doc-selected-emp-name').value;
      const empRole = document.getElementById('doc-selected-emp-role').value || 'Staff';

      // 1. Validation: Employee selected
      if (!empId) {
        notify('Validation Error: Please search and select an employee from Master Registry.');
        return;
      }

      // 2. Validation: At least one document attached across the 4 fields
      const attachedTypes = Object.keys(this.fileBuffers).filter(type => this.fileBuffers[type] && this.fileBuffers[type].fileDataUrl);
      if (attachedTypes.length === 0) {
        notify('Validation Error: Please select and upload at least one document (Resume, Valid ID, Clearance, or CBTA).');
        return;
      }

      const dateUploaded = document.getElementById('doc-upload-date').value || new Date().toISOString().split('T')[0];
      const expiryDate = document.getElementById('doc-upload-expiry').value || '—';
      const notes = document.getElementById('doc-upload-notes').value.trim() || 'Verified official compliance record on file.';

      // Determine status based on expiration date
      let status = 'Complete';
      if (expiryDate && expiryDate !== '—') {
        const exp = new Date(expiryDate);
        const now = new Date();
        const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) status = 'Expired';
        else if (diffDays <= 30) status = 'Expiring Soon';
      }

      this.pendingUploads = attachedTypes.map(docType => {
        const fileData = this.fileBuffers[docType];
        return {
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
      });

      // Check if employee already has any of these document types uploaded
      const existingTypes = attachedTypes.filter(docType => this.documents.some(d => this.isSameEmployee(d, empId, empName) && d.documentType === docType));

      if (existingTypes.length > 0) {
        // Show Replace confirmation modal
        document.getElementById('doc-replace-emp-name').textContent = `${empName} (${empId})`;
        document.getElementById('doc-replace-type').textContent = existingTypes.join(', ');
        document.getElementById('doc-replace-modal-title').textContent = `Replace Existing ${existingTypes.length > 1 ? 'Documents' : existingTypes[0]}?`;

        const replaceModal = document.getElementById('modal-doc-confirm-replace');
        if (replaceModal) replaceModal.classList.add('active');
      } else {
        // Show Standard Save confirmation modal
        document.getElementById('doc-confirm-emp-name').textContent = `${empName} (${empId})`;
        document.getElementById('doc-confirm-type').textContent = attachedTypes.join(', ');
        document.getElementById('doc-confirm-filename').textContent = this.pendingUploads.map(u => u.fileName).join(', ');

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
      if (!this.pendingUploads || this.pendingUploads.length === 0) return;

      try {
        this.pendingUploads.forEach(p => {
          if (isReplace) {
            this.documents = this.documents.filter(d => !(this.isSameEmployee(d, p.employeeId, p.employeeName) && d.documentType === p.documentType));
          }

          const newDoc = {
            id: `DOC-${p.employeeId}-${p.documentType.replace(/[\/\s]+/g, '_')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            employeeId: p.employeeId,
            employeeName: p.employeeName,
            position: p.employeeRole,
            documentType: p.documentType,
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
        });

        // Persist to IndexedDB & localStorage safely
        this.saveDocuments();

        // Broadcast to Supabase Cloud Database & Node Server for cross-device sync
        const savedBatch = this.documents.filter(d => this.pendingUploads.some(p => this.isSameEmployee(d, p.employeeId, p.employeeName) && d.documentType === p.documentType));
        if (window.supabaseSync && typeof window.supabaseSync.syncEmployeeDocument === 'function') {
          savedBatch.forEach(doc => {
            window.supabaseSync.syncEmployeeDocument(doc);
          });
        }
        if (typeof fetch === 'function') {
          fetch('/api/employee-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documents: this.documents })
          }).catch(() => {});
        }

        const docNames = this.pendingUploads.map(u => u.documentType).join(', ');
        const empName = this.pendingUploads[0].employeeName;
        const empId = this.pendingUploads[0].employeeId;
        const actionWord = isReplace ? 'saved/replaced' : 'uploaded';
        notify(`Success: Compliance documents [${docNames}] for ${empName} (${empId}) ${actionWord} successfully.`);
      } catch (err) {
        console.error('[ComplianceDocs] Error saving compliance documents:', err);
      } finally {
        this.closeUploadModal();
        this.render();
        this.pendingUploads = [];
      }
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

      // 1. Gather all active field personnel who legally require compliance documents
      const fieldPersonnel = this.getFieldPersonnel();

      // Build missing list (field staff with 0 uploaded documents)
      const missingStaff = fieldPersonnel.filter(emp => !this.documents.some(d => this.isSameEmployee(d, emp.id, emp.name)));

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
          id: `MISSING-${emp.id}-${(emp.name || '').replace(/[\/\s]+/g, '_')}`,
          employeeId: emp.id,
          employeeName: emp.name,
          position: emp.role || 'Sales Representative',
          documentType: 'CBTA & Compliance',
          status: 'Missing',
          dateUploaded: '—',
          expiryDate: '—',
          fileName: null,
          notes: 'Awaiting submission of compliance documents'
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
            const safeDocEmpName = (doc.employeeName || '').replace(/'/g, "\\'");
            actionBtns = `
              <button class="btn btn-xs btn-primary" onclick="window.employeeDocumentsModule.openUploadModalForEmp('${doc.employeeId}', '${safeDocEmpName}')" style="background:var(--accent-gold);border-color:var(--accent-gold);color:#000;font-weight:800;padding:3px 8px;font-size:11px;" title="Upload documents for this employee">
                ➕ Upload
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
    async viewDocument(id) {
      let doc = this.documents.find(d => d.id === id);
      if (!doc) return;

      // If document was loaded from lightweight metadata mirror, fetch full binary from IndexedDB
      if (!doc.fileDataUrl && typeof indexedDB !== 'undefined') {
        const idbDoc = await getDocFromDB(id);
        if (idbDoc && idbDoc.fileDataUrl) {
          doc.fileDataUrl = idbDoc.fileDataUrl;
          doc.fileName = idbDoc.fileName || doc.fileName;
          doc.fileType = idbDoc.fileType || doc.fileType;
        }
      }

      document.getElementById('view-doc-title').textContent = `${doc.documentType} — ${doc.employeeName}`;
      const contentEl = document.getElementById('view-doc-content');
      if (contentEl) {
        const isPdf = (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf')) || (doc.fileType === 'application/pdf');

        let filePreviewHtml = '';
        if (doc.fileDataUrl) {
          if (isPdf) {
            filePreviewHtml = `
              <div style="margin-top:14px; text-align:center;">
                <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px; font-weight:700;">📄 PDF AGREEMENT PREVIEW:</div>
                <iframe src="${doc.fileDataUrl}" style="width:100%; height:380px; border-radius:8px; border:1px solid rgba(245,158,11,0.3); background:#0f172a;" title="PDF Viewer"></iframe>
                <div style="margin-top:10px;">
                  <a href="${doc.fileDataUrl}" download="${doc.fileName || 'Document.pdf'}" class="btn btn-secondary btn-xs" style="font-weight:700; color:var(--accent-gold);">
                    ⬇️ Download Official PDF File
                  </a>
                </div>
              </div>
            `;
          } else {
            filePreviewHtml = `
              <div style="margin-top:14px; text-align:center;">
                <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:6px; font-weight:700;">🖼️ DOCUMENT IMAGE PREVIEW:</div>
                <img src="${doc.fileDataUrl}" style="max-width:100%; max-height:280px; border-radius:8px; border:1px solid rgba(245,158,11,0.3); object-fit:contain; background:#000;" alt="${doc.documentType}">
                <div style="margin-top:10px;">
                  <a href="${doc.fileDataUrl}" download="${doc.fileName || 'Document.jpg'}" class="btn btn-secondary btn-xs" style="font-weight:700; color:var(--accent-gold);">
                    ⬇️ Download Image File
                  </a>
                </div>
              </div>
            `;
          }
        } else {
          filePreviewHtml = `<div style="margin-top:10px; font-size:12px; color:var(--text-muted); font-style:italic;">No digital file attachment stored.</div>`;
        }

        const allEmpDocs = this.documents.filter(d => this.isSameEmployee(d, doc.employeeId, doc.employeeName));
        const resumeDoc = allEmpDocs.find(d => d.documentType === 'RESUME');
        const validIdDoc = allEmpDocs.find(d => d.documentType === 'PHOTOCOPY OF VALID ID');
        const clearanceDoc = allEmpDocs.find(d => d.documentType === 'BARANGAY CLEARANCE/POLICE CLEARANCE');
        const cbtaDoc = allEmpDocs.find(d => d.documentType === 'CBTA');

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
                <strong style="color:#fff;">${doc.documentType}</strong>
              </div>
              <div>
                <span style="color:var(--text-muted);">Uploaded / Signed Date:</span><br>
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
          <div style="font-size: 12.5px; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 6px; margin-bottom: 14px;">
            <strong>Verification Details:</strong><br>
            ${doc.notes || 'No special notes recorded.'}
          </div>

          <!-- Enhancement B: Overall Compliance Checklist for this Staff -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
              <span>📋 Compliance Checklist for ${doc.employeeName}</span>
              <span style="color: var(--accent-gold);">${allEmpDocs.length}/4 Uploaded</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px;">
              <div style="padding: 6px 10px; border-radius: 4px; background: ${resumeDoc ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${resumeDoc ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'};">
                <strong>1. Resume:</strong> ${resumeDoc ? '<span style="color:#4ade80;">✅ On File</span>' : '<span style="color:var(--text-muted);">⚪ Pending</span>'}
              </div>
              <div style="padding: 6px 10px; border-radius: 4px; background: ${validIdDoc ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${validIdDoc ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'};">
                <strong>2. Valid ID:</strong> ${validIdDoc ? '<span style="color:#4ade80;">✅ On File</span>' : '<span style="color:var(--text-muted);">⚪ Pending</span>'}
              </div>
              <div style="padding: 6px 10px; border-radius: 4px; background: ${clearanceDoc ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${clearanceDoc ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'};">
                <strong>3. Clearance:</strong> ${clearanceDoc ? '<span style="color:#4ade80;">✅ On File</span>' : '<span style="color:var(--text-muted);">⚪ Pending</span>'}
              </div>
              <div style="padding: 6px 10px; border-radius: 4px; background: ${cbtaDoc ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${cbtaDoc ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'};">
                <strong>4. CBTA:</strong> ${cbtaDoc ? '<span style="color:#4ade80;">✅ On File</span>' : '<span style="color:var(--text-muted);">⚪ Pending</span>'}
              </div>
            </div>
          </div>
        `;
      }

      // Enhancement B: Populate modal footer quick action to upload remaining files
      const footerActionEl = document.getElementById('view-doc-footer-action');
      if (footerActionEl) {
        const isAdmin = window.authManager && window.authManager.isAdmin();
        if (isAdmin) {
          const safeName = (doc.employeeName || '').replace(/'/g, "\\'");
          footerActionEl.innerHTML = `
            <button class="btn btn-primary" onclick="window.employeeDocumentsModule.closeViewModal(); window.employeeDocumentsModule.openUploadModalForEmp('${doc.employeeId}', '${safeName}')" style="background: var(--accent-gold); border-color: var(--accent-gold); color: #000; font-weight: 800; padding: 6px 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
              <span>➕</span> Upload Remaining Documents
            </button>
          `;
        } else {
          footerActionEl.innerHTML = '';
        }
      }

      const modal = document.getElementById('modal-view-document');
      if (modal) modal.classList.add('active');
    }

    closeViewModal() {
      const modal = document.getElementById('modal-view-document');
      if (modal) modal.classList.remove('active');
    }

    async deleteDocument(id) {
      if (!window.authManager || !window.authManager.isAdmin()) return;
      if (confirm('Are you sure you want to permanently delete this document record?')) {
        this.documents = this.documents.filter(d => d.id !== id);
        await this.saveDocuments();
        if (typeof indexedDB !== 'undefined') {
          await deleteDocFromDB(id);
        }
        if (window.supabaseSync && typeof window.supabaseSync.deleteEmployeeDocument === 'function') {
          window.supabaseSync.deleteEmployeeDocument(id);
        }
        if (typeof fetch === 'function') {
          fetch(`/api/employee-documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
        }
        this.render();
      }
    }
  }

  window.employeeDocumentsModule = new EmployeeDocumentsModule();

  // Automatic boot initialization
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.employeeDocumentsModule.init();
      });
    } else {
      window.employeeDocumentsModule.init();
    }
  }
})();
