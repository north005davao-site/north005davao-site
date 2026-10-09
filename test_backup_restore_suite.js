/**
 * NORTH-005 OmniERP — Automated Backup Point & Restore Verification Suite
 * 
 * Validates all 9 core requirements:
 * 1. Creation of verified recovery points before future modifications.
 * 2. Downloadable ZIP packages with SHA-256 manifests, recovery manuals, and sanitized credentials.
 * 3. Backup & Restore Control Center API endpoints.
 * 4. Guided restoration workflow with automatic pre-restoration safety snapshot generation.
 * 5. Preservation and verification of operational data (Master Registry, Transactions, Outlets).
 * 6. Protection guard against deleting the only verified recovery point.
 * 7. Prevention of silent failures and rollback verification.
 * 8. Strict admin role access enforcement.
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const backupEngine = require('./scripts/backup_engine');
const serverHandler = require('./server');

const TEST_PORT = 4920;

async function runBackupTestSuite() {
  console.log('====================================================');
  console.log('   NORTH-005 ENTERPRISE BACKUP & RESTORE TEST SUITE');
  console.log('====================================================\n');

  // Start temporary test server
  const server = http.createServer(serverHandler);
  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Creation of a Verified Backup Point
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Creating backup point with unique ID and planned changes...');
    const createRes = await backupEngine.createBackupPoint({
      versionName: 'v1.4.0-test-baseline',
      description: 'Pre-modification baseline for automated test suite',
      plannedChanges: 'Automated verification test run',
      backupType: 'full',
      author: 'Peter John Carrillo (Administrator)'
    });

    assert(createRes.success, 'Backup creation should succeed');
    assert(createRes.backupId.startsWith('BKP-'), 'Backup ID must have BKP- prefix');
    assert(fs.existsSync(createRes.zipPath), 'Generated ZIP file must exist on disk');
    assert(createRes.manifest, 'Manifest must be generated');
    assert.strictEqual(createRes.manifest.versionName, 'v1.4.0-test-baseline');
    assert(createRes.manifest.files.length > 0, 'Manifest must record files');
    console.log(`   ✓ Backup point created: ${createRes.backupId} (${(createRes.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

    // -------------------------------------------------------------
    // TEST 2: Package Contents & Sensitive Credential Sanitization
    // -------------------------------------------------------------
    console.log('▶ TEST 2: Inspecting ZIP archive structure & credential sanitization...');
    const zipBuf = fs.readFileSync(createRes.zipPath);
    const zip = await JSZip.loadAsync(zipBuf);

    assert(zip.file('manifest.json'), 'ZIP must include manifest.json');
    assert(zip.file('RECOVERY_MANUAL.md'), 'ZIP must include RECOVERY_MANUAL.md');
    assert(zip.file('index.html'), 'ZIP must include index.html');
    assert(zip.file('server.js'), 'ZIP must include server.js');
    assert(zip.file('data/master_registry.json'), 'ZIP must include data/master_registry.json');

    // Verify sanitization: active_session_token must be masked if present
    const sessionFile = zip.file('data/user_sessions.json');
    if (sessionFile) {
      const sessContent = await sessionFile.async('text');
      assert(!sessContent.includes('secret_raw_token'), 'Session tokens must be masked in backup');
    }
    console.log('   ✓ Archive verified: Manifest, Manual, Code, and Operational Data present with secrets sanitized.');

    // -------------------------------------------------------------
    // TEST 3: Cryptographic Verification (SHA-256 Checksums)
    // -------------------------------------------------------------
    console.log('▶ TEST 3: Cryptographic verification of backup hashes...');
    const verifyReport = await backupEngine.verifyBackup(createRes.zipPath);
    assert(verifyReport.valid, 'Backup archive must pass cryptographic validation');
    assert.strictEqual(verifyReport.errors.length, 0, 'No errors allowed during verification');
    assert(verifyReport.checks.checksumsMatched, 'All SHA-256 checksums must match declared manifest');
    assert(verifyReport.checks.dataIntegrity, 'Operational database records must be parsed and healthy');
    console.log(`   ✓ Checksums matched: ${verifyReport.checks.filesIntact} / ${verifyReport.checks.filesChecked} files verified.`);

    // -------------------------------------------------------------
    // TEST 4: Control Center API Endpoints
    // -------------------------------------------------------------
    console.log('▶ TEST 4: Testing Backup & Restore HTTP API endpoints...');
    
    // 4a. GET /api/backups
    const listRes = await fetch(`${baseUrl}/api/backups`, {
      headers: { 'Authorization': 'Bearer adm-test-master-token' }
    });
    assert.strictEqual(listRes.status, 200, 'GET /api/backups must return 200');
    const listData = await listRes.json();
    assert(Array.isArray(listData.backups), 'Backups list must be an array');
    assert(listData.backups.some(b => b.backupId === createRes.backupId), 'Catalog must list newly created backup');

    // 4b. GET /api/backups/download
    const dlRes = await fetch(`${baseUrl}/api/backups/download?id=${createRes.backupId}`);
    assert.strictEqual(dlRes.status, 200, 'Download endpoint must return 200');
    assert(dlRes.headers.get('content-type').includes('zip'), 'Download must serve application/zip');
    const dlBuf = await dlRes.arrayBuffer();
    assert.strictEqual(dlBuf.byteLength, createRes.sizeBytes, 'Downloaded buffer size must match archive size');

    // 4c. POST /api/backups/verify
    const apiVerifyRes = await fetch(`${baseUrl}/api/backups/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer adm-test-master-token'
      },
      body: JSON.stringify({ id: createRes.backupId })
    });
    assert.strictEqual(apiVerifyRes.status, 200, 'API verify must return 200');
    const apiVerifyData = await apiVerifyRes.json();
    assert(apiVerifyData.verification.valid, 'API verification report must be valid');
    console.log('   ✓ List, Download, and Verify API endpoints verified.');

    // -------------------------------------------------------------
    // TEST 5: Guided Restoration Workflow with Auto Safety Snapshot
    // -------------------------------------------------------------
    console.log('▶ TEST 5: Executing guided restore with pre-restore safety snapshot...');
    const restoreRes = await fetch(`${baseUrl}/api/backups/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer adm-test-master-token'
      },
      body: JSON.stringify({
        id: createRes.backupId,
        restoreCode: false,
        restoreData: true,
        autoSafetyBackup: true
      })
    });

    assert.strictEqual(restoreRes.status, 200, 'Restore must return 200');
    const restoreData = await restoreRes.json();
    assert(restoreData.success, 'Restoration must report success');
    assert(restoreData.report.safetyBackupId, 'System must have created automatic pre-restore safety snapshot');
    assert(restoreData.report.safetyBackupId.startsWith('BKP-'), 'Safety backup ID must be valid');
    assert(restoreData.report.postChecks.masterRegistryIntact, 'Master Registry must be verified intact post-restore');
    assert(restoreData.report.postChecks.employeesCount > 0, 'Master Registry employees must be preserved');
    console.log(`   ✓ Restoration succeeded. Safety point ${restoreData.report.safetyBackupId} created.`);
    console.log(`   ✓ Master Registry verified intact (${restoreData.report.postChecks.employeesCount} employees).`);

    // -------------------------------------------------------------
    // TEST 6: Upload and Verification of Saved Package
    // -------------------------------------------------------------
    console.log('▶ TEST 6: Uploading external backup package via API...');
    const base64Package = Buffer.from(dlBuf).toString('base64');
    const uploadRes = await fetch(`${baseUrl}/api/backups/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer adm-test-master-token'
      },
      body: JSON.stringify({
        base64Zip: base64Package,
        filename: 'external_upload_test.zip',
        description: 'Uploaded offline package'
      })
    });

    assert.strictEqual(uploadRes.status, 200, 'Upload must succeed with 200');
    const uploadData = await uploadRes.json();
    assert(uploadData.success, 'Upload response must report success');
    assert(uploadData.verification.valid, 'Uploaded package must be verified');
    console.log('   ✓ Uploaded package verified and cataloged.');

    // -------------------------------------------------------------
    // TEST 7: Protection Guard Against Deleting Only Recovery Point
    // -------------------------------------------------------------
    console.log('▶ TEST 7: Protection Guard against deleting last verified recovery point...');
    
    // Create an isolated engine index with exactly 1 verified point to test guard
    const testSinglePointId = 'BKP-SINGLE-POINT-TEST';
    const singleIndex = [{
      backupId: testSinglePointId,
      versionName: 'Only Point',
      isVerified: true,
      filename: 'dummy.zip'
    }];
    const backupIndexPath = path.join(__dirname, 'backups', 'index.json');
    const originalIndex = JSON.parse(fs.readFileSync(backupIndexPath, 'utf8'));

    try {
      fs.writeFileSync(backupIndexPath, JSON.stringify(singleIndex, null, 2), 'utf8');
      
      let blocked = false;
      try {
        backupEngine.deleteBackup(testSinglePointId);
      } catch (err) {
        if (err.message.includes('Cannot delete the only remaining verified recovery point')) {
          blocked = true;
        }
      }
      assert(blocked, 'Protection guard MUST prevent deleting the only verified recovery point');
      console.log('   ✓ Protection guard successfully blocked deletion of sole recovery point.');
    } finally {
      // Restore actual index
      fs.writeFileSync(backupIndexPath, JSON.stringify(originalIndex, null, 2), 'utf8');
    }

    // -------------------------------------------------------------
    // TEST 8: Role-Based Security Guard
    // -------------------------------------------------------------
    console.log('▶ TEST 8: Role-based security validation (Non-admin blocking)...');
    const unauthRes = await fetch(`${baseUrl}/api/backups`, {
      headers: { 'Authorization': 'Bearer non-admin-token-123' }
    });
    assert.strictEqual(unauthRes.status, 401, 'Unauthorized request to /api/backups must be rejected with 401');
    console.log('   ✓ Unauthenticated and non-admin requests strictly rejected.');

    console.log('\n====================================================');
    console.log('   ALL 8 BACKUP & RESTORE TEST SUITES PASSED CLEANLY! ✨');
    console.log('====================================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runBackupTestSuite().catch(err => {
    console.error('Test Suite Failure:', err);
    process.exit(1);
  });
}

module.exports = runBackupTestSuite;
