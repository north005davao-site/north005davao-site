/**
 * test_session_and_routing_lifecycle_suite.js
 * Comprehensive Verification of:
 * 1. Single-Device Session Lifecycle & False Kick Prevention (Same-device multi-tab immunity & stale record protection)
 * 2. Legitimate Cross-Device Session Termination (Verified device & timestamp display)
 * 3. Authentication Routing & Clean URL Resolution (/ root vs. /master-registry deep-link post-login navigation)
 * 4. Post-Logout URL Reset & Back Button Popstate Protection
 */

const assert = require('assert');
const path = require('path');

function createDOMEnvironment(initialPath = '/', initialAuth = null) {
  const elements = {};
  const listeners = {};

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
        focus() {},
        remove() {},
        addEventListener(event, fn) {
          listeners[id + ':' + event] = listeners[id + ':' + event] || [];
          listeners[id + ':' + event].push(fn);
        },
        removeEventListener() {}
      };
    }
    return elements[id];
  };

  const storageMock = (initialStore = {}) => {
    let store = { ...initialStore };
    return {
      getItem: (k) => store[k] !== undefined ? String(store[k]) : null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; },
      _raw: () => store
    };
  };

  let currentPath = initialPath;

  const historyStack = [{ state: null, url: initialPath }];
  const history = {
    replaceState(state, title, url) {
      currentPath = url;
      historyStack[historyStack.length - 1] = { state, url };
    },
    pushState(state, title, url) {
      currentPath = url;
      historyStack.push({ state, url });
    },
    back() {
      if (historyStack.length > 1) {
        historyStack.pop();
        const prev = historyStack[historyStack.length - 1];
        currentPath = prev.url;
        if (listeners['popstate']) {
          listeners['popstate'].forEach(fn => fn({ state: prev.state }));
        }
      }
    }
  };

  const localStore = {};
  const sessionStore = {};
  if (initialAuth) {
    sessionStore['north005_session_user_v2'] = JSON.stringify(initialAuth);
    localStore['north005_session_user_v2'] = JSON.stringify(initialAuth);
  }

  const localStorage = storageMock(localStore);
  const sessionStorage = storageMock(sessionStore);

  const windowMock = {
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
    },
    dispatch(event, data) {
      if (listeners[event]) listeners[event].forEach(fn => fn(data));
    },
    location: {
      protocol: 'https:',
      get pathname() { return currentPath; },
      set pathname(p) { currentPath = p; },
      search: '',
      hash: '',
      href: 'https://north005davao.site' + currentPath,
      reload() {}
    },
    history,
    localStorage,
    sessionStorage,
    alert(msg) { console.log('   [Alert]:', msg); },
    confirm() { return true; },
    showToast(msg, type) { console.log(`   [Toast ${type}]:`, msg); },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    sfx: { playClick() {} },
    get currentPathname() { return currentPath; },
    fetch: async (url) => ({
      ok: true,
      json: async () => ({ success: true, profiles: {}, session: null })
    })
  };

  global.fetch = windowMock.fetch;

  const documentMock = {
    getElementById: getOrCreateEl,
    querySelector: (sel) => getOrCreateEl(sel.replace(/^[.#]/, '')),
    querySelectorAll: (sel) => [getOrCreateEl(sel.replace(/^[.#]/, ''))],
    createElement: (tag) => getOrCreateEl(tag + '-' + Math.random().toString(36).substring(2, 6)),
    head: getOrCreateEl('head'),
    body: getOrCreateEl('body'),
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    visibilityState: 'visible'
  };

  return {
    windowMock,
    documentMock,
    getOrCreateEl,
    listeners,
    history,
    getPath: () => currentPath
  };
}

async function runSessionAndRoutingLifecycleSuite() {
  console.log('======================================================================');
  console.log('  NORTH-005 ERP — SESSION LIFECYCLE & ROUTING AUTOMATED TEST SUITE');
  console.log('======================================================================\n');

  /* ------------------------------------------------------------------ */
  /* PART 1: SAME-DEVICE MULTI-TAB SESSION IMMUNITY (STOP FALSE KICKS)   */
  /* ------------------------------------------------------------------ */
  console.log('▶ [TEST 1] Multi-Tab Same-Device Session Sharing & Immunity');
  {
    const env = createDOMEnvironment('/');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;
    delete require.cache[require.resolve('./js/store.js')];
    delete require.cache[require.resolve('./js/production-suite.js')];
    delete require.cache[require.resolve('./js/auth.js')];

    require('./js/store.js');
    require('./js/production-suite.js');
    require('./js/auth.js');

    const auth = global.window.authManager;
    assert.ok(auth, 'AuthManager must be loaded');

    // Tab 1 logs in
    const loginRes = auth.login('admin', 'Admin123!');
    assert.strictEqual(loginRes.success, true, 'Tab 1 login must succeed');

    const tab1DeviceId = auth.getDeviceId();
    const tab1Token = global.localStorage.getItem('north005_active_session_token');
    assert.ok(tab1DeviceId, 'Device ID must be created');
    assert.ok(tab1Token, 'Session token must be created');
    assert.strictEqual(auth.isAuthenticated(), true, 'Tab 1 must be authenticated');
    console.log(`   ✓ Tab 1 logged in on ${tab1DeviceId} (Token: ${tab1Token})`);

    // Tab 2 opens on the SAME device (shares deviceId via localStorage)
    // Tab 2 simulates a storage broadcast event or session refresh
    const tab2Broadcast = {
      username: 'admin',
      active_session_token: tab1Token,
      active_device_id: tab1DeviceId,
      active_device_name: 'Windows PC',
      session_created_at: Date.now(),
      timestamp: Date.now()
    };

    auth.handleConcurrentSessionKick(tab2Broadcast);

    // Verify Tab 1 is NOT terminated because it belongs to the same device!
    assert.strictEqual(auth.isAuthenticated(), true, 'Tab 1 must NOT be terminated by same-device session broadcast');
    const kickModal = env.getOrCreateEl('modal-concurrent-logout');
    assert.notStrictEqual(kickModal.style.display, 'flex', 'Termination modal must NOT be shown for same-device tabs');
    console.log('   ✓ Verified: Multi-tab on same Windows PC does NOT cause false session termination!');
  }

  /* ------------------------------------------------------------------ */
  /* PART 2: GENUINE COMPETING DEVICE LOGIN (INTENTIONAL SECURITY KICK) */
  /* ------------------------------------------------------------------ */
  console.log('\n▶ [TEST 2] Legitimate Competing Device Login Enforces Security Policy');
  {
    const env = createDOMEnvironment('/');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;
    delete require.cache[require.resolve('./js/auth.js')];
    require('./js/auth.js');

    const auth = global.window.authManager;
    auth.login('admin', 'Admin123!');
    assert.strictEqual(auth.isAuthenticated(), true, 'PC session authenticated');

    const pcDeviceId = auth.getDeviceId();

    // Now an Android Phone logs in to the same account at a newer timestamp
    const androidDeviceId = 'dev_android_mobile_9988';
    const androidDeviceName = 'Android Device';
    const androidToken = 'sess_android_' + Date.now();
    const newerTimestamp = Date.now() + 500;

    auth.handleConcurrentSessionKick({
      username: 'admin',
      active_session_token: androidToken,
      active_device_id: androidDeviceId,
      active_device_name: androidDeviceName,
      session_created_at: newerTimestamp,
      last_active_at: new Date(newerTimestamp).toISOString()
    });

    // PC session must be terminated immediately
    assert.strictEqual(auth.isAuthenticated(), false, 'PC session must be terminated when new device logs in');
    assert.strictEqual(global.localStorage.getItem('north005_active_session_token'), null, 'Local token must be wiped');

    // Security modal must accurately show the Android device
    const modal = env.getOrCreateEl('modal-concurrent-logout');
    const devEl = env.getOrCreateEl('concurrent-device-name');
    assert.strictEqual(modal.style.display, 'flex', 'Concurrent logout modal must be displayed');
    assert.strictEqual(devEl.textContent, androidDeviceName, 'Modal must display verified competing device name');
    console.log(`   ✓ Verified: Legitimate Android login kicks PC with verified badge: "${devEl.textContent}"`);

    // Acknowledge modal and return to clean login
    auth.dismissConcurrentModalAndShowLogin();
    assert.strictEqual(modal.style.display, 'none', 'Modal dismissed cleanly');
    assert.strictEqual(env.getPath(), '/', 'Address bar cleanly positioned at /');
    console.log('   ✓ Verified: Modal dismissal cleanly positions address bar at / with login screen');
  }

  /* ------------------------------------------------------------------ */
  /* PART 3: STALE DATABASE RECORD PROTECTION                           */
  /* ------------------------------------------------------------------ */
  console.log('\n▶ [TEST 3] Stale Backend Record Immunity (No Race Condition Kicks)');
  {
    const env = createDOMEnvironment('/');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;
    delete require.cache[require.resolve('./js/auth.js')];
    require('./js/auth.js');

    const auth = global.window.authManager;
    auth.login('admin', 'Admin123!');
    assert.strictEqual(auth.isAuthenticated(), true);

    // Simulate an older stale record arriving from a delayed Supabase query or cold serverless cache
    const staleRecord = {
      username: 'admin',
      active_session_token: 'sess_stale_from_yesterday_12345',
      active_device_id: 'dev_old_machine_000',
      active_device_name: 'Old Device',
      session_created_at: Date.now() - 600000 // 10 minutes older
    };

    auth.handleConcurrentSessionKick(staleRecord);

    // Current active session must survive because incoming record is older!
    assert.strictEqual(auth.isAuthenticated(), true, 'Current valid session must NOT be terminated by stale older records');
    console.log('   ✓ Verified: Stale older session records are safely ignored');
  }

  /* ------------------------------------------------------------------ */
  /* PART 4: UNAUTHENTICATED VISIT TO ROOT / STAYS AT / (NO /master-registry) */
  /* ------------------------------------------------------------------ */
  console.log('\n▶ [TEST 4] Unauthenticated Visit to Root / Stays Cleanly at /');
  {
    const env = createDOMEnvironment('/');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;

    // Simulate stale active view from prior session
    global.localStorage.setItem('NORTH005_ACTIVE_VIEW', 'view-employees');
    global.localStorage.setItem('NORTH005_CURRENT_ROUTE', '/master-registry');

    delete require.cache[require.resolve('./js/store.js')];
    delete require.cache[require.resolve('./js/production-suite.js')];
    delete require.cache[require.resolve('./js/auth.js')];
    delete require.cache[require.resolve('./js/app.js')];
    require('./js/store.js');
    require('./js/production-suite.js');
    require('./js/auth.js');
    require('./js/app.js');

    // Run router initialization
    global.window.initRouter();

    // Verify: Address bar remains at '/' and did NOT rewrite to '/master-registry'
    assert.strictEqual(env.getPath(), '/', 'Address bar must remain at / for unauthenticated visitors');
    assert.notStrictEqual(env.getPath(), '/master-registry', 'Must NEVER rewrite address bar to /master-registry when unauthenticated');
    console.log(`   ✓ Verified: Unauthenticated landing at root stays cleanly on "${env.getPath()}"`);
  }

  /* ------------------------------------------------------------------ */
  /* PART 5: UNAUTHENTICATED DEEP LINK /master-registry PRESERVES DESTINATION */
  /* ------------------------------------------------------------------ */
  console.log('\n▶ [TEST 5] Unauthenticated Deep Link /master-registry Preserved Post-Login');
  {
    const env = createDOMEnvironment('/master-registry');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;

    delete require.cache[require.resolve('./js/store.js')];
    delete require.cache[require.resolve('./js/production-suite.js')];
    delete require.cache[require.resolve('./js/auth.js')];
    delete require.cache[require.resolve('./js/app.js')];
    require('./js/store.js');
    require('./js/production-suite.js');
    require('./js/auth.js');
    require('./js/app.js');

    // Unauthenticated direct access to /master-registry
    global.window.initRouter();

    // The intended destination must be preserved in sessionStorage
    const preserved = global.sessionStorage.getItem('north005_redirect_destination');
    assert.strictEqual(preserved, 'view-employees', 'Requested /master-registry module must be preserved for post-login');

    // The unauthenticated user is presented with the clean login portal at /
    assert.strictEqual(env.getPath(), '/', 'Unauthenticated deep link must redirect to / for clean login');
    console.log(`   ✓ Preserved redirect destination: ${preserved}, address bar cleanly reset to: ${env.getPath()}`);

    // Now user logs in as Admin
    env.getOrCreateEl('auth-login-username').value = 'admin';
    env.getOrCreateEl('auth-login-password').value = 'Admin123!';

    global.window.submitLoginForm();

    // Post-login must redirect straight to the preserved Master Registry destination!
    assert.strictEqual(global.sessionStorage.getItem('north005_redirect_destination'), null, 'Redirect destination cleared after use');
    assert.strictEqual(env.getPath(), '/master-registry', 'User must be redirected to requested /master-registry module after login');
    console.log(`   ✓ Verified: Post-login seamlessly navigated to requested deep link "${env.getPath()}"`);
  }

  /* ------------------------------------------------------------------ */
  /* PART 6: STANDARD LOGIN WITHOUT DEEP LINK DEFAULTS TO /dashboard    */
  /* ------------------------------------------------------------------ */
  console.log('\n▶ [TEST 6] Standard Login without Deep Link Defaults to /dashboard');
  {
    const env = createDOMEnvironment('/');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;

    delete require.cache[require.resolve('./js/store.js')];
    delete require.cache[require.resolve('./js/production-suite.js')];
    delete require.cache[require.resolve('./js/auth.js')];
    delete require.cache[require.resolve('./js/app.js')];
    require('./js/store.js');
    require('./js/production-suite.js');
    require('./js/auth.js');
    require('./js/app.js');

    global.window.initRouter();
    assert.strictEqual(env.getPath(), '/');

    // Admin logs in without any prior deep-link
    env.getOrCreateEl('auth-login-username').value = 'admin';
    env.getOrCreateEl('auth-login-password').value = 'Admin123!';

    global.window.submitLoginForm();

    // Post-login must default to /dashboard
    assert.strictEqual(env.getPath(), '/dashboard', 'Normal login must default to /dashboard');
    console.log(`   ✓ Verified: Standard login smoothly lands on "${env.getPath()}"`);
  }

  /* ------------------------------------------------------------------ */
  /* PART 7: LOGOUT CLEARS SESSION AND RESETS URL TO /                  */
  /* ------------------------------------------------------------------ */
  console.log('\n▶ [TEST 7] Logout Cleans Session and Address Bar (Popstate Protected)');
  {
    const env = createDOMEnvironment('/master-registry');
    global.window = env.windowMock;
    global.document = env.documentMock;
    global.localStorage = env.windowMock.localStorage;
    global.sessionStorage = env.windowMock.sessionStorage;

    delete require.cache[require.resolve('./js/store.js')];
    delete require.cache[require.resolve('./js/production-suite.js')];
    delete require.cache[require.resolve('./js/auth.js')];
    delete require.cache[require.resolve('./js/app.js')];
    require('./js/store.js');
    require('./js/production-suite.js');
    require('./js/auth.js');
    require('./js/app.js');

    // Admin is logged in and viewing Master Registry
    global.window.authManager.login('admin', 'Admin123!');
    global.window.switchView('view-employees', true);
    assert.strictEqual(env.getPath(), '/master-registry');

    // Admin clicks logout
    global.window.authManager.logout();

    // Session must be cleared and URL reset to '/'
    assert.strictEqual(global.window.authManager.isAuthenticated(), false, 'Session must be null');
    assert.strictEqual(env.getPath(), '/', 'Address bar must be reset to / on logout');
    assert.strictEqual(global.localStorage.getItem('north005_active_session_token'), null, 'Session token wiped');

    // Simulate clicking browser Back button after logout
    env.history.back();

    // Popstate guard must prevent accessing protected view and keep user on '/'
    assert.strictEqual(env.getPath(), '/', 'Back button after logout must be intercepted and stay on /');
    console.log('   ✓ Verified: Logout resets URL to / and browser Back button is securely blocked');
  }

  console.log('\n======================================================================');
  console.log('🎉 ALL 7 LIFECYCLE & ROUTING TESTS PASSED PERFECTLY!');
  console.log('======================================================================\n');
  process.exit(0);
}

runSessionAndRoutingLifecycleSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
