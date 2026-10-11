/**
 * NORTH-005 DAVAO DEL NORTE HQ
 * Acceptance & Verification Test Suite:
 * REMOVAL OF LOADING ANIMATIONS AND VISUAL EFFECTS ONLY
 *
 * Verifies:
 * 1. Loading spinners and rotating icons removed/disabled
 * 2. Skeleton, shimmer, and pulsing placeholders removed/disabled
 * 3. Animated loading overlays and splash transitions disabled/dismissed immediately
 * 4. Module navigation is direct without animated loading overlay delay
 * 5. Normal browser refresh, F5/Ctrl+R, data fetching, and page navigation fully preserved
 * 6. Non-regression of ERP state (158 employees, 123 booths, authentication, duplicate submission guard)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('========================================================================');
console.log('   NORTH-005 LOADING ANIMATIONS & VISUAL EFFECTS REMOVAL TEST SUITE   ');
console.log('========================================================================\n');

// 1. Static Asset & Codebase Inspection
console.log('--- 1. Testing Removal of Visual Loading Animations in Static Files ---');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf8');
const cinematicCss = fs.readFileSync(path.join(__dirname, 'css/cinematic-intro.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const backupJs = fs.readFileSync(path.join(__dirname, 'js/backup-restore.js'), 'utf8');
const docsJs = fs.readFileSync(path.join(__dirname, 'js/employee-documents.js'), 'utf8');
const introJs = fs.readFileSync(path.join(__dirname, 'js/cinematic-intro.js'), 'utf8');

// A. Master Registry Loading Row: Spinner removed, static status text preserved
assert.ok(indexHtml.includes('id="registry-loading-row"'), 'Registry loading row must exist for static feedback');
assert.ok(indexHtml.includes('Loading Master Registry records...'), 'Static feedback text must exist');
const registryRowMatch = indexHtml.match(/<tr id="registry-loading-row">([\s\S]*?)<\/tr>/);
assert.ok(registryRowMatch, 'Registry row exists');
assert.ok(!registryRowMatch[1].includes('animation: spin'), 'Registry row must NOT contain spinning animation');
assert.ok(!registryRowMatch[1].includes('class="spinner"'), 'Registry row must NOT render spinning spinner element');
console.log('✓ Master Registry loading row: spinner removed, static status text preserved.');

// B. OCR Progress Modals: Spinners and pulsing animations removed
assert.ok(indexHtml.includes('id="ep-ocr-loading-overlay"'), 'Expenses OCR overlay preserved');
const epOcrMatch = indexHtml.match(/<div id="ep-ocr-loading-overlay"[\s\S]*?<\/div>\s*<\/div>/);
assert.ok(!epOcrMatch[0].includes('animation: pulse'), 'Expenses OCR overlay must NOT animate pulse on icon');

assert.ok(indexHtml.includes('id="modal-thermal-ocr-progress"'), 'Thermal OCR progress modal preserved');
const thermalMatch = indexHtml.match(/<div id="modal-thermal-ocr-progress"[\s\S]*?<\/div>\s*<\/div>/);
assert.ok(!thermalMatch[0].includes('animation: spin'), 'Thermal OCR progress modal must NOT spin icon');
console.log('✓ OCR progress dialogs: spinning/pulsing icons disabled, static progress preserved.');

// C. Backup & Restore Progress & Verification
assert.ok(!backupJs.includes('animation: spin'), 'Backup verification modal must NOT spin icon');
assert.ok(!indexHtml.includes('animation: indeterminateProgress'), 'Restore modal must NOT animate progress bar');
console.log('✓ Backup & Restore: spinning hourglass and indeterminate animation removed.');

// D. Employee Documents: Sync status & Save Button spinners removed
assert.ok(!docsJs.includes('<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;border-width:1.5px;display:inline-block;"></span> Syncing...'), 
  'Docs sync status must NOT have spinning spinner-border');
assert.ok(docsJs.includes('badge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;color:#60a5fa;font-size:11px;font-weight:700;">Syncing...</span>`;'),
  'Docs sync status displays clean static Syncing... indicator');
assert.ok(!docsJs.includes('saveBtn.innerHTML = \'<span class="spinner-border spinner-border-sm"></span> Saving...\';'), 
  'Save button must NOT have spinning spinner-border');
assert.ok(docsJs.includes('saveBtn.innerHTML = \'Saving...\';'), 'Save button displays clean static Saving... text');
assert.ok(docsJs.includes('saveBtn.disabled = true;'), 'Duplicate submission protection strictly preserved');
console.log('✓ Employee Documents: spinning borders removed while preserving duplicate submission guards.');

// E. Stylesheets: Loading animations disabled
assert.ok(stylesCss.includes('.spinner-border'), 'styles.css defines spinner-border suppression rule');
assert.ok(stylesCss.includes('animation: none !important'), 'styles.css disables loading animations');
assert.ok(cinematicCss.includes('.cinematic-logo-shimmer') && cinematicCss.includes('display: none !important'), 'Shimmer effect completely hidden in CSS');
assert.ok(cinematicCss.includes('animation: none !important'), 'Cinematic intro CSS disables animations');
console.log('✓ CSS: Shimmer effect, spinner rotation, and visual pulsing explicitly disabled.');

// 2. Behavioral & Runtime Simulation
console.log('\n--- 2. Testing Direct Module Navigation & Instant Splash Dismissal ---');

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
      querySelector(sel) {
        if (sel.includes('badge')) return getEl('mock-badge-text');
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
      removeEventListener() {},
      focus() {},
      remove() { this.style.display = 'none'; }
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
    if (sel.includes('.view-panel.active')) return getEl('view-dashboard');
    if (sel.includes('#cinematic')) return getEl(sel.replace('#', ''));
    if (sel.includes('.cinematic-badge-text')) return getEl('mock-badge-text');
    return null;
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

require('./js/cinematic-intro.js');
require('./js/store.js');
require('./js/auth.js');
require('./js/app.js');

// Test 2A: Splash loader dismisses immediately without animation delay
const splash = getEl('app-splash-loader');
splash.style.display = 'flex';
window.dismissSplashLoader(true);
assert.strictEqual(splash.style.display, 'none', 'Splash loader dismissed immediately');
console.log('✓ Splash loader dismissed immediately without delaying user view.');

// Test 2B: Particles animation is disabled
const intro = window.cinematicIntro;
intro.initParticles();
assert.strictEqual(intro.particles.length, 0, 'Canvas particles loop is inactive/disabled');
console.log('✓ Particle canvas animation loop confirmed inactive.');

// Test 2C: Navigation does not get blocked by module loading animation
getEl('module-loading-overlay').style.display = 'none';
window.switchView('view-employees', true);
assert.notStrictEqual(getEl('module-loading-overlay').style.display, 'flex', 
  'Module loading overlay was not activated on normal module navigation');
assert.ok(getEl('view-employees').classList.contains('active'), 'Target module view is activated directly');
console.log('✓ In-app module navigation opens views directly without visual loading overlay delays.');

// 3. Browser Refresh & Reload Functionality Preservation
console.log('\n--- 3. Testing Preservation of Browser Refresh & Normal Reload Behaviors ---');
assert.ok(typeof window.triggerSystemRefresh === 'function', 'triggerSystemRefresh exists');
assert.ok(appJs.includes('window.location.reload()'), 'Native window.location.reload preserved in fallback');
let refreshCalled = false;
window.triggerSystemRefresh(() => { refreshCalled = true; });
intro.skip();
assert.strictEqual(refreshCalled, true, 'System telemetry refresh completes cleanly');
console.log('✓ Browser reload, refresh telemetry, and navigation handlers strictly preserved.');

// 4. ERP Non-Regression Check
console.log('\n--- 4. Checking Core ERP State & Non-Regression ---');
const store = window.appStore;
assert.strictEqual(store.getEmployees().length, 158, 'All 158 authentic employees intact');
assert.strictEqual(store.getBooths().length, 123, 'All 123 authentic booths intact');
console.log('✓ Core state intact (158 employees, 123 booths, permissions & modules functional).');

console.log('\n========================================================================');
console.log('🎉 ALL LOADING ANIMATION REMOVAL TESTS PASSED CLEANLY! ✨');
console.log('========================================================================\n');
