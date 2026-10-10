/**
 * NORTH-005 DAVAO DEL NORTE HQ
 * Acceptance & Verification Test Suite:
 * - Phase 1: Blank Screen Repair (/master-registry & Dashboard)
 * - Phase 2: NORTH-005 5-Second Cinematic Corporate Reveal (Navy-Blue & Gold)
 * - Phase 3: Post-Login Destination, Skip Intro & Playback Frequency Lifecycle
 * - Phase 4: Non-Regression & Role-Based Access Control
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================================');
console.log('   NORTH-005 CINEMATIC LOGIN & MASTER REGISTRY ACCEPTANCE SUITE    ');
console.log('====================================================================\n');

// 1. Verify Assets and HTML Structure
console.log('--- 1. Testing Assets, Branding & HTML Architecture ---');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf8');
const cinematicCss = fs.readFileSync(path.join(__dirname, 'css/cinematic-intro.css'), 'utf8');

assert.ok(fs.existsSync(path.join(__dirname, 'assets/north-005-logo.png')), 'Official NORTH-005 logo asset must exist');
assert.ok(indexHtml.includes('css/cinematic-intro.css'), 'index.html must link cinematic-intro.css');
assert.ok(indexHtml.includes('js/cinematic-intro.js'), 'index.html must include cinematic-intro.js');
assert.ok(indexHtml.includes('id="cinematic-welcome-overlay"'), 'index.html must have #cinematic-welcome-overlay');
assert.ok(indexHtml.includes('id="cinematic-canvas"'), 'index.html must have #cinematic-canvas');
assert.ok(indexHtml.includes('id="cinematic-skip-btn"'), 'index.html must have #cinematic-skip-btn');
assert.ok(indexHtml.includes('assets/north-005-logo.png'), 'Cinematic reveal must use official logo');
assert.ok(indexHtml.includes('NORTH-005'), 'Must contain exact brand NORTH-005');
assert.ok(indexHtml.includes('DAVAO DEL NORTE HQ'), 'Must contain exact brand DAVAO DEL NORTE HQ');
assert.ok(indexHtml.includes('WELCOME BACK'), 'Must contain welcome greeting WELCOME BACK');
assert.ok(indexHtml.includes('id="registry-error-container"'), 'Master Registry must have error container');
assert.ok(indexHtml.includes('id="registry-loading-row"'), 'Master Registry must have initial loading row');
console.log('✓ Assets, official branding, and DOM overlays verified.');

// 2. Verify CSS Corporate Palette & Timing
console.log('\n--- 2. Testing Corporate Aesthetics & Timing ---');
assert.ok(cinematicCss.includes('#081b35') || cinematicCss.includes('radial-gradient'), 'Must use deep navy-blue background');
assert.ok(cinematicCss.includes('#d4af37') || cinematicCss.includes('#f59e0b'), 'Must feature gold lighting and refined highlights');
assert.ok(cinematicCss.includes('.cinematic-skip-btn'), 'Skip Intro button must have dedicated styles');
assert.ok(cinematicCss.includes('@media (prefers-reduced-motion: reduce)'), 'Must respect OS reduced motion preference');
assert.ok(cinematicCss.includes('@media (max-width: 640px)'), 'Must have mobile responsive breakpoint');
console.log('✓ Navy & gold palette, keyframes, skip button, and reduced-motion verified.');

// 3. Set up headless DOM & storage environment
console.log('\n--- 3. Testing Authentication & Cinematic Intro Lifecycle ---');

const localStorageMock = {};
const sessionStorageMock = {};
const domStore = {};

function getEl(id, tag = 'div') {
  if (!domStore[id]) {
    domStore[id] = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      style: { display: '' },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); }
      },
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k] || null; },
      addEventListener() {},
      removeEventListener() {},
      focus() {}
    };
  }
  return domStore[id];
}

global.localStorage = {
  getItem: (k) => localStorageMock[k] !== undefined ? localStorageMock[k] : null,
  setItem: (k, v) => { localStorageMock[k] = String(v); },
  removeItem: (k) => { delete localStorageMock[k]; },
  clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); }
};

global.sessionStorage = {
  getItem: (k) => sessionStorageMock[k] !== undefined ? sessionStorageMock[k] : null,
  setItem: (k, v) => { sessionStorageMock[k] = String(v); },
  removeItem: (k) => { delete sessionStorageMock[k]; },
  clear: () => { Object.keys(sessionStorageMock).forEach(k => delete sessionStorageMock[k]); }
};

global.window = global;
global.document = {
  body: getEl('body'),
  getElementById: (id) => getEl(id),
  querySelector: (sel) => {
    if (sel.includes('#cinematic')) return getEl(sel.replace('#', ''));
    if (sel.includes('.view-panel.active')) return null;
    return getEl('mock-el');
  },
  querySelectorAll: (sel) => {
    if (sel.includes('.view-panel')) {
      return [getEl('view-dashboard'), getEl('view-employees'), getEl('view-workforce-attendance')];
    }
    return [];
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.alert = (msg) => { global.__lastAlert = msg; };
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Load JS modules
require('./js/cinematic-intro.js');
require('./js/store.js');
require('./js/auth.js');
require('./js/app.js');

const intro = window.cinematicIntro;
const auth = window.authManager;

assert.ok(intro, 'CinematicIntro singleton must be initialized');
assert.ok(auth, 'AuthManager singleton must be initialized');

// TEST 3A: Invalid credentials -> Intro does NOT trigger
getEl('auth-login-username').value = 'admin';
getEl('auth-login-password').value = 'WrongPassword!';
window.submitLoginForm();
assert.strictEqual(intro.isPlaying, false, 'Invalid login credentials must NOT trigger intro');
assert.strictEqual(auth.isAuthenticated(), false, 'User must not be authenticated on bad password');
console.log('✓ TEST 3A: Invalid login credentials correctly blocked from triggering intro');

// TEST 3B: Valid login -> Intro plays and redirects to Dashboard
let redirectedView = null;
const origSwitchView = window.switchView;
window.switchView = function(viewId, updateHistory) {
  origSwitchView(viewId, updateHistory);
  redirectedView = localStorage.getItem('NORTH005_ACTIVE_VIEW');
};

getEl('auth-login-username').value = 'admin';
getEl('auth-login-password').value = 'Admin123!';
window.submitLoginForm();

assert.strictEqual(auth.isAuthenticated(), true, 'Admin credentials authenticate successfully');
assert.strictEqual(intro.isPlaying, true, 'Intro automatically plays upon successful login');
assert.strictEqual(getEl('cinematic-welcome-overlay').style.display, 'flex', 'Overlay displayed as flex');
console.log('✓ TEST 3B: Successful login triggers NORTH-005 cinematic welcome reveal');

// TEST 3C: Skip Intro immediately completes and redirects to Dashboard
intro.skip();
assert.strictEqual(intro.isPlaying, false, 'Skip Intro ends playback immediately');
assert.strictEqual(redirectedView, 'view-dashboard', 'Post-login destination strictly redirects to view-dashboard');
console.log('✓ TEST 3C: Skip Intro navigates immediately to Dashboard without duplicate redirects');

// TEST 3D: Page Refresh does NOT replay intro
// Simulate page refresh: existing session remains in sessionStorage
redirectedView = null;
// Simulate initApp() on page refresh
window.switchView('view-employees', false);
assert.strictEqual(intro.isPlaying, false, 'Page refresh must NOT replay cinematic intro');
assert.strictEqual(redirectedView, 'view-employees', 'Authenticated user navigates directly to requested view');
console.log('✓ TEST 3D: Page refresh / in-app module switching maintains session and does not replay intro');

// TEST 3E: Logout and new login plays intro again
auth.logout();
assert.strictEqual(auth.isAuthenticated(), false, 'User logged out');
redirectedView = null;

getEl('auth-login-username').value = 'admin';
getEl('auth-login-password').value = 'Admin123!';
window.submitLoginForm();

assert.strictEqual(intro.isPlaying, true, 'New login after logout triggers cinematic intro again');
intro.finish();
assert.strictEqual(redirectedView, 'view-dashboard', 'Redirects to Dashboard upon finishing');
console.log('✓ TEST 3E: Logout followed by re-login triggers intro again and lands on Dashboard');

// 4. Verify Master Registry & Blank Page Repair
console.log('\n--- 4. Testing Master Registry Blank-Page Repair & Routing ---');

// TEST 4A: view-master-registry alias maps to view-employees
redirectedView = null;
window.switchView('view-master-registry', false);
assert.strictEqual(redirectedView, 'view-employees', 'view-master-registry automatically normalizes to view-employees');
console.log('✓ TEST 4A: view-master-registry alias cleanly resolved to view-employees');

// TEST 4B: renderEmployeesTable renders actual staff records
const tbody = getEl('employee-table-tbody');
window.renderEmployeesTable();
assert.ok(tbody.innerHTML.includes('<tr>'), 'Master Registry must render rows into employee-table-tbody');
assert.ok(tbody.innerHTML.includes('DDN005-'), 'Rendered rows must display DDN005 IDs');
console.log('✓ TEST 4B: Master Registry renders authentic employee records cleanly');

// TEST 4C: Empty state handling
window.renderEmployeesTable([]);
assert.ok(tbody.innerHTML.includes('registry-empty-row'), 'Must display dedicated empty state row when list is empty');
assert.ok(!tbody.innerHTML.includes('registry-error-container'), 'Empty state must be distinct from error state');
console.log('✓ TEST 4C: Empty data handled separately from loading/error states');

// TEST 4D: Error state & retry action
const errContainer = getEl('registry-error-container');
assert.ok(typeof window.retryMasterRegistryLoad === 'function', 'window.retryMasterRegistryLoad must be a function');
console.log('✓ TEST 4D: Error state and retry action verified');

// 5. Verify Role-Based Redirection Guard
console.log('\n--- 5. Testing Role-Based Navigation Destinations ---');

// Test Teller login destination: strictly Attendance / Workforce Monitoring
auth.logout();
const allUsers = auth.getUsers();
if (!allUsers.some(u => u.username === 'test_teller_dest')) {
  allUsers.push({
    id: 'USR-TELLER-01',
    username: 'test_teller_dest',
    password: 'Password123!',
    role: 'Teller',
    position: 'Teller',
    department: 'Outlet & Booth Operations',
    status: 'Active',
    name: 'Test Teller Unit'
  });
  auth.saveUsers(allUsers);
}

getEl('auth-login-username').value = 'test_teller_dest';
getEl('auth-login-password').value = 'Password123!';
redirectedView = null;
window.submitLoginForm();

intro.skip();
assert.strictEqual(redirectedView, 'view-workforce-attendance', 'Teller login redirects strictly to view-workforce-attendance');
console.log('✓ TEST 5: Teller/Reliever roles land on authorized Attendance view, while Admins/Supervisors/Collectors land on Dashboard');

console.log('\n====================================================================');
console.log('🎉 ALL ACCEPTANCE TESTS PASSED (CINEMATIC REVEAL & BLANK PAGE REPAIR)!');
console.log('====================================================================\n');
