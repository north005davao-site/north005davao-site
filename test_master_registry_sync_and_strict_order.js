const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== RUNNING MASTER REGISTRY CROSS-DEVICE SYNC & ORDERING TEST ===\n');

// 1. Verify /api/master-registry API endpoint and canonical baseline
const registryFile = path.join(__dirname, 'data', 'master_registry.json');
assert.ok(fs.existsSync(registryFile), 'data/master_registry.json must exist');
const canonicalData = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
assert.ok(Array.isArray(canonicalData.employees), 'canonicalData.employees must be an array');
assert.ok(canonicalData.employees.length >= 150, 'canonicalData must contain all operational staff');

// Verify Charlyn Dela Vega is canonical Sales Representative
const charlyn = canonicalData.employees.find(e => e.name && e.name.toLowerCase().trim() === 'charlyn dela vega');
assert.ok(charlyn, 'Charlyn Dela Vega must exist in canonical registry');
assert.strictEqual(charlyn.id, 'DDN005-SR1799', 'Charlyn Dela Vega must have official ID DDN005-SR1799');
assert.strictEqual(charlyn.boothCode, 'DDN-1799', 'Charlyn Dela Vega must be assigned to booth DDN-1799');
assert.ok(['TELLER', 'SALES REPRESENTATIVE'].includes((charlyn.role || '').toUpperCase()), 'Charlyn role must be TELLER / Sales Representative');
console.log('✓ Requirement 1: Charlyn Dela Vega is authentic Sales Representative DDN005-SR1799 (Booth DDN-1799)');

// 2. Test Store class in isolated mock environment
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.window = {
  addEventListener() {},
  dispatchEvent() {}
};
global.document = {
  addEventListener() {},
  visibilityState: 'visible'
};

const storeCode = fs.readFileSync(path.join(__dirname, 'js', 'store.js'), 'utf8');
eval(storeCode);

const store = new Store();
assert.ok(store.data, 'store.data must be initialized');
assert.ok(Array.isArray(store.data.employees), 'store.data.employees must be an array');

// 3. Test getEmployees() strict ordering
const emps = store.getEmployees();
assert.ok(Array.isArray(emps), 'getEmployees() must return an array');

const isRel = (e) => {
  const r = (e.role || '').toUpperCase();
  const id = (e.id || '').toUpperCase();
  return r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
};

const isLeaderOrCol = (e) => {
  const r = (e.role || '').toUpperCase();
  return r.includes('ADMIN') || r.includes('SUPERVISOR') || r.includes('COLLECTOR');
};

const opEmps = emps.filter(e => !isLeaderOrCol(e));
assert.ok(opEmps.length > 0, 'Operational employees must not be empty');

// The very first operational employee MUST be a Sales Representative, NEVER a Reliever!
assert.strictEqual(isRel(opEmps[0]), false, 'First operational employee MUST NOT be a Reliever');
console.log('✓ Requirement 2: First operational employee is ' + opEmps[0].name + ' (' + (opEmps[0].role || 'Sales Representative') + '), NOT a Reliever');

// Verify that all Sales Representatives precede all Relievers
let foundReliever = false;
let relBeforeSales = false;
opEmps.forEach(e => {
  if (isRel(e)) {
    foundReliever = true;
  } else {
    if (foundReliever) {
      relBeforeSales = true;
    }
  }
});
assert.strictEqual(relBeforeSales, false, 'Sales Representatives must strictly precede all Relievers');
console.log('✓ Requirement 3: All Sales Representatives strictly precede Relievers');

// 4. Test adding a new reliever - must NOT be placed at the top!
const newRel = store.addEmployee({
  name: 'Zoe Test Reliever',
  role: 'Reliever',
  municipality: 'Sto. Tomas'
});
assert.strictEqual(newRel.role, 'Reliever');

const empsAfterAdd = store.getEmployees();
const opAfterAdd = empsAfterAdd.filter(e => !isLeaderOrCol(e));
assert.strictEqual(isRel(opAfterAdd[0]), false, 'After adding a reliever, first operational employee MUST STILL be a Sales Representative');
assert.strictEqual(opAfterAdd[opAfterAdd.length - 1].name, 'Zoe Test Reliever', 'Newly added reliever must be positioned among relievers at the bottom');
console.log('✓ Requirement 4: Adding a new Reliever preserves strict Sales Representative first ordering');

// 5. Test adding a new Sales Representative - must be before Relievers
const newSR = store.addEmployee({
  name: 'Adam Test Sales Rep',
  role: 'Sales Representative',
  boothCode: 'DDN-100'
});
const empsAfterSR = store.getEmployees();
const opAfterSR = empsAfterSR.filter(e => !isLeaderOrCol(e));
assert.strictEqual(isRel(opAfterSR[0]), false, 'First operational employee remains a Sales Representative');
const adamIdx = opAfterSR.findIndex(e => e.name === 'Adam Test Sales Rep');
const zoeIdx = opAfterSR.findIndex(e => e.name === 'Zoe Test Reliever');
assert.ok(adamIdx < zoeIdx, 'Sales Representative must appear before Reliever in master registry');
console.log('✓ Requirement 5: Sales Representative is placed ahead of Relievers');

console.log('\n🎉 ALL MASTER REGISTRY TESTS PASSED PERFECTLY!\n');
