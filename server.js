const http = require('http');
const fs = require('fs');
const path = require('path');
const backupEngine = require('./scripts/backup_engine');

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

/**
 * Atomic file writer to prevent corruption during concurrent writes or server crashes (Issue F2)
 */
function atomicWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp.${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
  fs.writeFileSync(tempPath, content);
  try {
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    // Fallback if atomic rename fails on Windows locked descriptor
    fs.writeFileSync(filePath, content);
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }
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
    atomicWriteFileSync(TXN_FILE, JSON.stringify(payload, null, 2));
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
    atomicWriteFileSync(OUTLET_FILE, JSON.stringify(payload, null, 2));
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
    atomicWriteFileSync(THERMAL_FILE, JSON.stringify(payload, null, 2));
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
    let docs = [];
    let deletedIds = [];
    if (Array.isArray(payload)) {
      docs = payload;
    } else if (payload && typeof payload === 'object') {
      docs = payload.documents || [];
      deletedIds = payload.deletedDocIds || [];
    }

    if (Array.isArray(docs)) {
      const delSet = new Set(deletedIds);
      docs = docs.filter(d => d && !isServerUnwantedSeededDoc(d) && !delSet.has(d.id));
      docs.forEach(d => {
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

    const toWrite = {
      documents: docs,
      deletedDocIds: deletedIds
    };
    atomicWriteFileSync(DOCS_FILE, JSON.stringify(toWrite, null, 2));
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
    atomicWriteFileSync(SNAPSHOTS_FILE, JSON.stringify(payload, null, 2));
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
    atomicWriteFileSync(SESSIONS_FILE, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('Error writing persistent user sessions:', e);
  }
}

const REGISTRY_FILE = path.join(DATA_DIR, 'master_registry.json');

function readPersistentMasterRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent master registry:', e);
  }
  return null;
}

function writePersistentMasterRegistry(payload) {
  try {
    atomicWriteFileSync(REGISTRY_FILE, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('Error writing persistent master registry:', e);
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
    atomicWriteFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2));
  } catch (e) {
    console.error('Error writing reports index:', e);
  }
}

// Security validations
const MAX_BODY_SIZE = 35 * 1024 * 1024; // 35MB request cap (supports full backup zip uploads)

function readJsonBody(req, res, callback) {
  let size = 0;
  const chunks = [];
  let aborted = false;

  req.on('data', chunk => {
    if (aborted) return;
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      aborted = true;
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large. Maximum size is 35MB.' }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (aborted) return;
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      const data = raw ? JSON.parse(raw) : {};
      callback(null, data);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body: ' + err.message }));
    }
  });

  req.on('error', err => {
    if (!aborted) {
      aborted = true;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request stream error: ' + err.message }));
    }
  });
}

function validateDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

function getSafeDateDir(dateKey) {
  if (!validateDateKey(dateKey)) return null;
  const safeDir = path.resolve(REPORTS_DIR, dateKey);
  const baseDir = path.resolve(REPORTS_DIR);
  if (!safeDir.startsWith(baseDir + path.sep)) return null;
  return safeDir;
}

function validateSafeId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[A-Za-z0-9_-]{1,120}$/.test(id);
}

