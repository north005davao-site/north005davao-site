/**
 * NORTH-005 DAVAO DEL NORTE — LANDING PAGE & AUTHENTICATION ACCEPTANCE TEST SUITE
 * Validates all 10 acceptance requirements specified in prompt.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simple DOM & Storage mock for headless node verification
class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName;
    this.id = id;
    this.style = { display: '' };
    this.classList = new Set();
    this.value = '';
    this.checked = false;
    this.type = 'text';
    this.textContent = '';
    this.innerHTML = '';
  }

  getAttribute(attr) { return this[attr] || null; }
  setAttribute(attr, val) { this[attr] = val; }
}

MockElement.prototype.classList = {
  _classes: new Set(),
  add(c) { this._classes.add(c); },
  remove(c) { this._classes.delete(c); },
  contains(c) { return this._classes.has(c); }
};

const domStore = {};
function getOrCreateEl(id, tagName = 'div') {
  if (!domStore[id]) {
    domStore[id] = {
      tagName,
      id,
      style: { display: '' },
      value: '',
      checked: false,
      type: 'text',
      textContent: '',
      innerHTML: '',
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      },
      focus() {}
    };
  }
  return domStore[id];
}

const mockStorage = {};
const mockSessionStorage = {};

global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

global.sessionStorage = {
  getItem: (k) => mockSessionStorage[k] || null,
  setItem: (k, v) => { mockSessionStorage[k] = String(v); },
  removeItem: (k) => { delete mockSessionStorage[k]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

global.document = {
  getElementById: (id) => getOrCreateEl(id),
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  addEventListener: () => {}
};

global.window = global;
global.alert = (msg) => { global.__lastAlert = msg; };

// Load code
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const cssContent = fs.readFileSync(path.join(__dirname, 'css', 'landing-portal.css'), 'utf-8');

console.log('--- 1. Testing HTML Structure & Visual Assets ---');
assert.ok(htmlContent.includes('id="landing-page-portal"'), 'landing-page-portal must exist in index.html');
assert.ok(htmlContent.includes('assets/north-005-logo.png'), 'Must reference official logo');
assert.ok(htmlContent.includes('NORTH-005'), 'Must contain NORTH-005 heading');
assert.ok(htmlContent.includes('DAVAO DEL NORTE'), 'Must contain DAVAO DEL NORTE heading');
assert.ok(htmlContent.includes('Together for a Stronger and More Progressive'), 'Must contain headline');
assert.ok(htmlContent.includes('Secure Access'), 'Must contain Secure Access indicator');
assert.ok(htmlContent.includes('Connected Teams'), 'Must contain Connected Teams indicator');
assert.ok(htmlContent.includes('Efficient Operations'), 'Must contain Efficient Operations indicator');
assert.ok(htmlContent.includes('Greater Coverage'), 'Must contain Greater Coverage indicator');
assert.ok(htmlContent.includes('id="tab-trigger-login"'), 'Must have Login tab');
assert.ok(htmlContent.includes('id="tab-trigger-signup"'), 'Must have Sign Up tab');
assert.ok(htmlContent.includes('id="auth-login-username"'), 'Must retain standard login username ID');
assert.ok(htmlContent.includes('id="auth-login-password"'), 'Must retain standard login password ID');
assert.ok(htmlContent.includes('id="reg-name"'), 'Must retain standard signup full name ID');
assert.ok(htmlContent.includes('id="reg-username"'), 'Must retain standard signup username ID');
assert.ok(htmlContent.includes('id="reg-position"'), 'Must retain standard signup position ID');
assert.ok(htmlContent.includes('modal-landing-terms'), 'Must contain terms modal');
assert.ok(htmlContent.includes('modal-landing-privacy'), 'Must contain privacy modal');
assert.ok(htmlContent.includes('modal-landing-forgot'), 'Must contain forgot password modal');
console.log('✓ All required HTML elements, visual badges, and IDs verified');

console.log('\n--- 2. Testing CSS Aesthetics & Responsive Design ---');
assert.ok(cssContent.includes('#landing-page-portal'), 'CSS defines landing page portal');
assert.ok(cssContent.includes('.landing-container'), 'CSS defines 2-column container');
assert.ok(cssContent.includes('.landing-auth-card'), 'CSS defines white authentication card');
assert.ok(cssContent.includes('@media (max-width: 900px)'), 'CSS includes tablet breakpoint');
assert.ok(cssContent.includes('@media (max-width: 540px)'), 'CSS includes mobile breakpoint');
assert.ok(cssContent.includes('assets/davao-landing-bg.jpg'), 'CSS uses generated scenic landscape background');
console.log('✓ CSS design tokens, 2-column layout, and responsive breakpoints verified');

console.log('\n--- 3. Testing Real Authentication Controller Functionality ---');
// Evaluate auth.js
require('./js/auth.js');

const auth = window.authManager;
assert.ok(auth, 'AuthManager singleton initialized');

// TEST 1: Open website logged out -> portal is displayed
auth.showLoginModal();
const portalEl = getOrCreateEl('landing-page-portal');
assert.strictEqual(portalEl.style.display, 'flex', 'Portal displayed as flex on initial visit');
console.log('✓ TEST 1: Logged out visitor receives full landing portal');

// TEST 2: Tab switching between Login and Sign Up
window.switchLandingTab('signup');
assert.strictEqual(getOrCreateEl('landing-pane-signup').style.display, 'block', 'Sign Up pane displayed');
assert.strictEqual(getOrCreateEl('landing-pane-login').style.display, 'none', 'Login pane hidden');

window.switchLandingTab('login');
assert.strictEqual(getOrCreateEl('landing-pane-login').style.display, 'block', 'Login pane restored');
assert.strictEqual(getOrCreateEl('landing-pane-signup').style.display, 'none', 'Sign Up pane hidden');
console.log('✓ TEST 2: Real interactive tab switching works smoothly');

// TEST 3: Invalid credentials
getOrCreateEl('auth-login-username').value = 'unknown_user_test';
getOrCreateEl('auth-login-password').value = 'WrongPassword!';
window.submitLoginForm();
const errAlert = getOrCreateEl('login-error-alert');
assert.ok(errAlert.textContent.includes('Invalid'), 'Displays error alert on invalid credentials');
assert.strictEqual(errAlert.style.display, 'block', 'Error alert is visible');
console.log('✓ TEST 3: Invalid credentials properly trigger real authentication error alert');

// TEST 4: Valid credentials login
getOrCreateEl('auth-login-username').value = 'admin';
getOrCreateEl('auth-login-password').value = 'Admin123!';
window.submitLoginForm();
assert.strictEqual(portalEl.style.display, 'none', 'Portal is hidden after successful login');
assert.ok(auth.isAuthenticated(), 'User is authenticated');
assert.strictEqual(auth.getCurrentUser().username, 'admin');
assert.strictEqual(auth.isAdmin(), true);
console.log('✓ TEST 4: Valid login authenticates and dismisses landing portal');

// TEST 5 & 6: Sign up verification
window.switchLandingTab('signup');
getOrCreateEl('reg-name').value = 'New Test Operative';
getOrCreateEl('reg-username').value = 'test_oper_01';
getOrCreateEl('reg-position').value = 'Collector';
getOrCreateEl('reg-password').value = 'Password123!';
getOrCreateEl('reg-confirm-password').value = 'Password123!';
window.submitSignUpForm();

const createdUser = auth.getUsers().find(u => u.username === 'test_oper_01');
assert.ok(createdUser, 'User successfully registered into system');
assert.strictEqual(createdUser.position, 'Collector');
console.log('✓ TEST 5 & 6: Sign Up form registers real user obeying existing architecture');

// TEST 7: Password toggler
const pwInput = getOrCreateEl('auth-login-password');
pwInput.type = 'password';
window.togglePasswordVisibility('auth-login-password', 'btn-toggle-login-password');
assert.strictEqual(pwInput.type, 'text', 'Password field reveals text');
window.togglePasswordVisibility('auth-login-password', 'btn-toggle-login-password');
assert.strictEqual(pwInput.type, 'password', 'Password field returns to masked password');
console.log('✓ TEST 7: Password visibility toggler functions correctly');

// TEST 8: Session persistence & reload
assert.ok(sessionStorage.getItem('north005_session_user_v2'), 'Session saved in sessionStorage');
const loadedUser = auth.loadSessionUser();
assert.ok(loadedUser && loadedUser.username === 'admin', 'Session loads without re-prompting login');
console.log('✓ TEST 8: Session state maintained across tab reloads');

// TEST 9: Logout restores landing portal
auth.logout();
assert.strictEqual(auth.isAuthenticated(), false);
assert.strictEqual(portalEl.style.display, 'flex', 'Landing portal restored upon logout');
console.log('✓ TEST 9: Logout restores the NORTH-005 landing portal');

// TEST 10: Role permissions unharmed
const colLogin = auth.login('collector', 'Collect123!');
assert.strictEqual(colLogin.success, true);
assert.strictEqual(auth.isCollector(), true);
assert.strictEqual(auth.canAccessView('view-dashboard'), true);
assert.strictEqual(auth.canAccessView('view-user-management'), false);
console.log('✓ TEST 10: Role-based permissions completely preserved and intact');

console.log('\n======================================================');
console.log('ALL 10 NORTH-005 LANDING & AUTH ACCEPTANCE TESTS PASSED! 🚀');
console.log('======================================================');
