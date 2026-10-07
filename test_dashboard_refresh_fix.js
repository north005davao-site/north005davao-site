const fs = require('fs');
const path = require('path');

console.log('=== VERIFYING DASHBOARD REFRESH & RELIEVER MULTI-UPDATE FIXES ===');

// 1. Inspect index.html fallback figures
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const forbiddenMockStrings = [
  '81 Active',
  '78 Outlets',
  '₱301,500',
  '467 Rolls',
  '78 Sales Reps • 3 Relievers',
  '6 Municipalities Active',
  '↑ +14.2% Across Davao Del Norte Circuits',
  '78 / 78 Online',
  '81 Staff'
];

forbiddenMockStrings.forEach(str => {
  if (indexHtml.includes(str)) {
    console.error(`❌ Found stale mock string in index.html: "${str}"`);
    process.exit(1);
  } else {
    console.log(`✓ Confirmed stale mock string removed: "${str}"`);
  }
});

// 2. Check js/app.js does not call renderCharts
const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
if (appJs.includes('renderCharts()') || appJs.includes('renderCharts(')) {
  console.error('❌ Found crashing renderCharts() in js/app.js');
  process.exit(1);
} else {
  console.log('✓ Confirmed renderCharts() reference removed from js/app.js');
}

// 3. Mock localStorage and browser environment to test store.js and app.js
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.sessionStorage = {
  _data: {},
  getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};
require('./js/store.js');
const store = window.appStore;
const relievers = store.getEmployees().filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));
console.log(`Relievers count in registry: ${relievers.length}`);

if (relievers.length !== 34) {
  console.error(`❌ Expected 34 relievers, got ${relievers.length}`);
  process.exit(1);
}
console.log('✓ Exactly 34 relievers loaded');

// Verify relievers municipalities are real municipalities and not "Davao Sector"
const davaoSectorRelievers = relievers.filter(r => r.municipality === 'Davao Sector' || r.municipality === 'Davao Del Norte');
if (davaoSectorRelievers.length > 0) {
  console.error(`❌ Found ${davaoSectorRelievers.length} relievers with generic Davao Sector municipality!`);
  process.exit(1);
}
console.log('✓ All 34 relievers have specific municipality assignments (Sto. Tomas, Tagum City, Panabo City, Carmen)');

// Verify all relievers are Active
const inactiveRelievers = relievers.filter(r => (r.status || '').toUpperCase() !== 'ACTIVE');
if (inactiveRelievers.length > 0) {
  console.error(`❌ Found ${inactiveRelievers.length} inactive relievers! All 34 should be ACTIVE`);
  process.exit(1);
}
console.log('✓ All 34 relievers have status ACTIVE');

// 4. Test targeted edit of a single reliever with shared ID DDN005-SR000
const testReliever1 = relievers[0];
const testReliever2 = relievers[1];
console.log(`Testing isolated update on: ${testReliever1.name} (id: ${testReliever1.id}) vs ${testReliever2.name} (id: ${testReliever2.id})`);

store.updateEmployee(testReliever1.id, { phone: '09123456789', notes: 'Specific Note' }, testReliever1.name);

const updatedRel1 = store.getEmployees().find(e => e.name === testReliever1.name);
const updatedRel2 = store.getEmployees().find(e => e.name === testReliever2.name);

if (updatedRel1.phone !== '09123456789') {
  console.error(`❌ Update failed on target reliever: phone is ${updatedRel1.phone}`);
  process.exit(1);
}
if (updatedRel2.phone === '09123456789') {
  console.error(`❌ Contamination bug! Reliever 2 was also modified when updating Reliever 1!`);
  process.exit(1);
}
console.log('✓ Disambiguated update succeeded: only targeted reliever was updated!');

// 5. Test targeted delete of a single reliever
const initialCount = store.getEmployees().length;
store.deleteEmployee(testReliever1.id, testReliever1.name);
const afterCount = store.getEmployees().length;

if (afterCount !== initialCount - 1) {
  console.error(`❌ Expected delete count to be ${initialCount - 1}, got ${afterCount}`);
  process.exit(1);
}

const stillExistsRel2 = store.getEmployees().some(e => e.name === testReliever2.name);
if (!stillExistsRel2) {
  console.error(`❌ Contamination bug! Reliever 2 was accidentally deleted along with Reliever 1!`);
  process.exit(1);
}
console.log('✓ Disambiguated delete succeeded: only targeted reliever was deleted!');

