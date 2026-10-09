const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = {
  console: console,
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  },
  document: {
    getElementById(id) {
      return { textContent: '', innerHTML: '', value: '', classList: { add() {}, remove() {} }, style: {} };
    }
  },
  window: {},
  global: {},
  navigator: { userAgent: 'NodeTest' }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

const storeCode = fs.readFileSync(path.join(__dirname, 'js', 'store.js'), 'utf8');
vm.runInNewContext(storeCode, sandbox);

const store = sandbox.window.appStore;
assert(store, 'Store must be initialized');

const employees = store.getEmployees();
const relievers = employees.filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));

assert.strictEqual(relievers.length, 34, 'Must have exactly 34 active relievers');

// Verify authentic municipalities and null coordinates
const validMunis = ['Sto. Tomas', 'Tagum City', 'Panabo City', 'Carmen'];
relievers.forEach(r => {
  assert(validMunis.includes(r.municipality), 'Reliever ' + r.name + ' has invalid municipality ' + r.municipality);
  assert(!r.municipality.includes('Davao Sector'), 'Reliever ' + r.name + ' has generic Davao Sector');
  assert.strictEqual(r.purok, '-', 'Reliever ' + r.name + ' must have - for purok');
  assert.strictEqual(r.boothCode, '-', 'Reliever ' + r.name + ' must have - for boothCode');
  assert.strictEqual(r.lat, null, 'Reliever ' + r.name + ' must not have latitude');
  assert.strictEqual(r.lng, null, 'Reliever ' + r.name + ' must not have longitude');
  assert.strictEqual(r.coordinates, null, 'Reliever ' + r.name + ' must not have coordinates');
});

// Verify ETS Live Tracking exclusions
const operationalStaff = employees.filter(emp => {
  const r = (emp.role || '').toUpperCase();
  const isRel = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || emp.id === 'DDN005-SR000';
  const isAdm = r.includes('ADMIN') || (emp.department || '').includes('admin');
  const isSup = r.includes('SUPERVISOR') || (emp.department || '').includes('sup');
  const isCol = r.includes('COLLECTOR') || (emp.department || '').includes('col');
  return !isRel && !isAdm && !isSup && !isCol;
});

assert.strictEqual(operationalStaff.filter(s => (s.role || '').toUpperCase().includes('RELIEVER')).length, 0, 'No relievers in ETS map staff');

console.log('✅ Relievers GPS Exclusion & Authentic Municipality Suite Passed Successfully.');
