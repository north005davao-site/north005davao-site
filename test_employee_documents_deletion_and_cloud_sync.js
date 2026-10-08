/**
 * Test Suite: Employee Documents Deletion Persistence & Zero-Fallback Cloud Sync
 * Verifies:
 * 1. Deleting documents (e.g. 3-5 sales reps) properly deletes from memory, IndexedDB, localStorage.
 * 2. On browser refresh / page reload, deleted records DO NOT fall back or resurrect.
 * 3. syncWithCloud() does NOT restore deleted records from static seeds or server cache.
 * 4. Cross-device sync: Deletion propagates across devices via tombstoning and realtime events.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== RUNNING EMPLOYEE DOCUMENTS DELETION & ZERO-FALLBACK SYNC TEST ===\n');

// Mock localStorage
const localStorageStore = {};
global.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

// Mock DOM elements
const domElements = {};
function getMockEl(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById: (id) => getMockEl(id),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  addEventListener: () => {},
  confirm: () => true,
  authManager: {
    isAdmin: () => true
  },
  toast: { info: (msg) => console.log('  [Toast]:', msg) }
};

// Mock Master Registry Store
require('./js/store.js');

// Mock initial data seeded
const sampleDocs = [
  {
    id: 'DOC-DDN005-SR778-CBTA-001',
    employeeId: 'DDN005-SR778',
    employeeName: 'LEA GRACE PROGE',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete'
  },
  {
    id: 'DOC-DDN005-SR779-CBTA-002',
    employeeId: 'DDN005-SR779',
    employeeName: 'JESSEL B. PABAYO',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete'
  },
  {
    id: 'DOC-DDN005-SR780-CBTA-003',
    employeeId: 'DDN005-SR780',
    employeeName: 'AZENITH B. TUASOC',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete'
  },
  {
    id: 'DOC-DDN005-SR774-CBTA-004',
    employeeId: 'DDN005-SR774',
    employeeName: 'RADIN MAYAKI WENG',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete'
  },
  {
    id: 'DOC-DDN005-SR1778-CBTA-005',
    employeeId: 'DDN005-SR1778',
    employeeName: 'MARY JOELINE SANICO RAMO',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete'
  }
];

// Seed initial localStorage
localStorage.setItem('north005_employee_documents_v6', JSON.stringify(sampleDocs));

const deletedFromSupabase = [];
window.supabaseSync = {
  fetchEmployeeDocuments: async () => sampleDocs, // Supabase still has all 5 initially
  syncEmployeeDocument: async () => true,
  deleteEmployeeDocument: async (id) => {
    deletedFromSupabase.push(id);
    return true;
  }
};

const serverDeletedIds = [];
global.fetch = async (url, options = {}) => {
  if (url.includes('/api/employee-documents')) {
    if (options.method === 'DELETE') {
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) serverDeletedIds.push(decodeURIComponent(idMatch[1]));
      return { ok: true, json: async () => ({ success: true }) };
    }
    // Return sample docs
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ documents: sampleDocs, deletedDocIds: serverDeletedIds })
    };
  }
  if (url.includes('/data/employee_documents.json')) {
    return {
      ok: true,
      json: async () => ({ documents: sampleDocs })
    };
  }
  return { ok: false };
};

// Load employee-documents module
require('./js/employee-documents.js');
const moduleInstance = window.employeeDocumentsModule;

async function runAcceptanceTest() {
  console.log('--- Step 1: Initial State ---');
  console.log('Initial document count:', moduleInstance.documents.length);
  assert.strictEqual(moduleInstance.documents.length, 5, 'Should have 5 initial documents');

  console.log('\n--- Step 2: Delete 3 Sales Reps ---');
  // Delete Lea Grace Proge, Jessel Pabayo, and Azenith Tuasoc
  await moduleInstance.deleteDocument('DOC-DDN005-SR778-CBTA-001');
  await moduleInstance.deleteDocument('DOC-DDN005-SR779-CBTA-002');
  await moduleInstance.deleteDocument('DOC-DDN005-SR780-CBTA-003');

  console.log('Document count immediately after deletion:', moduleInstance.documents.length);
  const uniqueDeletedFromSupabase = Array.from(new Set(deletedFromSupabase));
  assert.strictEqual(uniqueDeletedFromSupabase.length, 3, 'Should have triggered Supabase delete for all 3 docs');
  assert.strictEqual(uniqueDeletedFromSupabase.includes('DOC-DDN005-SR778-CBTA-001'), true);
  assert.strictEqual(uniqueDeletedFromSupabase.includes('DOC-DDN005-SR779-CBTA-002'), true);
  assert.strictEqual(uniqueDeletedFromSupabase.includes('DOC-DDN005-SR780-CBTA-003'), true);
  assert.strictEqual(serverDeletedIds.length, 3, 'Should have triggered server delete for all 3 docs');

  // Verify deletedDocIds in localStorage
  const tombstoneRaw = localStorage.getItem('north005_deleted_employee_doc_ids_v2');
  assert.notStrictEqual(tombstoneRaw, null, 'Tombstone list must exist in localStorage');
  const tombstones = JSON.parse(tombstoneRaw);
  assert.strictEqual(tombstones.includes('DOC-DDN005-SR778-CBTA-001'), true);
  assert.strictEqual(tombstones.includes('DOC-DDN005-SR779-CBTA-002'), true);
  assert.strictEqual(tombstones.includes('DOC-DDN005-SR780-CBTA-003'), true);
  console.log('✓ Tombstones verified in persistent storage:', tombstones);

  console.log('\n--- Step 3: Simulate Browser Refresh / Reload ---');
  // Re-instantiate the module simulating a brand new browser tab/refresh
  const freshLoadedDocs = moduleInstance.loadDocuments();
  console.log('Document count loaded from storage after refresh:', freshLoadedDocs.length);
  assert.strictEqual(freshLoadedDocs.length, 2, 'Must NOT resurrect deleted records on refresh!');
  assert.strictEqual(freshLoadedDocs.some(d => d.id === 'DOC-DDN005-SR778-CBTA-001'), false);
  console.log('✓ Confirmed: Deleted records DO NOT fall back on browser refresh');

  console.log('\n--- Step 4: Simulate Cloud Syncing (Background & Manual Sync Cloud Button) ---');
  await moduleInstance.syncWithCloud(false);
  console.log('Document count after full cloud sync:', moduleInstance.documents.length);
  assert.strictEqual(moduleInstance.documents.length, 2, 'Cloud sync MUST NOT resurrect tombstoned records!');
  assert.strictEqual(moduleInstance.documents.some(d => d.id === 'DOC-DDN005-SR778-CBTA-001'), false);
  assert.strictEqual(moduleInstance.documents.some(d => d.id === 'DOC-DDN005-SR779-CBTA-002'), false);
  assert.strictEqual(moduleInstance.documents.some(d => d.id === 'DOC-DDN005-SR780-CBTA-003'), false);
  console.log('✓ Confirmed: Cloud sync strictly excludes tombstoned records and prevents fallback');

  console.log('\n--- Step 5: Simulate Realtime DELETE Event on Mobile Device ---');
  // Suppose mobile has doc 4 and receives realtime delete from desktop
  moduleInstance.handleRealtimeUpdate({
    eventType: 'DELETE',
    old: { id: 'DOC-DDN005-SR774-CBTA-004' }
  });
  console.log('Document count on mobile after realtime delete event:', moduleInstance.documents.length);
  assert.strictEqual(moduleInstance.documents.length, 1, 'Should have 1 document remaining after realtime delete');
  assert.strictEqual(moduleInstance.documents[0].id, 'DOC-DDN005-SR1778-CBTA-005');
  console.log('✓ Confirmed: Realtime deletion event propagated instantly without refresh');

  console.log('\n======================================================');
  console.log('🎉 DELETION PERSISTENCE & ZERO-FALLBACK TEST PASSED! 🚀');
  console.log('======================================================\n');
}

runAcceptanceTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
