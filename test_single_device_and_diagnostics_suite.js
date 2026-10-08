/**
 * test_single_device_and_diagnostics_suite.js
 * Verification of:
 * 1. Single-Device Session Security (1 Login to 1 Device Enforcement)
 * 2. 12-Module System Diagnostics & Self-Healing Engine
 * 3. Cross-Device Real-Time Snapshot Synchronization
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser globals for testing
function setupDOM() {
  const elements = {};

  const getOrCreateEl = (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        style: {},
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
          toggle(c) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); }
        },
        value: '',
        textContent: '',
        innerHTML: '',
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k]; },
        children: [],
        appendChild(child) { this.children.push(child); return child; },
        contains() { return false; },
        querySelector(sel) { return getOrCreateEl(sel.replace(/^[.#]/, '')); },
        querySelectorAll() { return []; },
        focus() {}
      };
    }
    return elements[id];
  };

  const listeners = {};

  global.window = {
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener() {},
    dispatch(event, data) {
      if (listeners[event]) listeners[event].forEach(fn => fn(data));
    },
    location: { href: 'https://north005davao.site', reload() {} },
    open() {},
    alert(msg) { console.log('  [Alert]:', msg); },
    confirm() { return true; },
    showToast(msg, type) { console.log(`  [Toast ${type}]:`, msg); },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  };

  global.document = {
    getElementById: getOrCreateEl,
    querySelector: (sel) => getOrCreateEl(sel.replace('#', '')),
    querySelectorAll: () => [],
    createElement: (tag) => getOrCreateEl(tag + '-' + Math.random().toString(36).substring(2, 6)),
    body: getOrCreateEl('body'),
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    visibilityState: 'visible'
  };

  const storageMock = () => {
    let store = {};
    return {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  };

  global.localStorage = storageMock();
  global.sessionStorage = storageMock();

  return { getOrCreateEl, listeners };
}

async function runTestSuite() {
  console.log('=== RUNNING SINGLE-DEVICE SECURITY & 12-MODULE DIAGNOSTICS SUITE ===\n');

  const { getOrCreateEl, listeners } = setupDOM();

  // Load store, production-suite, and auth scripts
  require('./js/store.js');
  require('./js/production-suite.js');
  require('./js/auth.js');

  const auth = global.window.authManager;
  assert.ok(auth, 'AuthManager singleton must be initialized');

  /* ------------------------------------------------------------------ */
  /* PART 1: SINGLE-DEVICE SESSION SECURITY                             */
  /* ------------------------------------------------------------------ */
  console.log('--- TEST 1: Single-Device Session Security & Concurrent Kick ---');

  // 1. PC Browser logs in
  global.window.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };
  const pcLoginRes = auth.login('admin', 'Admin123!');
  assert.strictEqual(pcLoginRes.success, true, 'PC login must succeed');
  
  const pcToken = global.sessionStorage.getItem('north005_active_session_token');
  const pcDevice = global.sessionStorage.getItem('north005_active_device_name');
  assert.ok(pcToken, 'Session token must be created for PC');
  assert.strictEqual(pcDevice, 'Windows PC', 'Device must be detected as Windows PC');
  assert.strictEqual(auth.isAuthenticated(), true, 'PC must be currently authenticated');
  console.log(`✓ PC successfully logged in (Device: ${pcDevice}, Token: ${pcToken})`);

  // 2. Android Phone logs in to the same account
  const phoneDevice = 'Android Device';
  const phoneToken = 'sess_phone_' + Date.now() + '_xyz123';
  console.log(`Simulating concurrent login on ${phoneDevice} (New Token: ${phoneToken})...`);

  // 3. PC receives realtime kick notification
  auth.handleConcurrentSessionKick({
    username: 'admin',
    active_session_token: phoneToken,
    active_device_name: phoneDevice
  });

  // Verify PC session is immediately terminated
  assert.strictEqual(auth.isAuthenticated(), false, 'PC session must be terminated immediately upon concurrent login');
  assert.strictEqual(global.sessionStorage.getItem('north005_active_session_token'), null, 'PC token must be wiped');
  
  // Verify Security Notice Modal is triggered
  const modalEl = getOrCreateEl('modal-concurrent-logout');
  const devEl = getOrCreateEl('concurrent-device-name');
  assert.strictEqual(modalEl.style.display, 'flex', 'Concurrent logout modal must be displayed');
  assert.strictEqual(devEl.textContent, phoneDevice, 'Modal must display new device name');
  console.log('✓ Concurrent session kick verified: PC session wiped and termination modal displayed');

  // Dismiss modal and return to login
  auth.dismissConcurrentModalAndShowLogin();
  assert.strictEqual(modalEl.style.display, 'none', 'Modal dismissed when user acknowledges');
  console.log('✓ Modal dismissal restores clean login state');

  /* ------------------------------------------------------------------ */
  /* PART 2: 12-MODULE SYSTEM DIAGNOSTICS & SELF-HEALING ENGINE         */
  /* ------------------------------------------------------------------ */
  console.log('\n--- TEST 2: 12-Module System Diagnostics & Self-Healing ---');

  const prodSuite = global.window.productionSuite;
  assert.ok(prodSuite, 'ProductionSuite must be loaded');
  assert.ok(prodSuite.systemDiagnostics, 'SystemDiagnostics must be initialized');

  // Run full integrity audit across all 12 modules
  const audit = prodSuite.systemDiagnostics.runIntegrityAudit();
  assert.ok(audit, 'Audit must produce result');
  assert.ok(Array.isArray(audit.moduleAudits), 'Audit must return moduleAudits array');

  console.log(`Audited modules count: ${audit.moduleAudits.length}`);
  assert.strictEqual(audit.moduleAudits.length, 12, 'Exactly 12 sidebar modules must be covered');

  const expectedModuleIds = [
    'view-master-registry',
    'view-dashboard',
    'view-ets-tracking',
    'view-sales-collection',
    'view-expenses-payment',
    'view-outlet-rentals',
    'view-user-management',
    'view-workforce-attendance',
    'view-org-chart',
    'view-thermal-paper',
    'view-employee-documents',
    'view-eod-automation'
  ];

  expectedModuleIds.forEach(id => {
    const mod = audit.moduleAudits.find(m => m.id === id);
    assert.ok(mod, `Module '${id}' must be in moduleAudits`);
    assert.strictEqual(mod.status, 'HEALTHY', `Module '${id}' must be HEALTHY`);
    console.log(`  ✓ [Module HEALTHY]: ${mod.icon} ${mod.name} (${mod.info})`);
  });

  assert.strictEqual(audit.issues.length, 0, 'Clean store should have 0 issues');
  console.log('✓ All 12 sidebar modules verified healthy in audit');

  // Run 1-Click Auto Repair
  console.log('Running 1-Click Auto-Repair...');
  const repairResult = prodSuite.runAutoRepair();
  assert.ok(repairResult, 'Auto repair must execute');
  assert.strictEqual(repairResult.success, true, 'Auto repair must succeed');
  console.log(`✓ 1-Click Auto-Repair executed successfully (Healed: ${repairResult.repairedCount} issues)`);

  /* ------------------------------------------------------------------ */
  /* PART 3: CROSS-DEVICE REAL-TIME SNAPSHOT SYNCHRONIZATION            */
  /* ------------------------------------------------------------------ */
  console.log('\n--- TEST 3: Cross-Device Real-Time Snapshot Sync ---');

  const snapMgr = prodSuite.snapshotManager;
  assert.ok(snapMgr, 'SnapshotManager must be initialized');

  // 1. Take a snapshot
  const createdSnap = snapMgr.createSnapshot('Android Auto-Repair Snapshot');
  assert.ok(createdSnap, 'Snapshot must be created');
  assert.ok(createdSnap.id, 'Snapshot must have unique ID');

  const snaps = snapMgr.getSnapshots();
  assert.ok(snaps.some(s => s.id === createdSnap.id), 'Snapshot list must include newly created snapshot');
  console.log(`✓ Snapshot created locally: ${createdSnap.reason} (ID: ${createdSnap.id})`);

  // 2. Simulate reception of realtime snapshot from PC on Android phone
  const pcSnapshotEvent = {
    eventType: 'INSERT',
    new: {
      id: 'snap-pc-live-' + Date.now(),
      timestamp: Date.now(),
      formatted_time: '10/8/2026, 5:45:00 PM',
      reason: 'PC Administrator Safety Checkpoint',
      version: 'MRV-CURRENT',
      staff_count: 150,
      relievers_count: 34,
      booths_count: 126,
      data: { staff: 150, relievers: 34 }
    }
  };

  snapMgr.handleRealtimeSnapshotUpdate(pcSnapshotEvent);
  const updatedSnaps = snapMgr.getSnapshots();
  assert.ok(updatedSnaps.some(s => s.id === pcSnapshotEvent.new.id), 'Realtime PC snapshot must be dynamically added to snapshot list');
  console.log(`✓ Realtime snapshot event processed: Received "${pcSnapshotEvent.new.reason}" from PC without page reload`);

  console.log('\n======================================================');
  console.log('🎉 ALL TESTS PASSED! 100% VERIFIED ACROSS ALL REQUIREMENTS 🚀');
  console.log('======================================================\n');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
