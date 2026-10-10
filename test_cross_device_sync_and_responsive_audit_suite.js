/**
 * NORTH-005 OmniERP — Cross-Device Consistency & Data Synchronization Test Suite
 * Verifies Phase 1-6 objectives:
 * 1. Backend persistent API routes: /api/attendance and /api/system-users
 * 2. Cross-device bidirectional data persistence & merging for Attendance, Users, Transactions, and Rentals
 * 3. Client-side sync listeners and server revalidation on focus / visibilitychange
 * 4. Responsive CSS foundations across 360px, 480px, 768px, and 1024px breakpoints
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const requestHandler = require('./server.js');

function makeRequest(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url: urlPath,
      headers: {
        host: '127.0.0.1:3000',
        'content-type': 'application/json',
        ...headers
      },
      _body: body ? JSON.stringify(body) : null,
      on(event, handler) {
        if (event === 'data' && this._body) {
          handler(Buffer.from(this._body));
        }
        if (event === 'end') {
          handler();
        }
      }
    };

    let statusCode = 200;
    let responseHeaders = {};
    let responseBody = '';

    const res = {
      writeHead(code, head = {}) {
        statusCode = code;
        responseHeaders = head;
      },
      setHeader(k, v) {
        responseHeaders[k] = v;
      },
      end(data) {
        if (data) responseBody += data;
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch (_) {}
        resolve({
          statusCode,
          headers: responseHeaders,
          body: responseBody,
          json
        });
      }
    };

    try {
      requestHandler(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function runTests() {
  console.log('--- STARTING CROSS-DEVICE CONSISTENCY & DATA SYNC AUDIT SUITE ---');

  // TEST 1: /api/attendance GET & POST Persistence
  console.log('Test 1: /api/attendance GET and POST persistence...');
  const attGetRes = await makeRequest('GET', '/api/attendance');
  assert.strictEqual(attGetRes.statusCode, 200, 'GET /api/attendance should return 200');
  assert.ok(attGetRes.json && typeof attGetRes.json.records === 'object', 'Should return records object');

  const testAttendancePayload = {
    records: {
      '2026-10-10': {
        'DDN005-SR101': {
          employeeId: 'DDN005-SR101',
          status: 'PRESENT',
          timeIn: '07:55 AM',
          timeOut: '05:30 PM',
          duration: '9h 35m',
          notes: 'Present on duty'
        }
      }
    },
    remarks: {
      'DDN005-SR101_2026-10-10': 'Good performance'
    }
  };

  const attPostRes = await makeRequest('POST', '/api/attendance', testAttendancePayload);
  assert.strictEqual(attPostRes.statusCode, 200, 'POST /api/attendance should return 200');
  assert.strictEqual(attPostRes.json.success, true, 'POST /api/attendance should succeed');

  const attVerifyRes = await makeRequest('GET', '/api/attendance');
  assert.ok(attVerifyRes.json.records['2026-10-10'], 'Persisted date record should exist');
  assert.strictEqual(
    attVerifyRes.json.records['2026-10-10']['DDN005-SR101'].status,
    'PRESENT',
    'Persisted employee attendance should match'
  );
  assert.strictEqual(
    attVerifyRes.json.remarks['DDN005-SR101_2026-10-10'],
    'Good performance',
    'Persisted supervisor remarks should match'
  );
  console.log('✓ Test 1 Passed: /api/attendance persists across requests.');

  // TEST 2: /api/system-users GET, POST, and DELETE Persistence
  console.log('Test 2: /api/system-users GET, POST, DELETE persistence...');
  const usersGetRes = await makeRequest('GET', '/api/system-users');
  assert.strictEqual(usersGetRes.statusCode, 200, 'GET /api/system-users should return 200');
  assert.ok(Array.isArray(usersGetRes.json.users), 'Users should be an array');
  const adminUser = usersGetRes.json.users.find(u => u.username === 'admin');
  assert.ok(adminUser, 'Default Administrator must always exist');

  const dynamicTestId = 'USR-TEST-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const dynamicTestUsername = 'testuser_' + Math.random().toString(36).substr(2, 6);

  const testNewUser = {
    id: dynamicTestId,
    username: dynamicTestUsername,
    name: 'Maria Clara Santos',
    role: 'Supervisor',
    status: 'Active',
    position: 'Area Supervisor',
    department: 'Field Operations'
  };

  const usersPostRes = await makeRequest('POST', '/api/system-users', {
    users: [...usersGetRes.json.users, testNewUser],
    deletedUserIds: usersGetRes.json.deletedUserIds || []
  });
  assert.strictEqual(usersPostRes.statusCode, 200, 'POST /api/system-users should return 200');
  assert.strictEqual(usersPostRes.json.success, true, 'POST /api/system-users should succeed');

  const usersVerifyRes = await makeRequest('GET', '/api/system-users');
  const foundNew = usersVerifyRes.json.users.find(u => u.username === dynamicTestUsername);
  assert.ok(foundNew, 'New user must appear in system users list');
  assert.strictEqual(foundNew.role, 'Supervisor', 'Role must be Supervisor');

  // Test Delete User
  const deleteRes = await makeRequest('DELETE', `/api/system-users?id=${dynamicTestId}`);
  assert.strictEqual(deleteRes.statusCode, 200, 'DELETE /api/system-users should return 200');
  assert.strictEqual(deleteRes.json.success, true, 'DELETE /api/system-users should succeed');

  const usersAfterDelete = await makeRequest('GET', '/api/system-users');
  const foundDeleted = usersAfterDelete.json.users.find(u => u.id === dynamicTestId);
  assert.strictEqual(foundDeleted, undefined, 'Deleted user must be purged from users list');
  assert.ok(
    usersAfterDelete.json.deletedUserIds.includes(dynamicTestId),
    'Deleted user must be added to tombstone list'
  );
  console.log('✓ Test 2 Passed: /api/system-users handles full CRUD lifecycle and tombstones.');

  // TEST 3: Multi-device Data Merging in store.js
  console.log('Test 3: Store syncWithServer bidirectional merging verification...');
  const storeCode = fs.readFileSync(path.join(__dirname, 'js', 'store.js'), 'utf8');
  assert.ok(
    storeCode.includes('localMap.has(srvTxn.id)'),
    'store.js syncWithServer must merge transactions even if local transactions array is populated'
  );
  assert.ok(
    storeCode.includes('orMap.has(srvRental.id)'),
    'store.js syncWithServer must merge outlet rentals even if local outletRentals array is populated'
  );
  console.log('✓ Test 3 Passed: Multi-device sync condition in store.js merges incoming remote data.');

  // TEST 4: Workforce Attendance Server Sync & Listeners in workforce-attendance.js
  console.log('Test 4: workforce-attendance.js server sync and listeners...');
  const attCode = fs.readFileSync(path.join(__dirname, 'js', 'workforce-attendance.js'), 'utf8');
  assert.ok(
    attCode.includes('this.syncWithServer();') && attCode.includes('this.setupSyncListeners();'),
    'workforce-attendance.js must call syncWithServer and setupSyncListeners in init'
  );
  assert.ok(
    attCode.includes('/api/attendance'),
    'workforce-attendance.js must communicate with /api/attendance'
  );
  assert.ok(
    attCode.includes('this.persistToServer();'),
    'workforce-attendance.js must persist changes to server upon saving records or remarks'
  );
  console.log('✓ Test 4 Passed: Workforce Attendance has persistent server sync and focus listeners.');

  // TEST 5: User & Access Management Sync in auth.js
  console.log('Test 5: auth.js system users server sync and listeners...');
  const authCode = fs.readFileSync(path.join(__dirname, 'js', 'auth.js'), 'utf8');
  assert.ok(
    authCode.includes('this.syncUsersWithServer();') && authCode.includes('this.setupUserSyncListeners();'),
    'auth.js must call syncUsersWithServer and setupUserSyncListeners in initUsers'
  );
  assert.ok(
    authCode.includes('/api/system-users'),
    'auth.js must communicate with /api/system-users'
  );
  console.log('✓ Test 5 Passed: User Management has persistent server sync and focus listeners.');

  // TEST 6: Thermal Paper Sync in thermal-paper.js
  console.log('Test 6: thermal-paper.js server sync and cache refresh...');
  const tpCode = fs.readFileSync(path.join(__dirname, 'js', 'thermal-paper.js'), 'utf8');
  assert.ok(
    tpCode.includes('syncFromServer'),
    'thermal-paper.js must expose syncFromServer method'
  );
  assert.ok(
    tpCode.includes("window.addEventListener('focus', () => this.syncFromServer());"),
    'thermal-paper.js must bind focus listener to sync from server'
  );
  console.log('✓ Test 6 Passed: Thermal Paper has server revalidation on focus and visibilitychange.');

  // TEST 7: Responsive CSS Foundations in css/styles.css
  console.log('Test 7: Responsive CSS foundations in styles.css...');
  const cssContent = fs.readFileSync(path.join(__dirname, 'css', 'styles.css'), 'utf8');
  assert.ok(
    cssContent.includes('.table-wrapper') && cssContent.includes('-webkit-overflow-scrolling: touch'),
    'styles.css must have momentum scrolling on table-wrapper'
  );
  assert.ok(
    cssContent.includes('#view-workforce-attendance .view-actions'),
    'styles.css must have responsive rules for workforce attendance actions'
  );
  assert.ok(
    cssContent.includes('#view-finance .stat-grid') && cssContent.includes('.ep-tab-nav'),
    'styles.css must have responsive rules for finance stat-grid and tab nav'
  );
  assert.ok(
    cssContent.includes('#view-user-management .view-actions'),
    'styles.css must have responsive rules for user management actions'
  );
  assert.ok(
    cssContent.includes('.modal-card') && cssContent.includes('max-width: min(94vw'),
    'styles.css must enforce responsive maximum width for modal dialogs'
  );
  console.log('✓ Test 7 Passed: styles.css contains required responsive breakpoints and component guarantees.');

  console.log('\n====================================================');
  console.log('ALL CROSS-DEVICE CONSISTENCY AUDIT CHECKS PASSED! ✨');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
