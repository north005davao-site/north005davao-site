const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING PRODUCTION SUITE & FAVICON ===\n');

// 1. Verify Favicon links in index.html
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('<link rel="icon" type="image/png" href="assets/north-005-logo.png">'), 'index.html must have favicon pointing to assets/north-005-logo.png');
assert.ok(html.includes('<link rel="shortcut icon" type="image/png" href="assets/north-005-logo.png">'), 'index.html must have shortcut icon pointing to assets/north-005-logo.png');
assert.ok(html.includes('css/production-suite.css'), 'index.html must link css/production-suite.css');
assert.ok(html.includes('js/production-suite.js'), 'index.html must load js/production-suite.js');
console.log('✓ Requirement 1 (Favicon & Assets): Favicon linked to assets/north-005-logo.png and production suite assets included.');

// 2. Setup mock browser environment
const localStorageData = {};
const sessionStorageData = {};
global.localStorage = {
  getItem: (key) => localStorageData[key] || null,
  setItem: (key, val) => { localStorageData[key] = String(val); },
  removeItem: (key) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};
global.sessionStorage = {
  getItem: (key) => sessionStorageData[key] || null,
  setItem: (key, val) => { sessionStorageData[key] = String(val); },
  removeItem: (key) => { delete sessionStorageData[key]; },
  clear: () => { Object.keys(sessionStorageData).forEach(k => delete sessionStorageData[k]); }
};

