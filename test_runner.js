const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('====================================================');
console.log('   OMNI-ERP AUTOMATED TEST RUNNER (PHASE 0)');
console.log('====================================================\n');

const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js') && f !== 'test_runner.js')
  .sort();

console.log(`Discovered ${testFiles.length} test suites.\n`);

let passedCount = 0;
let failedCount = 0;
const failures = [];

for (const testFile of testFiles) {
  process.stdout.write(`▶ Running ${testFile.padEnd(45)} ... `);
  const startTime = Date.now();
  const res = spawnSync(process.execPath, [path.join(__dirname, testFile)], {
    cwd: __dirname,
    timeout: 15000,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' }
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (res.status === 0 && !res.error) {
    console.log(`[ PASS ] (${duration}s)`);
    passedCount++;
  } else {
    console.log(`[ FAIL ] (${duration}s)`);
    failedCount++;
    failures.push({
      file: testFile,
      status: res.status,
      error: res.error,
      stdout: res.stdout,
      stderr: res.stderr
    });
  }
}

console.log('\n====================================================');
console.log(`SUMMARY: ${passedCount} passed, ${failedCount} failed of ${testFiles.length} suites.`);
console.log('====================================================\n');

if (failures.length > 0) {
  console.log('FAILURES DETAIL:\n');
  failures.forEach(f => {
    console.log(`--- [FAIL] ${f.file} ---`);
    if (f.error) console.log('Error:', f.error.message);
    if (f.stderr) console.log('Stderr:\n', f.stderr);
    if (f.stdout) {
      const lines = f.stdout.trim().split('\n');
      console.log('Last output:\n', lines.slice(-10).join('\n'));
    }
    console.log('--------------------------------------------------\n');
  });
  process.exit(1);
} else {
  console.log('ALL TEST SUITES PASSED CLEANLY! ✨\n');
  process.exit(0);
}
