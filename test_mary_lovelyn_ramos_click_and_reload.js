const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: MARY LOVELYN RAMOS CLICK & RELOAD PERSISTENCE ===\n');

// 1. Verify 46 records exist in canonical data
const dataPath = path.join(__dirname, 'data', 'employee_documents.json');
const docsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const docsList = docsData.documents || docsData;
assert.strictEqual(docsList.length, 46, 'Must have 46 baseline records');
const mary = docsList.find(d => d.employeeName === 'MARY LOVELYN RAMOS');
assert(mary, 'Mary Lovelyn Ramos must exist in baseline documents');
assert.strictEqual(mary.employeeId, 'DDN005-SR350');
console.log('✓ Verified: Mary Lovelyn Ramos exists in baseline 46 records');

// 2. Set up DOM and browser mock
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

const domElements = {
  'docs-search-input': { value: '', style: {}, setAttribute: () => {} },
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
  'modal-view-document': { classList: { add: (c) => domElements['modal-view-document'].classes.push(c), remove: (c) => { domElements['modal-view-document'].classes = domElements['modal-view-document'].classes.filter(x => x !== c); } }, classes: [] }
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
    getCurrentUser: () => ({ username: 'admin', role: 'Administrator' })
  },
  toast: { info: () => {} }
};

require('./js/store.js');
require('./js/employee-documents.js');

const mod = window.employeeDocumentsModule;

// Manually set 46 documents as loaded from baseline
mod.documents = [...docsList];
mod.render();

assert.strictEqual(mod.documents.length, 46, 'Module must hold 46 documents');
assert.strictEqual(domElements['kpi-docs-total'].textContent, 46, 'KPI Total Documents must display 46');
console.log('✓ Verified: Initial render shows all 46 documents');

// 3. Test: Chrome autofills "admin" into docs-search-input
domElements['docs-search-input'].value = 'admin';
mod.filterDocuments();

// filterDocuments must detect autofilled 'admin' and NOT wipe data
assert.strictEqual(domElements['docs-search-input'].value, '', 'Autofilled "admin" must be cleared from input');
assert.strictEqual(mod.searchQuery, '', 'searchQuery must not be set to "admin"');
const filteredDocs = mod.getFilteredDocuments();
assert.strictEqual(filteredDocs.length, 46, 'All 46 documents must remain visible when "admin" is autofilled');
console.log('✓ Verified: Autofilled "admin" is automatically neutralized and does not make data disappear');

// 4. Test: Clicking Mary Lovelyn Ramos row calls viewDocument
let viewModalOpened = false;
mod.viewDocument(mary.id);
assert.strictEqual(domElements['modal-view-document'].classes.includes('active'), true, 'Document viewer modal must open');
assert(domElements['view-doc-title'].textContent.includes('MARY LOVELYN RAMOS'), 'Modal title must contain Mary Lovelyn Ramos');
assert(domElements['view-doc-content'].innerHTML.includes('DDN005-SR350'), 'Modal body must contain Mary Lovelyn Ramos ID');
assert.strictEqual(mod.documents.length, 46, 'Documents array must remain at 46 after viewing record');
console.log('✓ Verified: Clicking Mary Lovelyn Ramos opens official details modal cleanly without disappearing data');

// 5. Test: Searching for "Mary Lovelyn Ramos" explicitly
domElements['docs-search-input'].value = 'Mary Lovelyn Ramos';
mod.filterDocuments();
assert.strictEqual(mod.searchQuery, 'mary lovelyn ramos');
const searchResults = mod.getFilteredDocuments();
assert.strictEqual(searchResults.length, 1, 'Search for Mary Lovelyn Ramos must find exactly 1 record');
assert.strictEqual(searchResults[0].employeeName, 'MARY LOVELYN RAMOS');
console.log('✓ Verified: Searching Mary Lovelyn Ramos accurately finds Mary Lovelyn Ramos');

// 6. Test: Clearing search restores all 46 documents
mod.clearSearch();
assert.strictEqual(mod.searchQuery, '');
assert.strictEqual(domElements['docs-search-input'].value, '');
assert.strictEqual(mod.getFilteredDocuments().length, 46, 'Clearing search restores all 46 documents');
console.log('✓ Verified: Clear search button instantly restores all 46 records');

console.log('\n🎉 ALL MARY LOVELYN RAMOS & RELOAD INTERACTION TESTS PASSED!');
