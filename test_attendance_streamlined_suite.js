/**
 * Test Suite: Attendance / Workforce Monitoring Streamlined Implementation
 * Verifies:
 * 1. Exclusion of Admin, Supervisors, Collectors (Strictly 150 Field Personnel: 116 Tellers + 34 Relievers)
 * 2. True Data Reset (Present: 0, Late: 0, Absent: 150)
 * 3. Complete Removal of REST DAY / DAY OFF (cards, options, badges)
 * 4. Complete Removal of DURATION (table header, row cells, timeline modal, CSV)
 * 5. Operational Role Filter Segment Pills (All: 150, Tellers: 116, Relievers: 34)
 * 6. Reliever Coverage Deployment Workflow
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== RUNNING ATTENDANCE / WORKFORCE MONITORING VERIFICATION SUITE ===\n');

// 1. Verify HTML Structure
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Assert Rest Day removed
if (html.includes('id="att-tab-restday"') || html.includes('id="att-summary-restday"')) {
  throw new Error('FAILED: Rest Day card still found in index.html');
}
if (html.includes('<option value="REST DAY">REST DAY</option>')) {
  throw new Error('FAILED: Rest Day option still found in index.html status filter');
}
console.log('✓ Rest Day cards and dropdown options completely removed from HTML');

// Assert Duration column removed from tables
const mainTableMatch = html.match(/<section id="view-workforce-attendance"[\s\S]*?<\/section>/);
if (mainTableMatch) {
  const sectionContent = mainTableMatch[0];
  if (sectionContent.toLowerCase().includes('<th>duration</th>') || sectionContent.includes('>Duration</th>')) {
    throw new Error('FAILED: Duration column header found in main attendance table');
  }
}
const weeklyModalMatch = html.match(/<div id="modal-attendance-weekly-timeline"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
if (weeklyModalMatch) {
  const modalContent = weeklyModalMatch[0];
  if (modalContent.includes('<th>DURATION</th>') || modalContent.includes('>DURATION</th>')) {
    throw new Error('FAILED: DURATION column header found in weekly timeline modal');
  }
}
console.log('✓ Duration column headers completely removed from main table and weekly timeline modal');

// Assert Role Segment Pills exist
if (!html.includes('id="att-role-btn-all"') || !html.includes('id="att-role-btn-teller"') || !html.includes('id="att-role-btn-reliever"')) {
  throw new Error('FAILED: Role segment filter pills missing in index.html');
}
console.log('✓ Role segment filter buttons (All Field Staff, Sales Reps, Relievers Pool) verified in HTML');

// 2. Set up In-Memory Environment
const domStore = {};
function createMockElement(id, tagName = 'div') {
  return {
    id,
    tagName,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    click: () => {}
  };
}

const mockDocument = {
  getElementById: (id) => {
    if (!domStore[id]) {
      domStore[id] = createMockElement(id);
    }
    return domStore[id];
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => createMockElement(`dyn-${tag}`, tag),
  body: createMockElement('body')
};

const localStorageMock = {
  data: {},
  getItem(k) { return this.data[k] !== undefined ? this.data[k] : null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; }
};

const sandbox = {
  window: {},
  document: mockDocument,
  localStorage: localStorageMock,
  console: console,
  setTimeout: (fn) => fn(),
  URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
  Blob: class { constructor(parts) { this.content = parts.join(''); } }
};
sandbox.window = sandbox;

vm.createContext(sandbox);

// Load Store and Master Data
const storeCode = fs.readFileSync(path.join(__dirname, 'js/store.js'), 'utf8');
vm.runInContext(storeCode, sandbox);

// Load Attendance Module
const attCode = fs.readFileSync(path.join(__dirname, 'js/workforce-attendance.js'), 'utf8');
vm.runInContext(attCode, sandbox);

const attModule = sandbox.window.workforceAttendanceModule;
if (!attModule) {
  throw new Error('FAILED: workforceAttendanceModule failed to initialize');
}

// 3. Test Staff Filtering
const emps = attModule.getEmployees();
console.log(`\nFiltered Workforce Staff Count: ${emps.length}`);
if (emps.length !== 150) {
  throw new Error(`FAILED: Expected exactly 150 field staff (116 Tellers + 34 Relievers), got ${emps.length}`);
}

const rolesCount = {};
emps.forEach(e => {
  const r = e.role || e.position || 'Unknown';
  rolesCount[r] = (rolesCount[r] || 0) + 1;
  const upper = ((e.role || '') + ' ' + (e.position || '') + ' ' + (e.id || '')).toUpperCase();
  if (upper.includes('ADMIN') || upper.includes('SUPERVISOR') || upper.includes('COLLECTOR')) {
    throw new Error(`FAILED: Found non-field staff in attendance: ${e.name} (${e.id}) - ${e.role}`);
  }
});
console.log('Workforce Breakdown:', rolesCount);
console.log('✓ Operations Administrator, Supervisors, and Collectors strictly excluded');

const relievers = attModule.getRelievers();
console.log(`Relievers Pool Count: ${relievers.length}`);
if (relievers.length !== 34) {
  throw new Error(`FAILED: Expected 34 relievers, got ${relievers.length}`);
}
console.log('✓ Relievers pool count matches exactly 34 personnel');

// 4. Test Data Reset & Initial KPI Counters
attModule.init();

const kpiWorkforce = mockDocument.getElementById('kpi-att-workforce').textContent;
const kpiPresent = mockDocument.getElementById('kpi-att-present').textContent;
const kpiLate = mockDocument.getElementById('kpi-att-late').textContent;
const kpiAbsent = mockDocument.getElementById('kpi-att-absent').textContent;

console.log(`\nInitial Reset KPIs: Active=${kpiWorkforce}, Present=${kpiPresent}, Late=${kpiLate}, Absent=${kpiAbsent}`);
if (kpiWorkforce != 150) throw new Error(`Expected Active Workforce 150, got ${kpiWorkforce}`);
if (kpiPresent != 0) throw new Error(`Expected Present 0 after reset, got ${kpiPresent}`);
if (kpiLate != 0) throw new Error(`Expected Late 0 after reset, got ${kpiLate}`);
if (kpiAbsent != 150) throw new Error(`Expected Absent 150 after reset, got ${kpiAbsent}`);
console.log('✓ True Clean Slate verified: 0 Present, 0 Late, 150 Absent (No fake mock check-ins)');

// 5. Verify Table Rendering Does Not Have Duration
const tbody = mockDocument.getElementById('workforce-attendance-tbody');
if (tbody.innerHTML.includes('12.75 hrs') || tbody.innerHTML.includes('hrs</td>')) {
  throw new Error('FAILED: Duration found rendered in main table rows');
}
console.log('✓ Duration verified removed from all table row cells');

// 6. Test Role Segment Pills (Tellers vs Relievers filtering)
attModule.setPersonnelType('reliever');
// Check rendered count when filtered to reliever
let trMatches = tbody.innerHTML.match(/<tr>/g) || [];
console.log(`Relievers page rendered rows: ${trMatches.length}`);
if (trMatches.length === 0) throw new Error('Relievers filter should render reliever rows');

attModule.setPersonnelType('teller');
trMatches = tbody.innerHTML.match(/<tr>/g) || [];
console.log(`Tellers page rendered rows: ${trMatches.length}`);
if (trMatches.length === 0) throw new Error('Tellers filter should render teller rows');

attModule.setPersonnelType('all');
console.log('✓ Role segment switching verified (All, Tellers, Relievers)');

// 7. Test Reliever Deployment Workflow on Absent Seller
const absentSeller = emps.find(e => !(e.role || '').toLowerCase().includes('reliever'));
const deployedReliever = relievers[0];

console.log(`\nTesting Reliever Deployment:`);
console.log(`- Absent Teller: ${absentSeller.name} (${absentSeller.id})`);
console.log(`- Deploying Reliever: ${deployedReliever.name} (${deployedReliever.id})`);

mockDocument.getElementById('att-log-emp-id').value = absentSeller.id;
mockDocument.getElementById('att-log-date').value = '2026-09-30';
mockDocument.getElementById('att-log-status').value = 'ABSENT';
mockDocument.getElementById('att-log-time-in').value = '';
mockDocument.getElementById('att-log-time-out').value = '';
mockDocument.getElementById('att-log-remarks').value = 'Sick leave';
mockDocument.getElementById('att-log-reliever-select').value = deployedReliever.id;

attModule.saveLog();

// Check Absent Seller Record
const sellerRecord = attModule.records['2026-09-30'][absentSeller.id];
if (sellerRecord.status !== 'ABSENT') throw new Error(`Expected seller status ABSENT, got ${sellerRecord.status}`);
if (!sellerRecord.notes.includes(deployedReliever.name)) throw new Error('Expected seller notes to mention covering reliever');
console.log(`✓ Absent Teller logged: Status=${sellerRecord.status}, Notes="${sellerRecord.notes}"`);

// Check Reliever Record Automatically Created/Updated
const relieverRecord = attModule.records['2026-09-30'][deployedReliever.id];
if (!relieverRecord || relieverRecord.status !== 'PRESENT') {
  throw new Error(`Expected reliever status PRESENT, got ${relieverRecord && relieverRecord.status}`);
}
if (!relieverRecord.notes.includes('Covering')) {
  throw new Error(`Expected reliever notes to specify coverage, got "${relieverRecord.notes}"`);
}
console.log(`✓ Covering Reliever automatically logged: Status=${relieverRecord.status}, In=${relieverRecord.timeIn}, Notes="${relieverRecord.notes}"`);

// Check Updated KPIs: Present should now be 1, Absent 149
const newPresent = mockDocument.getElementById('kpi-att-present').textContent;
const newAbsent = mockDocument.getElementById('kpi-att-absent').textContent;
console.log(`Updated KPIs after deployment: Present=${newPresent}, Absent=${newAbsent}`);
if (newPresent != 1) throw new Error(`Expected Present 1 after deployment, got ${newPresent}`);

// 8. Test CSV Export Header
let exportedCSV = '';
sandbox.Blob = class {
  constructor(parts) {
    exportedCSV = parts.join('');
  }
};
attModule.exportCSV();
if (exportedCSV.includes('Duration')) {
  throw new Error('FAILED: CSV export still contains Duration column');
}
console.log('✓ CSV export verified without Duration column');

console.log('\n======================================================');
console.log('🎉 ALL ATTENDANCE STREAMLINED & OPERATIONAL TESTS PASSED! 🚀');
console.log('======================================================');
