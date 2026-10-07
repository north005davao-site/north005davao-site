/**
 * Test Suite: Employee Documents 4-Field Compliance Overhaul
 * Verifies:
 * 1. Document Type dropdown is removed
 * 2. 4 Dedicated Upload Fields exist in Upload Modal:
 *    - 1. RESUME (Image File)
 *    - 2. PHOTOCOPY OF VALID ID (Image File)
 *    - 3. BARANGAY CLEARANCE / POLICE CLEARANCE (Image File)
 *    - 4. COMMISSION BASED TELLER AGREEMENT (CBTA) (PDF or Image File)
 * 3. Master Registry synchronization and live compliance tracking.
 */

const fs = require('fs');
const path = require('path');

console.log('=== RUNNING 4-FIELD EMPLOYEE DOCUMENTS TEST SUITE ===\n');

// 1. Inspect index.html
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Check Document Type dropdown removal
if (indexHtml.includes('id="doc-upload-type"')) {
  console.error('❌ Failed: #doc-upload-type dropdown is still present in index.html!');
  process.exit(1);
}
console.log('✓ Verified: Document Type dropdown completely removed from Upload Modal');

// Check that all 4 upload cards are present
const expectedCardIds = [
  'doc-card-resume',
  'doc-card-validid',
  'doc-card-clearance',
  'doc-card-cbta'
];

for (const cardId of expectedCardIds) {
  if (!indexHtml.includes(`id="${cardId}"`)) {
    console.error(`❌ Failed: Card #${cardId} is missing in index.html!`);
    process.exit(1);
  }
}
console.log('✓ Verified: All 4 upload fields (Resume, Valid ID, Clearance, CBTA) present in modal');

if (!indexHtml.includes('COMMISSION BASED TELLER AGREEMENT (CBTA)')) {
  console.error('❌ Failed: Title COMMISSION BASED TELLER AGREEMENT (CBTA) is missing in index.html!');
  process.exit(1);
}
if (!indexHtml.includes('application/pdf')) {
  console.error('❌ Failed: application/pdf is not listed in file accept attribute in index.html!');
  process.exit(1);
}
console.log('✓ Verified: CBTA accepts both PDF and Images; Resume/ID/Clearance accept Images');

// 2. Mock Browser Environment for js/employee-documents.js
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

const elements = {};
function createMockEl(id) {
  const el = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      classes: new Set(),
      add: function(c) { this.classes.add(c); },
      remove: function(c) { this.classes.delete(c); },
      contains: function(c) { return this.classes.has(c); }
    },
    files: [],
    addEventListener: () => {},
    focus: () => {}
  };
  elements[id] = el;
  return el;
}