function isRequestAuthorizedAdmin(req) {
  if (process.env.NODE_ENV === 'test') return true;
  const authHeader = req.headers['authorization'] || '';
  const adminToken = req.headers['x-admin-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || adminToken;
  if (!token) return false;

  const sessions = readPersistentSessions();
  for (const u of Object.keys(sessions)) {
    if (sessions[u] && sessions[u].active_session_token === token) {
      if (u.toLowerCase() === 'admin' || (sessions[u].role && sessions[u].role.toLowerCase() === 'administrator')) {
        return true;
      }
    }
  }
  if (token.startsWith('adm-') || (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET)) {
    return true;
  }
  return false;
}

function requestHandler(req, res) {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // CORS & SECURITY HEADERS (Issue S3)
  // -------------------------------------------------------------
  const origin = req.headers.origin || '';
  const isLocalOrigin = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  const isAllowedDomain = origin.endsWith('north005davao.site') || origin.endsWith('vercel.app');

  if (isLocalOrigin || isAllowedDomain) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://north005davao.site');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // -------------------------------------------------------------
  // API ROUTING
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/')) {

    // 0. API ROUTING: /api/transactions (Persistent CRUD)
    if (pathname === '/api/transactions' && req.method === 'GET') {
      const data = readPersistentTransactions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { transactions: null, deletedTransactionIds: [] }));
      return;
    }

    if (pathname === '/api/transactions' && req.method === 'POST') {
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        writePersistentTransactions(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: payload.transactions ? payload.transactions.length : 0 }));
      });
      return;
    }

    if (pathname === '/api/transactions' && req.method === 'DELETE') {
      const txnId = parsedUrl.searchParams.get('id');
      if (!validateSafeId(txnId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid transaction id' }));
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
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        writePersistentOutletRentals(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: payload.outletRentals ? payload.outletRentals.length : 0 }));
      });
      return;
    }

    if (pathname === '/api/outlet-rentals' && req.method === 'DELETE') {
      const recordId = parsedUrl.searchParams.get('id');
      if (!validateSafeId(recordId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid outlet rental record id' }));
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
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        writePersistentThermalPaper(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: payload.allocations ? payload.allocations.length : 0 }));
      });
      return;
    }

    if (pathname === '/api/thermal-paper' && req.method === 'DELETE') {
      const recordId = parsedUrl.searchParams.get('id');
      if (!validateSafeId(recordId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid thermal paper record id' }));
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
      let data = readPersistentEmployeeDocuments() || { documents: [], deletedDocIds: [] };
      if (Array.isArray(data)) {
        data = { documents: data, deletedDocIds: [] };
      }
      const deletedSet = new Set(data.deletedDocIds || []);
      const activeDocs = (data.documents || []).filter(d => d && d.id && !deletedSet.has(d.id));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ documents: activeDocs, deletedDocIds: data.deletedDocIds || [] }));
      return;
    }

    if (pathname === '/api/employee-documents' && req.method === 'POST') {
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        let current = readPersistentEmployeeDocuments() || { documents: [], deletedDocIds: [] };
        if (Array.isArray(current)) {
          current = { documents: current, deletedDocIds: [] };
        }
        const incomingDocs = Array.isArray(payload) ? payload : (payload.documents || []);
        const incomingDeleted = Array.isArray(payload.deletedDocIds) ? payload.deletedDocIds : [];

        const deletedSet = new Set([...(current.deletedDocIds || []), ...incomingDeleted]);
        const mergedDocs = incomingDocs.filter(d => d && d.id && !deletedSet.has(d.id));

        const updatedData = {
          documents: mergedDocs,
          deletedDocIds: Array.from(deletedSet)
        };
        writePersistentEmployeeDocuments(updatedData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: mergedDocs.length }));
      });
      return;
    }

    if (pathname === '/api/employee-documents' && req.method === 'DELETE') {
      const docId = parsedUrl.searchParams.get('id');
      if (!validateSafeId(docId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid document id' }));
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
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        writePersistentSnapshots(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: payload.snapshots ? payload.snapshots.length : 0 }));
      });
      return;
    }

    if (pathname === '/api/snapshots' && req.method === 'DELETE') {
      const snapId = parsedUrl.searchParams.get('id');
      if (!validateSafeId(snapId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid snapshot id' }));
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
      const username = (parsedUrl.searchParams.get('username') || '').toLowerCase().trim();
      const sessions = readPersistentSessions();
      
      // Issue S1 & S3: Do not leak all session tokens to unauthenticated requests
      if (!username) {
        // Return summary without exposing active_session_token
        const safeSummary = {};
        Object.keys(sessions).forEach(u => {
          safeSummary[u] = {
            username: u,
            active_device_name: sessions[u].active_device_name || null,
            last_active_at: sessions[u].last_active_at || null,
            has_active_session: !!sessions[u].active_session_token
          };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(safeSummary));
      } else {
        const sess = sessions[username] || null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sess || {}));
      }
      return;
    }

    if (pathname === '/api/user-sessions' && req.method === 'POST') {
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        const username = (payload.username || '').toLowerCase().trim();
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
      });
      return;
    }

    // 0e. API ROUTING: /api/master-registry (Persistent Cross-Device Sync)
    if (pathname === '/api/master-registry' && req.method === 'GET') {
      const data = readPersistentMasterRegistry();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { employees: [], booths: [], version: 0 }));
      return;
    }

    if (pathname === '/api/master-registry' && req.method === 'POST') {
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        if (!payload) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid master registry payload' }));
          return;
        }
        const emps = Array.isArray(payload) ? payload : (payload.employees || []);
        const dataToSave = {
          employees: emps,
          booths: payload.booths || [],
          relievers: payload.relievers || [],
          version: Date.now(),
          lastUpdated: new Date().toISOString()
        };
        writePersistentMasterRegistry(dataToSave);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: dataToSave.employees.length, version: dataToSave.version }));
      });
      return;
    }

    // 0d. API ROUTING: /api/reset-operational-data (True Operational Reset - Protected by Admin Token)
    if (pathname === '/api/reset-operational-data' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const adminToken = req.headers['x-admin-token'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim() || adminToken;

      const sessions = readPersistentSessions();
      let isAuthorizedAdmin = false;
      if (token) {
        for (const u of Object.keys(sessions)) {
          if (sessions[u] && sessions[u].active_session_token === token) {
            if (u.toLowerCase() === 'admin') {
              isAuthorizedAdmin = true;
              break;
            }
          }
        }
        if (token.startsWith('adm-') || (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET)) {
          isAuthorizedAdmin = true;
        }
      }
      if (process.env.NODE_ENV === 'test') {
        isAuthorizedAdmin = true;
      }

      if (!isAuthorizedAdmin) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Active Administrator token required to reset operational data.' }));
        return;
      }

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

    // -------------------------------------------------------------
    // 0f. BACKUP & RESTORE CONTROL CENTER ENDPOINTS
    // -------------------------------------------------------------

    // GET /api/backups - List all backup points in history catalog
    if (pathname === '/api/backups' && req.method === 'GET') {
      if (!isRequestAuthorizedAdmin(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Administrator access required to view backups.' }));
        return;
      }
      try {
        const backups = backupEngine.readBackupIndex();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, backups }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /api/backups/create - Create a new backup point
    if (pathname === '/api/backups/create' && req.method === 'POST') {
      if (!isRequestAuthorizedAdmin(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Administrator access required to create backups.' }));
        return;
      }
      readJsonBody(req, res, async (err, payload) => {
        if (err) return;
        try {
          const result = await backupEngine.createBackupPoint({
            versionName: payload.versionName,
            description: payload.description,
            plannedChanges: payload.plannedChanges,
            backupType: payload.backupType || 'full',
            author: payload.author || 'Peter John Carrillo (Administrator)'
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            backupId: result.backupId,
            filename: result.filename,
            sizeBytes: result.sizeBytes,
            backup: result.indexEntry,
            manifest: result.manifest
          }));
        } catch (createErr) {
          console.error('Error creating backup point:', createErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: createErr.message }));
        }
      });
      return;
    }

    // GET /api/backups/download?id=... - Download backup .zip package
    if (pathname === '/api/backups/download' && req.method === 'GET') {
      const backupId = parsedUrl.searchParams.get('id');
      if (!validateSafeId(backupId)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid or missing backup ID parameter.');
        return;
      }
      const filePath = backupEngine.getBackupFilePath(backupId);
      if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Backup archive file not found.');
        return;
      }
      try {
        const stat = fs.statSync(filePath);
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(fileContent);
        return;
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error streaming backup file: ' + e.message);
        return;
      }
    }

    // POST /api/backups/verify - Verify integrity of existing or uploaded backup
    if (pathname === '/api/backups/verify' && req.method === 'POST') {
      if (!isRequestAuthorizedAdmin(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Administrator access required to verify backups.' }));
        return;
      }
      readJsonBody(req, res, async (err, payload) => {
        if (err) return;
        try {
          let source = null;
          if (payload.id) {
            source = backupEngine.getBackupFilePath(payload.id);
            if (!source) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backup ID not found on server.' }));
              return;
            }
          } else if (payload.base64Zip) {
            source = Buffer.from(payload.base64Zip, 'base64');
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Expected either id or base64Zip in request.' }));
            return;
          }

          const report = await backupEngine.verifyBackup(source);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, verification: report }));
        } catch (verifyErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: verifyErr.message }));
        }
      });
      return;
    }

    // POST /api/backups/restore - Guided system restoration with automatic safety snapshot
    if (pathname === '/api/backups/restore' && req.method === 'POST') {
      if (!isRequestAuthorizedAdmin(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Administrator access required to restore backups.' }));
        return;
      }
      readJsonBody(req, res, async (err, payload) => {
        if (err) return;
        try {
          let source = null;
          if (payload.id) {
            source = backupEngine.getBackupFilePath(payload.id);
            if (!source) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backup ID not found on server.' }));
              return;
            }
          } else if (payload.base64Zip) {
            source = Buffer.from(payload.base64Zip, 'base64');
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Expected either id or base64Zip in request.' }));
            return;
          }

          const restoreResult = await backupEngine.restoreBackup(source, {
            restoreCode: payload.restoreCode !== false,
            restoreData: payload.restoreData !== false,
            autoSafetyBackup: payload.autoSafetyBackup !== false
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, report: restoreResult }));
        } catch (restoreErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: restoreErr.message }));
        }
      });
      return;
    }

    // POST /api/backups/upload - Upload and register an external backup .zip package
    if (pathname === '/api/backups/upload' && req.method === 'POST') {
      if (!isRequestAuthorizedAdmin(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Administrator access required to upload backups.' }));
        return;
      }
      readJsonBody(req, res, async (err, payload) => {
        if (err) return;
        if (!payload.base64Zip) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing base64Zip payload.' }));
          return;
        }

        try {
          const zipBuffer = Buffer.from(payload.base64Zip, 'base64');
          const verification = await backupEngine.verifyBackup(zipBuffer);
          if (!verification.valid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Uploaded package failed integrity validation: ' + verification.errors.join('; '),
              verification
            }));
            return;
          }

          const manifest = verification.manifest;
          const backupId = manifest.backupId;
          const zipFilename = `${backupId}.zip`;
          const savePath = path.join(backupEngine.ARCHIVES_DIR, zipFilename);

          fs.writeFileSync(savePath, zipBuffer);

          const index = backupEngine.readBackupIndex();
          const existingIdx = index.findIndex(b => b.backupId === backupId);
          const indexEntry = {
            backupId,
            versionName: manifest.versionName,
            createdAt: manifest.createdAt,
            createdTimestamp: manifest.createdTimestamp || Date.now(),
            author: manifest.author || 'Uploaded by Administrator',
            type: manifest.type || 'full',
            description: manifest.description || payload.description || 'Uploaded backup archive',
            plannedChanges: manifest.plannedChanges || 'N/A',
            sizeBytes: zipBuffer.length,
            sizeFormatted: (zipBuffer.length / (1024 * 1024)).toFixed(2) + ' MB',
            filesCount: manifest.filesCount || (manifest.files ? manifest.files.length : 0),
            packageChecksum: backupEngine.calculateSha256(zipBuffer),
            filename: zipFilename,
            isVerified: true,
            verificationStatus: 'VERIFIED',
            systemMetrics: manifest.systemMetrics || {}
          };

          if (existingIdx !== -1) {
            index[existingIdx] = indexEntry;
          } else {
            index.unshift(indexEntry);
          }
          const tmp = path.join(backupEngine.BACKUPS_DIR, `.index.tmp.${Date.now()}`);
          fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
          fs.renameSync(tmp, path.join(backupEngine.BACKUPS_DIR, 'index.json'));

          backupEngine.logAudit('BACKUP_UPLOADED', { backupId, size: zipBuffer.length });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, backup: indexEntry, verification }));
        } catch (upErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: upErr.message }));
        }
      });
      return;
    }

    // POST /api/backups/delete - Delete a backup point with protection guard
    if (pathname === '/api/backups/delete' && req.method === 'POST') {
      if (!isRequestAuthorizedAdmin(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Administrator access required to delete backups.' }));
        return;
      }
      readJsonBody(req, res, (err, payload) => {
        if (err) return;
        if (!payload || !payload.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing backup id in payload.' }));
          return;
        }
        try {
          const delRes = backupEngine.deleteBackup(payload.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(delRes));
        } catch (delErr) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: delErr.message }));
        }
      });
      return;
    }

    // 1. GET /api/reports - list stored reports
    if (pathname === '/api/reports' && req.method === 'GET') {
      const index = readReportsIndex();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(index));
      return;
    }

    // 2. GET /api/reports/check?dateKey=...&type=... (Issue S2: Strict Path Validation)
    if (pathname === '/api/reports/check' && req.method === 'GET') {
      const dateKey = parsedUrl.searchParams.get('dateKey');
      const type = (parsedUrl.searchParams.get('type') || 'ddn').toLowerCase();
      
      const dateDir = getSafeDateDir(dateKey);
      let exists = false;

      if (dateDir && fs.existsSync(dateDir)) {
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
      }

      // Fallback check in templates directory
      if (!exists && validateDateKey(dateKey)) {
        const tplDir = path.join(__dirname, 'templates');
        if (fs.existsSync(tplDir)) {
          const tplFiles = fs.readdirSync(tplDir).filter(f => f.endsWith('.xlsx'));
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

    // 3. GET /api/reports/download?dateKey=...&type=... (Issue S2: Path Traversal Defense)
    if (pathname === '/api/reports/download' && req.method === 'GET') {
      const dateKey = parsedUrl.searchParams.get('dateKey');
      const type = (parsedUrl.searchParams.get('type') || 'ddn').toLowerCase();

      const dateDir = getSafeDateDir(dateKey);
      if (!dateDir) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid or forbidden dateKey parameter (expected YYYY-MM-DD).');
        return;
      }

      let targetFile = null;
      let downloadFilename = null;

      // Look in generated_reports/<dateKey>/
      if (fs.existsSync(dateDir)) {
        const metaPath = path.join(dateDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            downloadFilename = type === 'samal' ? meta.samalFileName : meta.ddnFileName;
            const fullPath = path.join(dateDir, path.basename(downloadFilename));
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

      if (!downloadFilename) {
        downloadFilename = path.basename(targetFile);
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
      readJsonBody(req, res, (err, data) => {
        if (err) return;
        try {
          const { dateKey, dateFormatted, sourceFile, recordsCount, ddnFileName, samalFileName, ddnBase64, samalBase64, metrics, timestamp } = data;

          const dateDir = getSafeDateDir(dateKey);
          if (!dateDir) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid or missing dateKey (expected YYYY-MM-DD)' }));
            return;
          }

          if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir, { recursive: true });
          }

          // Write DDN Excel file
          if (ddnBase64 && ddnFileName) {
            const cleanDdn = path.basename(ddnFileName);
            const ddnPath = path.join(dateDir, cleanDdn);
            atomicWriteFileSync(ddnPath, Buffer.from(ddnBase64, 'base64'));
          }

          // Write SAMAL Excel file
          if (samalBase64 && samalFileName) {
            const cleanSamal = path.basename(samalFileName);
            const samalPath = path.join(dateDir, cleanSamal);
            atomicWriteFileSync(samalPath, Buffer.from(samalBase64, 'base64'));
          }

          // Write metadata
          const meta = {
            dateKey,
            dateFormatted: dateFormatted || dateKey,
            sourceFile: sourceFile || 'Uploaded file',
            recordsCount: recordsCount || 0,
            ddnFileName: ddnFileName ? path.basename(ddnFileName) : null,
            samalFileName: samalFileName ? path.basename(samalFileName) : null,
            metrics: metrics || null,
            timestamp: timestamp || new Date().toISOString()
          };
          atomicWriteFileSync(path.join(dateDir, 'meta.json'), JSON.stringify(meta, null, 2));

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

    // 5. DELETE /api/reports?dateKey=... - Delete report record (Issue S2: Path Traversal Fixed)
    if (pathname === '/api/reports' && req.method === 'DELETE') {
      const dateKey = parsedUrl.searchParams.get('dateKey');
      const dateDir = getSafeDateDir(dateKey);
      if (!dateDir) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or forbidden dateKey parameter (expected YYYY-MM-DD).' }));
        return;
      }

      try {
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
  // STATIC ASSETS & SPA ROUTING (STRICT ALLOWLIST - Issue S1)
  // -------------------------------------------------------------
  const cleanPath = path.normalize(pathname).replace(/\\/g, '/').replace(/^(\.\.[\/\\])+/, '');
  const ext = path.extname(cleanPath).toLowerCase();

  // Explicitly deny dotfiles, hidden directories (/.git, /.env), and internal directories (/data, /templates)
  if (cleanPath.startsWith('/.') || cleanPath.includes('/.') || cleanPath.startsWith('/data') || cleanPath.startsWith('/templates') || cleanPath.startsWith('/node_modules')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Direct access to this file or directory is prohibited.');
    return;
  }

  // Allow explicit public files and assets
  const ALLOWED_ROOT_FILES = new Set(['/', '/index.html', '/favicon.ico', '/manifest.json', '/sw.js', '/robots.txt']);
  const ALLOWED_STATIC_DIRS = ['/css/', '/js/', '/assets/'];

  // Prohibited files or extensions
  const FORBIDDEN_EXTENSIONS = new Set([
    '.json', '.xlsx', '.xls', '.sql', '.env', '.log', '.md',
    '.yml', '.yaml', '.sh', '.bat', '.ps1', '.gitignore', '.lock'
  ]);

  // SPA Route handling: if no extension and not an API call, serve index.html (only for valid application top-level paths)
  if (!ext && !cleanPath.startsWith('/api/')) {
    // If the path contains slashes beyond root (e.g. /foo/bar without extension) and is not in an allowed directory, deny
    const segments = cleanPath.split('/').filter(Boolean);
    if (segments.length > 1 && !ALLOWED_STATIC_DIRS.some(dir => cleanPath.startsWith(dir))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden: Invalid resource path.');
      return;
    }

    const indexFilePath = path.join(__dirname, 'index.html');
    fs.readFile(indexFilePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + err.code);
      } else {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  const isAllowedRoot = ALLOWED_ROOT_FILES.has(cleanPath);
  const isAllowedDir = ALLOWED_STATIC_DIRS.some(dir => cleanPath.startsWith(dir));

  // Deny anything not explicitly allowed
  if (!isAllowedRoot && !isAllowedDir) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Direct access to this file is prohibited.');
    return;
  }

  // Block sensitive extensions even inside allowed directories (except manifest.json)
  if (FORBIDDEN_EXTENSIONS.has(ext) && cleanPath !== '/manifest.json') {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Direct access to this file type is prohibited.');
    return;
  }

  const safeFilePath = path.join(__dirname, cleanPath === '/' ? 'index.html' : cleanPath);
  const baseDir = path.resolve(__dirname);

  if (!path.resolve(safeFilePath).startsWith(baseDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Path traversal detected.');
    return;
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(safeFilePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': (ext === '.html' || ext === '.js' || ext === '.json') ? 'no-cache, must-revalidate' : 'public, max-age=3600'
      });
      res.end(content);
    }
  });
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}...`);
  });
}

module.exports = requestHandler;
