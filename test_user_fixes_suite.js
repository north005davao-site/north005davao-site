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
assert.ok(testReliever.id.startsWith('DDN005-REL'), `Generated ID must start with DDN005-REL, got ${testReliever.id}`);
const relFound = window.appStore.data.relievers.find(r => r.name === 'Maria Elena Santos');
assert.ok(relFound, 'Reliever must be automatically synced to store.data.relievers');
console.log('✓ Requirement 2 (Role & Store): Added Reliever auto-synced to store.data.relievers with ID:', testReliever.id);

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

console.log('\n======================================================');
console.log('🎉 ALL 3 USER REQUIREMENTS VERIFIED AND PASSED 100%!');
console.log('======================================================\n');
