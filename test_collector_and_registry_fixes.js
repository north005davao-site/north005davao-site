/**
 * Test Suite: Collector Dropdown Isolation & Master Data Registry Counts
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment
global.window = global;
global.document = {
  getElementById: (id) => {
    if (!global._elements[id]) {
      global._elements[id] = {
        innerHTML: '',
        textContent: '',
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        },
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {}
      };
    }
    return global._elements[id];
  },
  addEventListener: () => {}
};
global._elements = {};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};
global.sessionStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

// Load scripts
const storeCode = fs.readFileSync(path.join(__dirname, 'js/store.js'), 'utf8');
eval(storeCode);

const expensesCode = fs.readFileSync(path.join(__dirname, 'js/expenses-payment.js'), 'utf8');
eval(expensesCode);

console.log('=== RUNNING TESTS ===');

// 1. Verify Store Seed Data
const store = window.appStore;
assert(store, 'appStore must exist');

const allEmps = store.getEmployees();
console.log(`Total employees in store: ${allEmps.length}`);

const isLeadershipOrCollector = (e) => {
  const r = (e.role || '').toUpperCase();
  const d = (e.department || '').toLowerCase();
  return r.includes('ADMIN') || 
         r.includes('SUPERVISOR') || 
         r.includes('COLLECTOR') || 
         r.includes('TEAM LEADER') || 
         d === 'dept-admin' || 
         d === 'dept-sup' || 
         d === 'dept-col';
};

const operationalStaff = allEmps.filter(e => !isLeadershipOrCollector(e));
console.log(`Operational Staff count (All Staff): ${operationalStaff.length}`);
assert.strictEqual(operationalStaff.length, 150, `Expected 150 operational staff, got ${operationalStaff.length}`);

const tellers = allEmps.filter(e => {
  const r = (e.role || '').toUpperCase();
  const isOtherRole = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('SUPERVISOR') || r.includes('COLLECTOR') || r.includes('TEAM LEADER') || r.includes('ADMIN');
  if (isOtherRole) return false;
  const statusUpper = (e.status || 'ACTIVE').toUpperCase();
  return statusUpper === 'ACTIVE';
});
console.log(`Active Sales Representatives: ${tellers.length}`);
assert.strictEqual(tellers.length, 116, `Expected 116 active Sales Reps, got ${tellers.length}`);

const relievers = allEmps.filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));
console.log(`Relievers count: ${relievers.length}`);
assert.strictEqual(relievers.length, 34, `Expected 34 relievers, got ${relievers.length}`);

const inactiveBooths = allEmps.filter(e => (e.status || '').toUpperCase() === 'INACTIVE');
console.log(`Inactive booths count: ${inactiveBooths.length}`);
assert.strictEqual(inactiveBooths.length, 0, `Expected 0 inactive booths, got ${inactiveBooths.length}`);

const terminated = allEmps.filter(e => (e.status || '').toUpperCase() === 'TERMINATED');
console.log(`Terminated tellers count: ${terminated.length}`);
assert.strictEqual(terminated.length, 0, `Expected 0 terminated tellers, got ${terminated.length}`);

// 2. Test Collector Dropdown Isolation
const ep = window.expensesPayment;

// Test Admin Session
window.authManager = {
  isCollector: () => false,
  isAdmin: () => true,
  getCurrentUser: () => ({ role: 'Administrator', username: 'admin', name: 'Peter John Carrillo' })
};

const adminEligible = ep.getEligibleCollectors();
console.log(`Admin sees eligible collectors: ${adminEligible.length}`);
assert.strictEqual(adminEligible.length, 5, 'Admin must see all 5 collectors');

// Setup selector for Admin
const containerEl = document.getElementById('ep-collector-selector-container');
ep.setupSearchableCollectorSelect();
assert(containerEl.innerHTML.includes('ep-collector-searchable-dropdown'), 'Admin must have searchable dropdown');
assert(containerEl.innerHTML.includes('JOHN'), 'Admin dropdown must list JOHN');
assert(containerEl.innerHTML.includes('MARK ANTHONY (MAC2)'), 'Admin dropdown must list Mark Anthony');

// Test Collector Session (Mark Anthony)
window.authManager = {
  isCollector: () => true,
  isAdmin: () => false,
  getCurrentUser: () => ({ role: 'Collector', username: 'collector', name: 'MARK ANTHONY (MAC2)', id: 'DDN005-SC004' })
};

const collectorEligible = ep.getEligibleCollectors();
console.log(`Collector sees eligible collectors: ${collectorEligible.length}`);
assert.strictEqual(collectorEligible.length, 1, 'Collector must see ONLY 1 collector (themselves)');
assert.strictEqual(collectorEligible[0].name, 'MARK ANTHONY (MAC2)', 'Collector eligible list must be MARK ANTHONY (MAC2)');

// Setup selector for Collector
ep.setupSearchableCollectorSelect();
assert(!containerEl.innerHTML.includes('ep-collector-searchable-dropdown'), 'Collector view must NOT render dropdown');
assert(!containerEl.innerHTML.includes('ep-collector-search-input'), 'Collector view must NOT render search input');
assert(!containerEl.innerHTML.includes('JOHN'), 'Collector view must NOT contain other collectors like JOHN');
assert(!containerEl.innerHTML.includes('JASON'), 'Collector view must NOT contain other collectors like JASON');
assert(containerEl.innerHTML.includes('MARK ANTHONY (MAC2)'), 'Collector view must contain their own name');
assert(containerEl.innerHTML.includes('LOCKED TO YOUR ACCOUNT'), 'Collector view must show lock indicator');

console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
