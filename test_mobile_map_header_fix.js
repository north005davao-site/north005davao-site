const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('TEST SUITE: MOBILE EST MAP & NORTH-005 HEADER WRAPPING FIX');
console.log('Target: Samsung Galaxy S20 / 360px Viewport & Responsive Design');
console.log('================================================================\n');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(__dirname, 'css', 'styles.css'), 'utf8');
const appJsContent = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

// --- 1. HTML STRUCTURE & CLASSES VERIFICATION ---
console.log('--- 1. Testing HTML Structure & Semantic Classes ---');

// Bug 2 Header Verification
assert(htmlContent.includes('class="topbar-branding"'), 'HTML must have topbar-branding class');
assert(htmlContent.includes('class="topbar-logo"'), 'HTML must have topbar-logo class');
assert(htmlContent.includes('class="topbar-title-block"'), 'HTML must have topbar-title-block class');
assert(htmlContent.includes('class="brand-code"'), 'HTML must have brand-code span for NORTH-005');
assert(htmlContent.includes('class="brand-sub"'), 'HTML must have brand-sub span for DAVAO DEL NORTE HQ');
assert(htmlContent.includes('Control Center &amp; Asset Suite'), 'HTML must retain Control Center & Asset Suite subtitle');

// Ensure no inline grid forcing 3fr 1fr on tracking grid
assert(!htmlContent.includes('grid-template-columns: 3fr 1fr;'), 'Inline 3fr 1fr grid must be removed in favor of responsive CSS classes');

// Bug 1 Map Verification
assert(htmlContent.includes('class="ets-tracking-grid"'), 'HTML must contain .ets-tracking-grid');
assert(htmlContent.includes('class="card ets-map-card"'), 'HTML must contain .ets-map-card');
assert(htmlContent.includes('id="ets-map-container" class="ets-map-viewport"'), 'HTML must preserve #ets-map-container with viewport class');
assert(htmlContent.includes('class="card ets-fleet-card"'), 'HTML must contain .ets-fleet-card');
assert(htmlContent.includes('id="ets-fleet-list" class="ets-fleet-list"'), 'HTML must preserve #ets-fleet-list with .ets-fleet-list class');
console.log('✓ HTML markup adheres strictly to semantic responsive architecture');

// --- 2. CSS RESPONSIVE RULES & MOBILE BREAKPOINTS ---
console.log('\n--- 2. Testing CSS Responsive Styles & Breakpoints ---');

// Base Desktop Styles
assert(cssContent.includes('.ets-tracking-grid {'), 'CSS must define base .ets-tracking-grid');
assert(cssContent.includes('.brand-code {') && cssContent.includes('white-space: nowrap;'), 'brand-code must enforce white-space: nowrap');
assert(cssContent.includes('.brand-sub {') && cssContent.includes('white-space: nowrap;'), 'brand-sub must enforce white-space: nowrap');

// Mobile <= 1024px & <= 480px (Galaxy S20 / 360px)
assert(cssContent.includes('.ets-map-card {') && cssContent.includes('order: 1;'), 'Mobile CSS must order map first (order: 1)');
assert(cssContent.includes('.ets-fleet-card {') && cssContent.includes('order: 2;'), 'Mobile CSS must order fleet monitor second (order: 2)');
assert(cssContent.includes('height: 360px !important;') || cssContent.includes('min-height: 320px !important;'), 'Map card must have proper 320px-360px mobile height');
assert(cssContent.includes('width: 100% !important;'), 'Map card must be width: 100% on mobile');

// Subtitle must NOT be hidden on 480px/360px
assert(cssContent.includes('.topbar-subtitle {') && cssContent.includes('display: block !important;'), 'Subtitle must be preserved as display: block on mobile');

// Theme selector compact styling
assert(cssContent.includes('max-width: 42px;'), 'Theme selector must be compact on 360px viewport to leave space for branding');
console.log('✓ CSS responsive layout rules verified (stacked map, 100% width, order: 1 map / order: 2 fleet)');

// --- 3. JAVASCRIPT MOBILE INTERACTIVITY & SCROLLING ---
console.log('\n--- 3. Testing JS Mobile Interactivity & Handlers ---');
assert(appJsContent.includes('scrollIntoView({ behavior: \'smooth\', block: \'nearest\' })'), 'Clicking staff on mobile must scroll map into view');
assert(appJsContent.includes('window.etsMap.invalidateMapSize()'), 'Opening/closing mobile drawer must invalidate Leaflet map dimensions');
console.log('✓ JS mobile map auto-scroll and drawer size invalidation verified');

console.log('\n======================================================');
console.log('ALL MOBILE EST MAP & HEADER WRAPPING TESTS PASSED! 🚀');
console.log('======================================================\n');