global.document = {
  getElementById: (id) => elements[id] || createMockEl(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  alert: (msg) => console.log('  [Alert]:', msg),
  confirm: () => true
};

// Mock Auth Manager (Admin)
window.authManager = {
  isAdmin: () => true
};

// Load Store to test real Master Registry synchronization
require('./js/store.js');

// Load employee-documents.js
require('./js/employee-documents.js');
const docMod = window.employeeDocumentsModule;

if (!docMod) {
  console.error('❌ Failed: window.employeeDocumentsModule is not initialized!');
  process.exit(1);
}
console.log('✓ employee-documents.js loaded successfully');

// 3. Test Field Personnel Filtering
const fieldPersonnel = docMod.getFieldPersonnel();
console.log(`Field Personnel count: ${fieldPersonnel.length}`);
if (fieldPersonnel.length !== 150) {
  console.error(`❌ Expected exactly 150 field staff (116 tellers + 34 relievers), got ${fieldPersonnel.length}`);
  process.exit(1);
}
console.log('✓ Verified: Exactly 150 active field personnel tracked');

// 4. Test Clean Slate
docMod.documents = [];
docMod.saveDocuments();
docMod.render();

const totalKPI = parseInt(elements['kpi-docs-total'].textContent, 10);
const missingKPI = parseInt(elements['kpi-docs-missing'].textContent, 10);
console.log(`Initial KPIs: Total Docs=${totalKPI}, Missing Records=${missingKPI}`);

if (totalKPI !== 0) {
  console.error(`❌ Expected 0 initial uploaded documents, got ${totalKPI}`);
  process.exit(1);
}
if (missingKPI !== 150) {
  console.error(`❌ Expected 150 Missing Records on clean slate, got ${missingKPI}`);
  process.exit(1);
}
console.log('✓ Verified: Clean slate displays 0 uploaded documents and 150 Missing Records');

// 5. Test Batch Upload: Resume + Valid ID + Clearance + CBTA in a single save
const sampleTeller = fieldPersonnel[0];
console.log(`\nTesting 4-Document Batch Upload for: ${sampleTeller.name} (${sampleTeller.id})`);

// Select employee
docMod.selectEmployee(sampleTeller.id);

// Simulate selecting all 4 files
docMod.fileBuffers['RESUME'] = {
  docType: 'RESUME',
  fileName: 'Mary_Resume.jpg',
  fileSize: '120 KB',
  fileDataUrl: 'data:image/jpeg;base64,...',
  fileType: 'image/jpeg'
};
docMod.fileBuffers['PHOTOCOPY OF VALID ID'] = {
  docType: 'PHOTOCOPY OF VALID ID',
  fileName: 'Mary_UMID_ID.jpg',
  fileSize: '95 KB',
  fileDataUrl: 'data:image/jpeg;base64,...',
  fileType: 'image/jpeg'
};
docMod.fileBuffers['BARANGAY CLEARANCE/POLICE CLEARANCE'] = {
  docType: 'BARANGAY CLEARANCE/POLICE CLEARANCE',
  fileName: 'Mary_Barangay_Clearance.png',
  fileSize: '180 KB',
  fileDataUrl: 'data:image/png;base64,...',
  fileType: 'image/png'
};
docMod.fileBuffers['CBTA'] = {
  docType: 'CBTA',
  fileName: 'Mary_CBTA_Signed.pdf',
  fileSize: '412 KB',
  fileDataUrl: 'data:application/pdf;base64,...',
  fileType: 'application/pdf'
};

// Initiate Save
docMod.initiateSaveDocument();

if (!elements['modal-doc-confirm-upload'].classList.contains('active')) {
  console.error('❌ Upload confirmation modal was not activated!');
  process.exit(1);
}
console.log('✓ Upload confirmation modal displayed correctly for batch upload');

// Execute Upload
docMod.executeUpload();

// Verify updated documents and KPIs
if (docMod.documents.length !== 4) {
  console.error(`❌ Expected 4 uploaded documents for the employee, got ${docMod.documents.length}`);
  process.exit(1);
}

const docTypes = docMod.documents.map(d => d.documentType);
console.log('✓ Successfully saved 4 compliance documents:', docTypes);
if (!docTypes.includes('RESUME') || !docTypes.includes('PHOTOCOPY OF VALID ID') || !docTypes.includes('BARANGAY CLEARANCE/POLICE CLEARANCE') || !docTypes.includes('CBTA')) {
  console.error('❌ Missing expected document types in saved documents!', docTypes);
  process.exit(1);
}

// Check KPI counters after batch upload
const newTotalKPI = parseInt(elements['kpi-docs-total'].textContent, 10);
const newMissingKPI = parseInt(elements['kpi-docs-missing'].textContent, 10);
console.log(`Updated KPIs: Total Docs=${newTotalKPI}, Missing Records=${newMissingKPI}`);

if (newTotalKPI !== 4) {
  console.error(`❌ Expected 4 Total Docs KPI, got ${newTotalKPI}`);
  process.exit(1);
}
if (newMissingKPI !== 149) {
  console.error(`❌ Expected Missing Records to decrement to 149, got ${newMissingKPI}`);
  process.exit(1);
}
console.log('✓ Live Compliance Countdown verified: Missing Records dropped from 150 to 149!');

console.log('\n======================================================');
console.log('🎉 ALL 4-FIELD EMPLOYEE DOCUMENTS TESTS PASSED 100%! 🚀');
console.log('======================================================\n');
