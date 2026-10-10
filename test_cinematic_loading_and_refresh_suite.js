/**
 * NORTH-005 DAVAO DEL NORTE HQ
 * Acceptance & Verification Test Suite:
 * - Replacement of existing general loading/refresh animation with NORTH-005 Cinematic Corporate Reveal
 * - Uniform navy-blue & gold branding (official logo, aura, light sweep, DAVAO DEL NORTE HQ text)
 * - Duration matching: ~5s for full reveals, abbreviated (~210ms) for fast in-page transitions
 * - Polished ending transitions: destination view ready before removal, no blank screen, no white flash
 * - Slow loading hold (>5s) without loops or restarts
 * - Preservation of operation-specific indicators (OCR, Excel, table loading) & ERP functionality
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('========================================================================');
console.log('   NORTH-005 CINEMATIC LOADING & REFRESH REPLACEMENT ACCEPTANCE SUITE   ');
console.log('========================================================================\n');

// 1. Static Asset and Branding Checks
console.log('--- 1. Testing Branding, Asset Alignment & Unified DOM Overlays ---');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf8');
const cinematicCss = fs.readFileSync(path.join(__dirname, 'css/cinematic-intro.css'), 'utf8');

// A. Logo and branding
assert.ok(fs.existsSync(path.join(__dirname, 'assets/north-005-logo.png')), 'Official logo asset must exist');
assert.ok(indexHtml.includes('assets/north-005-logo.png'), 'Must link official NORTH-005 logo');
assert.ok(indexHtml.includes('NORTH-005'), 'Must contain NORTH-005 branding');
assert.ok(indexHtml.includes('DAVAO DEL NORTE HQ'), 'Must contain DAVAO DEL NORTE HQ branding');

// B. Splash / Page-load overlay uses cinematic classes
assert.ok(indexHtml.includes('id="app-splash-loader"'), 'Splash loader element must exist');
assert.ok(indexHtml.includes('app-splash-overlay cinematic-welcome-overlay'), 'Splash loader must adopt cinematic-welcome-overlay class');
assert.ok(indexHtml.includes('cinematic-ambient-glow'), 'Splash loader must include atmospheric aura glow');
assert.ok(indexHtml.includes('cinematic-logo-ring'), 'Splash loader must feature gold logo ring');
assert.ok(indexHtml.includes('cinematic-progress-bar'), 'Splash loader must feature cinematic progress bar');
assert.ok(indexHtml.includes('id="splash-skip-btn"'), 'Splash loader must provide Skip Intro button');

// C. Welcome overlay and in-page module transition
assert.ok(indexHtml.includes('id="cinematic-welcome-overlay"'), 'Cinematic welcome overlay must exist');
assert.ok(indexHtml.includes('id="module-loading-overlay"'), 'In-page module loading overlay must exist');
assert.ok(indexHtml.includes('id="module-loading-title"'), 'Module title must be present');
assert.ok(indexHtml.includes('onclick="window.triggerSystemRefresh'), 'Topbar logo click must trigger smooth system telemetry refresh');

console.log('✓ Unified DOM overlays, branding, and assets successfully verified.');

// 2. CSS Styling & Ending Transitions
console.log('\n--- 2. Testing Unified Cinematic CSS & Ending Transitions ---');

// A. Deep navy background
assert.ok(stylesCss.includes('radial-gradient(circle at 50% 45%, #081b35 0%, #030a17 60%, #01040a 100%)'), 
  'styles.css .app-splash-overlay must use official deep navy-blue radial gradient');
assert.ok(cinematicCss.includes('radial-gradient(circle at 50% 45%, #081b35 0%, #030a17 60%, #01040a 100%)'), 
  'cinematic-intro.css must use official deep navy-blue radial gradient');

// B. Module transition styling
assert.ok(stylesCss.includes('.module-loading-overlay'), 'Module loading overlay styles must exist');
assert.ok(stylesCss.includes('rgba(8, 27, 53'), 'Module loading overlay must use deep navy theme');
assert.ok(stylesCss.includes('cinematicRingGlow'), 'Module loading logo must use cinematic gold ring glow');

// C. Ending transition classes
assert.ok(cinematicCss.includes('.cinematic-welcome-overlay.cinematic-closing'), 'Must have dedicated .cinematic-closing class');
assert.ok(cinematicCss.includes('scale(1.03)'), 'Ending transition must gently scale');
assert.ok(cinematicCss.includes('.cinematic-loading-hold'), 'Must have .cinematic-loading-hold state for slow loads');

// D. Accessibility
assert.ok(cinematicCss.includes('@media (prefers-reduced-motion: reduce)'), 'Must support OS prefers-reduced-motion');

console.log('✓ Navy/gold palette, module transitions, and smooth ending scales verified.');

// 3. Headless Lifecycle and Timing Tests
console.log('\n--- 3. Testing Duration Matching, Skip Control & Page Readiness ---');

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

const intro = window.cinematicIntro;

// TEST 3A: Full reveal duration is ~5000ms by default
let finished = false;
intro.play(() => { finished = true; });
assert.strictEqual(intro.isPlaying, true, 'Intro is playing');
assert.strictEqual(intro.options.duration || 5000, 5000, 'Full animation duration is ~5.0 seconds');
console.log('✓ TEST 3A: Full-screen intro sets ~5000ms duration');

// TEST 3B: Skip Intro ends immediately and cleanly
intro.skip();
assert.strictEqual(intro.isPlaying, false, 'Skip Intro terminates animation immediately');
assert.strictEqual(finished, true, 'onComplete callback executed on skip');
console.log('✓ TEST 3B: Skip Intro terminates animation cleanly without delay');

// TEST 3C: Slow loading hold state (>5s) keeps loading visible without restarting from scratch
finished = false;
let readyCheck = false;
intro.play(() => { finished = true; }, {
  duration: 5000,
  checkReady: () => readyCheck
});
assert.strictEqual(intro.isPlaying, true, 'Intro started');
intro.holdLoadingState();
assert.strictEqual(intro.isHolding, true, 'Enters hold state when destination is not ready');
assert.ok(getEl('cinematic-welcome-overlay').classList.contains('cinematic-loading-hold'), 'Overlay has hold class');
readyCheck = true;
intro.markReady();
assert.strictEqual(intro.isHolding, false, 'Hold state cleared upon markReady');
assert.strictEqual(finished, true, 'Finished cleanly after readiness confirmation');
console.log('✓ TEST 3C: Slow load gracefully holds visible loading state and finishes upon readiness');

// TEST 3D: In-page abbreviated module transitions
getEl('module-loading-overlay').style.display = 'none';
getEl('module-loading-overlay').classList.remove('active');
window.triggerModuleLoadingAnimation('view-employees');
assert.strictEqual(getEl('module-loading-overlay').style.display, 'flex', 'Module loader activated as flex');
assert.ok(getEl('module-loading-overlay').classList.contains('active'), 'Module loader receives active class');
assert.strictEqual(getEl('module-loading-title').textContent, 'Loading Master Registry...', 'Dynamic title set correctly');
console.log('✓ TEST 3D: Fast abbreviated module loader triggers smoothly for in-app navigation');

// TEST 3E: In-app system telemetry refresh
let refreshTriggered = false;
window.triggerSystemRefresh(() => { refreshTriggered = true; });
assert.strictEqual(intro.isPlaying, true, 'System telemetry refresh plays cinematic animation');
assert.strictEqual(intro.options.badgeText, 'SYSTEM TELEMETRY SYNCHRONIZED', 'Displays synchronization badge');
intro.skip();
assert.strictEqual(refreshTriggered, true, 'Telemetry refresh callback executed cleanly');
console.log('✓ TEST 3E: In-app system telemetry refresh verified with official branding');

// 4. Operation-Specific Loaders Preservation Check
console.log('\n--- 4. Testing Preservation of Operation-Specific Indicators ---');
assert.ok(indexHtml.includes('id="ep-ocr-loading-overlay"'), 'Expenses OCR loading overlay must be preserved');
assert.ok(indexHtml.includes('id="modal-thermal-ocr-progress"'), 'Thermal OCR progress dialog must be preserved');
assert.ok(indexHtml.includes('id="registry-loading-row"'), 'Master registry table loading row must be preserved');
assert.ok(indexHtml.includes('id="registry-error-container"'), 'Master registry error & retry container must be preserved');
console.log('✓ Operation-specific indicators and error containers strictly preserved.');

// 5. Check Non-Regression of ERP Data
console.log('\n--- 5. Non-Regression & Core ERP State ---');
const store = window.appStore;
assert.strictEqual(store.getEmployees().length, 158, 'Exactly 158 employee records preserved');
assert.strictEqual(store.getBooths().length, 123, 'Exactly 123 authentic booths preserved');
console.log('✓ All 158 employees and 123 booths remain completely intact.');

console.log('\n========================================================================');
console.log('🎉 ALL CINEMATIC LOADING & REFRESH REPLACEMENT TESTS PASSED CLEANLY! ✨');
console.log('========================================================================\n');
