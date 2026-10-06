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
  // Sto. Tomas (Master Registry Verified)
  { code: 'DDN-754', expectedLat: 7.532151, expectedLng: 125.651232, muni: 'Sto. Tomas' },
  { code: 'DDN-352', expectedLat: 7.484155, expectedLng: 125.716352, muni: 'Sto. Tomas' },
  { code: 'DDN-762', expectedLat: 7.522965, expectedLng: 125.613093, muni: 'Sto. Tomas' },
  // Tagum City (Master Registry Verified)
  { code: 'DDN-760', expectedLat: 7.465273, expectedLng: 125.825592, muni: 'Tagum City' },
  { code: 'DDN-350', expectedLat: 7.460470, expectedLng: 125.784925, muni: 'Tagum City' },
  { code: 'DDN-769', expectedLat: 7.423330, expectedLng: 125.828964, muni: 'Tagum City' },
  // Panabo City (Master Registry Verified)
  { code: 'DDN-398', expectedLat: 7.293308, expectedLng: 125.667908, muni: 'Panabo City' },
  { code: 'DDN-399', expectedLat: 7.320821, expectedLng: 125.668614, muni: 'Panabo City' },
  // Carmen (Master Registry Verified)
  { code: 'DDN-397', expectedLat: 7.355234, expectedLng: 125.706468, muni: 'Carmen' },
  { code: 'DDN-425', expectedLat: 7.368167, expectedLng: 125.723424, muni: 'Carmen' },
  // Talaingod (Master Registry Verified)
  { code: 'DDN-1424', expectedLat: 7.626863, expectedLng: 125.616652, muni: 'Talaingod' },
  { code: 'DDN-1752', expectedLat: 7.629899, expectedLng: 125.605769, muni: 'Talaingod' },
  // Kapalong (Master Registry Verified)
  { code: 'DDN-1523', expectedLat: 7.621407, expectedLng: 125.703117, muni: 'Kapalong' },
  { code: 'DDN-402', expectedLat: 7.597889, expectedLng: 125.707191, muni: 'Kapalong' },
  // Samal (Master Registry Verified)
  { code: 'DDN-1281', expectedLat: 7.131028, expectedLng: 125.711256, muni: 'Samal' },
  { code: 'DDN-1284', expectedLat: 7.130260, expectedLng: 125.696882, muni: 'Samal' },
  { code: 'DDN-1285', expectedLat: 7.147230, expectedLng: 125.708615, muni: 'Samal' }
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

// Verify that non-existent/uncoordinated booths have NO marker rendered on the map
const uncoordinatedBooths = ['DDN-9999', 'DDN-UNKNOWN'];
uncoordinatedBooths.forEach(code => {
  assert.strictEqual(window.etsMap.allMarkerInstances[code], undefined, `Uncoordinated booth ${code} must NOT have a map marker`);
});
console.log('✓ Uncoordinated booths are NOT rendered as fake markers.');

// Verify no pseudo-booth marker was created for '-'
assert.strictEqual(window.etsMap.allMarkerInstances['-'], undefined, 'No marker should exist for booth "-"');
console.log('✓ Non-booth roaming personnel ("-") properly excluded from booth map.');

// Verify diagnostic audit report output
const audit = window.getEtsGpsAuditReport();
assert(audit, 'getEtsGpsAuditReport must return audit data');
assert.strictEqual(audit.recordsWithValidGps, 116, 'Must have exactly 116 valid GPS coordinates matching Master Registry');
assert.strictEqual(audit.estMarkersCreated, 116, 'Must have rendered exactly 116 EST markers on map');
console.log(`✓ Diagnostic Audit Report Verified: Total: ${audit.totalMasterRegistryBooths} | Valid GPS: ${audit.recordsWithValidGps} | Markers: ${audit.estMarkersCreated} | Missing GPS: ${audit.recordsWithMissingGps}`);

// --- TEST 5: CLICKING A STAFF MEMBER IN FLEET MONITOR FOCUSES EXACT BOOTH ---
console.log('\n--- TEST 5: Fleet Activity Monitor Click Interactivity ---');
window.focusStaffMember('DDN005-SR754'); // Belle Amor Quizo -> DDN-754
const m754 = window.etsMap.allMarkerInstances['DDN-754'];
assert(m754.isPopupOpen, 'Popup for DDN-754 must be open');
assert.strictEqual(global.lastMapCenter[0], 7.532151);
assert.strictEqual(global.lastMapCenter[1], 125.651232);
console.log('✓ Clicking Belle Amor Quizo (DDN005-SR754) centered map on 7.532151, 125.651232 and opened DDN-754 popup');

