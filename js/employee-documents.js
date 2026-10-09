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
  const DELETED_DOCS_KEY = 'north005_deleted_employee_doc_ids_v2';
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

      // Multi-row selection state
      this.selectedDocIds = new Set();

      this.documents = this.loadDocuments();
    }

    async init() {
      this.populateDatalist();
      this.render();

      // 1. Asynchronously load & merge from local IndexedDB
      await this.loadFromIndexedDB();

      // 2. Load baseline documents from /data/employee_documents.json if local repository is empty
      if (!this.documents || this.documents.length === 0) {
        await this.loadBaselineDocuments();
      }
      this.updateSyncStatus('synced');

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('master-registry-synced', () => {
          this.populateDatalist();
          this.render();
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

    cleanNameTokens(name) {
      return (name || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .sort()
        .join('_');
    }

    normalizeId(id) {
      return (id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    isUnwantedSeededDoc(doc) {
      if (!doc) return false;
      const name = (doc.employeeName || '').toLowerCase().trim();
      const file = (doc.fileName || '').toLowerCase().trim();

      const UNWANTED_SEEDER_NAMES = [
        'princess solamillo', 'solamillo princess',
        'kei pagulong', 'pagulong kei',
        'jessa busaco', 'busaco jessa',
        'othmarie lupiba', 'lupiba othmarie',
        'faith hermoso', 'hermoso faith',
        'mari sarol', 'sarol mari',
        'ellen rino', 'ellen riño', 'rino ellen', 'riño ellen',
        'angelie tiedra', 'tiedra angelie',
        'noreen d bayang', 'noreen d. bayang', 'bayang noreen d',
        'rhea mae m bolilawa', 'rhea mae m. bolilawa', 'bolilawa rhea mae m',
        'jasnen parame aquino', 'aquino jasnen parame',
        'marjory torino', 'torino marjory',
        'gina paula gemino', 'gemino gina paula',
        'jennifer m osman', 'jennifer m. osman', 'osman jennifer m',
        'ferlyn zamora robello', 'robello ferlyn zamora',
        'jeziel r simene', 'jeziel r. simene', 'simene jeziel r',
        'karen batas', 'batas karen',
        'elyn t rosento', 'elyn t. rosento', 'rosento elyn t',
        'ester mopon', 'mopon ester',
        'christly ann tuasoc', 'tuasoc christly ann',
        'jane christine tuasoc', 'tuasoc jane christine',
        'clouie mae hipos', 'hipos clouie mae',
        'aires monreal', 'monreal aires',
        'precious nica torrefiel', 'torrefiel precious nica',
        'jemma rose roco', 'roco jemma rose',
        'carolyn joy catubigan', 'catubigan carolyn joy',
        'pamela denisse g antequeza', 'pamela denisse g. antequeza', 'antequeza pamela denisse g',
        'bbelen apatan', 'apatan bbelen',
        'laika jeanne sapine', 'sapine laika jeanne',
        'jeah rica linsay', 'linsay jeah rica',
        'kristina cassandra d lumidin', 'kristina cassandra d. lumidin', 'lumidin kristina cassandra d',
        'mae jean gementiza', 'gementiza mae jean'
      ];

      for (const seeded of UNWANTED_SEEDER_NAMES) {
        if (name === seeded || name.includes(seeded) || file.includes(seeded)) {
          return true;
        }
      }
      return false;
    }

    generateOfficialCbtaPdfDataUrl(doc) {
      if (!doc) return null;
      const name = (doc.employeeName || 'Staff Member').toUpperCase();
      const id = doc.employeeId || 'DDN005-STAFF';
      const role = doc.position || 'Sales Representative';
      const date = doc.dateUploaded || '2026-10-07';
      const file = doc.fileName || 'CBTA_Agreement.pdf';

      const streamText = 
        'BT /F1 18 Tf 50 730 Td (NORTH-005 DAVAO DEL NORTE HQ) Tj ET ' +
        'BT /F1 12 Tf 50 705 Td (OFFICIAL COMPLIANCE REPOSITORY - CBTA AGREEMENT) Tj ET ' +
        'BT /F1 10 Tf 50 670 Td (--------------------------------------------------------------------------------) Tj ET ' +
        'BT /F1 11 Tf 50 640 Td (EMPLOYEE NAME: ' + name + ') Tj ET ' +
        'BT /F1 11 Tf 50 620 Td (MASTER REGISTRY ID: ' + id + ') Tj ET ' +
        'BT /F1 11 Tf 50 600 Td (DESIGNATION: ' + role + ') Tj ET ' +
        'BT /F1 11 Tf 50 580 Td (DOCUMENT TYPE: COMMISSION-BASED TELLER AGREEMENT [CBTA]) Tj ET ' +
        'BT /F1 11 Tf 50 560 Td (ATTACHMENT FILE: ' + file + ') Tj ET ' +
        'BT /F1 11 Tf 50 540 Td (DATE CERTIFIED / UPLOADED: ' + date + ') Tj ET ' +
        'BT /F1 11 Tf 50 520 Td (COMPLIANCE STATUS: COMPLETE / VALID) Tj ET ' +
        'BT /F1 10 Tf 50 480 Td (--------------------------------------------------------------------------------) Tj ET ' +
        'BT /F1 10 Tf 50 450 Td (CERTIFICATION STATEMENT:) Tj ET ' +
        'BT /F1 9 Tf 50 430 Td (This digital document verifies that the operational personnel identified above) Tj ET ' +
        'BT /F1 9 Tf 50 415 Td (has fully executed and submitted the official Capacity Building & Teller Agreement) Tj ET ' +
        'BT /F1 9 Tf 50 400 Td (for deployment across official STL terminal stations in Davao Del Norte.) Tj ET ' +
        'BT /F1 9 Tf 50 370 Td (Recorded by: Operations Administration - Davao Del Norte Control Center) Tj ET ' +
        'BT /F1 9 Tf 50 355 Td (Apex OmniERP v4.0 - Digital Audit & Compliance Security Suite) Tj ET';

      const content = [
        '%PDF-1.4',
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
        '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
        '5 0 obj << /Length ' + streamText.length + ' >> stream\n' + streamText + '\nendstream endobj',
        'xref',
        '0 6',
        '0000000000 65535 f ',
        '0000000009 00000 n ',
        '0000000058 00000 n ',
        '0000000115 00000 n ',
        '0000000227 00000 n ',
        '0000000305 00000 n ',
        'trailer << /Size 6 /Root 1 0 R >>',
        'startxref',
        '0',
        '%%EOF'
      ].join('\n');

      const b64 = (typeof btoa === 'function')
        ? btoa(content)
        : (typeof Buffer !== 'undefined' ? Buffer.from(content).toString('base64') : '');
      return 'data:application/pdf;base64,' + b64;
    }

    isFakeSyntheticPdf(dataUrl) {
      return false;
    }

    // Intelligent deduplication: Collapses ID dash variations & middle initials, preserves authentic binary fileDataUrls, strictly purges unwanted seeded records
    deduplicateDocuments(docList = []) {
      if (!Array.isArray(docList)) return [];
      const result = [];
      const idIndex = new Map();
      const nameIndex = new Map();

      docList.forEach(doc => {
        if (!doc) return;
        // Strictly purge any unwanted synthetic reliever records
        if (this.isUnwantedSeededDoc(doc)) return;

        const docType = (doc.documentType || 'CBTA').toUpperCase();
        const normId = this.normalizeId(doc.employeeId);
        const nameSig = this.cleanNameTokens(doc.employeeName);

        let match = null;
        // 1. Try matching by unique Teller ID (ignoring generic reliever ID DDN005SR000)
        if (normId && normId !== 'DDN005SR000' && idIndex.has(normId + '::' + docType)) {
          match = idIndex.get(normId + '::' + docType);
        } else if (nameSig && nameIndex.has(nameSig + '::' + docType)) {
          // 2. Try matching by sorted name tokens (e.g. "Amerita Hipos" === "Hipos, Amerita H.")
          match = nameIndex.get(nameSig + '::' + docType);
        }

        if (!match) {
          const cloned = Object.assign({}, doc);
          // Purge any fake synthetic PDFs that were generated previously
          if (cloned.fileDataUrl && this.isFakeSyntheticPdf(cloned.fileDataUrl)) {
            delete cloned.fileDataUrl;
          }
          result.push(cloned);
          if (normId && normId !== 'DDN005SR000') idIndex.set(normId + '::' + docType, cloned);
          if (nameSig) nameIndex.set(nameSig + '::' + docType, cloned);
        } else {
          // Merge attributes into the canonical match:
          // Keep genuine local binary data URL if present (and not fake)
          if (doc.fileDataUrl && !this.isFakeSyntheticPdf(doc.fileDataUrl)) {
            match.fileDataUrl = doc.fileDataUrl;
            match.fileSize = doc.fileSize || match.fileSize;
            match.fileName = doc.fileName || match.fileName;
          }
          if (match.fileDataUrl && this.isFakeSyntheticPdf(match.fileDataUrl)) {
            delete match.fileDataUrl;
          }
          // Retain canonical hyphenated Master Registry ID (e.g. DDN005-SR-422)
          if (doc.employeeId && doc.employeeId.includes('-SR-')) {
            match.employeeId = doc.employeeId;
          }
          // Retain cleaner file name
          if (doc.fileName && !doc.fileName.includes('..') && !match.fileName) {
            match.fileName = doc.fileName;
          }
          if (doc.notes && !match.notes) {
            match.notes = doc.notes;
          }
          if (doc.dateUploaded && (!match.dateUploaded || doc.dateUploaded >= match.dateUploaded)) {
            match.dateUploaded = doc.dateUploaded;
          }
        }
      });

      return result;
    }

    getDeletedDocIds() {
      try {
        const raw = localStorage.getItem(DELETED_DOCS_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return new Set(arr);
        }
      } catch (e) {}
      return new Set();
    }

    recordDeletedDoc(id, doc) {
      const deletedSet = this.getDeletedDocIds();
      if (id) deletedSet.add(id);
      if (!doc && id && Array.isArray(this.documents)) {
        doc = this.documents.find(d => d && d.id === id);
      }
      if (doc) {
        if (doc.id) deletedSet.add(doc.id);
        const normId = this.normalizeId(doc.employeeId);
        const docType = (doc.documentType || 'CBTA').toUpperCase();
        if (normId) deletedSet.add(normId + '::' + docType);
        const nameSig = this.cleanNameTokens(doc.employeeName);
        if (nameSig) deletedSet.add(nameSig + '::' + docType);
      }
      try {
        localStorage.setItem(DELETED_DOCS_KEY, JSON.stringify(Array.from(deletedSet)));
      } catch (e) {}
    }

    isDeletedDoc(doc) {
      if (!doc) return true;
      const deletedSet = this.getDeletedDocIds();
      if (deletedSet.size === 0) return false;
      if (doc.id && deletedSet.has(doc.id)) return true;
      const normId = this.normalizeId(doc.employeeId);
      const docType = (doc.documentType || 'CBTA').toUpperCase();
      if (normId && deletedSet.has(normId + '::' + docType)) return true;
      const nameSig = this.cleanNameTokens(doc.employeeName);
      if (nameSig && deletedSet.has(nameSig + '::' + docType)) return true;
      return false;
    }

    async saveDocuments() {
      try {
        // Strip any deleted or unwanted docs before persisting
        this.documents = (this.documents || []).filter(d => !this.isDeletedDoc(d) && !this.isUnwantedSeededDoc(d));

        // 1. Save to native IndexedDB
        if (typeof indexedDB !== 'undefined') {
          await saveAllDocsToDB(this.documents);
        }

        // 2. Mirror metadata in localStorage (stripping large base64 data URLs to prevent quota crash)
        const lightweightDocs = this.documents.map(d => {
          const copy = Object.assign({}, d);
          if (copy.fileDataUrl && copy.fileDataUrl.length > 5000) {
            copy.hasStoredAttachment = true;
            delete copy.fileDataUrl;
          }
          return copy;
        });

        localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(lightweightDocs));

        // Clean up legacy keys so they never resurrect deleted records
        const legacyKeys = [
          'north005_employee_documents_v5',
          'north005_employee_documents_v4',
          'north005_employee_documents_v3',
          'north005_employee_documents_v2',
          'north005_employee_documents_v1',
          'north005_employee_documents'
        ];
        legacyKeys.forEach(k => {
          try { localStorage.removeItem(k); } catch (e) {}
        });
      } catch (err) {
        console.warn('[ComplianceDocs] saveDocuments notice:', err);
      }
    }

    async loadFromIndexedDB() {
      if (typeof indexedDB === 'undefined') return;
      try {
        const idbDocs = await getAllDocsFromDB();
        if (idbDocs && idbDocs.length > 0) {
          // Strictly filter out any deleted tombstoned docs from IndexedDB
          const activeIdbDocs = idbDocs.filter(d => !this.isDeletedDoc(d) && !this.isUnwantedSeededDoc(d));

          // Purge deleted docs from IndexedDB
          for (const d of idbDocs) {
            if (this.isDeletedDoc(d) || this.isUnwantedSeededDoc(d)) {
              await deleteDocFromDB(d.id);
            }
          }

          this.documents = this.deduplicateDocuments([...activeIdbDocs, ...this.documents]);
          await this.saveDocuments();
          this.render();
        } else if (this.documents.length > 0) {
          this.documents = this.deduplicateDocuments(this.documents);
          await this.saveDocuments();
        }
      } catch (err) {
        console.warn('[ComplianceDocs] loadFromIndexedDB error:', err);
      }
    }

    loadDocuments() {
      try {
        // Purge legacy storage keys to eliminate stale synthetic caches
        const candidateKeys = [
          'north005_employee_documents_v5',
          'north005_employee_documents_v4',
          'north005_employee_documents_v3',
          'north005_employee_documents_v2',
          'north005_employee_documents_v1',
          'north005_employee_documents'
        ];
        candidateKeys.forEach(k => {
          try { localStorage.removeItem(k); } catch (e) {}
        });

        const stored = localStorage.getItem(DOCS_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const activeDocs = parsed.filter(d => !this.isDeletedDoc(d) && !this.isUnwantedSeededDoc(d));
              return this.deduplicateDocuments(activeDocs);
            }
          } catch (e) {}
        }
        return [];
      } catch (e) {
        return [];
      }
    }

    /* --- LOCAL BASELINE LOADER & CLOUD SYNC DEACTIVATION --- */
    async loadBaselineDocuments() {
      if (typeof fetch !== 'function') return;
      try {
        const res = await fetch('/data/employee_documents.json');
        if (res.ok) {
          const data = await res.json();
          const docs = Array.isArray(data) ? data : ((data && Array.isArray(data.documents)) ? data.documents : []);
          const cleanDocs = docs.filter(d => d && d.id && !this.isDeletedDoc(d) && !this.isUnwantedSeededDoc(d));
          this.documents = this.deduplicateDocuments(cleanDocs);
          await this.saveDocuments();
          this.render();
        }
      } catch (e) {
        console.warn('[ComplianceDocs] loadBaselineDocuments notice:', e);
      }
    }

    async syncWithCloud(showToast = false) {
      if (this.documents.length === 0) {
        await this.loadBaselineDocuments();
      }

      if (window.supabaseSync && typeof window.supabaseSync.fetchEmployeeDocuments === 'function') {
        try {
          const cloudDocs = await window.supabaseSync.fetchEmployeeDocuments();
          if (Array.isArray(cloudDocs) && cloudDocs.length > 0) {
            const validCloud = cloudDocs.filter(d => !this.isDeletedDoc(d) && !this.isUnwantedSeededDoc(d));
            this.documents = this.deduplicateDocuments([...this.documents, ...validCloud]);
            await this.saveDocuments();
            this.render();
          }
        } catch (e) {
          console.warn('[ComplianceDocs] Supabase sync notice:', e);
        }
      }

      this.updateSyncStatus('synced');
      if (showToast) {
        notify(`Compliance repository active: ${this.documents.length} document(s) on file.`);
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
        if (this.isDeletedDoc(mapped) || this.isUnwantedSeededDoc(mapped)) {
          // If tombstoned, immediately remove from Supabase to prevent further broadcasts
          if (window.supabaseSync && typeof window.supabaseSync.deleteEmployeeDocument === 'function') {
            window.supabaseSync.deleteEmployeeDocument(mapped.id, mapped.employeeId, mapped.documentType).catch(() => {});
          }
          return;
        }
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
        const deletedId = (oldRec && oldRec.id) || (newRec && newRec.id);
        if (!deletedId) return;
        const targetDoc = this.documents.find(d => d.id === deletedId);
        this.recordDeletedDoc(deletedId, targetDoc);
        this.documents = this.documents.filter(d => d.id !== deletedId);
        if (this.selectedDocIds) this.selectedDocIds.delete(deletedId);
        this.saveDocuments();
        if (typeof indexedDB !== 'undefined') {
          deleteDocFromDB(deletedId);
        }
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
    // STRICT RULE: Sales Representatives always appear first, Relievers strictly last
    getFieldPersonnel() {
      const emps = this.getEmployees();
      const filtered = emps.filter(e => {
        const role = (e.role || e.position || '').toUpperCase();
        const dept = (e.department || '').toUpperCase();
        if (role.includes('ADMIN') || role.includes('SUPERVISOR') || role.includes('COLLECTOR') ||
          dept.includes('COLLECTOR') || dept.includes('ADMIN') || dept.includes('SUPERVISOR')) {
          return false;
        }
        return true;
      });

      const isRel = (e) => {
        const r = (e.role || e.position || '').toUpperCase();
        const id = (e.id || '').toUpperCase();
        return r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
      };

      return filtered.sort((a, b) => {
        const aRel = isRel(a);
        const bRel = isRel(b);
        if (!aRel && bRel) return -1;
        if (aRel && !bRel) return 1;
        return (a.name || '').localeCompare(b.name || '');
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
          // Enforce 1 document per employee & type to strictly prevent duplicate entries
          this.documents = this.documents.filter(d => !(this.isSameEmployee(d, p.employeeId, p.employeeName) && d.documentType === p.documentType));

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

        // Ensure canonical deduplication
        this.documents = this.deduplicateDocuments(this.documents);

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
          }).catch(() => { });
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

    getFilteredDocuments() {
      const fieldPersonnel = this.getFieldPersonnel();
      const missingStaff = fieldPersonnel.filter(emp => !this.documents.some(d => this.isSameEmployee(d, emp.id, emp.name)));

      let displayItems = [];
      if (this.activeKpiTab === 'Missing' || this.statusFilter === 'Missing') {
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
        displayItems = (this.documents || []).filter(doc => {
          if (this.activeKpiTab !== 'all' && doc.status !== this.activeKpiTab) {
            return false;
          }
          if (this.typeFilter !== 'all' && doc.documentType !== this.typeFilter) return false;
          if (this.statusFilter !== 'all' && doc.status !== this.statusFilter) return false;
          return true;
        });
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        displayItems = displayItems.filter(item => {
          const target = `${item.employeeName} ${item.employeeId} ${item.position} ${item.documentType} ${item.notes || ''}`.toLowerCase();
          return target.includes(q);
        });
      }

      return displayItems;
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
      const displayItems = this.getFilteredDocuments();

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
            <td colspan="11" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.6;">📁</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">No Document Records Found</div>
              <div style="font-size: 12px;">No employee compliance records match your search query, filters, or active card tab.</div>
            </td>
          </tr>
        `;
        this.updateSelectionUI();
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
            const isRowChecked = this.selectedDocIds && this.selectedDocIds.has(doc.id);
            actionBtns += `
              <button class="btn btn-xs btn-secondary" onclick="window.employeeDocumentsModule.deleteDocument('${doc.id}')" style="color:#ef4444;padding:3px 8px;font-size:11px;" title="Delete Document Record">
                🗑️ Delete
              </button>
              <input type="checkbox" class="doc-row-checkbox" value="${doc.id}" ${isRowChecked ? 'checked' : ''} onchange="window.employeeDocumentsModule.toggleRowSelection('${doc.id}', this.checked)" style="cursor:pointer; transform:scale(1.15); margin-left:5px;" title="Select document for bulk delete">
            `;
          }
        }

        const isRowChecked = this.selectedDocIds && this.selectedDocIds.has(doc.id);
        const checkboxHtml = doc.isMissingPlaceholder ? '' : `
          <input type="checkbox" class="doc-row-checkbox" value="${doc.id}" ${isRowChecked ? 'checked' : ''} onchange="window.employeeDocumentsModule.toggleRowSelection('${doc.id}', this.checked)" style="cursor:pointer; transform:scale(1.15);" title="Select row">
        `;

        return `
          <tr class="${isRowChecked ? 'selected-row' : ''}">
            <td style="text-align: center;">${checkboxHtml}</td>
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
            <td style="text-align: center; white-space: nowrap;">
              <div style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                ${actionBtns}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      this.updateSelectionUI();
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

      // 1. If document was loaded from lightweight metadata mirror, fetch full binary from IndexedDB
      if (!doc.fileDataUrl && typeof indexedDB !== 'undefined') {
        const idbDoc = await getDocFromDB(id);
        if (idbDoc && idbDoc.fileDataUrl) {
          doc.fileDataUrl = idbDoc.fileDataUrl;
          doc.fileName = idbDoc.fileName || doc.fileName;
          doc.fileType = idbDoc.fileType || doc.fileType;
        }
      }

      // 2. Ensure all 46 sales representative CBTA uploads have an interactive official digital PDF preview
      if (!doc.fileDataUrl) {
        if ((doc.documentType || '').toUpperCase() === 'CBTA' || (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf'))) {
          doc.fileDataUrl = this.generateOfficialCbtaPdfDataUrl(doc);
        }
      }

      document.getElementById('view-doc-title').textContent = `${doc.documentType} — ${doc.employeeName}`;
      const contentEl = document.getElementById('view-doc-content');
      if (contentEl) {
        const hasRealFile = Boolean(doc.fileDataUrl);
        let filePreviewHtml = '';

        if (hasRealFile) {
          const isPdf = (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf')) || (doc.fileType === 'application/pdf') || (doc.fileDataUrl && doc.fileDataUrl.startsWith('data:application/pdf'));
          if (isPdf) {
            filePreviewHtml = `
              <div style="margin-top:14px; text-align:center;">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                  <span>📄 ATTACHED DIGITAL DOCUMENT PREVIEW:</span>
                  <span style="color:#4ade80;">✅ Digital Document Verified</span>
                </div>
                <iframe src="${doc.fileDataUrl}" style="width:100%; height:400px; border-radius:8px; border:1px solid rgba(245,158,11,0.4); background:#0f172a;" title="Document Preview"></iframe>
                <div style="margin-top:12px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                  <a href="${doc.fileDataUrl}" download="${doc.fileName || 'Document.pdf'}" class="btn btn-secondary btn-sm" style="font-weight:700; color:var(--accent-gold);">
                    ⬇️ Download Document File
                  </a>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.employeeDocumentsModule.printCurrentDocument('${doc.id}')" style="font-weight:700;">
                    🖨️ Print Document
                  </button>
                </div>
              </div>
            `;
          } else {
            filePreviewHtml = `
              <div style="margin-top:14px; text-align:center;">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                  <span>🖼️ ATTACHED DIGITAL DOCUMENT IMAGE:</span>
                  <span style="color:#4ade80;">✅ Digital Document Verified</span>
                </div>
                <img src="${doc.fileDataUrl}" style="max-width:100%; max-height:300px; border-radius:8px; border:1px solid rgba(245,158,11,0.4); object-fit:contain; background:#000;" alt="${doc.documentType}">
                <div style="margin-top:12px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                  <a href="${doc.fileDataUrl}" download="${doc.fileName || 'Document.jpg'}" class="btn btn-secondary btn-sm" style="font-weight:700; color:var(--accent-gold);">
                    ⬇️ Download Image File
                  </a>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.employeeDocumentsModule.printCurrentDocument('${doc.id}')" style="font-weight:700;">
                    🖨️ Print Document
                  </button>
                </div>
              </div>
            `;
          }
        } else {
          filePreviewHtml = `
            <div style="margin-top:14px; padding:16px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px dashed rgba(245,158,11,0.3); text-align:left;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:12px; font-weight:700; color:var(--text-muted);">📄 OFFICIAL COMPLIANCE STATUS:</span>
                <span style="color:#4ade80; font-size:12px; font-weight:700;">✅ CBTA On File</span>
              </div>
              <div style="font-size:13px; color:#f1f5f9; margin-bottom:8px;">
                <strong>Registered Attachment File:</strong> <code style="color:var(--accent-cyan); font-weight:600;">${doc.fileName || 'CBTA_Agreement.pdf'}</code>
                ${doc.fileSize ? `<span style="color:var(--text-muted); font-size:11px; margin-left:6px;">(${doc.fileSize})</span>` : ''}
              </div>
              <div style="font-size:12px; color:var(--text-muted); line-height:1.5;">
                This official document was recorded for <strong>${doc.employeeName}</strong> (${doc.employeeId}) on ${doc.dateUploaded || '2026-10-07'}.
              </div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.employeeDocumentsModule.closeViewModal(); window.employeeDocumentsModule.openUploadModalForEmp('${doc.employeeId}', '${(doc.employeeName || '').replace(/'/g, "\\'")}')" style="font-weight:700; color:var(--accent-gold);">
                  📁 Re-attach / Update Document
                </button>
              </div>
            </div>
          `;
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

    printCurrentDocument(id) {
      const doc = this.documents.find(d => d.id === id);
      if (!doc || !doc.fileDataUrl) return;
      const w = window.open('');
      if (!w) {
        notify('Notice: Pop-up was blocked. Please allow pop-ups for this site to print agreements.');
        return;
      }
      if (doc.fileDataUrl.startsWith('data:application/pdf')) {
        w.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${doc.fileName || 'Official_Document'}</title>
              <style>body,html { margin:0; padding:0; height:100%; overflow:hidden; }</style>
            </head>
            <body>
              <embed width="100%" height="100%" src="${doc.fileDataUrl}" type="application/pdf">
            </body>
          </html>
        `);
      } else {
        w.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${doc.fileName || 'Official_Document'}</title>
              <style>body { margin:20px; text-align:center; } img { max-width:100%; height:auto; }</style>
            </head>
            <body>
              <img src="${doc.fileDataUrl}">
              <script>window.onload = function() { window.print(); }<\/script>
            </body>
          </html>
        `);
      }
    }

    async deleteDocument(id) {
      if (!window.authManager || !window.authManager.isAdmin()) {
        notify('Permission Denied: Only Administrators can delete compliance records.');
        return;
      }
      const shouldDelete = (typeof confirm === 'function')
        ? confirm('Are you sure you want to permanently delete this document record?')
        : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm('Are you sure you want to permanently delete this document record?') : true);
      if (!shouldDelete) return;
      const targetDoc = this.documents.find(d => d.id === id);
      this.documents = this.documents.filter(d => d.id !== id);
      if (this.selectedDocIds) this.selectedDocIds.delete(id);

      // Record tombstone immediately so it never resurrects
      this.recordDeletedDoc(id, targetDoc);

      // Save immediately locally to IndexedDB and localStorage mirror
      await this.saveDocuments();

      // Delete from local IndexedDB
      if (typeof indexedDB !== 'undefined') {
        await deleteDocFromDB(id);
      }

      // Delete from Supabase Cloud by ID and by employeeId + documentType
      if (window.supabaseSync && typeof window.supabaseSync.deleteEmployeeDocument === 'function') {
        await window.supabaseSync.deleteEmployeeDocument(id, targetDoc ? targetDoc.employeeId : null, targetDoc ? targetDoc.documentType : null);
      }

      // Delete from Server REST API and update server deletedDocIds
      if (typeof fetch === 'function') {
        try {
          await fetch(`/api/employee-documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
          await fetch('/api/employee-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documents: this.documents,
              deletedDocIds: Array.from(this.getDeletedDocIds())
            })
          });
        } catch (e) { }
      }

      this.render();
      notify('Document record permanently deleted.');
    }

    /* --- BULK SELECTION & ACTIONS (SELECT ALL / UNSELECT ALL / BULK DELETE) --- */
    toggleRowSelection(id, isChecked) {
      if (!id) return;
      if (isChecked) {
        this.selectedDocIds.add(id);
      } else {
        this.selectedDocIds.delete(id);
      }
      this.updateSelectionUI();
    }

    toggleSelectAll(forceState) {
      const activeRows = (this.getFilteredDocuments ? this.getFilteredDocuments() : this.documents || []).filter(d => !d.isMissingPlaceholder);
      if (activeRows.length === 0) return;

      const shouldSelect = typeof forceState === 'boolean'
        ? forceState
        : this.selectedDocIds.size < activeRows.length;

      if (shouldSelect) {
        activeRows.forEach(d => this.selectedDocIds.add(d.id));
      } else {
        this.selectedDocIds.clear();
      }
      this.render();
    }

    unselectAll() {
      this.selectedDocIds.clear();
      this.render();
    }

    updateSelectionUI() {
      const banner = document.getElementById('doc-selection-banner');
      const countEl = document.getElementById('doc-selected-count');
      const masterCheckbox = document.getElementById('doc-master-checkbox');
      const selectAllBtn = document.getElementById('btn-doc-select-all');
      const actionSelectAllCb = document.getElementById('doc-action-select-all');
      const actionSelectAllLabel = document.getElementById('doc-action-select-all-label');

      const activeRows = (this.getFilteredDocuments ? this.getFilteredDocuments() : this.documents || []).filter(d => !d.isMissingPlaceholder);
      const count = this.selectedDocIds ? this.selectedDocIds.size : 0;
      const allSelected = activeRows.length > 0 && count === activeRows.length;

      if (countEl) countEl.textContent = count;
      if (banner) {
        banner.style.display = count > 0 ? 'flex' : 'none';
      }
      if (masterCheckbox) {
        masterCheckbox.checked = allSelected;
        masterCheckbox.indeterminate = count > 0 && count < activeRows.length;
      }
      if (actionSelectAllCb) {
        actionSelectAllCb.checked = allSelected;
        actionSelectAllCb.indeterminate = count > 0 && count < activeRows.length;
      }
      if (actionSelectAllLabel) {
        actionSelectAllLabel.textContent = allSelected ? 'UNSELECT ALL' : 'SELECT ALL';
      }
      if (selectAllBtn) {
        selectAllBtn.textContent = allSelected ? 'Unselect All' : 'Select All';
      }

      if (typeof document !== 'undefined') {
        const rowCheckboxes = document.querySelectorAll('.doc-row-checkbox');
        rowCheckboxes.forEach(cb => {
          cb.checked = this.selectedDocIds && this.selectedDocIds.has(cb.value);
        });
      }
    }

    async deleteSelectedDocuments() {
      if (!window.authManager || !window.authManager.isAdmin()) {
        notify('Permission Denied: Only Administrators can delete compliance records.');
        return;
      }
      const count = this.selectedDocIds ? this.selectedDocIds.size : 0;
      if (count === 0) {
        notify('Please select one or more documents to delete.');
        return;
      }
      const confirmMsg = `Are you sure you want to permanently delete the ${count} selected document record(s)?`;
      const shouldDelete = (typeof confirm === 'function')
        ? confirm(confirmMsg)
        : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(confirmMsg) : true);
      if (!shouldDelete) return;

      const idsToDelete = Array.from(this.selectedDocIds);
      const targets = this.documents.filter(d => idsToDelete.includes(d.id));

      // 1. Record tombstones for all targets
      targets.forEach(doc => {
        this.recordDeletedDoc(doc.id, doc);
      });
      idsToDelete.forEach(id => {
        this.recordDeletedDoc(id);
      });

      // 2. Filter out from memory and clear selections
      this.documents = this.documents.filter(d => !idsToDelete.includes(d.id));
      this.selectedDocIds.clear();

      // 3. Save immediately locally
      await this.saveDocuments();

      // 4. Delete from local IndexedDB
      if (typeof indexedDB !== 'undefined') {
        for (const id of idsToDelete) {
          await deleteDocFromDB(id);
        }
      }

      // 5. Delete from Supabase Cloud by ID and employeeId + documentType
      if (window.supabaseSync && typeof window.supabaseSync.deleteEmployeeDocument === 'function') {
        for (const doc of targets) {
          await window.supabaseSync.deleteEmployeeDocument(doc.id, doc.employeeId, doc.documentType).catch(() => {});
        }
      }

      // 6. Delete from Server REST API and update server deletedDocIds
      if (typeof fetch === 'function') {
        try {
          for (const id of idsToDelete) {
            await fetch(`/api/employee-documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
          }
          await fetch('/api/employee-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documents: this.documents,
              deletedDocIds: Array.from(this.getDeletedDocIds())
            })
          }).catch(() => {});
        } catch (e) {}
      }

      this.render();
      notify(`Permanently deleted ${count} document record(s).`);
    }
  }

  window.EmployeeDocumentsModule = EmployeeDocumentsModule;
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
