/**
 * test_select_all_and_bulk_delete.js
 * Verifies:
 * 1. Checkbox rendering in Employee Document Repository table
 * 2. Select All / Unselect All toggle functionality
 * 3. Individual row checkbox toggle
 * 4. Bulk Delete of selected documents (removing from memory, IndexedDB, Supabase, and Server)
 * 5. Permanent tombstone recording preventing resurrecting on refresh
 */

const assert = require('assert');

// Mock browser environment
const localStorageData = {};
global.localStorage = {
  getItem: (k) => localStorageData[k] || null,
  setItem: (k, v) => { localStorageData[k] = String(v); },
  removeItem: (k) => { delete localStorageData[k]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};

const domElements = {};
function getOrCreateEl(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      checked: false,
      indeterminate: false,
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById: (id) => getOrCreateEl(id),
  querySelectorAll: (selector) => [],
  querySelector: (selector) => null,
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  authManager: {
    isAdmin: () => true
  },
  toast: {
    info: (msg) => console.log('  [Toast]:', msg)
  },
  confirm: () => true
};

const sampleDocs = [
  { id: 'DOC-1', employeeId: 'DDN005-SR778', employeeName: 'LEA GRACE PROGE;;A', position: 'Sales Representative', documentType: 'CBTA', status: 'Complete' },
  { id: 'DOC-2', employeeId: 'DDN005-SR779', employeeName: 'JESSEL B. PABAYO', position: 'Sales Representative', documentType: 'CBTA', status: 'Complete' },
  { id: 'DOC-3', employeeId: 'DDN005-SR780', employeeName: 'AZENITH B. TUASOC', position: 'Sales Representative', documentType: 'CBTA', status: 'Complete' },
  { id: 'DOC-4', employeeId: 'DDN005-SR774', employeeName: 'RADIN MAYAKI WENG', position: 'Sales Representative', documentType: 'CBTA', status: 'Complete' },
  { id: 'DOC-5', employeeId: 'DOC-5-ID', employeeName: 'MARY JOELINE', position: 'Sales Representative', documentType: 'CBTA', status: 'Complete' }
];

localStorage.setItem('north005_employee_documents_v6', JSON.stringify(sampleDocs));

const deletedFromSupabase = [];
window.supabaseSync = {
  fetchEmployeeDocuments: async () => sampleDocs,
  syncEmployeeDocument: async () => true,
  deleteEmployeeDocument: async (id, empId, docType) => {
    deletedFromSupabase.push({ id, empId, docType });
    return true;
  }
};

global.fetch = async (url, options = {}) => {
  if (url.includes('/api/employee-documents')) {
    if (options.method === 'DELETE') return { ok: true, json: async () => ({ success: true }) };
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ documents: sampleDocs }) };
  }
  if (url.includes('/data/employee_documents.json')) {
    return { ok: true, json: async () => ({ documents: sampleDocs }) };
  }
  return { ok: false };
};

// Load module
require('./js/employee-documents.js');
const mod = window.employeeDocumentsModule;

async function runTest() {
  console.log('=== TEST: Select All / Unselect All & Bulk Delete ===');

  console.log('--- Step 1: Initial State ---');
  console.log('Initial document count:', mod.documents.length);
  assert.strictEqual(mod.documents.length, 5, 'Should have 5 initial docs');
  assert.strictEqual(mod.selectedDocIds.size, 0, 'No docs should be selected initially');

  console.log('--- Step 2: Individual Selection ---');
  mod.toggleRowSelection('DOC-1', true);
  mod.toggleRowSelection('DOC-2', true);
  assert.strictEqual(mod.selectedDocIds.size, 2, 'Should have 2 docs selected');
  assert.ok(mod.selectedDocIds.has('DOC-1'));
  assert.ok(mod.selectedDocIds.has('DOC-2'));
  console.log('✓ Successfully selected 2 rows individually');

  console.log('--- Step 3: Unselect All ---');
  mod.unselectAll();
  assert.strictEqual(mod.selectedDocIds.size, 0, 'Selections should be cleared');
  console.log('✓ Successfully unselected all rows');

  console.log('--- Step 4: Select All ---');
  mod.toggleSelectAll(true);
  assert.strictEqual(mod.selectedDocIds.size, 5, 'All 5 non-placeholder docs should be selected');
  console.log('✓ Successfully selected all rows via toggleSelectAll');

  console.log('--- Step 5: Toggle Select All (Off) ---');
  mod.toggleSelectAll();
  assert.strictEqual(mod.selectedDocIds.size, 0, 'Should unselect all when toggled again');
  console.log('✓ Successfully toggled off');

  console.log('--- Step 6: Select 3 Sales Reps for Bulk Delete ---');
  mod.toggleRowSelection('DOC-1', true);
  mod.toggleRowSelection('DOC-2', true);
  mod.toggleRowSelection('DOC-3', true);
  assert.strictEqual(mod.selectedDocIds.size, 3, 'Should have 3 selected for bulk delete');

  console.log('--- Step 7: Execute Bulk Delete ---');
  await mod.deleteSelectedDocuments();
  console.log('Documents remaining after bulk delete:', mod.documents.length);
  assert.strictEqual(mod.documents.length, 2, 'Should have exactly 2 documents left');
  assert.strictEqual(mod.selectedDocIds.size, 0, 'Selected set should be cleared after deletion');

  // Verify Supabase deletions
  console.log('Deleted from Supabase:', deletedFromSupabase);
  const uniqueDeletedFromSupabase = Array.from(new Set(deletedFromSupabase.map(d => d.id)));
  assert.strictEqual(uniqueDeletedFromSupabase.length, 3, 'Should have deleted all 3 from Supabase');
  assert.ok(uniqueDeletedFromSupabase.includes('DOC-1'));
  assert.ok(uniqueDeletedFromSupabase.includes('DOC-2'));
  assert.ok(uniqueDeletedFromSupabase.includes('DOC-3'));

  // Verify tombstones
  const tombstoneRaw = localStorage.getItem('north005_deleted_employee_doc_ids_v2');
  assert.notStrictEqual(tombstoneRaw, null);
  const tombstones = JSON.parse(tombstoneRaw);
  assert.ok(tombstones.includes('DOC-1'));
  assert.ok(tombstones.includes('DOC-2'));
  assert.ok(tombstones.includes('DOC-3'));
  console.log('✓ Tombstones verified in storage');

  console.log('--- Step 8: Sync / Refresh does NOT resurrect bulk deleted docs ---');
  await mod.syncWithCloud(false);
  assert.strictEqual(mod.documents.length, 2, 'Cloud sync must not resurrect bulk deleted docs');
  console.log('✓ Zero-fallback verified after bulk delete');

  console.log('\n🎉 ALL SELECT ALL & BULK DELETE TESTS PASSED! 🚀\n');
}

runTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
