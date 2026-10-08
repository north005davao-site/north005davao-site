const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const REPORTS_DIR = path.join(__dirname, 'generated_reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const INDEX_FILE = path.join(REPORTS_DIR, 'index.json');
if (!fs.existsSync(INDEX_FILE)) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Ensure persistent data directory and transactions database file exist
const DATA_DIR = path.join(__dirname, 'data');
const TXN_FILE = path.join(DATA_DIR, 'transactions.json');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readPersistentTransactions() {
  try {
    if (fs.existsSync(TXN_FILE)) {
      return JSON.parse(fs.readFileSync(TXN_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent transactions:', e);
  }
  return null;
}

function writePersistentTransactions(payload) {
  try {
    fs.writeFileSync(TXN_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent transactions:', e);
  }
}

const OUTLET_FILE = path.join(DATA_DIR, 'outlet_rentals.json');

function readPersistentOutletRentals() {
  try {
    if (fs.existsSync(OUTLET_FILE)) {
      return JSON.parse(fs.readFileSync(OUTLET_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent outlet rentals:', e);
  }
  return null;
}

function writePersistentOutletRentals(payload) {
  try {
    fs.writeFileSync(OUTLET_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent outlet rentals:', e);
  }
}

const THERMAL_FILE = path.join(DATA_DIR, 'thermal_paper.json');

function readPersistentThermalPaper() {
  try {
    if (fs.existsSync(THERMAL_FILE)) {
      return JSON.parse(fs.readFileSync(THERMAL_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent thermal paper:', e);
  }
  return null;
}

function writePersistentThermalPaper(payload) {
  try {
    fs.writeFileSync(THERMAL_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent thermal paper:', e);
  }
}

const DOCS_FILE = path.join(DATA_DIR, 'employee_documents.json');

function readPersistentEmployeeDocuments() {
  try {
    if (fs.existsSync(DOCS_FILE)) {
      return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent employee documents:', e);
  }
  return null;
}

const UNWANTED_SEEDER_NAMES_SERVER = new Set([
  'princess solamillo', 'kei pagulong', 'jessa busaco', 'othmarie lupiba',
  'faith hermoso', 'mari sarol', 'ellen rino', 'ellen riño', 'angelie tiedra',
  'noreen d bayang', 'noreen d. bayang', 'rhea mae m bolilawa', 'rhea mae m. bolilawa',
  'jasnen parame aquino', 'marjory torino', 'gina paula gemino', 'jennifer m osman',
  'jennifer m. osman', 'ferlyn zamora robello', 'jeziel r simene', 'jeziel r. simene',
  'karen batas', 'elyn t rosento', 'elyn t. rosento', 'ester mopon',
  'christly ann tuasoc', 'jane christine tuasoc', 'clouie mae hipos', 'aires monreal',
  'precious nica torrefiel', 'jemma rose roco', 'carolyn joy catubigan',
  'pamela denisse g antequeza', 'pamela denisse g. antequeza', 'bbelen apatan',
  'laika jeanne sapine', 'jeah rica linsay', 'kristina cassandra d lumidin',
  'kristina cassandra d. lumidin', 'mae jean gementiza'
]);

function isServerUnwantedSeededDoc(d) {
  if (!d) return false;
  const name = (d.employeeName || '').toLowerCase().trim();
  const file = (d.fileName || '').toLowerCase().trim();
  for (const s of UNWANTED_SEEDER_NAMES_SERVER) {
    if (name === s || name.includes(s) || file.includes(s)) return true;
  }
  return false;
}

function writePersistentEmployeeDocuments(payload) {
  try {
    if (payload && Array.isArray(payload.documents)) {
      payload.documents = payload.documents.filter(d => !isServerUnwantedSeededDoc(d));
      payload.documents.forEach(d => {
        if (d.fileDataUrl && typeof d.fileDataUrl === 'string' && d.fileDataUrl.length < 3500) {
          try {
            const b64 = d.fileDataUrl.split(',')[1] || '';
            const str = Buffer.from(b64, 'base64').toString('latin1');
            if (str.includes('OFFICIAL COMPLIANCE REPOSITORY') || str.includes('Capacity Building & Teller Agreement')) {
              delete d.fileDataUrl;
            }
          } catch (e) {}
        }
      });
    }
    fs.writeFileSync(DOCS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent employee documents:', e);
  }
}

const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');

function readPersistentSnapshots() {
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent snapshots:', e);
  }
  return null;
}

function writePersistentSnapshots(payload) {
  try {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent snapshots:', e);
  }
}

const SESSIONS_FILE = path.join(DATA_DIR, 'user_sessions.json');

function readPersistentSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent user sessions:', e);
  }
  return {};
}

function writePersistentSessions(payload) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent user sessions:', e);
  }
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function readReportsIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading reports index:', e);
  }
  return [];
}

function writeReportsIndex(indexData) {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing reports index:', e);
  }
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // API ROUTING: /api/reports
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 0. API ROUTING: /api/transactions (Persistent CRUD)
    if (pathname === '/api/transactions' && req.method === 'GET') {
      const data = readPersistentTransactions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { transactions: null, deletedTransactionIds: [] }));
      return;
    }

    if (pathname === '/api/transactions' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(raw);
          writePersistentTransactions(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: payload.transactions ? payload.transactions.length : 0 }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/transactions' && req.method === 'DELETE') {
      const txnId = parsedUrl.searchParams.get('id');
      if (!txnId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing transaction id' }));
        return;
      }
      try {
        let data = readPersistentTransactions() || { transactions: [], deletedTransactionIds: [] };
        data.transactions = (data.transactions || []).filter(t => t.id !== txnId);
        if (!data.deletedTransactionIds) data.deletedTransactionIds = [];
        if (!data.deletedTransactionIds.includes(txnId)) {
          data.deletedTransactionIds.push(txnId);
        }
        writePersistentTransactions(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedId: txnId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 0b. API ROUTING: /api/outlet-rentals (Persistent CRUD for Outlet Rentals & Load Allowance)
    if (pathname === '/api/outlet-rentals' && req.method === 'GET') {
      const data = readPersistentOutletRentals();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { outletRentals: null, deletedOutletRentalIds: [] }));
      return;
    }

    if (pathname === '/api/outlet-rentals' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(raw);
          writePersistentOutletRentals(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: payload.outletRentals ? payload.outletRentals.length : 0 }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/outlet-rentals' && req.method === 'DELETE') {
      const recordId = parsedUrl.searchParams.get('id');
      if (!recordId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing outlet rental record id' }));
        return;
      }
      try {
        let data = readPersistentOutletRentals() || { outletRentals: [], deletedOutletRentalIds: [] };
        const altId = recordId.startsWith('ORL-') ? recordId.replace(/^ORL-/, '') : ('ORL-' + recordId);
        data.outletRentals = (data.outletRentals || []).filter(r => r.id !== recordId && r.id !== altId && r.sourceTxnId !== recordId && r.sourceTxnId !== altId);
        if (!data.deletedOutletRentalIds) data.deletedOutletRentalIds = [];
        if (!data.deletedOutletRentalIds.includes(recordId)) {
          data.deletedOutletRentalIds.push(recordId);
        }
        if (!data.deletedOutletRentalIds.includes(altId)) {
          data.deletedOutletRentalIds.push(altId);
        }
        writePersistentOutletRentals(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedId: recordId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 0c. API ROUTING: /api/thermal-paper (Persistent CRUD for Thermal Paper Daily Summary)
    if (pathname === '/api/thermal-paper' && req.method === 'GET') {
      const data = readPersistentThermalPaper();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { initialStock: 0, dailyStocksOnHand: {}, stockAdjustments: [], allocations: [] }));
      return;
    }

    if (pathname === '/api/thermal-paper' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(raw);
          writePersistentThermalPaper(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: payload.allocations ? payload.allocations.length : 0 }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/thermal-paper' && req.method === 'DELETE') {
      const recordId = parsedUrl.searchParams.get('id');
      if (!recordId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing thermal paper record id' }));
        return;
      }
      try {
        let data = readPersistentThermalPaper() || { initialStock: 0, dailyStocksOnHand: {}, stockAdjustments: [], allocations: [] };
        data.allocations = (data.allocations || []).filter(r => r.id !== recordId);
        writePersistentThermalPaper(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedId: recordId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 0c2. API ROUTING: /api/employee-documents (Persistent Cross-Device CRUD for Employee Compliance Documents)
    if (pathname === '/api/employee-documents' && req.method === 'GET') {
      const data = readPersistentEmployeeDocuments();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { documents: [], deletedDocIds: [] }));
      return;
    }

    if (pathname === '/api/employee-documents' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(raw);
          writePersistentEmployeeDocuments(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: payload.documents ? payload.documents.length : 0 }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/employee-documents' && req.method === 'DELETE') {
      const docId = parsedUrl.searchParams.get('id');
      if (!docId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing document id' }));
        return;
      }
      try {
        let data = readPersistentEmployeeDocuments() || { documents: [], deletedDocIds: [] };
        if (Array.isArray(data)) {
          data = { documents: data, deletedDocIds: [] };
        }
        data.documents = (data.documents || []).filter(d => d.id !== docId);
        if (!data.deletedDocIds) data.deletedDocIds = [];
        if (!data.deletedDocIds.includes(docId)) {
          data.deletedDocIds.push(docId);
        }
        writePersistentEmployeeDocuments(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedId: docId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 0c3. API ROUTING: /api/snapshots (Persistent Cross-Device Snapshots & Auto-Repair Checkpoints)
    if (pathname === '/api/snapshots' && req.method === 'GET') {
      const data = readPersistentSnapshots();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { snapshots: [], deletedSnapshotIds: [] }));
      return;
    }

    if (pathname === '/api/snapshots' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(raw);
          writePersistentSnapshots(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: payload.snapshots ? payload.snapshots.length : 0 }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/snapshots' && req.method === 'DELETE') {
      const snapId = parsedUrl.searchParams.get('id');
      if (!snapId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing snapshot id' }));
        return;
      }
      try {
        let data = readPersistentSnapshots() || { snapshots: [], deletedSnapshotIds: [] };
        if (Array.isArray(data)) {
          data = { snapshots: data, deletedSnapshotIds: [] };
        }
        data.snapshots = (data.snapshots || []).filter(s => s.id !== snapId);
        if (!data.deletedSnapshotIds) data.deletedSnapshotIds = [];
        if (!data.deletedSnapshotIds.includes(snapId)) {
          data.deletedSnapshotIds.push(snapId);
        }
        writePersistentSnapshots(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedId: snapId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 0c4. API ROUTING: /api/user-sessions (Single-Device Session Security & Active Token Tracking)
    if (pathname === '/api/user-sessions' && req.method === 'GET') {
      const username = (parsedUrl.searchParams.get('username') || '').toLowerCase();
      const sessions = readPersistentSessions();
      if (!username) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sessions));
      } else {
        const sess = sessions[username] || null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sess || {}));
      }
      return;
    }

    if (pathname === '/api/user-sessions' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(raw);
          const username = (payload.username || '').toLowerCase();
          if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Username required' }));
            return;
          }
          const sessions = readPersistentSessions();
          sessions[username] = {
            username,
            active_session_token: payload.active_session_token || null,
            active_device_name: payload.active_device_name || null,
            last_active_at: payload.last_active_at || new Date().toISOString()
          };
          writePersistentSessions(sessions);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, session: sessions[username] }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 0d. API ROUTING: /api/reset-operational-data (True Operational Reset)
    if (pathname === '/api/reset-operational-data' && req.method === 'POST') {
      try {
        writePersistentTransactions({ transactions: [], deletedTransactionIds: [] });
        writePersistentOutletRentals({ outletRentals: [], deletedOutletRentalIds: [] });
        writePersistentThermalPaper({ initialStock: 0, dailyStocksOnHand: {}, stockAdjustments: [], allocations: [] });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Operational and transactional data truly reset to zero.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 1. GET /api/reports - list stored reports
    if (pathname === '/api/reports' && req.method === 'GET') {
      const index = readReportsIndex();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(index));
      return;
    }

    // 2. GET /api/reports/check?dateKey=...&type=...
    if (pathname === '/api/reports/check' && req.method === 'GET') {
      const dateKey = parsedUrl.searchParams.get('dateKey');
      const type = (parsedUrl.searchParams.get('type') || 'ddn').toLowerCase();
      
      let exists = false;
      if (dateKey) {
        const dateDir = path.join(REPORTS_DIR, dateKey);
        const metaPath = path.join(dateDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const filename = type === 'samal' ? meta.samalFileName : meta.ddnFileName;
            if (filename && fs.existsSync(path.join(dateDir, filename))) {
              exists = true;
            }
          } catch (e) {}
        }
        // Fallback check in templates directory
        if (!exists) {
          const tplFiles = fs.readdirSync(path.join(__dirname, 'templates')).filter(f => f.endsWith('.xlsx'));
          const target = tplFiles.find(f => {
            const upper = f.toUpperCase();
            return type === 'samal' ? upper.includes('SAMAL') : upper.includes('DDN');
          });
          if (target) exists = true;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exists }));
      return;
    }

    // 3. GET /api/reports/download?dateKey=...&type=...
    if (pathname === '/api/reports/download' && req.method === 'GET') {
      const dateKey = parsedUrl.searchParams.get('dateKey');
      const type = (parsedUrl.searchParams.get('type') || 'ddn').toLowerCase();

      if (!dateKey) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing dateKey parameter.');
        return;
      }

      const dateDir = path.join(REPORTS_DIR, dateKey);
      let targetFile = null;
      let downloadFilename = null;

      // Look in generated_reports/<dateKey>/
      if (fs.existsSync(dateDir)) {
        const metaPath = path.join(dateDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            downloadFilename = type === 'samal' ? meta.samalFileName : meta.ddnFileName;
            const fullPath = path.join(dateDir, downloadFilename);
            if (fs.existsSync(fullPath)) {
              targetFile = fullPath;
            }
          } catch (e) {}
        }

        // If meta lookup didn't find file, search files in directory
        if (!targetFile) {
          const files = fs.readdirSync(dateDir);
          const match = files.find(f => {
            const upper = f.toUpperCase();
            return (type === 'samal' ? upper.includes('SAMAL') : upper.includes('DDN')) && upper.endsWith('.XLSX');
          });
          if (match) {
            targetFile = path.join(dateDir, match);
            downloadFilename = match;
          }
        }
      }

      // Fallback: check templates directory for pre-existing templates (e.g. September 3)
      if (!targetFile) {
        const tplDir = path.join(__dirname, 'templates');
        if (fs.existsSync(tplDir)) {
          const tplFiles = fs.readdirSync(tplDir);
          const match = tplFiles.find(f => {
            const upper = f.toUpperCase();
            return (type === 'samal' ? upper.includes('SAMAL') : upper.includes('DDN')) && upper.endsWith('.XLSX') && upper.includes('COMPLETED');
          });
          if (match) {
            targetFile = path.join(tplDir, match);
            downloadFilename = match;
          }
        }
      }

      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Report file not found for ${dateKey} (${type.toUpperCase()}).`);
        return;
      }

      // Ensure proper human-readable filename format: [PREFIX] - [DATE] - COMPLETED.xlsx
      if (!downloadFilename) {
        downloadFilename = path.basename(targetFile);
      }

      try {
        const stat = fs.statSync(targetFile);
        const fileContent = fs.readFileSync(targetFile);

        // Strict Content-Disposition header with exact quoted filename
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(fileContent);
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error reading report file: ' + err.message);
        return;
      }
    }

    // 3b. GET /api/templates/download?type=ddn|samal - Download permanent ERP master template
    if (pathname === '/api/templates/download' && req.method === 'GET') {
      const type = (parsedUrl.searchParams.get('type') || 'ddn').toLowerCase();
      const tplDir = path.join(__dirname, 'templates');
      let targetFile = null;
      let downloadFilename = null;

      if (type === 'samal') {
        downloadFilename = 'SAMAL - MASTER TEMPLATE.xlsx';
        const candidate1 = path.join(tplDir, 'SAMAL - MASTER TEMPLATE.xlsx');
        const candidate2 = path.join(tplDir, 'samal_master.xlsx');
        if (fs.existsSync(candidate1)) targetFile = candidate1;
        else if (fs.existsSync(candidate2)) targetFile = candidate2;
      } else {
        downloadFilename = 'DDN - MASTER TEMPLATE.xlsx';
        const candidate1 = path.join(tplDir, 'DDN - MASTER TEMPLATE.xlsx');
        const candidate2 = path.join(tplDir, 'ddn_master.xlsx');
        if (fs.existsSync(candidate1)) targetFile = candidate1;
        else if (fs.existsSync(candidate2)) targetFile = candidate2;
      }

      if (!targetFile || !fs.existsSync(targetFile)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Master template file not found for ${type.toUpperCase()}.`);
        return;
      }

      try {
        const stat = fs.statSync(targetFile);
        const fileContent = fs.readFileSync(targetFile);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(fileContent);
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error reading master template: ' + err.message);
        return;
      }
    }

    // 4. POST /api/reports - Save generated report files & metadata
    if (pathname === '/api/reports' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const data = JSON.parse(raw);
          const { dateKey, dateFormatted, sourceFile, recordsCount, ddnFileName, samalFileName, ddnBase64, samalBase64, metrics, timestamp } = data;

          if (!dateKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing dateKey' }));
            return;
          }

          const dateDir = path.join(REPORTS_DIR, dateKey);
          if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir, { recursive: true });
          }

          // Write DDN Excel file
          if (ddnBase64 && ddnFileName) {
            const ddnPath = path.join(dateDir, ddnFileName);
            fs.writeFileSync(ddnPath, Buffer.from(ddnBase64, 'base64'));
          }

          // Write SAMAL Excel file
          if (samalBase64 && samalFileName) {
            const samalPath = path.join(dateDir, samalFileName);
            fs.writeFileSync(samalPath, Buffer.from(samalBase64, 'base64'));
          }

          // Write metadata
          const meta = {
            dateKey,
            dateFormatted: dateFormatted || dateKey,
            sourceFile: sourceFile || 'Uploaded file',
            recordsCount: recordsCount || 0,
            ddnFileName,
            samalFileName,
            metrics: metrics || null,
            timestamp: timestamp || new Date().toISOString()
          };
          fs.writeFileSync(path.join(dateDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

          // Update index
          let index = readReportsIndex();
          index = index.filter(item => item.dateKey !== dateKey);
          index.push(meta);
          index.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
          writeReportsIndex(index);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, dateKey }));
        } catch (err) {
          console.error('Failed to save report:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 5. DELETE /api/reports?dateKey=... - Delete report record and associated generated files
    if (pathname === '/api/reports' && req.method === 'DELETE') {
      const dateKey = parsedUrl.searchParams.get('dateKey');
      if (!dateKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing dateKey parameter.' }));
        return;
      }

      try {
        const dateDir = path.join(REPORTS_DIR, dateKey);
        if (fs.existsSync(dateDir)) {
          fs.rmSync(dateDir, { recursive: true, force: true });
        }

        // Remove from index
        let index = readReportsIndex();
        index = index.filter(item => item.dateKey !== dateKey);
        writeReportsIndex(index);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Report deleted successfully.' }));
      } catch (err) {
        console.error('Failed to delete report:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  // -------------------------------------------------------------
  // STATIC ASSETS & SPA ROUTING
  // -------------------------------------------------------------
  const urlPath = pathname;
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  let ext = path.extname(filePath).toLowerCase();

  // If request has no extension (e.g. /sales-collection, /master-registry, /dashboard),
  // it is an SPA route! Serve index.html directly with 200 OK.
  if (!ext) {
    filePath = path.join(__dirname, 'index.html');
    ext = '.html';
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routes
        if (!urlPath.startsWith('/css/') && !urlPath.startsWith('/js/') && !urlPath.startsWith('/assets/')) {
          fs.readFile(path.join(__dirname, 'index.html'), (indexErr, indexContent) => {
            if (indexErr) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Server Error: ' + indexErr.code);
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(indexContent, 'utf-8');
            }
          });
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}...`);
});