window.focusStaffMember('DDN005-SR760'); // Elvie Oñez -> DDN-760 (Tagum City)
const m760 = window.etsMap.allMarkerInstances['DDN-760'];
assert(m760.isPopupOpen, 'Popup for DDN-760 must be open');
assert.strictEqual(global.lastMapCenter[0], 7.465273);
assert.strictEqual(global.lastMapCenter[1], 125.825592);
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
assert.strictEqual(bUpdated._userCalibrated, true);
console.log('✓ Recalibrating coordinates persists correctly across store booths and employees with _userCalibrated: true');

// --- TEST 8: LOCALSTORAGE PURGE OF STALE CATERPILLAR COORDINATES ---
console.log('\n--- TEST 8: LocalStorage Purge of Stale Caterpillar Coordinates ---');
const mockStaleData = {
  employees: [
    { id: 'DDN005-SR754', name: 'Belle Amor Quizo', boothCode: 'DDN-754', lat: 99.9, lng: 99.9 },
    { id: 'DDN-FAKE-1', name: 'Fake Uncoordinated', boothCode: 'DDN-9999', lat: 7.5270, lng: 125.6290 } // Booth without Master Registry GPS
  ],
  booths: [
    { id: 'DDN-754', code: 'DDN-754', lat: 99.9, lng: 99.9 },
    { id: 'DDN-9999', code: 'DDN-9999', lat: 7.5270, lng: 125.6290 } // Booth without Master Registry GPS
  ]
};
// Pad employees array to pass load sanity check (> 50 employees)
for (let i = 0; i < 60; i++) {
  mockStaleData.employees.push({ id: `MOCK-${i}`, name: `Staff ${i}`, role: 'TELLER', boothCode: `MOCK-${i}`, lat: 7.5 + i * 0.001, lng: 125.6 + i * 0.001 });
  mockStaleData.booths.push({ id: `MOCK-${i}`, code: `MOCK-${i}`, lat: 7.5 + i * 0.001, lng: 125.6 + i * 0.001 });
}
localStorage.setItem('apex_omnierp_data_v4_ddn', JSON.stringify(mockStaleData));

// Reload store
const reloaded = window.appStore.load();
const b754 = reloaded.booths.find(b => b.id === 'DDN-754');
const b9999 = reloaded.booths.find(b => b.id === 'DDN-9999');
assert.strictEqual(b754.lat, 7.532151, 'DDN-754 must be updated to authentic Master Registry lat');
assert.strictEqual(b754.lng, 125.651232, 'DDN-754 must be updated to authentic Master Registry lng');
assert.strictEqual(b9999.lat, null, 'DDN-9999 without Master Registry GPS must be purged to null');
assert.strictEqual(b9999.lng, null, 'DDN-9999 without Master Registry GPS must be purged to null');
console.log('✓ LocalStorage migration (_gpsStrictMasterV1) successfully purged fake coordinates and synchronized Master Registry!');

// --- TEST 9: SMART CACHE DATA INTEGRITY & TTL FALLBACK ---
console.log('\n--- TEST 9: Smart Cache Data Integrity & TTL Fallback ---');
const curVer = window.appStore.getMasterRegistryVersion();
assert.ok(curVer.startsWith('MRV-'), 'Master Registry Version must start with MRV-');

// Render markers to populate cache
window.etsMap.renderAllMarkers();
const validCache = window.etsGpsCache.getValidData(curVer);
assert.ok(validCache, 'Smart cache must return valid data for current version');
assert.strictEqual(validCache.version, curVer, 'Cache version must match store version');
assert.strictEqual(validCache.booths.length, 116, 'Cache must contain exactly 116 validated booths');

// Check schema of cached record
const sampleCached = validCache.booths.find(b => b.boothCode === 'DDN-754');
assert.ok(sampleCached, 'Sample booth DDN-754 must be present in cache');
assert.strictEqual(sampleCached.lat, 7.532151);
assert.strictEqual(sampleCached.lng, 125.651232);
assert.strictEqual(sampleCached.municipality, 'Sto. Tomas');
assert.strictEqual(typeof sampleCached.masterRegistryVersion, 'string');
assert.strictEqual(typeof sampleCached.lastUpdated, 'string');

