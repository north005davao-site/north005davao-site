/**
 * Test Suite: Employee Documents CBTA Overhaul
 * Verifies removal of Document Type dropdown and legacy fields,
 * dedicated CBTA upload field, PDF & image support, and Master Registry Missing CBTA tracking.
 */

const fs = require('fs');
const path = require('path');

console.log('=== RUNNING CBTA EMPLOYEE DOCUMENTS TEST SUITE ===\n');

// 1. Inspect index.html
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Check Document Type dropdown removal
if (indexHtml.includes('id="doc-upload-type"')) {
  console.error('❌ Failed: #doc-upload-type is still present in index.html!');
  process.exit(1);
}
console.log('✓ Verified: Document Type dropdown completely removed from Upload Modal');

// Check legacy fields removal
const legacyCardIds = ['doc-card-resume', 'doc-card-validid', 'doc-card-clearance'];
for (const cardId of legacyCardIds) {
  if (indexHtml.includes(`id="${cardId}"`)) {
    console.error(`❌ Failed: Legacy field card #${cardId} is still present in index.html!`);
    process.exit(1);
  }
}
console.log('✓ Verified: Legacy fields (Resume, Valid ID, Barangay Clearance) completely removed from Upload Modal');

// Check dedicated CBTA field
if (!indexHtml.includes('id="doc-card-cbta"')) {
  console.error('❌ Failed: Dedicated CBTA field #doc-card-cbta is missing in index.html!');
  process.exit(1);
}
if (!indexHtml.includes('COMMISSION BASED TELLER AGREEMENT (CBTA)')) {
  console.error('❌ Failed: Title COMMISSION BASED TELLER AGREEMENT (CBTA) is missing in index.html!');
  process.exit(1);
}
if (!indexHtml.includes('application/pdf')) {
  console.error('❌ Failed: application/pdf is not listed in file accept attribute in index.html!');
  process.exit(1);
}
console.log('✓ Verified: Dedicated CBTA upload card added with PDF and image support');

// 2. Mock Browser Environment for js/employee-documents.js
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = v; },
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
// window.appStore is created by store.js

// Load employee-documents.js
require('./js/employee-documents.js');
const docMod = window.employeeDocumentsModule;

if (!docMod) {
  console.error('❌ Failed: window.employeeDocumentsModule is not initialized!');
  process.exit(1);
}
console.log('✓ employee-documents.js loaded successfully');

// 3. Test Field Personnel Filtering (Only Tellers and Relievers legally require CBTA)
const fieldPersonnel = docMod.getFieldPersonnel();
console.log(`Field Personnel requiring CBTA: ${fieldPersonnel.length}`);
if (fieldPersonnel.length !== 150) {
  console.error(`❌ Expected exactly 150 field staff (116 tellers + 34 relievers), got ${fieldPersonnel.length}`);
  process.exit(1);
}

// Verify no Admins, Supervisors, or Collectors are in the CBTA compliance roster
const hasLeadership = fieldPersonnel.some(e => {
  const r = (e.role || '').toUpperCase();
  return r.includes('ADMIN') || r.includes('SUPERVISOR') || r.includes('COLLECTOR');
});
if (hasLeadership) {
  console.error('❌ Leadership or Collectors mistakenly included in CBTA compliance roster!');
  process.exit(1);
}
console.log('✓ Verified: Exactly 150 active field personnel (116 Sales Reps + 34 Relievers) tracked for CBTA');

// 4. Test Clean Zero Slate & Missing Tracking
docMod.documents = [];
docMod.saveDocuments();
docMod.render();

const totalKPI = parseInt(elements['kpi-docs-total'].textContent, 10);
const missingKPI = parseInt(elements['kpi-docs-missing'].textContent, 10);
console.log(`Initial Clean Slate KPIs: Total Docs=${totalKPI}, Missing CBTA=${missingKPI}`);

if (totalKPI !== 0) {
  console.error(`❌ Expected 0 initial uploaded documents, got ${totalKPI}`);
  process.exit(1);
}
if (missingKPI !== 150) {
  console.error(`❌ Expected 150 Missing Records on clean slate, got ${missingKPI}`);
  process.exit(1);
}
console.log('✓ Verified: Clean slate displays 0 uploaded documents and 150 Missing Records');

