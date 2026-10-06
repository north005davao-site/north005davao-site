/**
 * NORTH-005 DAVAO DEL NORTE — MOBILE COLLAPSIBLE SIDEBAR & NAVIGATION TEST SUITE
 * Validates all mobile drawer requirements, breakpoints, and interaction flows.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simple DOM & Storage mock for headless verification
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
        contains(c) { return this._set.has(c); },
        toggle(c) {
          if (this._set.has(c)) { this._set.delete(c); return false; }
          else { this._set.add(c); return true; }
        }
      },
      getAttribute(attr) { return this[attr] || null; },
      setAttribute(attr, val) { this[attr] = val; },
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
  body: {
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    }
  },
  getElementById: (id) => getOrCreateEl(id),
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  addEventListener: () => {}
};

global.window = global;
global.window.innerWidth = 360; // Simulate Galaxy S20 width
global.alert = (msg) => {};

// Read source files
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const cssContent = fs.readFileSync(path.join(__dirname, 'css', 'styles.css'), 'utf-8');

console.log('--- 1. Testing HTML Structure for Mobile Navigation ---');
assert.ok(htmlContent.includes('id="mobile-sidebar-toggle"'), 'Must have hamburger toggle button');
assert.ok(htmlContent.includes('id="mobile-sidebar-close"'), 'Must have sidebar close button');
assert.ok(htmlContent.includes('id="sidebar-backdrop"'), 'Must have sidebar backdrop overlay');
assert.ok(htmlContent.includes('topbar-corridors-pill'), 'Must tag long corridor text for mobile hiding');
console.log('✓ Hamburger button, close button, and backdrop overlay present in HTML');

console.log('\n--- 2. Testing CSS Breakpoints & Mobile Drawer Styles ---');
assert.ok(cssContent.includes('.mobile-menu-btn'), 'Defines .mobile-menu-btn styles');
assert.ok(cssContent.includes('.mobile-sidebar-close-btn'), 'Defines .mobile-sidebar-close-btn styles');
assert.ok(cssContent.includes('.sidebar-backdrop'), 'Defines .sidebar-backdrop styles');
assert.ok(cssContent.includes('@media (max-width: 1024px)'), 'Defines mobile/tablet breakpoint');
assert.ok(cssContent.includes('#sidebar.mobile-open'), 'Defines #sidebar.mobile-open drawer open rule');
assert.ok(cssContent.includes('transform: translateX(-100%)'), 'Sidebar is off-canvas when closed');
assert.ok(cssContent.includes('transform: translateX(0)'), 'Sidebar slides into view when open');
assert.ok(cssContent.includes('@media (min-width: 1025px)'), 'Preserves standard static layout on desktop');
console.log('✓ CSS responsive drawer styles and breakpoints verified');

console.log('\n--- 3. Testing Interactive Mobile Drawer State & Handlers ---');
require('./js/store.js');
require('./js/app.js');

const sidebar = getOrCreateEl('sidebar');
const backdrop = getOrCreateEl('sidebar-backdrop');

// TEST 1: Initial state is closed
assert.strictEqual(sidebar.classList.contains('mobile-open'), false, 'Sidebar is initially closed');
assert.strictEqual(backdrop.classList.contains('active'), false, 'Backdrop is initially inactive');
console.log('✓ TEST 1: Mobile initial load is collapsed/closed');

// TEST 2: Open sidebar via toggle
window.openMobileSidebar();
assert.strictEqual(sidebar.classList.contains('mobile-open'), true, 'Sidebar has mobile-open class');
assert.strictEqual(backdrop.classList.contains('active'), true, 'Backdrop has active class');
assert.strictEqual(document.body.classList.contains('mobile-sidebar-active'), true, 'Body has lock class');
console.log('✓ TEST 2: Open sidebar drawer smoothly applies active classes');

// TEST 3: Close sidebar via close button
window.closeMobileSidebar();
assert.strictEqual(sidebar.classList.contains('mobile-open'), false, 'Sidebar mobile-open removed');
assert.strictEqual(backdrop.classList.contains('active'), false, 'Backdrop active removed');
assert.strictEqual(document.body.classList.contains('mobile-sidebar-active'), false, 'Body lock removed');
console.log('✓ TEST 3: Close button dismisses sidebar drawer');

// TEST 4: Toggle helper
window.toggleMobileSidebar();
assert.strictEqual(sidebar.classList.contains('mobile-open'), true, 'Toggle opens when closed');
window.toggleMobileSidebar();
assert.strictEqual(sidebar.classList.contains('mobile-open'), false, 'Toggle closes when open');
console.log('✓ TEST 4: Toggle mobile sidebar alternates state cleanly');

// TEST 5: Selecting module auto-closes sidebar
window.openMobileSidebar();
assert.strictEqual(sidebar.classList.contains('mobile-open'), true);
window.switchView('view-employees', false);
assert.strictEqual(sidebar.classList.contains('mobile-open'), false, 'Sidebar auto-closes on switchView');
assert.strictEqual(backdrop.classList.contains('active'), false, 'Backdrop auto-dismisses on switchView');
console.log('✓ TEST 5: Selecting any module automatically closes drawer and reflows view');

console.log('\n======================================================');
console.log('ALL MOBILE RESPONSIVE SIDEBAR TESTS PASSED! 🚀');
console.log('======================================================');