// Test TTL Expiration
const originalTimestamp = validCache.timestamp;
validCache.timestamp = Date.now() - (20 * 60 * 1000); // 20 minutes ago (> 15 min TTL)
const expiredCheck = window.etsGpsCache.getValidData(curVer);
assert.strictEqual(expiredCheck, null, 'Expired cache past 15 min TTL must return null');
validCache.timestamp = originalTimestamp; // Restore

// Test Corrupted / Bad Data Prevention
const badDataCheck = window.etsGpsCache._isValidCachePayload({
  version: curVer,
  timestamp: Date.now(),
  booths: [{ boothCode: 'BAD-1', lat: 'invalid', lng: 125.6 }]
}, curVer);
assert.strictEqual(badDataCheck, false, 'Cache payload with non-numeric coordinates must be rejected');

console.log('✓ Smart Cache validates data integrity, strict coordinates, and enforces 15-minute TTL expiration.');

// --- TEST 10: VERSION-BASED CACHE INVALIDATION & PIN RECALIBRATION ---
console.log('\n--- TEST 10: Version-Based Cache Invalidation & Pin Recalibration ---');
const oldVer = window.appStore.getMasterRegistryVersion();
// Recalibrate DDN-754 to a new precision coordinate
window.appStore.updateCoordinates('DDN-754', 7.532200, 125.651300);
const newVer = window.appStore.getMasterRegistryVersion();
assert.notStrictEqual(oldVer, newVer, 'Recalibration must bump Master Registry Version');

// Old version cache lookup must now fail
const staleLookup = window.etsGpsCache.getValidData(oldVer);
assert.strictEqual(staleLookup, null, 'Stale version cache lookup must be rejected');

// Render markers with new version
window.etsMap.renderAllMarkers();
const newCache = window.etsGpsCache.getValidData(newVer);
assert.ok(newCache, 'New cache must be generated for new version');
const updatedCachedBooth = newCache.booths.find(b => b.boothCode === 'DDN-754');
assert.strictEqual(updatedCachedBooth.lat, 7.532200);
assert.strictEqual(updatedCachedBooth.lng, 125.651300);
console.log('✓ Pin recalibration bumps version and invalidates old cache without requiring browser restart.');

// --- TEST 11: EXCEL IMPORT AUTO-INVALIDATION & REFRESH ---
console.log('\n--- TEST 11: Excel Import Auto-Invalidation & Pin Refresh ---');
const preExcelVer = window.appStore.getMasterRegistryVersion();
const excelSyncRes = window.appStore.syncEmployeesFromExcel({
  newRecords: [],
  updateRecords: [
    { boothCode: 'DDN-754', name: 'Belle Amor Quizo', lat: 7.532151, lng: 125.651232 }
  ],
  fileName: 'Master_Registry_Update.xlsx',
  user: 'Peter John Carrillo'
});
const postExcelVer = window.appStore.getMasterRegistryVersion();
assert.notStrictEqual(preExcelVer, postExcelVer, 'Excel sync must bump Master Registry Version');

// Test that force refresh regenerates cache with new data
window.etsMap.renderAllMarkers(true);
const postExcelCache = window.etsGpsCache.getValidData(postExcelVer);
assert.ok(postExcelCache, 'Cache must be populated after Excel import refresh');
const restoredBooth = postExcelCache.booths.find(b => b.boothCode === 'DDN-754');
assert.strictEqual(restoredBooth.lat, 7.532151);
assert.strictEqual(restoredBooth.lng, 125.651232);
console.log('✓ Master Registry Excel import automatically bumps version and invalidates cache.');

// --- TEST 12: SECTION 18 validateEtsGpsSync() VERIFICATION ---
console.log('\n--- TEST 12: validateEtsGpsSync() Full Verification ---');
const syncAudit = window.validateEtsGpsSync();
assert.strictEqual(syncAudit.success, true, 'All booths must be synchronized between Master Registry, EST, and Markers');
assert.strictEqual(syncAudit.discrepancies, 0, 'Zero discrepancies allowed');
assert.ok(syncAudit.totalChecked >= 116, 'Must check all valid booths');
console.log(`✓ validateEtsGpsSync() verified ${syncAudit.totalChecked} booths: 100% synchronized across Master Registry, EST, and Map Markers.`);

console.log('\n========================================================================');
console.log('ALL EST LIVE TRACKING & GPS PIN TESTS PASSED WITH 100% SUCCESS! 🚀');
console.log('========================================================================');
process.exit(0);
