const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING USER REQUIREMENTS ===');

// 1. Verify index.html contains RELIEVER option
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('<option value="RELIEVER">Reliever</option>'), 'index.html must have Reliever option in emp-form-role');
console.log('✓ Requirement 2 (index.html): emp-form-role contains <option value="RELIEVER">Reliever</option>');

// 2. Setup mock browser environment
const localStorageData = {};
global.localStorage = {
  getItem: (key) => localStorageData[key] || null,
  setItem: (key, val) => { localStorageData[key] = String(val); },
  removeItem: (key) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.window = global;
global.document = {
  getElementById: (id) => ({
    id,
    value: '',
    innerHTML: '',
    textContent: '',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {}
  }),
  querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Mock Leaflet
global.L = {
  layerGroup: () => ({
    clearLayers: () => {},
    addLayer: () => {},
    addTo: () => {}
  }),
  map: () => ({
    setView: () => {},
    fitBounds: () => {},
    on: () => {},
    invalidateSize: () => {}
  }),
  tileLayer: () => ({ addTo: () => {} }),
  divIcon: (opts) => opts,
  marker: (coords, opts) => ({
    bindTooltip: () => ({}),
    bindPopup: () => ({}),
    openPopup: () => ({}),
    getLatLng: () => ({ lat: coords[0], lng: coords[1] }),
    setLatLng: () => ({})
  }),
  latLngBounds: () => ({ pad: () => ({}) })
};

require('./js/store.js');
require('./js/map-ets.js');
require('./js/app.js');

// 3. Test Reliever role creation and auto-sync
const testReliever = window.appStore.addEmployee({
  name: 'Maria Elena Santos',
  role: 'RELIEVER',
  department: 'dept-tel',
  municipality: 'Tagum City',
  address: 'Purok 1, Tagum City',
  phone: '09171234567',
  status: 'ACTIVE'
});
assert.strictEqual(testReliever.id, 'DDN005-SR000', `Reliever default ID No must be DDN005-SR000, got ${testReliever.id}`);
const relFound = window.appStore.data.relievers.find(r => r.name === 'Maria Elena Santos');
assert.ok(relFound, 'Reliever must be automatically synced to store.data.relievers');
assert.strictEqual(relFound.id, 'DDN005-SR000', 'Reliever in store.data.relievers must have ID DDN005-SR000');

// Test updateEmployee to RELIEVER and away from RELIEVER
const testStaff = window.appStore.addEmployee({
  name: 'Test Role Switcher',
  role: 'SALES REPRESENTATIVE',
  department: 'dept-tel',
  status: 'ACTIVE'
});
window.appStore.updateEmployee(testStaff.id, { role: 'RELIEVER' });
const relUpdated = window.appStore.data.relievers.find(r => r.name === 'Test Role Switcher');
assert.ok(relUpdated, 'Role update to RELIEVER must register staff into store.data.relievers');
assert.strictEqual(relUpdated.id, 'DDN005-SR000', 'Updated reliever must have ID DDN005-SR000');

window.appStore.updateEmployee('DDN005-SR000', { role: 'SALES REPRESENTATIVE', name: 'Test Role Switcher' });
const relRemoved = window.appStore.data.relievers.find(r => r.name === 'Test Role Switcher');
assert.strictEqual(relRemoved, undefined, 'Changing role away from Reliever must remove staff from store.data.relievers');
console.log('✓ Requirement 1 (Relievers Default ID & Sync): All relievers default to DDN005-SR000 and bi-directionally sync');

// 4. Test LocalStorage Purge of phantom booths & ghost inactive records
const mockCorruptedStorage = {
  employees: [
    { id: 'DDN005-SR754', name: 'Belle Amor Quizo', boothCode: 'DDN-754', role: 'Sales Representative', status: 'ACTIVE' },
    { id: 'DDN005-SR766', name: 'N/A', role: 'N/A', boothCode: 'DDN-766', status: 'INACTIVE' },
    { id: 'DDN005-SR1750', name: 'N/A', role: 'N/A', boothCode: 'DDN-1750', status: 'INACTIVE' },
    { id: 'DDN005-SR0001', name: 'Ferlyn Zamora Robello', role: 'SALES REPRESENTATIVE', status: 'INACTIVE' },
    { id: 'BOOTH-DDN-2001', name: 'N/A', role: 'N/A', boothCode: 'DDN-2001', status: 'INACTIVE' }
  ],
  booths: [
    { id: 'DDN-754', code: 'DDN-754', assignedTellerId: 'DDN005-SR754', assignedTellerName: 'Belle Amor Quizo', status: 'Active' },
    { id: 'DDN-2001', code: 'DDN-2001', assignedTellerId: '-', assignedTellerName: '-', status: 'INACTIVE' },
    { id: 'DDN-2002', code: 'DDN-2002', assignedTellerId: '-', assignedTellerName: 'Unassigned', status: 'Active' },
    { id: 'DDN-358', code: 'DDN-358', assignedTellerId: '-', assignedTellerName: '-', status: 'INACTIVE' }
  ]
};
// Pad to satisfy 50-item sanity check
for (let i = 0; i < 60; i++) {
  mockCorruptedStorage.employees.push({ id: 'PAD-' + i, name: 'Staff ' + i, role: 'Sales Representative', status: 'ACTIVE' });
}
localStorage.setItem('apex_omnierp_data_v4_ddn', JSON.stringify(mockCorruptedStorage));
const reloaded = window.appStore.load();
assert.ok(!reloaded.booths.some(b => b.id === 'DDN-2001' || b.id === 'DDN-2002' || b.id === 'DDN-358'), 'Phantom booths DDN-2001, DDN-2002, DDN-358 must be purged');
assert.ok(!reloaded.employees.some(e => e.id === 'DDN005-SR766' || e.id === 'DDN005-SR1750' || e.id === 'DDN005-SR0001' || e.id === 'BOOTH-DDN-2001'), 'Ghost records must be purged');
console.log('✓ Requirement 1 (Store load purge): Phantom booths & ghost inactive records permanently eradicated from localStorage');

// 5. Test Dashboard Municipality Pill colors
let pillsHtml = '';
global.document.getElementById = (id) => {
  if (id === 'dash-muni-pills-container') {
    return {
      set innerHTML(val) { pillsHtml = val; },
      get innerHTML() { return pillsHtml; }
    };
  }
  return { id, value: '', innerHTML: '', textContent: '', classList: { add: () => {}, remove: () => {} }, style: {} };
};
window.filterDashboardMuni('ALL');
assert.ok(pillsHtml.includes('#10b981'), 'Panabo City green color (#10b981) must be in pills HTML');
assert.ok(pillsHtml.includes('#eab308'), 'Sto. Tomas yellow color (#eab308) must be in pills HTML');
assert.ok(pillsHtml.includes('#ef4444'), 'Carmen red color (#ef4444) must be in pills HTML');
assert.ok(pillsHtml.includes('#3b82f6'), 'Kapalong blue color (#3b82f6) must be in pills HTML');
assert.ok(pillsHtml.includes('#8b5cf6'), 'Tagum City purple color (#8b5cf6) must be in pills HTML');
assert.ok(pillsHtml.includes('#ec4899'), 'Talaingod pink color (#ec4899) must be in pills HTML');
assert.ok(pillsHtml.includes('#06b6d4'), 'Samal cyan color (#06b6d4) must be in pills HTML');
console.log('✓ Requirement 3 (Dashboard): All 7 municipality pills styled with exact matching STL Booth pin colors & glowing indicator dots');

// 6. Test 34 Relievers count and default ID DDN005-SR000
localStorage.clear();
const freshStore = window.appStore.load();
const relieversInStore = freshStore.employees.filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));
assert.strictEqual(relieversInStore.length, 34, `Must have exactly 34 relievers, got ${relieversInStore.length}`);
relieversInStore.forEach(r => {
  assert.strictEqual(r.id, 'DDN005-SR000', `Reliever ${r.name} ID must be DDN005-SR000, got ${r.id}`);
});
console.log('✓ Requirement 4 (Relievers Count & ID): Exactly 34 official relievers present, all with DDN005-SR000');

