const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: TELLER SHORTAGE RESET TO ₱0.00 VERIFICATION ===\n');

// 1. Verify data/transactions.json
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'transactions.json'), 'utf8'));
assert(Array.isArray(raw.transactions), 'transactions must be an array');
assert.strictEqual(raw.transactions.length, 0, 'data/transactions.json must contain 0 active transactions');
assert(raw.deletedTransactionIds.includes('TXN-OCR-1790756780277-9'), 'TXN-OCR-1790756780277-9 must be tombstoned in deletedTransactionIds');
assert(raw.deletedTransactionIds.includes('TXN-OCR-1790756780277-10'), 'TXN-OCR-1790756780277-10 must be tombstoned in deletedTransactionIds');
console.log('✓ data/transactions.json verified: 0 active transactions, Tura shortage IDs tombstoned');

// 2. Setup mock browser environment
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

const domElements = {
  'ep-kpi-expenses': { textContent: '' },
  'ep-kpi-short': { textContent: '' },
  'ep-kpi-ca': { textContent: '' },
  'ep-kpi-payments': { textContent: '' },
  'ep-short-teller-name': { textContent: '' },
  'ep-short-original-amt': { textContent: '' },
  'ep-short-total-paid': { textContent: '' },
  'ep-short-remaining': { textContent: '' },
  'ep-short-status-badge': { textContent: '', className: '', style: {} },
  'ep-teller-selector-container': { innerHTML: '' },
  'ep-short-calendar-container': { innerHTML: '' },
  'ep-short-ledger-tbody': { innerHTML: '' },
  'ep-short-ledger-pagination': { innerHTML: '' },
  'ep-search-input': { value: '', addEventListener() {} },
  'ep-search-clear-btn': { style: { display: 'none' } }
};

global.document = {
  getElementById: (id) => {
    if (!domElements[id]) {
      domElements[id] = { innerHTML: '', textContent: '', value: '', style: {}, classList: { add() {}, remove() {} }, addEventListener() {} };
    }
    if (!domElements[id].addEventListener) domElements[id].addEventListener = () => {};
    return domElements[id];
  },
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  addEventListener: () => {},
  authManager: {
    isCollector: () => false,
    isAdmin: () => true,
    getCurrentUser: () => ({ username: 'admin' })
  }
};

require('./js/store.js');
const store = window.appStore;
assert.strictEqual(store.data.transactions.length, 0, 'Store must initialize with 0 transactions');

require('./js/expenses-payment.js');
const ep = window.expensesPayment;
ep.init();

// Verify KPI card
const kpiShort = domElements['ep-kpi-short'].textContent;
console.log('Teller Shortages KPI:', kpiShort);
assert.strictEqual(kpiShort, '₱0.00', 'Teller Shortages KPI must be exactly ₱0.00');

// Verify Short Tracker Tab metrics
console.log('Original Shortage:', domElements['ep-short-original-amt'].textContent);
console.log('Remaining Shortage:', domElements['ep-short-remaining'].textContent);
console.log('Status Badge:', domElements['ep-short-status-badge'].textContent);

assert.strictEqual(domElements['ep-short-original-amt'].textContent, 'P0.00');
assert.strictEqual(domElements['ep-short-remaining'].textContent, 'P0.00');
assert.strictEqual(domElements['ep-short-status-badge'].textContent, 'NO SHORTAGES');

// Simulate client loading cached Tura transactions and verify auto-purge
store.data.transactions.push({
  id: 'TXN-OCR-1790756780277-9',
  amount: 1140,
  name: 'JUVYLYN H. TURA',
  type: 'SHORT',
  classification: 'SHORT'
});
store.data.transactions.push({
  id: 'TXN-OCR-1790756780277-10',
  amount: 325,
  name: 'JUVYLYN H. TURA',
  type: 'SHORT',
  classification: 'SHORT'
});
assert.strictEqual(store.data.transactions.length, 2);

ep.ensureSeedData();
assert.strictEqual(store.data.transactions.length, 0, 'ensureSeedData must automatically purge Tura shortages');
ep.updateKpiCounters();
assert.strictEqual(domElements['ep-kpi-short'].textContent, '₱0.00', 'KPI must stay ₱0.00 after purge');

console.log('\n🎉 ALL SHORTAGE RESET TO ₱0.00 VERIFICATIONS PASSED SUCCESSFULLY!');