// 5. Test Uploading a PDF CBTA for a Sales Representative
const sampleTeller = fieldPersonnel[0];
console.log(`\nTesting PDF CBTA upload for: ${sampleTeller.name} (${sampleTeller.id})`);

// Simulate file selection
docMod.fileBuffers['CBTA'] = {
  fileName: 'Signed_CBTA_Contract.pdf',
  fileSize: '412 KB',
  fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
  fileType: 'application/pdf'
};

// Select employee
docMod.selectEmployee(sampleTeller.id);

// Initiate Save
docMod.initiateSaveDocument();

if (!elements['modal-doc-confirm-upload'].classList.contains('active')) {
  console.error('❌ Upload confirmation modal was not activated!');
  process.exit(1);
}
console.log('✓ Upload confirmation modal displayed correctly');

// Execute Upload
docMod.executeUpload();

// Verify updated documents and KPIs
if (docMod.documents.length !== 1) {
  console.error(`❌ Expected 1 uploaded document, got ${docMod.documents.length}`);
  process.exit(1);
}
const uploadedDoc = docMod.documents[0];
if (uploadedDoc.employeeId !== sampleTeller.id || uploadedDoc.documentType !== 'CBTA' || uploadedDoc.fileType !== 'application/pdf') {
  console.error('❌ Uploaded document properties mismatch!', uploadedDoc);
  process.exit(1);
}
console.log(`✓ CBTA document successfully recorded: ${uploadedDoc.fileName} (${uploadedDoc.fileType})`);

// Check KPI counters after 1 upload
const newTotalKPI = parseInt(elements['kpi-docs-total'].textContent, 10);
const newMissingKPI = parseInt(elements['kpi-docs-missing'].textContent, 10);
console.log(`Updated KPIs: Total Docs=${newTotalKPI}, Missing Records=${newMissingKPI}`);

if (newTotalKPI !== 1) {
  console.error(`❌ Expected 1 Total Docs KPI, got ${newTotalKPI}`);
  process.exit(1);
}
if (newMissingKPI !== 149) {
  console.error(`❌ Expected Missing Records to decrement to 149, got ${newMissingKPI}`);
  process.exit(1);
}
console.log('✓ Dynamic Compliance Countdown verified: Missing Records dropped from 150 to 149!');

// 6. Test Replacement Modal when re-uploading for same employee
docMod.fileBuffers['CBTA'] = {
  fileName: 'Signed_CBTA_Contract_Renewed.pdf',
  fileSize: '450 KB',
  fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
  fileType: 'application/pdf'
};
docMod.selectEmployee(sampleTeller.id);
docMod.initiateSaveDocument();

if (!elements['modal-doc-confirm-replace'].classList.contains('active')) {
  console.error('❌ Replace confirmation modal was not activated for existing employee!');
  process.exit(1);
}
console.log('✓ Replacement confirmation modal triggered correctly for existing CBTA');

docMod.executeReplace();
if (docMod.documents.length !== 1 || docMod.documents[0].fileName !== 'Signed_CBTA_Contract_Renewed.pdf') {
  console.error('❌ Replacement failed to update existing record cleanly!');
  process.exit(1);
}
console.log('✓ Replacement verified: Old contract updated cleanly without duplicating records');

// 7. Test In-Browser Document Viewer with PDF
docMod.viewDocument(docMod.documents[0].id);
if (!elements['modal-view-document'].classList.contains('active')) {
  console.error('❌ Document viewer modal failed to open!');
  process.exit(1);
}
if (!elements['view-doc-content'].innerHTML.includes('iframe') || !elements['view-doc-content'].innerHTML.includes('Download Official PDF File')) {
  console.error('❌ PDF viewer embed and download link missing in view-doc-content!');
  process.exit(1);
}
console.log('✓ Verified: Document Viewer modal embeds PDF viewer and download button');

console.log('\n======================================================');
console.log('🎉 ALL CBTA EMPLOYEE DOCUMENTS TESTS PASSED 100%! 🚀');
console.log('======================================================\n');