// 6. Test AuthManager & User Deletion Persistence (Mark Anthony / collector fix)
require('./js/auth.js');
const authManager = window.authManager;
const currentUsers = authManager.getUsers();
console.log('Current system users:', currentUsers.map(u => `${u.username} (${u.name})`));

const hasMarkAnthony = currentUsers.some(u => u.username === 'collector' || (u.name && u.name.toUpperCase().includes('MARK ANTHONY')));
if (hasMarkAnthony) {
  console.error('❌ Mark Anthony (MAC2) / collector is still present in default users!');
  process.exit(1);
}
console.log('✓ Confirmed Mark Anthony (MAC2) / collector is NOT resurrected in system users');

// Test deletion and persistent tombstone
authManager.register({
  username: 'test_temp_user',
  name: 'Temporary User',
  password: 'Password123!',
  confirmPassword: 'Password123!',
  position: 'Collector'
});
console.log('Registered temporary user. Now deleting...');
const tempUser = authManager.getUsers().find(u => u.username === 'test_temp_user');
if (!tempUser) {
  console.error('❌ Failed to find registered temporary user');
  process.exit(1);
}

authManager.deleteUser(tempUser.id);
const usersAfterDelete = authManager.getUsers();
if (usersAfterDelete.some(u => u.username === 'test_temp_user')) {
  console.error('❌ Temporary user still exists after deleteUser!');
  process.exit(1);
}

// Test re-initializing authManager (simulating browser reload / refresh)
authManager.initUsers();
const usersAfterReload = authManager.getUsers();
if (usersAfterReload.some(u => u.username === 'test_temp_user')) {
  console.error('❌ Temporary user was resurrected on reload! Tombstone failed!');
  process.exit(1);
}
console.log('✓ Deletion tombstone verified: deleted users remain permanently purged across reloads');

// 7. Verify index.html contains dash-wf-relievers and dash-booth-muni-samal
if (!indexHtml.includes('dash-wf-relievers')) {
  console.error('❌ index.html is missing dash-wf-relievers!');
  process.exit(1);
}
if (!indexHtml.includes('dash-booth-muni-samal')) {
  console.error('❌ index.html is missing dash-booth-muni-samal!');
  process.exit(1);
}
console.log('✓ Confirmed index.html contains dash-wf-relievers and dash-booth-muni-samal');

// 8. Verify Booths Count is exactly 123 (never 126 or 123/126)
const totalStoreBooths = store.getBooths().length;
if (totalStoreBooths !== 123) {
  console.error(`❌ Expected exactly 123 booths in store, got ${totalStoreBooths}`);
  process.exit(1);
}
console.log(`✓ Store booths strictly equals 123 outlets: verified`);

// Test rogue booth sanitizer: inject 3 rogue/phantom booths (simulating stale 126 localStorage)
store.data.booths.push({ id: 'DDN-9999', code: 'DDN-9999', name: 'Rogue 1', status: 'Active' });
store.data.booths.push({ id: 'DDN-9998', code: 'DDN-9998', name: 'Rogue 2', status: 'Active' });
store.data.booths.push({ id: 'DDN-9997', code: 'DDN-9997', name: 'Rogue 3', status: 'Active' });
console.log('Injected 3 rogue booths to simulate 126 count. Total now:', store.data.booths.length);
store.save();

// Now trigger store.load() (simulating browser refresh)
store.load();
const sanitizedBooths = store.getBooths().length;
if (sanitizedBooths !== 123) {
  console.error(`❌ Rogue booth sanitizer failed! Expected 123 after load(), got ${sanitizedBooths}`);
  process.exit(1);
}
console.log('✓ Rogue booth sanitizer verified: 126 booths in localStorage cleanly purged down to 123 authentic outlets!');

// 9. Verify Fast Branded Splash Loader & Logo Animation
if (!indexHtml.includes('id="app-splash-loader"')) {
  console.error('❌ index.html is missing #app-splash-loader overlay!');
  process.exit(1);
}
if (!indexHtml.includes('assets/north-005-logo.png')) {
  console.error('❌ index.html is missing official logo link!');
  process.exit(1);
}
const stylesCss = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf8');
if (!stylesCss.includes('.app-splash-overlay')) {
  console.error('❌ styles.css is missing .app-splash-overlay styles!');
  process.exit(1);
}
console.log('✓ Confirmed Fast Branded Splash Loader with official NORTH-005 logo and styles active');

console.log('\n======================================================');
console.log('🎉 ALL DASHBOARD REFRESH, 123 BOOTHS & SPLASH TESTS PASSED!');
console.log('======================================================\n');
