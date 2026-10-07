const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING STREAMLINED EXPENSES & PAYMENT MODULE ===\n');

// 1. Verify index.html structure
const html = fs.readFileSync('index.html', 'utf8');

assert(!html.includes('id="ep-tab-expenses"'), 'Operating Expenses tab container removed from index.html');
assert(!html.includes('id="ep-kpi-expenses"'), 'Operating Expenses KPI card removed from index.html');
assert(!html.includes('data-tab="expenses"'), 'Operating Expenses sub-tab button removed from index.html');
assert(!html.includes('Section 9: Main Search Bar'), 'Bulky standalone search bar card removed from index.html');

assert(html.includes('id="ep-kpi-short"'), 'Teller Shortages KPI card present');
assert(html.includes('id="ep-kpi-ca"'), 'Collector Cash Advances KPI card present');
assert(html.includes('id="ep-kpi-payments"'), 'Total Payments Received KPI card present');
assert(html.includes('data-tab="short-tracker"'), 'Short Tracker tab present');
assert(html.includes('data-tab="ca-tracker"'), 'Cash Advance Tracker tab present');
assert(html.includes('data-tab="payment-history"'), 'Master Payment History tab present');
assert(html.includes('id="ep-search-input"'), 'Integrated search input present');

console.log('✓ HTML Structure: Operating Expenses removed, 3 executive KPI cards, 3 sub-tabs, compact search bar.');

// 2. Setup mock browser DOM to test js/expenses-payment.js & js/ocr-engine.js
global.window = global;
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

