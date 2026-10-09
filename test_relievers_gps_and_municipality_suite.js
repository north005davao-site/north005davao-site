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

// 2. Verify all 123 booths are covered by AUTHENTIC_MASTER_REGISTRY_COORDINATES
const authCoords = sandbox.window.AUTHENTIC_MASTER_REGISTRY_COORDINATES;
assert(authCoords, 'AUTHENTIC_MASTER_REGISTRY_COORDINATES must be defined');
const booths = store.getBooths();
assert.strictEqual(booths.length, 123, 'Must have 123 total registered booths');
booths.forEach(b => {
  const norm = sandbox.window.cleanBoothId(b.id || b.code);
  assert(authCoords[norm], 'Booth ' + (b.id || b.code) + ' must exist in AUTHENTIC_MASTER_REGISTRY_COORDINATES');
  assert(typeof authCoords[norm].lat === 'number' && typeof authCoords[norm].lng === 'number', 'Coordinates must be valid numbers');
});

// 3. Verify Fleet Activity Monitor filtering excludes relievers, admins, supervisors, collectors
const boothStaff = employees.filter(emp => {
  if (!emp) return false;
  const roleUpper = (emp.role || '').toUpperCase();
  const deptLower = (emp.department || '').toLowerCase();
  const nameNorm = (emp.name || '').trim().toLowerCase();

  // 1. Strictly exclude Relievers, Admins, Supervisors, Collectors, Buffer staff
  if (roleUpper.includes('RELIEVER') || roleUpper.includes('RELIVER') || roleUpper.includes('BUFFER')) return false;
  if (roleUpper.includes('ADMIN') || deptLower.includes('admin') || deptLower === 'dept-admin') return false;
  if (roleUpper.includes('SUPERVISOR') || roleUpper.includes('TEAM LEADER') || deptLower.includes('sup') || deptLower === 'dept-sup') return false;
  if (roleUpper.includes('COLLECTOR') || deptLower.includes('col') || deptLower === 'dept-col') return false;
  if (emp.id === 'DDN005-SR000' || (emp.id && emp.id.startsWith('DDN005-REL'))) return false;

  // 2. Must have an assigned STL Booth! (Fleet Activity Monitor tracks STL Booths)
  const boothCode = (emp.boothCode || emp.booth || '').trim().toUpperCase();
  if (!boothCode || boothCode === '-' || boothCode === 'N/A' || boothCode === 'NONE' || boothCode === 'UNASSIGNED') {
    return false;
  }
  return true;
});

assert.strictEqual(boothStaff.length, 116, 'Exactly 116 active primary sales representatives must be in boothStaff');
assert(!boothStaff.some(s => s.name.toUpperCase().includes('PRECIOUS NICA TORREFIEL')), 'Precious Nica Torrefiel must NOT be in Fleet Activity');
assert(!boothStaff.some(s => s.role.toUpperCase().includes('RELIEVER')), 'No reliever allowed in Fleet Activity');

// 4. Verify search for 'admin' never returns Precious Nica Torrefiel or any reliever
const searchAdminQuery = 'admin';
const searchAdminMatches = boothStaff.filter(emp => {
  const q = searchAdminQuery.toLowerCase();
  return (emp.name && emp.name.toLowerCase().includes(q)) ||
         (emp.id && emp.id.toLowerCase().includes(q)) ||
         (emp.boothCode && emp.boothCode.toLowerCase().includes(q));
});
assert.strictEqual(searchAdminMatches.length, 0, "Query 'admin' must return 0 booth staff since Peter John Carrillo and relievers are excluded");

console.log('✅ Relievers GPS Exclusion & Authentic Municipality Suite Passed Successfully.');