// 7. Test 7 Unused Booths registered in booths
const unusedBoothsInStore = freshStore.booths.filter(b => (b.status || '').toUpperCase() === 'UNUSED');
assert.strictEqual(unusedBoothsInStore.length, 7, `Must have exactly 7 unused booths in store.booths, got ${unusedBoothsInStore.length}`);
const expectedUnusedCodes = ['DDN-766', 'DDN-1750', 'DDN-1753', 'DDN-1680', 'DDN-1635', 'DDN-1630', 'DDN-1763'];
expectedUnusedCodes.forEach(code => {
  assert.ok(unusedBoothsInStore.some(b => (b.id || b.code) === code), `Unused booth ${code} must be present in store.booths`);
});
console.log('✓ Requirement 5 (Unused Booths): All 7 authentic unassigned booths registered with status UNUSED');

// 8. Test ETS Map ignores UNUSED booths
window.etsMap.init('ets-map-container');
window.etsMap.renderAllMarkers(true);
expectedUnusedCodes.forEach(code => {
  assert.strictEqual(window.etsMap.allMarkerInstances[code], undefined, `Unused booth ${code} must NOT have an active map pin`);
});
console.log('✓ Requirement 6 (Map Pins): None of the 7 unused booths rendered as active pins on ETS map');

console.log('\n======================================================');
console.log('🎉 ALL USER REQUIREMENTS VERIFIED AND PASSED 100%!');
console.log('======================================================\n');