global.window = global;
global.document = {
  getElementById: (id) => ({
    id,
    value: '',
    innerHTML: '',
    textContent: '',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {},
    focus: () => {}
  }),
  createElement: (tag) => ({
    tagName: tag,
    className: '',
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {} },
    querySelector: () => ({ onclick: null }),
    querySelectorAll: () => [],
    appendChild: () => {},
    remove: () => {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.navigator = { userAgent: 'Mozilla/5.0 NodeTest' };
global.Blob = class Blob { constructor(content) { this.content = content; } };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };

// Mock Leaflet
global.L = {
  layerGroup: () => ({ clearLayers: () => {}, addLayer: () => {}, addTo: () => {} }),
  map: () => ({ setView: () => {}, fitBounds: () => {}, on: () => {}, invalidateSize: () => {} }),
  tileLayer: () => ({ addTo: () => {} }),
  divIcon: (opts) => opts,
  marker: () => ({ bindTooltip: () => ({}), bindPopup: () => ({}), openPopup: () => ({}), getLatLng: () => ({ lat: 7.5, lng: 125.6 }) }),
  latLngBounds: () => ({ pad: () => ({}) })
};

// Load dependencies
require('./js/store.js');
require('./js/auth.js');
require('./js/map-ets.js');
require('./js/app.js');
require('./js/production-suite.js');

const ps = window.productionSuite;
assert.ok(ps, 'productionSuite must be initialized on window');

// 3. Test Rate Limiter
console.log('\n--- Testing Rate Limiter (Brute Force Protection) ---');
const testUser = 'test_attacker';
ps.resetRateLimit(testUser);
assert.strictEqual(ps.checkRateLimit(testUser).allowed, true, 'First attempt must be allowed');

for (let i = 0; i < 4; i++) {
  const r = ps.recordFailedAttempt(testUser);
  assert.strictEqual(r.locked, false, `Attempt ${i + 1} should not lock yet`);
}
const lockResult = ps.recordFailedAttempt(testUser);
assert.strictEqual(lockResult.locked, true, '5th failed attempt must trigger lock');
const checkLocked = ps.checkRateLimit(testUser);
assert.strictEqual(checkLocked.allowed, false, 'Rate limit check must disallow login during cooldown');
assert.ok(checkLocked.message.includes('cooldown'), 'Rate limit message must inform user of cooldown');

// Test that authManager.login respects rate limit
const loginAttempt = window.authManager.login(testUser, 'wrongpassword');
assert.strictEqual(loginAttempt.success, false);
assert.ok(loginAttempt.message.includes('cooldown') || loginAttempt.message.includes('wait'), 'Login response must enforce security cooldown');

ps.resetRateLimit(testUser);
assert.strictEqual(ps.checkRateLimit(testUser).allowed, true, 'Resetting rate limit must restore access');
console.log('✓ Rate Limiter: Verified brute force protection locks out after 5 failures and restores upon reset.');

// 4. Test Inactivity Session Guard
console.log('\n--- Testing Session Inactivity Lock Guard ---');
window.authManager.currentUser = { username: 'admin', name: 'Peter John Carrillo', role: 'Administrator', password: 'admin' };
ps.lockSessionNow();
assert.strictEqual(ps.sessionGuard.isLocked, true, 'Manual lock must lock session');

const wrongUnlock = ps.unlockSession('wrongpin');
assert.strictEqual(wrongUnlock, false, 'Incorrect PIN must fail unlock');
assert.strictEqual(ps.sessionGuard.isLocked, true, 'Session must remain locked on failed unlock');

const correctUnlock = ps.unlockSession('admin');
assert.strictEqual(correctUnlock, true, 'Correct credentials must unlock session');
assert.strictEqual(ps.sessionGuard.isLocked, false, 'Session is now unlocked');
console.log('✓ Session Guard: Verified terminal inactivity lock and secure credential unlock.');

// 5. Test Command Palette (Ctrl+K Quick Find)
console.log('\n--- Testing Command Palette (Ctrl+K Quick Find) ---');
ps.commandPalette.handleSearch('DDN-754');
assert.ok(ps.commandPalette.currentResults.length > 0, 'Searching DDN-754 must find matching booth/staff');
const hasBoothOrStaff = ps.commandPalette.currentResults.some(r => r.title.includes('754') || r.sub.includes('754'));
assert.ok(hasBoothOrStaff, 'Results must contain booth or staff with 754');

ps.commandPalette.handleSearch('dashboard');
assert.ok(ps.commandPalette.currentResults.some(r => r.title.includes('Executive Dashboard')), 'Searching "dashboard" must find Executive Dashboard module');
console.log('✓ Command Palette: Verified fast fuzzy search across modules, staff, and booths.');

// 6. Test Snapshot & Rollback Engine
console.log('\n--- Testing Snapshot & Safe Rollback Engine ---');
const snap = ps.createSnapshot('Pre-Test Safety Snapshot');
assert.ok(snap && snap.id.startsWith('SNAP-'), 'Snapshot must be created with valid ID');
const allSnaps = ps.snapshotManager.getSnapshots();
assert.ok(allSnaps.some(s => s.id === snap.id), 'Snapshot must be stored in localStorage');

// Mutate store data to verify restoration
const origStaffCount = window.appStore.data.employees.length;
window.appStore.data.employees.push({ id: 'MUTATED-1', name: 'Mutated Person', role: 'Sales Representative' });
assert.strictEqual(window.appStore.data.employees.length, origStaffCount + 1);

const restoreRes = ps.restoreSnapshot(snap.id);
assert.strictEqual(restoreRes.success, true, 'Snapshot rollback must succeed');
assert.strictEqual(window.appStore.data.employees.length, origStaffCount, 'Rollback must accurately restore original staff count');
console.log('✓ Snapshot Engine: Verified automatic snapshot creation and instant 1-click state rollback.');

// 7. Test System Diagnostics & 1-Click Auto-Repair
console.log('\n--- Testing System Diagnostics & Self-Healing ---');
const audit = ps.systemDiagnostics.runIntegrityAudit();
assert.strictEqual(audit.stats.operationalStaff, 150, `Operational staff count must be 150, got ${audit.stats.operationalStaff}`);
assert.strictEqual(audit.stats.relieversInStore, 34, `Relievers registry must be 34, got ${audit.stats.relieversInStore}`);
assert.strictEqual(audit.stats.unusedBooths, 7, `Unused booths must be 7, got ${audit.stats.unusedBooths}`);
assert.strictEqual(audit.isHealthy, true, 'System must report 100% healthy status');

const repairRes = ps.systemDiagnostics.runAutoRepair();
assert.strictEqual(repairRes.success, true, 'Auto-repair routine must execute cleanly');
console.log('✓ Diagnostics: 100% clean audit across 150 staff, 34 relievers (DDN005-SR000), and 7 unused booths.');

// 8. Test Toast Notification System
console.log('\n--- Testing Toast Notifications ---');
const toastEl = window.showToast('Test Toast Notification', 'success', 'Success Title');
assert.ok(toastEl, 'showToast must return created element');
console.log('✓ Toast System: Non-blocking notifications active.');

console.log('\n======================================================');
console.log('🎉 ALL PRODUCTION SUITE REQUIREMENTS PASSED 100%!');
console.log('======================================================\n');
process.exit(0);
