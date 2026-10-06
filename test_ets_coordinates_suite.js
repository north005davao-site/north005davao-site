/**
 * Test Suite: EST Live Tracking & STL Booth GPS Precision Verification
 * Tests the complete data flow:
 * MASTER REGISTRY -> Booth Code -> GPS Coordinates -> EST Live Tracking -> Map Marker
 */

const assert = require('assert');

// Mock browser environment
const localStorageData = {};
global.localStorage = {
  getItem: (key) => localStorageData[key] || null,
  setItem: (key, val) => { localStorageData[key] = String(val); },
  removeItem: (key) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};

const sessionStorageData = {};
global.sessionStorage = {
  getItem: (key) => sessionStorageData[key] || null,
  setItem: (key, val) => { sessionStorageData[key] = String(val); },
  removeItem: (key) => { delete sessionStorageData[key]; },
  clear: () => { Object.keys(sessionStorageData).forEach(k => delete sessionStorageData[k]); }
};

global.window = global;
const domElements = {};
global.document = {
  getElementById: (id) => {
    if (!domElements[id]) {
      domElements[id] = {
        id,
        value: '',
        textContent: '',
        innerHTML: '',
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        addEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }
    return domElements[id];
  },
  querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Mock Leaflet
const createdMarkers = [];
global.L = {
  layerGroup: () => ({
    clearLayers: () => { createdMarkers.length = 0; },
    addLayer: (m) => { createdMarkers.push(m); },
    addTo: () => {}
  }),
  map: () => ({
    setView: (latlng, zoom) => { global.lastMapCenter = latlng; global.lastMapZoom = zoom; },
    invalidateSize: () => {},
    on: () => {},
    fitBounds: () => {}
  }),
  tileLayer: () => ({ addTo: () => {} }),
  divIcon: (opts) => opts,
  marker: (latlng, opts) => {
    const instance = {
      latlng,
      opts,
      popupContent: '',
      tooltipContent: '',
      isPopupOpen: false,
      getLatLng: () => ({ lat: latlng[0], lng: latlng[1] }),
      bindTooltip: (content) => { instance.tooltipContent = content; return instance; },
      bindPopup: (content) => { instance.popupContent = content; return instance; },
      openPopup: () => { instance.isPopupOpen = true; return instance; },
      on: () => instance
    };
    return instance;
  }
};

global.alert = (msg) => { console.log('   [Alert Triggered]:', msg); };

console.log('========================================================================');
console.log('RUNNING EST LIVE TRACKING & STL BOOTH GPS MAP VERIFICATION SUITE');
console.log('========================================================================\n');

// Load Modules
require('./js/store.js');
require('./js/auth.js');
require('./js/map-ets.js');
require('./js/app.js');

const parseGps = window.parseGpsCoordinates;
const normBooth = window.normalizeBoothCode;

// --- TEST 1: LATITUDE / LONGITUDE ORDER AND FORMAT PARSING ---
console.log('--- TEST 1: Latitude / Longitude Order & Formats ---');
// First coordinate is lat (~7.5), second is lng (~125.6)
const p1 = parseGps({ lat: 7.519800, lng: 125.615900 });
assert.strictEqual(p1.isValid, true);
assert.strictEqual(p1.lat, 7.519800);
assert.strictEqual(p1.lng, 125.615900);

// String with comma and space
const p2 = parseGps({ gps: '7.524000, 125.625000' });
assert.strictEqual(p2.isValid, true);
assert.strictEqual(p2.lat, 7.524000);
assert.strictEqual(p2.lng, 125.625000);

// String with comma without space
const p3 = parseGps({ coordinates: '7.526000,125.628000' });
assert.strictEqual(p3.isValid, true);
assert.strictEqual(p3.lat, 7.526000);
assert.strictEqual(p3.lng, 125.628000);

// Array format [lat, lng]
const p4 = parseGps({ coordinates: [7.447500, 125.807800] });
assert.strictEqual(p4.isValid, true);
assert.strictEqual(p4.lat, 7.447500);
assert.strictEqual(p4.lng, 125.807800);

// INVERTED format [lng, lat] (e.g. 125.6159, 7.5198) must be automatically detected and corrected
const pInverted = parseGps({ lat: 125.615900, lng: 7.519800 });
assert.strictEqual(pInverted.isValid, true);
assert.strictEqual(pInverted.lat, 7.519800, 'Inverted coordinates must be corrected so Latitude is ~7.x');
assert.strictEqual(pInverted.lng, 125.615900, 'Inverted coordinates must be corrected so Longitude is ~125.x');

console.log('✓ Latitude is first (~7.x), Longitude is second (~125.x), and inverted formats are corrected.');

// --- TEST 2: INVALID COORDINATES MUST BE REJECTED ---
console.log('\n--- TEST 2: Rejecting Invalid / Missing Coordinates ---');
const pZero = parseGps({ lat: 0, lng: 0 });
assert.strictEqual(pZero.isValid, false, '0,0 coordinates must be rejected');

const pNaN = parseGps({ lat: 'abc', lng: 'xyz' });
assert.strictEqual(pNaN.isValid, false, 'Non-numeric strings must be rejected');

const pEmpty = parseGps({});
assert.strictEqual(pEmpty.isValid, false, 'Empty records must return isValid: false');

const pOutOfBounds = parseGps({ lat: 95.0, lng: 200.0 });
assert.strictEqual(pOutOfBounds.isValid, false, 'Out of bounds global coordinates must be rejected');

console.log('✓ Invalid, missing, non-numeric, (0,0), and out-of-bounds coordinates are safely rejected.');

// --- TEST 3: BOOTH CODE NORMALIZATION & ROAMING EXCLUSION ---
console.log('\n--- TEST 3: Booth Code Normalization & Non-Booth Staff Exclusion ---');
assert.strictEqual(normBooth('DDN-754'), 'DDN-754');
assert.strictEqual(normBooth('DDN 754'), 'DDN-754');
assert.strictEqual(normBooth('BOOTH-DDN-754'), 'DDN-754');
assert.strictEqual(normBooth('754'), 'DDN-754');
assert.strictEqual(normBooth('-'), null, 'Collectors/Admins with "-" must return null');
assert.strictEqual(normBooth('N/A'), null);
assert.strictEqual(normBooth(''), null);
assert.strictEqual(normBooth(null), null);
console.log('✓ Booth Code normalization verified and roaming collectors/admins ("-") properly excluded.');

// --- TEST 4: MASTER REGISTRY COORDINATES BY BOOTH CODE ACROSS 7 CORRIDORS ---
console.log('\n--- TEST 4: Verifying Booth Markers Across All 7 Corridors ---');
window.etsMap.init('ets-map-container');
window.etsMap.renderAllMarkers();

const testVerificationBooths = [
  // Sto. Tomas
  { code: 'DDN-754', expectedLat: 7.519800, expectedLng: 125.615900, muni: 'Sto. Tomas' },
  { code: 'DDN-352', expectedLat: 7.523500, expectedLng: 125.624100, muni: 'Sto. Tomas' },
  { code: 'DDN-762', expectedLat: 7.526000, expectedLng: 125.628000, muni: 'Sto. Tomas' },
  // Tagum City
  { code: 'DDN-760', expectedLat: 7.447500, expectedLng: 125.807800, muni: 'Tagum City' },
  { code: 'DDN-766', expectedLat: 7.448500, expectedLng: 125.809200, muni: 'Tagum City' },
  { code: 'DDN-769', expectedLat: 7.449500, expectedLng: 125.811000, muni: 'Tagum City' },
  // Panabo City
  { code: 'DDN-398', expectedLat: 7.307800, expectedLng: 125.683300, muni: 'Panabo City' },
  { code: 'DDN-399', expectedLat: 7.309000, expectedLng: 125.685000, muni: 'Panabo City' },
  // Carmen
  { code: 'DDN-397', expectedLat: 7.358600, expectedLng: 125.706100, muni: 'Carmen' },
  { code: 'DDN-425', expectedLat: 7.361000, expectedLng: 125.708000, muni: 'Carmen' },
  // Talaingod
  { code: 'DDN-1424', expectedLat: 7.653600, expectedLng: 125.641700, muni: 'Talaingod' },
  { code: 'DDN-1752', expectedLat: 7.655000, expectedLng: 125.643000, muni: 'Talaingod' },
  // Kapalong
  { code: 'DDN-1523', expectedLat: 7.585500, expectedLng: 125.707200, muni: 'Kapalong' },
  // Samal
  { code: 'DDN-2001', expectedLat: 7.073600, expectedLng: 125.712800, muni: 'Samal' },
  { code: 'DDN-2002', expectedLat: 7.085000, expectedLng: 125.719000, muni: 'Samal' },
  { code: 'DDN-2003', expectedLat: 7.052000, expectedLng: 125.705000, muni: 'Samal' }
];

testVerificationBooths.forEach(tb => {
  const marker = window.etsMap.allMarkerInstances[tb.code];
  assert(marker, `Marker for ${tb.code} must exist in allMarkerInstances`);
  const pos = marker.getLatLng();
  assert.strictEqual(pos.lat, tb.expectedLat, `Booth ${tb.code} Latitude mismatch. Expected: ${tb.expectedLat}, Got: ${pos.lat}`);
  assert.strictEqual(pos.lng, tb.expectedLng, `Booth ${tb.code} Longitude mismatch. Expected: ${tb.expectedLng}, Got: ${pos.lng}`);
  assert(marker.popupContent.includes(tb.code), `Popup for ${tb.code} must include its Booth Code`);
  console.log(`✓ Booth ${tb.code.padEnd(8)} | Muni: ${tb.muni.padEnd(11)} | Lat: ${pos.lat.toFixed(6)} | Lng: ${pos.lng.toFixed(6)} | STATUS: MATCH`);
});

// Verify no pseudo-booth marker was created for '-'
assert.strictEqual(window.etsMap.allMarkerInstances['-'], undefined, 'No marker should exist for booth "-"');

// --- TEST 5: CLICKING A STAFF MEMBER IN FLEET MONITOR FOCUSES EXACT BOOTH ---
console.log('\n--- TEST 5: Fleet Activity Monitor Click Interactivity ---');
window.focusStaffMember('DDN005-SR754'); // Belle Amor Quizo -> DDN-754
const m754 = window.etsMap.allMarkerInstances['DDN-754'];
assert(m754.isPopupOpen, 'Popup for DDN-754 must be open');
assert.strictEqual(global.lastMapCenter[0], 7.519800);
assert.strictEqual(global.lastMapCenter[1], 125.615900);
console.log('✓ Clicking Belle Amor Quizo (DDN005-SR754) centered map on 7.519800, 125.615900 and opened DDN-754 popup');

window.focusStaffMember('DDN005-SR760'); // Elvie Oñez -> DDN-760 (Tagum City)
const m760 = window.etsMap.allMarkerInstances['DDN-760'];
assert(m760.isPopupOpen, 'Popup for DDN-760 must be open');
assert.strictEqual(global.lastMapCenter[0], 7.447500);
assert.strictEqual(global.lastMapCenter[1], 125.807800);
console.log('✓ Clicking Elvie Oñez (DDN005-SR760) centered map on 7.447500, 125.807800 and opened DDN-760 popup');

// --- TEST 6: MUNICIPALITY LEGEND COLORS PRESERVED ---
console.log('\n--- TEST 6: Municipality Legend Color Mapping ---');
const colors = {
  'Panabo City': window.getMunicipalityColor('Panabo City'),
  'Sto. Tomas': window.getMunicipalityColor('Sto. Tomas'),
  'Carmen': window.getMunicipalityColor('Carmen'),
  'Kapalong': window.getMunicipalityColor('Kapalong'),
  'Tagum City': window.getMunicipalityColor('Tagum City'),
  'Talaingod': window.getMunicipalityColor('Talaingod'),
  'Samal': window.getMunicipalityColor('Samal')
};

assert.strictEqual(colors['Panabo City'], '#10b981', 'Panabo must be GREEN');
assert.strictEqual(colors['Sto. Tomas'], '#eab308', 'Sto. Tomas must be YELLOW');
assert.strictEqual(colors['Carmen'], '#ef4444', 'Carmen must be RED');
assert.strictEqual(colors['Kapalong'], '#3b82f6', 'Kapalong must be BLUE');
assert.strictEqual(colors['Tagum City'], '#8b5cf6', 'Tagum City must be PURPLE');
assert.strictEqual(colors['Talaingod'], '#ec4899', 'Talaingod must be PINK');
assert.strictEqual(colors['Samal'], '#06b6d4', 'Samal must be CYAN');
console.log('✓ All municipality colors verified: Panabo=GREEN, Sto. Tomas=YELLOW, Carmen=RED, Kapalong=BLUE, Tagum=PURPLE, Talaingod=PINK, Samal=CYAN');

// --- TEST 7: RECALIBRATION PERSISTENCE ---
console.log('\n--- TEST 7: Precision Recalibration Persistence ---');
const updated = window.appStore.updateCoordinates('DDN-754', 7.524000, 125.625000);
assert.strictEqual(updated, true);
const bUpdated = window.appStore.getBooths().find(b => b.id === 'DDN-754');
assert.strictEqual(bUpdated.lat, 7.524000);
assert.strictEqual(bUpdated.lng, 125.625000);
console.log('✓ Recalibrating coordinates persists correctly across store booths and employees');

console.log('\n========================================================================');
console.log('ALL EST LIVE TRACKING & GPS PIN TESTS PASSED WITH 100% SUCCESS! 🚀');
console.log('========================================================================');
process.exit(0);
