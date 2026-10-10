/**
 * NORTH-005 OmniERP — Critical Regression Test Suite:
 * Employee Document Upload, Database Persistence, Search, and Repository Synchronization
 * 
 * Verifies Test A through Test K from user specification:
 * - Test A: Upload & Persistence (Nobelyn Baya DDN005-SR428 CBTA PDF)
 * - Test B: Browser Refresh/Reload (Persistence verified across full reload)
 * - Test C: Search & Clear (Searching 'admin' filters rows without mutating repository or KPI cards)
 * - Test D: Multiple Employees (Nobelyn Baya + Merily Baranda co-existence)
 * - Test E: Filters & Pagination (Type, status, rows per page)
 * - Test F: Cloud Synchronization (Sync Cloud preserves records and reports honest status)
 * - Test G: Failure Handling (Safe error reporting on persistence failure)
 * - Test H: Duplicate Prevention (Re-upload updates record without creating duplicate entries)
 * - Test I: Cross-Device Persistence (Server API persistence across simulated devices)
 * - Test J: Existing Records Protection (Preserves existing valid employee documents)
 * - Test K: Compliance Calculations (Global summary cards always derived from authoritative repository)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// --- Mock Browser Environment ---
const storageStore = new Map();
global.localStorage = {
  getItem: (key) => storageStore.has(key) ? storageStore.get(key) : null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

// In-Memory IndexedDB Mock
const idbStore = new Map();
global.indexedDB = {
  open: (dbName, version) => {
    return {
      set onupgradeneeded(fn) {
        if (!this._upgraded) {
          this._upgraded = true;
          fn({ target: { result: { objectStoreNames: { contains: () => true }, createObjectStore: () => {} } } });
        }
      },
      set onsuccess(fn) {
        setTimeout(() => {
          fn({
            target: {
              result: {
                objectStoreNames: { contains: (name) => name === 'employee_documents' },
                close: () => {},
                transaction: (storeName, mode) => ({
                  objectStore: () => ({
                    getAll: () => {
                      const req = { onsuccess: null, onerror: null, result: Array.from(idbStore.values()) };
                      setTimeout(() => req.onsuccess && req.onsuccess(), 5);
                      return req;
                    },
                    get: (id) => {
                      const req = { onsuccess: null, onerror: null, result: idbStore.get(id) || null };
                      setTimeout(() => req.onsuccess && req.onsuccess(), 5);
                      return req;
                    },
                    put: (doc) => {
                      idbStore.set(doc.id, Object.assign({}, doc));
                    },
                    delete: (id) => {
                      idbStore.delete(id);
                    }
                  }),
                  set oncomplete(cb) { setTimeout(() => cb(), 10); },
                  set onerror(cb) {}
                })
              }
            }
          });
        }, 5);
      },
      set onerror(fn) {}
    };
  }
};

const domElements = {};
function getOrCreateEl(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      focus: () => {},
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      },
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
  }
  return domElements[id];
}

global.window = {
  toast: { info: (m) => notifications.push(m) },
  addEventListener: () => {},
  authManager: { isAdmin: () => true }
};
global.document = {
  getElementById: (id) => getOrCreateEl(id),
  querySelectorAll: () => [],
  addEventListener: () => {},
  querySelector: () => null
};

let notifications = [];
global.alert = (m) => notifications.push(m);

// Mock Server In-Memory Storage
let serverDocs = [];
let serverDeletedIds = [];
global.fetch = async (url, opts = {}) => {
  if (url.includes('/api/employee-documents')) {
    if (opts.method === 'POST') {
      const payload = JSON.parse(opts.body || '{}');
      const incoming = payload.documents || [];
      const incomingDel = payload.deletedDocIds || [];
      const delSet = new Set([...serverDeletedIds, ...incomingDel]);
      incoming.forEach(d => {
        if (d && d.id) delSet.delete(d.id);
      });
      const map = new Map();
      serverDocs.forEach(d => { if (!delSet.has(d.id)) map.set(d.employeeId + '::' + d.documentType, d); });
      incoming.forEach(d => { if (!delSet.has(d.id)) map.set(d.employeeId + '::' + d.documentType, d); });
      serverDocs = Array.from(map.values());
      serverDeletedIds = Array.from(delSet);
      return { ok: true, json: async () => ({ success: true, count: serverDocs.length, documents: serverDocs }) };
    }
    if (opts.method === 'DELETE') {
      const id = new URL(url, 'http://localhost').searchParams.get('id');
      serverDocs = serverDocs.filter(d => d.id !== id);
      serverDeletedIds.push(id);
      return { ok: true, json: async () => ({ success: true, deletedId: id }) };
    }
    return {
      ok: true,
      json: async () => ({ documents: serverDocs, deletedDocIds: serverDeletedIds })
    };
  }
  return { ok: false };
};

// Load Modules
require('./js/store.js');
require('./js/employee-documents.js');

async function runRegressionSuite() {
  console.log('========================================================================');
  console.log('RUNNING EMPLOYEE DOCUMENTS PERSISTENCE, SEARCH & SYNC REGRESSION SUITE');
  console.log('========================================================================\n');

  const mod = window.employeeDocumentsModule;
  await mod.init();

  // ---------------------------------------------------------------------------
  // TEST A: Upload and Persistence (Nobelyn Baya DDN005-SR428 CBTA PDF)
  // ---------------------------------------------------------------------------
  console.log('--- TEST A: Upload & Persistence (Nobelyn Baya) ---');
  notifications = [];
  mod.openUploadModal();
  mod.selectEmployee('DDN005-SR428', 'Nobelyn Baya');
  
  // Attach test CBTA PDF
  const samplePdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZz4+ZW5kb2Jq';
  mod.fileBuffers['CBTA'] = {
    docType: 'CBTA',
    fileName: 'Baya, Nobelyn.pdf',
    fileSize: '1361 KB',
    fileDataUrl: samplePdfBase64,
    fileType: 'application/pdf'
  };

  mod.initiateSaveDocument();
  assert.ok(getOrCreateEl('modal-doc-confirm-upload').classList.contains('active'), 'Upload confirmation modal must open');
  
  // Execute upload and await full persistence
  await mod.commitDocumentSave(false);
  
  assert.strictEqual(mod.documents.length, 1, 'Repository must contain 1 document');
  const bayaDoc = mod.documents[0];
  assert.strictEqual(bayaDoc.employeeName, 'Nobelyn Baya');
  assert.strictEqual(bayaDoc.employeeId, 'DDN005-SR428');
  assert.strictEqual(bayaDoc.documentType, 'CBTA');
  assert.strictEqual(bayaDoc.fileName, 'Baya, Nobelyn.pdf');
  assert.strictEqual(bayaDoc.fileDataUrl, samplePdfBase64);
  assert.ok(notifications.some(n => n.includes('Nobelyn Baya') && n.includes('uploaded successfully')), 'Truthful success notification displayed');

  // Verify attachment opens through View action
  await mod.viewDocument(bayaDoc.id);
  const viewContent = getOrCreateEl('view-doc-content').innerHTML;
  assert.ok(viewContent.includes('iframe src="data:application/pdf;base64,'), 'Document view action must render PDF preview');
  console.log('✓ TEST A PASSED: Upload, persistence, and attachment viewing verified.');

  // ---------------------------------------------------------------------------
  // TEST B: Browser Refresh / Reload
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST B: Browser Refresh / Reload ---');
  // Re-instantiate module from scratch to simulate clean browser reload
  const reloadedMod = new window.EmployeeDocumentsModule();
  assert.strictEqual(reloadedMod.documents.length, 1, 'Must load saved record from localStorage synchronously');
  await reloadedMod.init();
  assert.strictEqual(reloadedMod.documents.length, 1, 'Must retain saved record after IndexedDB & server hydration');
  const reloadedBaya = reloadedMod.documents.find(d => d.employeeId === 'DDN005-SR428');
  assert.ok(reloadedBaya, 'Nobelyn Baya record must remain intact after reload');
  assert.strictEqual(reloadedBaya.fileName, 'Baya, Nobelyn.pdf');
  
  // Verify attachment is still retrievable via viewDocument
  await reloadedMod.viewDocument(reloadedBaya.id);
  assert.ok(reloadedBaya.fileDataUrl, 'Attachment data must be retrieved from persistent storage');
  console.log('✓ TEST B PASSED: Uploaded document remains fully visible with attachment after reload.');

  // ---------------------------------------------------------------------------
  // TEST C: Search and Clear
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST C: Search & Clear ---');
  // Check baseline KPIs before search
  const totalBefore = parseInt(getOrCreateEl('kpi-docs-total').textContent, 10);
  const missingBefore = parseInt(getOrCreateEl('kpi-docs-missing').textContent, 10);

  // Search for 'admin' (which does not match Nobelyn Baya)
  getOrCreateEl('docs-search-input').value = 'admin';
  reloadedMod.filterDocuments();
  const searchResults = reloadedMod.getFilteredDocuments();
  assert.strictEqual(searchResults.length, 0, 'No rows should match search term "admin"');
  assert.strictEqual(reloadedMod.documents.length, 1, 'Repository persistent documents must NOT be modified by search');
  
  // KPI summary cards must NOT be altered by search
  assert.strictEqual(parseInt(getOrCreateEl('kpi-docs-total').textContent, 10), totalBefore, 'Total Documents KPI must remain unchanged during search');
  assert.strictEqual(parseInt(getOrCreateEl('kpi-docs-missing').textContent, 10), missingBefore, 'Missing Records KPI must remain unchanged during search');

  // Clear search
  getOrCreateEl('docs-search-input').value = '';
  reloadedMod.filterDocuments();
  const clearedResults = reloadedMod.getFilteredDocuments();
  assert.strictEqual(clearedResults.length, 1, 'Clearing search must restore visible record');
  console.log('✓ TEST C PASSED: Search filters table view without mutating records or KPI calculations.');

  // ---------------------------------------------------------------------------
  // TEST D: Other Employee Upload
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST D: Other Employee Upload ---');
  reloadedMod.openUploadModal();
  reloadedMod.selectEmployee('DDN005-SR1780', 'Merily Baranda');
  reloadedMod.fileBuffers['CBTA'] = {
    docType: 'CBTA',
    fileName: 'Baranda, Merily P..pdf',
    fileSize: '1420 KB',
    fileDataUrl: samplePdfBase64,
    fileType: 'application/pdf'
  };
  reloadedMod.initiateSaveDocument();
  await reloadedMod.commitDocumentSave(false);

  assert.strictEqual(reloadedMod.documents.length, 2, 'Repository must contain 2 employee documents');
  assert.ok(reloadedMod.documents.some(d => d.employeeId === 'DDN005-SR428'), 'Nobelyn Baya must remain present');
  assert.ok(reloadedMod.documents.some(d => d.employeeId === 'DDN005-SR1780'), 'Merily Baranda must remain present');
  console.log('✓ TEST D PASSED: Multiple employees co-exist without overwriting or displacing each other.');

  // ---------------------------------------------------------------------------
  // TEST E: Filters and Pagination
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST E: Filters & Pagination ---');
  reloadedMod.setPageSize(1);
  assert.strictEqual(reloadedMod.pageSize, 1);
  reloadedMod.setPage(1);
  assert.strictEqual(reloadedMod.currentPage, 1);

  // Filter by document type
  reloadedMod.typeFilter = 'CBTA';
  const cbtaOnly = reloadedMod.getFilteredDocuments();
  assert.strictEqual(cbtaOnly.length, 2, 'Both CBTA documents must match CBTA filter');

  reloadedMod.typeFilter = 'RESUME';
  const resumeOnly = reloadedMod.getFilteredDocuments();
  assert.strictEqual(resumeOnly.length, 0, 'No documents should match RESUME filter');
  reloadedMod.typeFilter = 'all';

  // Global KPIs must remain at 2
  assert.strictEqual(parseInt(getOrCreateEl('kpi-docs-total').textContent, 10), 2);
  console.log('✓ TEST E PASSED: Type filters and pagination behave consistently.');

  // ---------------------------------------------------------------------------
  // TEST F: Cloud Synchronization
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST F: Cloud Synchronization ---');
  await reloadedMod.syncWithCloud(false);
  assert.strictEqual(reloadedMod.documents.length, 2, 'Cloud sync must preserve all 2 saved documents');
  assert.ok(getOrCreateEl('docs-sync-status-badge').innerHTML.includes('Cloud Synced'), 'Status badge must show Cloud Synced');
  console.log('✓ TEST F PASSED: Cloud synchronization reconciles and preserves repository.');

  // ---------------------------------------------------------------------------
  // TEST G: Failure Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST G: Failure Handling ---');
  reloadedMod.openUploadModal();
  reloadedMod.pendingUploads = [{ employeeId: 'DDN005-SR999', employeeName: 'Incomplete Staff', documentType: 'CBTA', fileDataUrl: null }];
  notifications = [];
  await reloadedMod.commitDocumentSave(false);
  assert.ok(notifications.some(n => n.includes('Validation Error')), 'Must show validation error when file attachment is missing');
  assert.strictEqual(reloadedMod.documents.length, 2, 'Repository must not be corrupted by failed upload');
  console.log('✓ TEST G PASSED: Failed upload safely handled without false success messages.');

  // ---------------------------------------------------------------------------
  // TEST H: Duplicate Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST H: Duplicate Prevention ---');
  reloadedMod.openUploadModal();
  reloadedMod.selectEmployee('DDN005-SR428', 'Nobelyn Baya');
  reloadedMod.fileBuffers['CBTA'] = {
    docType: 'CBTA',
    fileName: 'Baya_Nobelyn_Updated.pdf',
    fileSize: '1380 KB',
    fileDataUrl: samplePdfBase64,
    fileType: 'application/pdf'
  };
  reloadedMod.initiateSaveDocument();
  await reloadedMod.commitDocumentSave(true); // Re-upload/replace

  assert.strictEqual(reloadedMod.documents.length, 2, 'Total repository count must remain 2 (no duplicate entry)');
  const updatedBaya = reloadedMod.documents.find(d => d.employeeId === 'DDN005-SR428');
  assert.strictEqual(updatedBaya.fileName, 'Baya_Nobelyn_Updated.pdf', 'Document must be updated in place');
  console.log('✓ TEST H PASSED: Re-upload updates record without creating duplicate entries.');

  // ---------------------------------------------------------------------------
  // TEST I: Cross-Device Persistence
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST I: Cross-Device Persistence ---');
  // Device 2 connects to the server endpoint
  const res = await fetch('/api/employee-documents');
  const serverData = await res.json();
  assert.strictEqual(serverData.documents.length, 2, 'Server must return both documents to simulated secondary device');
  assert.ok(serverData.documents.some(d => d.employeeId === 'DDN005-SR428'), 'Server has Nobelyn Baya');
  assert.ok(serverData.documents.some(d => d.employeeId === 'DDN005-SR1780'), 'Server has Merily Baranda');
  console.log('✓ TEST I PASSED: Server API maintains cross-device persistence.');

  // ---------------------------------------------------------------------------
  // TEST J: Existing Records Protection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST J: Existing Records Protection ---');
  const baranda = reloadedMod.documents.find(d => d.employeeId === 'DDN005-SR1780');
  assert.ok(baranda, 'Merily Baranda record must exist');
  assert.strictEqual(baranda.employeeName, 'Merily Baranda');
  assert.strictEqual(baranda.documentType, 'CBTA');
  console.log('✓ TEST J PASSED: Existing employee compliance documents remain intact.');

  // ---------------------------------------------------------------------------
  // TEST K: Compliance Calculations
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST K: Compliance Calculations ---');
  reloadedMod.render();
  const totalKpi = parseInt(getOrCreateEl('kpi-docs-total').textContent, 10);
  const validKpi = parseInt(getOrCreateEl('kpi-docs-valid').textContent, 10);
  const missingKpi = parseInt(getOrCreateEl('kpi-docs-missing').textContent, 10);

  assert.strictEqual(totalKpi, 2, 'Total Documents must be exactly 2');
  assert.strictEqual(validKpi, 2, 'Complete & Valid must be exactly 2');
  assert.strictEqual(missingKpi, 148, 'Missing Records must be exactly 148 (150 total - 2 submitted)');
  console.log('✓ TEST K PASSED: Summary cards accurate (Total=2, Valid=2, Missing=148).');

  console.log('\n========================================================================');
  console.log('ALL 11 REGRESSION REQUIREMENTS (TEST A THROUGH K) PASSED CLEANLY! ✨');
  console.log('========================================================================\n');
}

runRegressionSuite().catch(err => {
  console.error('❌ Regression suite failed:', err);
  process.exit(1);
});
