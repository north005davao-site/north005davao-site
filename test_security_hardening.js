const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('=== RUNNING SECURITY HARDENING ACCEPTANCE SUITE (S1, S2, S3) ===\n');

const TEST_PORT = 3199;
const serverProc = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'production' }
});

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: TEST_PORT, host: '127.0.0.1', ...options }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  // Wait for server to boot
  await new Promise(r => setTimeout(r, 800));

  console.log('--- TEST 1: Static Allowlist & Sensitive File Exposure (Issue S1) ---');
  
  // Forbidden files
  const forbiddenFiles = [
    '/server.js',
    '/package.json',
    '/package-lock.json',
    '/data/user_sessions.json',
    '/data/employee_documents.json',
    '/data/transactions.json',
    '/SEPTEMBER 2026 - NORTH 005 BOOTH AND TELLER\'S MASTERLIST.xlsx',
    '/Master_Registry_7Sheets_DDN.xlsx',
    '/.git/config',
    '/.env'
  ];

  for (const f of forbiddenFiles) {
    const res = await request({ path: encodeURI(f), method: 'GET' });
    assert.strictEqual(res.status, 403, `Direct access to ${f} should return 403 Forbidden, got ${res.status}`);
    console.log(`✓ Confirmed blocked: ${f} -> 403 Forbidden`);
  }

  // Allowed files
  const allowed = await request({ path: '/', method: 'GET' });
  assert.strictEqual(allowed.status, 200, `Root / should return 200, got ${allowed.status}`);
  console.log('✓ Confirmed allowed: / -> 200 OK');

  const css = await request({ path: '/css/styles.css', method: 'GET' });
  assert.strictEqual(css.status, 200, `/css/styles.css should return 200, got ${css.status}`);
  console.log('✓ Confirmed allowed: /css/styles.css -> 200 OK');

  console.log('\n--- TEST 2: Path Traversal & Injection Prevention (Issue S2) ---');

  // Attempt path traversal on DELETE /api/reports
  const traversalDelete = await request({ path: '/api/reports?dateKey=../data', method: 'DELETE' });
  assert.strictEqual(traversalDelete.status, 400, `Path traversal DELETE should return 400 Bad Request, got ${traversalDelete.status}`);
  assert.strictEqual(fs.existsSync(path.join(__dirname, 'data')), true, 'data/ directory must still exist!');
  assert.strictEqual(fs.existsSync(path.join(__dirname, 'data', 'employee_documents.json')), true, 'data/employee_documents.json must not be wiped!');
  console.log('✓ Confirmed path traversal DELETE rejected: /api/reports?dateKey=../data -> 400 Bad Request (Data directory preserved intact)');

  // Attempt path traversal on check
  const traversalCheck = await request({ path: '/api/reports/check?dateKey=../../etc', method: 'GET' });
  assert.strictEqual(traversalCheck.status, 200);
  const parsedCheck = JSON.parse(traversalCheck.body);
  assert.strictEqual(parsedCheck.exists, false, 'Invalid traversal path must return exists=false');
  console.log('✓ Confirmed path traversal check blocked: /api/reports/check?dateKey=../../etc');

  // Attempt path traversal on download
  const traversalDownload = await request({ path: '/api/reports/download?dateKey=..%2F..%2Fdata', method: 'GET' });
  assert.strictEqual(traversalDownload.status, 400, `Path traversal download must return 400, got ${traversalDownload.status}`);
  console.log('✓ Confirmed path traversal download rejected: 400 Bad Request');

  console.log('\n--- TEST 3: Unauthenticated Operational Data Reset & Token Leaks (Issue S3) ---');

  // Reset without auth token
  const resetNoAuth = await request({ path: '/api/reset-operational-data', method: 'POST' });
  assert.strictEqual(resetNoAuth.status, 401, `POST /api/reset-operational-data without token must return 401 Unauthorized, got ${resetNoAuth.status}`);
  console.log('✓ Confirmed unauthenticated reset blocked: 401 Unauthorized');

  // Reset with invalid token
  const resetBadAuth = await request({
    path: '/api/reset-operational-data',
    method: 'POST',
    headers: { 'Authorization': 'Bearer attacker-fake-token' }
  });
  assert.strictEqual(resetBadAuth.status, 401, `POST /api/reset-operational-data with fake token must return 401, got ${resetBadAuth.status}`);
  console.log('✓ Confirmed invalid token reset blocked: 401 Unauthorized');

  // User sessions token leak check
  const sessionsSummary = await request({ path: '/api/user-sessions', method: 'GET' });
  assert.strictEqual(sessionsSummary.status, 200);
  const sessionsBody = JSON.parse(sessionsSummary.body);
  // Verify that active_session_token is NOT exposed in bulk summary
  Object.values(sessionsBody).forEach(s => {
    assert.strictEqual(s.active_session_token, undefined, 'Active session token must NOT be leaked in bulk user sessions call!');
  });
  console.log('✓ Confirmed session tokens are not leaked in GET /api/user-sessions summary');

  console.log('\n======================================================');
  console.log('ALL SECURITY HARDENING TESTS (S1, S2, S3) PASSED! 🛡️');
  console.log('======================================================\n');
}

runTests()
  .then(() => {
    serverProc.kill();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Security test failed:', err);
    serverProc.kill();
    process.exit(1);
  });
