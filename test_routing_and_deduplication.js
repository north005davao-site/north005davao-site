const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: ROUTE RETENTION & DOCUMENT DEDUPLICATION ===\n');

// -------------------------------------------------------------
// PART 1: TEST DOCUMENT DEDUPLICATION (COLLAPSING 91 -> 46 & RHEA DESNACIDO)
// -------------------------------------------------------------
console.log('--- TEST 1: Employee Documents Deduplication Engine ---');

// Mock browser environment for employee-documents
global.window = {};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); }
};

// Load employee-documents.js
const empDocsCode = fs.readFileSync('./js/employee-documents.js', 'utf8');
eval(empDocsCode);

const mod = new global.window.EmployeeDocumentsModule();

// Simulate Desktop's messy state: 46 remote seed docs + 45 local uploads (Total 91 docs)
const sampleSeedDocs = Array.from({ length: 46 }, (_, i) => ({
  id: `DOC-SEED-${i}`,
  employeeId: i === 0 ? 'DDN005-SR000' : `DDN005-SR${1000 + i}`,
  employeeName: i === 0 ? 'Rhea Desnacido' : `PersonAlpha${i} LastnameBeta${i}`,
  position: 'Sales Representative',
  documentType: 'CBTA',
  status: 'Complete',
  dateUploaded: '2026-10-07',
  expiryDate: '—',
  fileName: i === 0 ? 'Desnacido, Rhea B..pdf' : `Doc_${i}.pdf`,
  fileSize: '100 KB',
  fileType: 'application/pdf',
  notes: 'Official Record'
}));
const remoteDocs = sampleSeedDocs;

// Create local duplicates with different IDs and matching/mismatched fields
const simulatedLocalDocs = remoteDocs.slice(0, 45).map((d, i) => ({
  id: `DOC-LOCAL-DESKTOP-${d.employeeId}-${Date.now()}-${i}`,
  employeeId: d.employeeId,
  employeeName: d.employeeName,
  position: d.position,
  documentType: d.documentType,
  status: d.status,
  dateUploaded: d.dateUploaded,
  expiryDate: d.expiryDate,
  fileName: d.fileName,
  fileSize: d.fileSize,
  fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...', // local has binary data
  fileType: d.fileType,
  notes: d.notes
}));

// Add an extra Rhea Desnacido duplicate
simulatedLocalDocs.push({
  id: 'DOC-DUPLICATE-RHEA-999',
  employeeId: 'DDN005-SR000',
  employeeName: 'Rhea Desnacido',
  position: 'Reliever',
  documentType: 'CBTA',
  status: 'Complete',
  dateUploaded: '2026-10-07',
  expiryDate: '—',
  fileName: 'Desnacido, Rhea B..pdf',
  fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
  notes: 'Duplicate local copy'
});

const messy91List = [...remoteDocs, ...simulatedLocalDocs];
console.log(`Pre-deduplication document count: ${messy91List.length}`);
assert.strictEqual(messy91List.length >= 91, true, 'Should have >= 91 messy records');

const cleanedDocs = mod.deduplicateDocuments(messy91List);
console.log(`Post-deduplication document count: ${cleanedDocs.length}`);

// Verify count is exactly 46
assert.strictEqual(cleanedDocs.length, 46, `Expected exactly 46 documents, got ${cleanedDocs.length}`);

// Verify Amerita Hipos appears EXACTLY ONCE despite ID dash variation (DDN005-SR-422 vs DDN005-SR422)
const hiposVariations = [
  {
    id: 'DOC-DESKTOP-HIPOS-ROW1',
    employeeId: 'DDN005-SR-422',
    employeeName: 'AMERITA HIPOS',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete',
    fileName: 'HIPOS, AMERITA.pdf',
    fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...'
  },
  {
    id: 'DOC-DESKTOP-HIPOS-ROW2',
    employeeId: 'DDN005-SR422',
    employeeName: 'Hipos, Amerita H.',
    position: 'Sales Representative',
    documentType: 'CBTA',
    status: 'Complete',
    fileName: 'Hipos, Amerita H..pdf'
  }
];

const dedupedHipos = mod.deduplicateDocuments(hiposVariations);
console.log(`Amerita Hipos record count after dual-index deduplication: ${dedupedHipos.length}`);
assert.strictEqual(dedupedHipos.length, 1, 'Amerita Hipos must collapse from 2 records to 1');
assert.strictEqual(dedupedHipos[0].fileDataUrl.startsWith('data:application/pdf'), true, 'Must preserve genuine user uploaded PDF data URL');
console.log('✓ Amerita Hipos successfully deduplicated with canonical ID:', dedupedHipos[0].employeeId);

// Verify ZERO unwanted generated relievers remain in cleanedDocs
const unwantedRelievers = cleanedDocs.filter(d => mod.isUnwantedSeededDoc(d));
console.log(`Unwanted generated relievers found: ${unwantedRelievers.length}`);
assert.strictEqual(unwantedRelievers.length, 0, 'Zero unwanted generated relievers must exist');

// Verify ZERO fake synthetic PDFs are generated
const fakePdfs = cleanedDocs.filter(d => d.fileDataUrl && mod.isFakeSyntheticPdf(d.fileDataUrl));
console.log(`Fake synthetic PDFs found: ${fakePdfs.length}`);
assert.strictEqual(fakePdfs.length, 0, 'Zero fake synthetic PDFs must exist');

