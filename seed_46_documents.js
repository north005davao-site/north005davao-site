const fs = require('fs');
const path = require('path');

// Mock browser globals to load store.js
global.window = {};
global.document = { addEventListener: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {} };
require('./js/store.js');

const store = global.window.appStore;
const emps = store.data.employees;

function formatPdfName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] + '.pdf';
  const lastName = parts[parts.length - 1];
  const firstNames = parts.slice(0, parts.length - 1).join(' ');
  return lastName + ', ' + firstNames + '.pdf';
}

function generateOfficialCbtaPdfDataUrl(doc) {
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

  return 'data:application/pdf;base64,' + Buffer.from(content).toString('base64');
}

const docs = [];

// Helper to push document with guaranteed PDF Data URL
function addDocument(doc) {
  if (!doc.fileDataUrl) {
    doc.fileDataUrl = generateOfficialCbtaPdfDataUrl(doc);
  }
  docs.push(doc);
}

// 1. Rhea Desnacido (Single canonical record, strictly deduplicated)
addDocument({
  id: 'DOC-DDN005-SR000-CBTA-1760000000000-101',
  employeeId: 'DDN005-SR000',
  employeeName: 'Rhea Desnacido',
  position: 'Reliever',
  documentType: 'CBTA',
  status: 'Complete',
  dateUploaded: '2026-10-07',
  expiryDate: '—',
  fileName: 'Desnacido, Rhea B..pdf',
  fileSize: '1121 KB',
  fileType: 'application/pdf',
  notes: 'Verified official compliance record on file.'
});

// 2. Yzalou I. Dumaguing
addDocument({
  id: 'DOC-DDN005-SR000-CBTA-1760000000000-103',
  employeeId: 'DDN005-SR000',
  employeeName: 'Yzalou I. Dumaguing',
  position: 'Reliever',
  documentType: 'CBTA',
  status: 'Complete',
  dateUploaded: '2026-10-07',
  expiryDate: '—',
  fileName: 'Dumaguing, Yzalou I..pdf',
  fileSize: '890 KB',
  fileType: 'application/pdf',
  notes: 'Verified official compliance record on file.'
});

const topTellersOrder = [
  'Marcia Taghap Cabudlan',
  'MAY A.INAHID',
  'MELANIE A. SARAWI',
  'Annabelle Semblante',
  'ANA MAY M. DELO SANTOS',
  'Erma Serdan',
  'LENIE ORILLO'
];

const tellers = emps.filter(e => !(e.role || '').toUpperCase().includes('ADMIN') && !(e.role || '').toUpperCase().includes('SUPERVISOR') && !(e.role || '').toUpperCase().includes('COLLECTOR') && !(e.role || '').toUpperCase().includes('RELIEVER'));

topTellersOrder.forEach((name, i) => {
  const f = tellers.find(t => t.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(t.name.toLowerCase()));
  if (f) {
    addDocument({
      id: 'DOC-' + f.id + '-CBTA-1760000000000-' + (104 + i),
      employeeId: f.id,
      employeeName: f.name,
      position: 'Sales Representative',
      documentType: 'CBTA',
      status: 'Complete',
      dateUploaded: '2026-10-07',
      expiryDate: '—',
      fileName: formatPdfName(f.name),
      fileSize: (600 + ((i * 37) % 500)) + ' KB',
      fileType: 'application/pdf',
      notes: 'Verified official compliance record on file.'
    });
  }
});

const used = new Set(docs.map(d => d.employeeName.toLowerCase()));

// Populate remaining up to 46 documents
const rels = emps.filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));
for (const r of rels) {
  if (docs.length >= 46) break;
  if (!used.has(r.name.toLowerCase())) {
    used.add(r.name.toLowerCase());
    addDocument({
      id: 'DOC-' + r.id + '-CBTA-1760000000000-' + (100 + docs.length),
      employeeId: r.id,
      employeeName: r.name,
      position: 'Reliever',
      documentType: 'CBTA',
      status: 'Complete',
      dateUploaded: '2026-10-07',
      expiryDate: '—',
      fileName: formatPdfName(r.name),
      fileSize: (700 + ((docs.length * 23) % 400)) + ' KB',
      fileType: 'application/pdf',
      notes: 'Verified official compliance record on file.'
    });
  }
}

for (const t of tellers) {
  if (docs.length >= 46) break;
  if (!used.has(t.name.toLowerCase())) {
    used.add(t.name.toLowerCase());
    addDocument({
      id: 'DOC-' + t.id + '-CBTA-1760000000000-' + (100 + docs.length),
      employeeId: t.id,
      employeeName: t.name,
      position: 'Sales Representative',
      documentType: 'CBTA',
      status: 'Complete',
      dateUploaded: '2026-10-07',
      expiryDate: '—',
      fileName: formatPdfName(t.name),
      fileSize: (650 + ((docs.length * 19) % 450)) + ' KB',
      fileType: 'application/pdf',
      notes: 'Verified official compliance record on file.'
    });
  }
}

console.log('Total seeded documents generated:', docs.length);
fs.writeFileSync('./data/employee_documents.json', JSON.stringify({ documents: docs, deletedDocIds: [] }, null, 2), 'utf8');
console.log('Successfully written to data/employee_documents.json!');
