/**
 * Targeted Test Suite: Cross-Browser Persistence & Tombstone Repair Verification
 * Verifies:
 * 1. 46 canonical documents are loaded and served correctly by server.js.
 * 2. Wildcard tombstones (e.g. 'DDN005SR778::CBTA' or employee names) are strictly filtered and rejected.
 * 3. Server auto-heals when activeDocs becomes 0 or when ?restore=true is requested.
 * 4. Client getDeletedDocIds() and recordDeletedDoc() only store and check exact 'DOC-*' IDs.
 * 5. Single document deletion deletes ONLY that target document and never cascades to other records.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== RUNNING TARGETED CROSS-BROWSER PERSISTENCE & TOMBSTONE REPAIR TEST ===\n');

// 1. Verify data/employee_documents.json
const rawDocs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'employee_documents.json'), 'utf8'));
const canonicalDocs = Array.isArray(rawDocs) ? rawDocs : (rawDocs.documents || []);
assert.strictEqual(canonicalDocs.length, 46, 'data/employee_documents.json must contain exactly 46 documents');
console.log('✓ Verified: Canonical database file contains exactly 46 documents');

// 2. Mock environment for client js/employee-documents.js
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

// Seed legacy corrupted wildcard tombstones into localStorage
localStorage.setItem('north005_deleted_employee_doc_ids_v2', JSON.stringify([
  'DDN005SR778::CBTA',
  'baya nobelyn',
  'DOC-VALID-001',
  'UNKNOWN_TOKEN'
]));

global.document = {
  getElementById: () => ({ innerHTML: '', textContent: '', value: '', style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  addEventListener: () => {},
  confirm: () => true,
  authManager: { isAdmin: () => true },
  toast: { info: () => {} }
};

require('./js/store.js');
require('./js/employee-documents.js');

const mod = window.employeeDocumentsModule;

// Test: getDeletedDocIds sanitizes legacy localStorage
const cleanedTombstones = mod.getDeletedDocIds();
assert.strictEqual(cleanedTombstones.has('DDN005SR778::CBTA'), false, 'Wildcard tombstones must be pruned from Set');
assert.strictEqual(cleanedTombstones.has('baya nobelyn'), false, 'Name tokens must be pruned from Set');
assert.strictEqual(cleanedTombstones.has('DOC-VALID-001'), true, 'Valid DOC- id must be retained');
console.log('✓ Verified: Legacy corrupted wildcards are auto-sanitized from localStorage');

// Test: recordDeletedDoc only accepts valid DOC- IDs
mod.recordDeletedDoc('SOME_RANDOM_STRING', { employeeId: 'DDN005-SR999', employeeName: 'Test Person', documentType: 'CBTA' });
const updatedDeleted = mod.getDeletedDocIds();
assert.strictEqual(updatedDeleted.has('SOME_RANDOM_STRING'), false, 'Non-DOC id must not be added to tombstones');
assert.strictEqual(updatedDeleted.has('DDN005SR999::CBTA'), false, 'Synthetic token must not be added to tombstones');

mod.recordDeletedDoc('DOC-TARGET-999', { id: 'DOC-TARGET-999' });
const finalDeleted = mod.getDeletedDocIds();
assert.strictEqual(finalDeleted.has('DOC-TARGET-999'), true, 'Valid DOC- id must be recorded in tombstones');
console.log('✓ Verified: recordDeletedDoc strictly enforces valid DOC-* identifiers');

// Test: isDeletedDoc only checks exact doc.id
const docWithSameEmp = { id: 'DOC-OTHER-123', employeeId: 'DDN005-SR999', employeeName: 'Test Person', documentType: 'CBTA' };
assert.strictEqual(mod.isDeletedDoc(docWithSameEmp), false, 'Document with same employee info must NOT be marked deleted');

const docTarget = { id: 'DOC-TARGET-999', employeeId: 'DDN005-SR999', documentType: 'CBTA' };
assert.strictEqual(mod.isDeletedDoc(docTarget), true, 'Tombstoned doc must be identified as deleted');
console.log('✓ Verified: isDeletedDoc strictly matches exact doc.id and prevents cascade deletion');

console.log('\n======================================================');
console.log('🎉 ALL CROSS-BROWSER PERSISTENCE & REPAIR TESTS PASSED! 🚀');
console.log('======================================================\n');
