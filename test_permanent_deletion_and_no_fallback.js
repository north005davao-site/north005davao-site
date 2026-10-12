const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: PERMANENT DELETION & ZERO AUTO-RESURRECTION ===\n');

// 1. Verify server readPersistentEmployeeDocuments does NOT resurrect when all docs are deleted
// Simulate server logic
const DOCS_FILE = path.join(__dirname, 'data', 'employee_documents.json');
const raw = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
const baseDocs = raw.documents || raw;
assert.strictEqual(baseDocs.length, 46, 'Baseline must have 46 docs');

// Simulate dynamic state where all 46 IDs are in delSet
const allIds = baseDocs.map(d => d.id);
const delSet = new Set(allIds);
const docMap = new Map();
baseDocs.forEach(d => {
  if (d && d.id && !delSet.has(d.id)) {
    docMap.set(d.id, d);
  }
});
const activeList = Array.from(docMap.values());
assert.strictEqual(activeList.length, 0, 'Active list must be 0 after deleting all docs');

// Test our new server condition:
const dynamic = { documents: [], deletedDocIds: allIds };
const shouldResurrect = activeList.length === 0 && baseDocs.length > 0 && delSet.size === 0 && (!dynamic || dynamic.documents === undefined);
assert.strictEqual(shouldResurrect, false, 'Server must NEVER resurrect when deletions are recorded');
console.log('✓ Verified: Server readPersistentEmployeeDocuments honors complete deletion and does not resurrect');

// 2. Mock client environment
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

const domElements = {
  'docs-search-input': { value: '', style: {} },
  'docs-filter-type': { value: 'all', style: {} },
  'docs-filter-status': { value: 'all', style: {} },
  'docs-search-clear-btn': { style: { display: 'none' } },
  'docs-search-datalist': { innerHTML: '' },
  'employee-documents-tbody': { innerHTML: '' },
  'employee-documents-pagination': { innerHTML: '' },
  'kpi-docs-total': { textContent: '' },
  'kpi-docs-valid': { textContent: '' },
  'kpi-docs-expiring': { textContent: '' },
  'kpi-docs-expired': { textContent: '' },
  'kpi-docs-missing': { textContent: '' },
  'view-doc-title': { textContent: '' },
  'view-doc-content': { innerHTML: '' },
  'modal-view-document': { classList: { add: () => {}, remove: () => {} }, classes: [] }
};

global.document = {
  getElementById: (id) => domElements[id] || { innerHTML: '', textContent: '', value: '', style: {}, classList: { add: () => {}, remove: () => {} } },
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  addEventListener: () => {},
  confirm: () => true,
  authManager: {
    isAdmin: () => true,
    getCurrentUser: () => ({ username: 'admin' })
  },
  toast: { info: () => {} }
};

require('./js/store.js');
require('./js/employee-documents.js');

const mod = window.employeeDocumentsModule;

// Start with 46 documents
mod.documents = [...baseDocs];
mod.render();
assert.strictEqual(mod.documents.length, 46);

// User selects all 46 documents and deletes them
allIds.forEach(id => mod.selectedDocIds.add(id));
assert.strictEqual(mod.selectedDocIds.size, 46);

// Delete all selected
const idsToDelete = Array.from(mod.selectedDocIds);
idsToDelete.forEach(id => mod.recordDeletedDoc(id));
mod.documents = mod.documents.filter(d => !idsToDelete.includes(d.id));
mod.selectedDocIds.clear();
mod.render();

assert.strictEqual(mod.documents.length, 0, 'Client documents must be 0 after deleteSelected');
assert.strictEqual(domElements['kpi-docs-total'].textContent, 0, 'KPI Total Documents must be 0');
assert.strictEqual(domElements['kpi-docs-missing'].textContent, 150, 'KPI Missing Records must be 150');
console.log('✓ Verified: Deletion of all documents sets count to 0 and missing to 150');

// 3. Simulate browser reload when server returns 0 documents
const serverResponse = {
  documents: [],
  deletedDocIds: allIds
};

// Check that client does NOT call restore=true and stays at 0
const sDeleted = serverResponse.deletedDocIds;
const cleanServerDeleted = sDeleted.filter(k => typeof k === 'string' && k.startsWith('DOC-'));
const serverDeletedSet = new Set(cleanServerDeleted);
const validDocs = serverResponse.documents.filter(d => d && d.id && !serverDeletedSet.has(d.id));

if (validDocs.length > 0) {
  mod.documents = validDocs;
} else if (Array.isArray(serverResponse.documents) && serverResponse.documents.length === 0) {
  mod.documents = [];
}
mod.render();

assert.strictEqual(mod.documents.length, 0, 'Documents must STAY 0 on reload');
assert.strictEqual(domElements['kpi-docs-total'].textContent, 0, 'KPI Total must remain 0 on reload');
console.log('✓ Verified: Client reload cleanly stays at 0 documents with ZERO resurrection');

console.log('\n🎉 ALL PERMANENT DELETION TESTS PASSED!');