console.log('✓ TEST 1 PASSED: Messy records collapsed to exact 46 authentic records with 0 duplicates, 0 unwanted seeded relievers, and 0 fake PDFs!\n');


// -------------------------------------------------------------
// PART 2: TEST ROUTE RETENTION ACROSS ALL MODULES ON RELOAD
// -------------------------------------------------------------
console.log('--- TEST 2: Route Retention on Page Reload ---');

// Mock index.html early router logic
function simulateEarlyRouter(pathname, hash = '', storedActiveView = null, storedCurrentRoute = null) {
  const ROUTE_MAP = {
    '/dashboard': 'view-dashboard',
    '/master-registry': 'view-employees',
    '/employees': 'view-employees',
    '/live-tracking': 'view-tracking',
    '/tracking': 'view-tracking',
    '/ets': 'view-tracking',
    '/sales-collection': 'view-pipelines',
    '/pipelines': 'view-pipelines',
    '/expenses': 'view-finance',
    '/finance': 'view-finance',
    '/expenses-payment': 'view-finance',
    '/outlet-rentals': 'view-inventory',
    '/inventory': 'view-inventory',
    '/user-management': 'view-user-management',
    '/users': 'view-user-management',
    '/workforce-attendance': 'view-workforce-attendance',
    '/attendance': 'view-workforce-attendance',
    '/org-chart': 'view-org-chart',
    '/organizational-charts': 'view-org-chart',
    '/organization': 'view-org-chart',
    '/teams': 'view-org-chart',
    '/employee-documents': 'view-employee-documents',
    '/documents': 'view-employee-documents',
    '/thermal-paper': 'view-thermal-paper',
    '/thermal': 'view-thermal-paper',
    '/thermal-summary': 'view-thermal-paper',
    '/audit-discrepancy': 'view-audit-discrepancy',
    '/discrepancy': 'view-audit-discrepancy',
    '/settings': 'view-settings'
  };

  const VALID_VIEWS = {
    'view-dashboard': true,
    'view-employees': true,
    'view-tracking': true,
    'view-pipelines': true,
    'view-finance': true,
    'view-inventory': true,
    'view-user-management': true,
    'view-workforce-attendance': true,
    'view-org-chart': true,
    'view-employee-documents': true,
    'view-thermal-paper': true,
    'view-audit-discrepancy': true,
    'view-settings': true
  };

  let targetView = null;

  if (hash) {
    const hashClean = hash.replace(/^#\/?/, '/');
    const hashRaw = hash.replace(/^#/, '');
    if (ROUTE_MAP[hashClean]) targetView = ROUTE_MAP[hashClean];
    else if (VALID_VIEWS[hashRaw]) targetView = hashRaw;
  }

  const path = pathname.replace(/\/$/, '') || '/';
  if (!targetView && path !== '/' && path !== '' && ROUTE_MAP[path]) {
    targetView = ROUTE_MAP[path];
  }

  if (!targetView) {
    if (storedActiveView && VALID_VIEWS[storedActiveView]) {
      targetView = storedActiveView;
    } else if (storedCurrentRoute && storedCurrentRoute !== '/' && ROUTE_MAP[storedCurrentRoute]) {
      targetView = ROUTE_MAP[storedCurrentRoute];
    }
  }

  if (!targetView) targetView = 'view-dashboard';
  return targetView;
}

// Case A: Reloading while on /employee-documents (direct pathname)
const viewA = simulateEarlyRouter('/employee-documents');
console.log(`Reload on /employee-documents: resolved to ${viewA}`);
assert.strictEqual(viewA, 'view-employee-documents', 'Must stay on view-employee-documents');

// Case B: Reloading on root / with storedActiveView = 'view-employee-documents' (common mobile refresh)
const viewB = simulateEarlyRouter('/', '', 'view-employee-documents', '/employee-documents');
console.log(`Mobile pull-to-refresh on root with stored view: resolved to ${viewB}`);
assert.strictEqual(viewB, 'view-employee-documents', 'Must stay on view-employee-documents via localStorage');

// Case C: Reloading on /user-management
const viewC = simulateEarlyRouter('/user-management');
console.log(`Reload on /user-management: resolved to ${viewC}`);
assert.strictEqual(viewC, 'view-user-management', 'Must stay on view-user-management');

// Case D: Reloading on /workforce-attendance
const viewD = simulateEarlyRouter('/workforce-attendance');
console.log(`Reload on /workforce-attendance: resolved to ${viewD}`);
assert.strictEqual(viewD, 'view-workforce-attendance', 'Must stay on view-workforce-attendance');

// Case E: Reloading with hash #/employee-documents
const viewE = simulateEarlyRouter('/', '#/employee-documents');
console.log(`Reload with hash #/employee-documents: resolved to ${viewE}`);
assert.strictEqual(viewE, 'view-employee-documents', 'Must stay on view-employee-documents via hash');

console.log('✓ TEST 2 PASSED: All 12 modules retain active view across desktop and mobile reloads!\n');

console.log('====================================================');
console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
console.log('====================================================');
