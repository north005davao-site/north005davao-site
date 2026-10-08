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

const docs = [];

// 1. Rhea Desnacido (2 records as seen in Desktop Image 2)
docs.push({
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

docs.push({
  id: 'DOC-DDN005-SR000-CBTA-1760000000000-102',
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
docs.push({
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
    docs.push({
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
    docs.push({
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
    docs.push({
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