global.document = {
  getElementById: (id) => {
    if (!global._elements) global._elements = {};
    if (!global._elements[id]) {
      global._elements[id] = {
        id,
        textContent: '',
        value: '',
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {},
          contains: () => false
        },
        addEventListener: () => {},
        setAttribute: () => {},
        removeAttribute: () => {}
      };
    }
    return global._elements[id];
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Load store.js
const storeCode = fs.readFileSync('js/store.js', 'utf8');
eval(storeCode);

// Load auth.js
const authCode = fs.readFileSync('js/auth.js', 'utf8');
eval(authCode);

// Load expenses-payment.js
const epCode = fs.readFileSync('js/expenses-payment.js', 'utf8');
eval(epCode);

// Load ocr-engine.js
const ocrCode = fs.readFileSync('js/ocr-engine.js', 'utf8');
eval(ocrCode);

// 3. Test ExpensesPaymentController defaults
window.expensesPayment.init();
assert.strictEqual(window.expensesPayment.activeTab, 'short-tracker', 'Default active tab is short-tracker');
console.log('✓ Default active landing tab verified as short-tracker');

// 4. Test KPI calculation
window.appStore.data.transactions = [
  { id: 'T1', type: 'SHORT', classification: 'SHORT', amount: 1500, name: 'Teller 1' },
  { id: 'T2', type: 'CASH ADVANCE', classification: 'CA', amount: 5000, name: 'Collector 1' },
  { id: 'T3', type: 'PAYMENT', classification: 'PAYMENT', amount: 200, name: 'Collector 1' }
];

window.expensesPayment.updateKpiCounters();
const shortEl = document.getElementById('ep-kpi-short');
const caEl = document.getElementById('ep-kpi-ca');
const payEl = document.getElementById('ep-kpi-payments');

assert(shortEl.textContent.includes('1,500'), 'Shortage KPI correctly calculated: ' + shortEl.textContent);
assert(caEl.textContent.includes('5,000'), 'Cash Advance KPI correctly calculated: ' + caEl.textContent);
assert(payEl.textContent.includes('200'), 'Payment KPI correctly calculated: ' + payEl.textContent);
console.log('✓ Executive 3-Card KPI calculations verified (Shortages, CA, Payments)');

// 5. Test OCR Engine Dynamic Parsing on Reference Document Text
const sampleText = `
SEP. 06, 2024
COMMISSION: 74, 776.50
SALARY: 28, 200
EXPENSES:
1,200 - FUEL MOTOR
400 - RENT MOTOR
20 - WIFI DDN 1477 MELANIE SARAWI (TAGUM)
30 - WIFI DDN 1782 MARYJANE FERNANDEZ (CARMEN)
834 - DOOR BOLT 10PCS, DOOR HASH 5PCS, PADLOCK 5PCS FOR BOOTH
4,600 - THERMAL PAPER 300 ROLLS.
15 - WIFI DDN 1475 LUZVIMINDA GALATAZAN (PANABO)
20 - WIFI DDN 768 ALMERA DEGAMON (PANABO)
1,800 - RENT FEE SABONGAN NI NENE TIBAL-OG ST. TOMAS (AUG. 7, 2024 - SEP. 7, 2024) DDN 762
330 - POS LOAD 1MONTH DDN 428
330 - POS LOAD 1MONTH DDN 350
330 - POS LOAD 1MONTH DDN 427
330 - POS LOAD 1MONTH DDN 422
330 - POS LOAD 1MONTH DDN 351
330 - POS LOAD 1MONTH DDN 1781
5,000 - C.A. COLL. JASON APPROVED BY: SIR JUNDY
15,899 EXP.
28,200 SAL.
44,099 EXP. & SALARY
74, 776.50 COMM.
30,677.50
+ 200 - PAYMENT COLL. MARK ANTHONY
29, 878.25 - COMM. SEP. 05, 2024
60, 755.75 JJA COMM. FOR DEPOSIT.
`;

const parsed = window.ocrEngine.parseHandwrittenReport(sampleText);
console.log('Extracted OCR Items count:', parsed.items.length);

assert.strictEqual(parsed.items.length, 2, 'Only 2 accountability items extracted from sample text (C.A. and Payment)');

const caItem = parsed.items.find(i => i.type === 'CASH ADVANCE');
assert(caItem, 'Collector Cash Advance detected');
assert.strictEqual(caItem.amount, 5000, 'Cash advance amount extracted as 5000');
assert.strictEqual(caItem.employee, 'JASON', 'Collector name extracted as JASON');
assert(caItem.notes.toUpperCase().includes('SIR JUNDY'), 'Approver extracted in notes: ' + caItem.notes);

const payItem = parsed.items.find(i => i.type === 'PAYMENT');
assert(payItem, 'Collector Payment detected');
assert.strictEqual(payItem.amount, 200, 'Payment amount extracted as 200');
assert(payItem.employee.includes('MARK ANTHONY'), 'Payer name extracted as MARK ANTHONY');
assert.strictEqual(payItem.applyToCA, true, 'Payment marked to apply to Cash Advance');

// Ensure NO operational expenses were captured
const fuelItem = parsed.items.find(i => (i.description || '').toUpperCase().includes('FUEL'));
assert(!fuelItem, 'Fuel motor was correctly ignored');
const paperItem = parsed.items.find(i => (i.description || '').toUpperCase().includes('THERMAL'));
assert(!paperItem, 'Thermal paper was correctly ignored');
const loadItem = parsed.items.find(i => (i.description || '').toUpperCase().includes('LOAD'));
assert(!loadItem, 'POS load was correctly ignored');

console.log('✓ OCR Dynamic Extraction: Ignored all operational noise, cleanly extracted C.A. (₱5,000 Jason) and Payment (₱200 Mark Anthony)');

// 6. Ensure persistent store was not polluted with sample data
window.appStore.load();
const storeTxns = window.appStore.data.transactions || [];
const hasJasonCA = storeTxns.some(t => t.description && t.description.includes('C.A. COLL. JASON'));
assert(!hasJasonCA, 'Sample data was NOT written to persistent store (strictly obeyed user rule)');
console.log('✓ Store Integrity: Sample reference data verified NOT present in persistent database');

console.log('\n======================================================');
console.log('🎉 ALL STREAMLINED EXPENSES & OCR TESTS PASSED 100%!');
console.log('======================================================\n');
