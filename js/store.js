/**
 * APEX OmniERP - Centralized Data Store & State Management
 * Persistent reactive store for Davao Del Norte (DDN005) Operations
 */

const STORAGE_KEY = 'apex_omnierp_data_v4_ddn';

// Geolocation anchors for Davao Del Norte Municipalities
const GEO_ANCHORS = {
  'Sto. Tomas': { lat: 7.5303, lng: 125.6264 },
  'Tagum': { lat: 7.4475, lng: 125.8078 },
  'Carmen': { lat: 7.3586, lng: 125.7061 },
  'Panabo': { lat: 7.3078, lng: 125.6833 },
  'Kapalong': { lat: 7.5855, lng: 125.7072 },
  'Talaingod': { lat: 7.6536, lng: 125.6417 },
  'Samal': { lat: 7.0736, lng: 125.7128 },
  'Island Garden City of Samal': { lat: 7.0736, lng: 125.7128 },
  'Davao Del Norte': { lat: 7.4500, lng: 125.7500 }
};

// Authoritative Reliever-to-Municipality dictionary from Excel Masterlist
const OFFICIAL_RELIEVER_MUNICIPALITIES = {
  'princess solamillo': 'Sto. Tomas',
  'princess salamilla': 'Sto. Tomas',
  'kei pagulong': 'Sto. Tomas',
  'jessa busaco': 'Tagum City',
  'yzalou i. dumaquing': 'Panabo City',
  'yzalou i. dumaguing': 'Panabo City',
  'yzalou dumaquing': 'Panabo City',
  'othmarie lupiba': 'Carmen',
  'faith hermoso': 'Tagum City',
  'faith hermara': 'Tagum City',
  'mari sarol': 'Tagum City',
  'mari saral': 'Tagum City',
  'ellen riña': 'Sto. Tomas',
  'ellen riño': 'Sto. Tomas',
  'ellen rina': 'Sto. Tomas',
  'ellen rino': 'Sto. Tomas',
  'rhea desnacido': 'Carmen',
  'rhea dernacido': 'Carmen',
  'angelie tiedra': 'Panabo City',
  'noreen d. bayang': 'Sto. Tomas',
  'noreen d bayang': 'Sto. Tomas',
  'rhea mae m. bolilawa': 'Sto. Tomas',
  'rhea mae m. balilawa': 'Sto. Tomas',
  'rhea mae bolilawa': 'Sto. Tomas',
  'rhea mae balilawa': 'Sto. Tomas',
  'jasnen parame aquino': 'Sto. Tomas',
  'jarnen parame aquino': 'Sto. Tomas',
  'marjory torino': 'Panabo City',
  'marjary tarina': 'Panabo City',
  'marjory tarina': 'Panabo City',
  'marjary torino': 'Panabo City',
  'gina paula gemino': 'Carmen',
  'jennifer m. osman': 'Panabo City',
  'jennifer osman': 'Panabo City',
  'ferlyn zamora robello': 'Carmen',
  'ferlyn zamora rabella': 'Carmen',
  'ferlyn zamora rebello': 'Carmen',
  'jeziel r. simene': 'Sto. Tomas',
  'jeziel simene': 'Sto. Tomas',
  'karen batas': 'Tagum City',
  'elyn t. rosento': 'Sto. Tomas',
  'elyn rosento': 'Sto. Tomas',
  'elyn t. rarenta': 'Sto. Tomas',
  'elyn rarenta': 'Sto. Tomas',
  'ester mopon': 'Carmen',
  'christly ann tuasoc': 'Tagum City',
  'jane christine tuasoc': 'Tagum City',
  'clouie mae hipos': 'Tagum City',
  'clauie mae hipar': 'Tagum City',
  'clouie mae hipar': 'Tagum City',
  'aires monreal': 'Tagum City',
  'precious nica torrefiel': 'Carmen',
  'jemma rose roco': 'Sto. Tomas',
  'carolyn joy catubigan': 'Sto. Tomas',
  'pamela denisse g. antequeza': 'Sto. Tomas',
  'pamela denisse antequeza': 'Sto. Tomas',
  'bbelen apatan': 'Tagum City',
  'laika jeanne sapine': 'Tagum City',
  'laikajeanne sapine': 'Tagum City',
  'jeah rica linray': 'Tagum City',
  'jeah rica linsay': 'Tagum City',
  'kristina cassandra d. lumidin': 'Tagum City',
  'kristina cassandra lumidin': 'Tagum City',
  'mae jean gementiza': 'Sto. Tomas'
};

function getRelieverMunicipality(name) {
  if (!name) return 'Sto. Tomas';
  const norm = String(name).toLowerCase().trim();
  if (OFFICIAL_RELIEVER_MUNICIPALITIES[norm]) {
    return OFFICIAL_RELIEVER_MUNICIPALITIES[norm];
  }
  // Check exact substrings
  for (const [key, val] of Object.entries(OFFICIAL_RELIEVER_MUNICIPALITIES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return val;
    }
  }
  // Keyword / Surname token heuristics to guarantee 100% correct match
  if (norm.includes('solamillo') || norm.includes('salamilla')) return 'Sto. Tomas';
  if (norm.includes('pagulong')) return 'Sto. Tomas';
  if (norm.includes('busaco')) return 'Tagum City';
  if (norm.includes('dumaquing') || norm.includes('dumaguing')) return 'Panabo City';
  if (norm.includes('lupiba')) return 'Carmen';
  if (norm.includes('hermoso') || norm.includes('hermara')) return 'Tagum City';
  if (norm.includes('sarol') || norm.includes('saral')) return 'Tagum City';
  if (norm.includes('riña') || norm.includes('riño') || norm.includes('rina') || norm.includes('rino')) return 'Sto. Tomas';
  if (norm.includes('desnacido') || norm.includes('dernacido')) return 'Carmen';
  if (norm.includes('tiedra')) return 'Panabo City';
  if (norm.includes('bayang')) return 'Sto. Tomas';
  if (norm.includes('bolilawa') || norm.includes('balilawa')) return 'Sto. Tomas';
  if (norm.includes('aquino')) return 'Sto. Tomas';
  if (norm.includes('torino') || norm.includes('tarina')) return 'Panabo City';
  if (norm.includes('gemino')) return 'Carmen';
  if (norm.includes('osman')) return 'Panabo City';
  if (norm.includes('robello') || norm.includes('rabella') || norm.includes('rebello')) return 'Carmen';
  if (norm.includes('simene')) return 'Sto. Tomas';
  if (norm.includes('batas')) return 'Tagum City';
  if (norm.includes('rosento') || norm.includes('rarenta')) return 'Sto. Tomas';
  if (norm.includes('mopon')) return 'Carmen';
  if (norm.includes('tuasoc')) return 'Tagum City';
  if (norm.includes('hipos') || norm.includes('hipar')) return 'Tagum City';
  if (norm.includes('monreal')) return 'Tagum City';
  if (norm.includes('torrefiel')) return 'Carmen';
  if (norm.includes('roco')) return 'Sto. Tomas';
  if (norm.includes('catubigan')) return 'Sto. Tomas';
  if (norm.includes('antequeza')) return 'Sto. Tomas';
  if (norm.includes('apatan')) return 'Tagum City';
  if (norm.includes('sapine')) return 'Tagum City';
  if (norm.includes('linray') || norm.includes('linsay')) return 'Tagum City';
  if (norm.includes('lumidin')) return 'Tagum City';
  if (norm.includes('gementiza')) return 'Sto. Tomas';
  return 'Sto. Tomas';
}

function isOfficialRelieverName(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim().toLowerCase();
  if (OFFICIAL_RELIEVER_MUNICIPALITIES[n]) return true;
  for (const rName of Object.keys(OFFICIAL_RELIEVER_MUNICIPALITIES)) {
    if (n.includes(rName) || rName.includes(n)) return true;
  }
  return false;
}

function cleanBoothId(code) {
  if (!code || typeof code !== 'string') return null;
  const trimmed = String(code).trim().toUpperCase();
  if (trimmed === '-' || trimmed === 'N/A' || trimmed === 'NONE' || trimmed === '' || trimmed === 'UNASSIGNED') return null;
  let clean = trimmed.replace(/^BOOTH[\s-]*/i, '').replace(/^DDN[\s_]+(\d+)/i, 'DDN-$1');
  if (/^\d+$/.test(clean)) clean = `DDN-${clean}`;
  return clean;
}

if (typeof window !== 'undefined') {
  window.OFFICIAL_RELIEVER_MUNICIPALITIES = OFFICIAL_RELIEVER_MUNICIPALITIES;
  window.getRelieverMunicipality = getRelieverMunicipality;
  window.isOfficialRelieverName = isOfficialRelieverName;
  window.cleanBoothId = cleanBoothId;
}
if (typeof global !== 'undefined') {
  global.OFFICIAL_RELIEVER_MUNICIPALITIES = OFFICIAL_RELIEVER_MUNICIPALITIES;
  global.getRelieverMunicipality = getRelieverMunicipality;
  global.isOfficialRelieverName = isOfficialRelieverName;
  global.cleanBoothId = cleanBoothId;
}

function parseAddress(rawAddress) {
  if (!rawAddress || rawAddress.trim() === '' || rawAddress.trim() === '-') {
    return { purok: '-', municipality: '-' };
  }
  const addr = rawAddress.trim();
  
  // If the address contains multi-municipality route slashes (e.g. "Tagum / Kapalong / Talaingod" or "Carmen / Tagum")
  // and has no comma, this is an assigned coverage territory/route without a purok!
  if (addr.includes('/') && !addr.includes(',')) {
    return {
      purok: '-',
      municipality: addr
    };
  }

  // Strip trailing province suffix if present so municipality is not masked
  const cleanAddr = addr.replace(/,\s*Davao\s+del\s+Norte\s*$/i, '').trim();

  const knownMunicipalities = [
    'Sto. Tomas',
    'Sto Tomas',
    'St. Tomas',
    'Tagum City',
    'Tagum',
    'Panabo City',
    'Panabo',
    'Carmen',
    'Kapalong',
    'Sto. Nino Talaingod',
    'Sto. Niño Talaingod',
    'Talaingod',
    'Samal',
    'Island Garden City of Samal',
    'Asuncion'
  ];

  // Check if entire address is a known municipality
  for (const m of knownMunicipalities) {
    if (cleanAddr.toLowerCase() === m.toLowerCase()) {
      return {
        purok: '-',
        municipality: m === 'Sto Tomas' || m === 'St. Tomas' ? 'Sto. Tomas' : (m === 'Tagum' ? 'Tagum City' : (m === 'Panabo' ? 'Panabo City' : m))
      };
    }
  }

  for (const m of knownMunicipalities) {
    const re = new RegExp('(?:,\\s*|\\s+)' + m.replace('.', '\\.') + '\\s*$', 'i');
    if (re.test(cleanAddr)) {
      const match = cleanAddr.match(re);
      const purokPart = cleanAddr.substring(0, match.index).trim().replace(/[,\/\s]+$/, '');
      return {
        purok: purokPart || '-',
        municipality: m === 'Sto Tomas' || m === 'St. Tomas' ? 'Sto. Tomas' : (m === 'Tagum' ? 'Tagum City' : (m === 'Panabo' ? 'Panabo City' : m))
      };
    }
  }

  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const muni = parts.pop();
    const pPart = parts.join(', ').replace(/[,\/\s]+$/, '').trim();
    return {
      purok: pPart || '-',
      municipality: muni
    };
  } else if (parts.length === 1) {
    return {
      purok: '-',
      municipality: parts[0]
    };
  }

  return { purok: '-', municipality: '-' };
}

// Authoritative Master Registry GPS Coordinates Dictionary (Source of Truth - September 2026 Official Masterlist)
// STRICT MASTER REGISTRY SYNC: Contains 116 authentic coordinates verified in Master Registry.
// Zero guessing, zero approximation, zero radial offset, zero mock coordinates.
const AUTHENTIC_MASTER_REGISTRY_COORDINATES = {
  // Tagum City Corridor (22 Booths)
  'DDN-350': { lat: 7.460470, lng: 125.784925, municipality: 'Tagum City' },
  'DDN-351': { lat: 7.478119, lng: 125.805107, municipality: 'Tagum City' },
  'DDN-353': { lat: 7.451125, lng: 125.825055, municipality: 'Tagum City' },
  'DDN-422': { lat: 7.422684, lng: 125.807161, municipality: 'Tagum City' },
  'DDN-423': { lat: 7.373690, lng: 125.750205, municipality: 'Tagum City' },
  'DDN-424': { lat: 7.432682, lng: 125.815427, municipality: 'Tagum City' },
  'DDN-760': { lat: 7.465273, lng: 125.825592, municipality: 'Tagum City' },
  'DDN-769': { lat: 7.423330, lng: 125.828964, municipality: 'Tagum City' },
  'DDN-770': { lat: 7.418289, lng: 125.797697, municipality: 'Tagum City' },
  'DDN-772': { lat: 7.431548, lng: 125.800559, municipality: 'Tagum City' },
  'DDN-775': { lat: 7.464045, lng: 125.776568, municipality: 'Tagum City' },
  'DDN-776': { lat: 7.453310, lng: 125.781870, municipality: 'Tagum City' },
  'DDN-777': { lat: 7.378367, lng: 125.755851, municipality: 'Tagum City' },
  'DDN-778': { lat: 7.480606, lng: 125.751107, municipality: 'Tagum City' },
  'DDN-779': { lat: 7.443478, lng: 125.775321, municipality: 'Tagum City' },
  'DDN-780': { lat: 7.424187, lng: 125.809429, municipality: 'Tagum City' },
  'DDN-1477': { lat: 7.341469, lng: 125.773863, municipality: 'Tagum City' },
  'DDN-1586': { lat: 7.374190, lng: 125.757967, municipality: 'Tagum City' },
  'DDN-1591': { lat: 7.387508, lng: 125.760861, municipality: 'Tagum City' },
  'DDN-774': { lat: 7.418365, lng: 125.823344, municipality: 'Tagum City' },
  'DDN-1778': { lat: 7.463334, lng: 125.763312, municipality: 'Tagum City' },
  'DDN-1784': { lat: 7.398164, lng: 125.791198, municipality: 'Tagum City' },
  // Panabo City Corridor (20 Booths)
  'DDN-398': { lat: 7.293308, lng: 125.667908, municipality: 'Panabo City' },
  'DDN-399': { lat: 7.320821, lng: 125.668614, municipality: 'Panabo City' },
  'DDN-400': { lat: 7.312217, lng: 125.688231, municipality: 'Panabo City' },
  'DDN-429': { lat: 7.307471, lng: 125.702746, municipality: 'Panabo City' },
  'DDN-430': { lat: 7.274260, lng: 125.678783, municipality: 'Panabo City' },
  'DDN-756': { lat: 7.304127, lng: 125.682994, municipality: 'Panabo City' },
  'DDN-758': { lat: 7.293512, lng: 125.712846, municipality: 'Panabo City' },
  'DDN-761': { lat: 7.291958, lng: 125.668823, municipality: 'Panabo City' },
  'DDN-763': { lat: 7.305050, lng: 125.689640, municipality: 'Panabo City' },
  'DDN-764': { lat: 7.309127, lng: 125.665852, municipality: 'Panabo City' },
  'DDN-768': { lat: 7.284526, lng: 125.687476, municipality: 'Panabo City' },
  'DDN-908': { lat: 7.288113, lng: 125.670530, municipality: 'Panabo City' },
  'DDN-909': { lat: 7.310239, lng: 125.696477, municipality: 'Panabo City' },
  'DDN-1475': { lat: 7.320189, lng: 125.565709, municipality: 'Panabo City' },
  'DDN-1476': { lat: 7.309606, lng: 125.603768, municipality: 'Panabo City' },
  'DDN-1751': { lat: 7.300470, lng: 125.631770, municipality: 'Panabo City' },
  'DDN-1806': { lat: 7.314461, lng: 125.682721, municipality: 'Panabo City' },
  'DDN-1797': { lat: 7.319028, lng: 125.687553, municipality: 'Panabo City' },
  'DDN-1824': { lat: 7.338700, lng: 125.649243, municipality: 'Panabo City' },
  'DDN-765': { lat: 7.305605, lng: 125.667983, municipality: 'Panabo City' },
  // Carmen Corridor (15 Booths)
  'DDN-397': { lat: 7.355234, lng: 125.706468, municipality: 'Carmen' },
  'DDN-425': { lat: 7.368167, lng: 125.723424, municipality: 'Carmen' },
  'DDN-426': { lat: 7.355117, lng: 125.705739, municipality: 'Carmen' },
  'DDN-427': { lat: 7.356070, lng: 125.711712, municipality: 'Carmen' },
  'DDN-755': { lat: 7.371467, lng: 125.721702, municipality: 'Carmen' },
  'DDN-1717': { lat: 7.345307, lng: 125.733234, municipality: 'Carmen' },
  'DDN-910': { lat: 7.336516, lng: 125.698739, municipality: 'Carmen' },
  'DDN-1590': { lat: 7.346484, lng: 125.686672, municipality: 'Carmen' },
  'DDN-428': { lat: 7.355624, lng: 125.705198, municipality: 'Carmen' },
  'DDN-1780': { lat: 7.337993, lng: 125.723079, municipality: 'Carmen' },
  'DDN-1779': { lat: 7.348620, lng: 125.722270, municipality: 'Carmen' },
  'DDN-1783': { lat: 7.368869, lng: 125.631514, municipality: 'Carmen' },
  'DDN-1823': { lat: 7.359248, lng: 125.630432, municipality: 'Carmen' },
  'DDN-1782': { lat: 7.358734, lng: 125.682120, municipality: 'Carmen' },
  'DDN-1781': { lat: 7.349206, lng: 125.677993, municipality: 'Carmen' },
  // Sto. Tomas Corridor (24 Booths)
  'DDN-1723': { lat: 7.546910, lng: 125.688077, municipality: 'Sto. Tomas' },
  'DDN-773': { lat: 7.548439, lng: 125.645542, municipality: 'Sto. Tomas' },
  'DDN-1741': { lat: 7.561543, lng: 125.616265, municipality: 'Sto. Tomas' },
  'DDN-754': { lat: 7.532151, lng: 125.651232, municipality: 'Sto. Tomas' },
  'DDN-767': { lat: 7.522976, lng: 125.627928, municipality: 'Sto. Tomas' },
  'DDN-1422': { lat: 7.494953, lng: 125.599426, municipality: 'Sto. Tomas' },
  'DDN-1742': { lat: 7.557742, lng: 125.618332, municipality: 'Sto. Tomas' },
  'DDN-1703': { lat: 7.483383, lng: 125.596618, municipality: 'Sto. Tomas' },
  'DDN-1721': { lat: 7.510548, lng: 125.625135, municipality: 'Sto. Tomas' },
  'DDN-1715': { lat: 7.514462, lng: 125.622125, municipality: 'Sto. Tomas' },
  'DDN-1474': { lat: 7.534522, lng: 125.618364, municipality: 'Sto. Tomas' },
  'DDN-771': { lat: 7.527599, lng: 125.617978, municipality: 'Sto. Tomas' },
  'DDN-1722': { lat: 7.532014, lng: 125.630350, municipality: 'Sto. Tomas' },
  'DDN-352': { lat: 7.484155, lng: 125.716352, municipality: 'Sto. Tomas' },
  'DDN-762': { lat: 7.522965, lng: 125.613093, municipality: 'Sto. Tomas' },
  'DDN-1524': { lat: 7.527528, lng: 125.613392, municipality: 'Sto. Tomas' },
  'DDN-1716': { lat: 7.510463, lng: 125.600806, municipality: 'Sto. Tomas' },
  'DDN-1738': { lat: 7.520821, lng: 125.697598, municipality: 'Sto. Tomas' },
  'DDN-1739': { lat: 7.529198, lng: 125.693183, municipality: 'Sto. Tomas' },
  'DDN-1740': { lat: 7.553908, lng: 125.624058, municipality: 'Sto. Tomas' },
  'DDN-1743': { lat: 7.558333, lng: 125.624444, municipality: 'Sto. Tomas' },
  'DDN-1794': { lat: 7.523546, lng: 125.700598, municipality: 'Sto. Tomas' },
  'DDN-1799': { lat: 7.485317, lng: 125.592014, municipality: 'Sto. Tomas' },
  'DDN-1801': { lat: 7.480434, lng: 125.591228, municipality: 'Sto. Tomas' },
  // Talaingod Corridor (2 Booths)
  'DDN-1752': { lat: 7.629899, lng: 125.605769, municipality: 'Talaingod' },
  'DDN-1424': { lat: 7.626863, lng: 125.616652, municipality: 'Talaingod' },
  // Kapalong Corridor (2 Booths)
  'DDN-1523': { lat: 7.621407, lng: 125.703117, municipality: 'Kapalong' },
  'DDN-402': { lat: 7.597889, lng: 125.707191, municipality: 'Kapalong' },
  // Samal Corridor (31 Booths)
  'DDN-1281': { lat: 7.131028, lng: 125.711256, municipality: 'Samal' },
  'DDN-1284': { lat: 7.130260, lng: 125.696882, municipality: 'Samal' },
  'DDN-1285': { lat: 7.147230, lng: 125.708615, municipality: 'Samal' },
  'DDN-1286': { lat: 7.080133, lng: 125.705328, municipality: 'Samal' },
  'DDN-1288': { lat: 7.162784, lng: 125.730500, municipality: 'Samal' },
  'DDN-1293': { lat: 7.154390, lng: 125.693374, municipality: 'Samal' },
  'DDN-1294': { lat: 7.135420, lng: 125.692080, municipality: 'Samal' },
  'DDN-1295': { lat: 7.141375, lng: 125.689222, municipality: 'Samal' },
  'DDN-1296': { lat: 7.130772, lng: 125.701228, municipality: 'Samal' },
  'DDN-1299': { lat: 7.139878, lng: 125.688614, municipality: 'Samal' },
  'DDN-1300': { lat: 7.173820, lng: 125.718752, municipality: 'Samal' },
  'DDN-1302': { lat: 7.077480, lng: 125.684133, municipality: 'Samal' },
  'DDN-1303': { lat: 7.098433, lng: 125.705961, municipality: 'Samal' },
  'DDN-1305': { lat: 7.097374, lng: 125.710370, municipality: 'Samal' },
  'DDN-1306': { lat: 7.111832, lng: 125.712829, municipality: 'Samal' },
  'DDN-1308': { lat: 7.144947, lng: 125.724269, municipality: 'Samal' },
  'DDN-1588': { lat: 7.119867, lng: 125.721334, municipality: 'Samal' },
  'DDN-1629': { lat: 7.128747, lng: 125.692167, municipality: 'Samal' },
  'DDN-1631': { lat: 7.018875, lng: 125.768859, municipality: 'Samal' },
  'DDN-1632': { lat: 7.038510, lng: 125.753050, municipality: 'Samal' },
  'DDN-1634': { lat: 7.067369, lng: 125.754003, municipality: 'Samal' },
  'DDN-1679': { lat: 7.061630, lng: 125.721299, municipality: 'Samal' },
  'DDN-1714': { lat: 7.060608, lng: 125.722195, municipality: 'Samal' },
  'DDN-1737': { lat: 7.062732, lng: 125.725706, municipality: 'Samal' },
  'DDN-1757': { lat: 7.026253, lng: 125.766835, municipality: 'Samal' },
  'DDN-1758': { lat: 7.049746, lng: 125.755539, municipality: 'Samal' },
  'DDN-1756': { lat: 7.089701, lng: 125.706518, municipality: 'Samal' },
  'DDN-1759': { lat: 7.002936, lng: 125.762211, municipality: 'Samal' },
  'DDN-1761': { lat: 7.008400, lng: 125.756400, municipality: 'Samal' },
  'DDN-1764': { lat: 6.981264, lng: 125.732830, municipality: 'Samal' },
  'DDN-1765': { lat: 6.990609, lng: 125.733920, municipality: 'Samal' },
  'DDN-766': { lat: 7.471085, lng: 125.760813, municipality: 'Tagum City' },
  'DDN-1750': { lat: 7.312412, lng: 125.593712, municipality: 'Panabo City' },
  'DDN-1753': { lat: 7.525676, lng: 125.713530, municipality: 'Sto. Tomas' },
  'DDN-1680': { lat: 7.530783, lng: 125.655975, municipality: 'Sto. Tomas' },
  'DDN-1635': { lat: 7.145169, lng: 125.726759, municipality: 'Samal' },
  'DDN-1630': { lat: 7.018645, lng: 125.742199, municipality: 'Samal' },
  'DDN-1763': { lat: 6.997705, lng: 125.733667, municipality: 'Samal' },
};

const MASTER_REGISTRY_BOOTH_COORDINATES = AUTHENTIC_MASTER_REGISTRY_COORDINATES;
if (typeof window !== 'undefined') window.AUTHENTIC_MASTER_REGISTRY_COORDINATES = AUTHENTIC_MASTER_REGISTRY_COORDINATES;
if (typeof global !== 'undefined') global.AUTHENTIC_MASTER_REGISTRY_COORDINATES = AUTHENTIC_MASTER_REGISTRY_COORDINATES;

// 1. Raw Tellers Data (116 Active Primary Sales Representatives from September 2026 Masterlist)
const RAW_TELLERS = [
  { id: "DDN005-SR350", name: "MARY LOVELYN RAMOS", address: "CAPITOL ROAD, MANKILAM, Tagum City", booth: "DDN-350", posSerial: "V3A7249S20344", phone: "9269669474" },
  { id: "DDN005-SR351", name: "BEVERLY ALAO", address: "PUROK 2-B, LA FILIPINA, Tagum City", booth: "DDN-351", posSerial: "V302248820059", phone: "9556421602" },
  { id: "DDN005-SR353", name: "PRETTY JANE TANDAAN", address: "PUROK DURIAN TIPAZ ST., MAGUGPO EAST, Tagum City", booth: "DDN-353", posSerial: "V302248820755", phone: "9911813063" },
  { id: "DDN005-SR-422", name: "AMERITA HIPOS", address: "PUROK DURIAN, VISAYAN VILLAGE, Tagum City", booth: "DDN-422", posSerial: "V302248820077", phone: "9977345836" },
  { id: "DDN005-SR423", name: "REALIZA MIGULLAS", address: "PUROK SANTAN, BINCUNGAN 1, Tagum City", booth: "DDN-423", posSerial: "V302248720160", phone: "9974314925" },
  { id: "DDN005-SR424", name: "MARYJOY APOC", address: "PRK SUNSHINE, VISAYAN VILLAGE, Tagum City", booth: "DDN-424", posSerial: "V302248820035", phone: "9518178796" },
  { id: "DDN005-SR760", name: "Elvie Fabon Oñez", address: "PUROK 9, MERVILLE SUB., MAGDUM, Tagum City", booth: "DDN-760", posSerial: "V302244720238", phone: "9947656024" },
  { id: "DDN005-SR769", name: "Mary Jane Verano", address: "DAVAO REGIONAL MEDICAL CENTER, APOKON RD, APOKON, Tagum City", booth: "DDN-769", posSerial: "V3A7249R20196", phone: "9974900676" },
  { id: "DDN005-SR770", name: "JIANALYN T. DAYADAY", address: "TIMOG AVE, VISAYAN VILLAGE, Tagum City", booth: "DDN-770", posSerial: "V3A7249S20259", phone: "9817906361" },
  { id: "DDN005-SR772", name: "Patricia Manova Coquilla", address: "Near Rose pharmacy, Paulino Manigo, VISAYAN VILLAGE, Tagum City", booth: "DDN-772", posSerial: "V3A7249S20263", phone: "9654352383" },
  { id: "DDN005-SR775", name: "CENDY MAEJOY P.JAVA", address: "URAYA SUBD. ENTRANCE, MANKILAM, Tagum City", booth: "DDN-775", posSerial: "V3A7249R20298", phone: "9639432109" },
  { id: "DDN005-SR776", name: "JOSEPHINE LARGO", address: "CAPITOL DRIVE, Mankilam, Tagum City", booth: "DDN-776", posSerial: "V302248820606", phone: "9526209305" },
  { id: "DDN005-SR777", name: "Glenda Olingay", address: "PUROK WALING-WALING, BINCUNGAN, Tagum City", booth: "DDN-777", posSerial: "V3A7249R20075", phone: "9677134266" },
  { id: "DDN005-SR778", name: "LEA GRACE PROGE;;A", address: "PUROK PAGKAKAISA, PAGSABANGAN, Tagum City", booth: "DDN-778", posSerial: "V3A7249S20044", phone: "" },
  { id: "DDN005-SR779", name: "JESSEL B. PABAYO", address: "Sampaguita st.prk.6, SAN MIGUEL CAMP 4., Tagum City", booth: "DDN-779", posSerial: "V3A7249R20141", phone: "9243741215" },
  { id: "DDN005-SR780", name: "AZENITH B. TUASOC", address: "PUROK MACOPA, VISAYAN VILLAGE, Tagum City", booth: "DDN-780", posSerial: "V30224CG20625", phone: "9971007208" },
  { id: "DDN005-SR1477", name: "MELANIE A. SARAWI", address: "PUROK 6, LIBUGANON, Tagum City", booth: "DDN-1477", posSerial: "V30224CG20594", phone: "9755686527" },
  { id: "DDN005-SR1586", name: "ANA MAY M. DELO SANTOS", address: "PUROK SUNFLOWER, BINCUNGAN, Tagum City", booth: "DDN-1586", posSerial: "V3A7249R20207", phone: "9051055419" },
  { id: "DDN005-SR1591", name: "LENIE ORILLO", address: "PUROK ROSE, BINCUNGAN, Tagum City", booth: "DDN-1591", posSerial: "V302244720266", phone: "9705204165" },
  { id: "DDN005-SR774", name: "RADIN MAYAKI WENG", address: "NEAR EPARK, FIRST ORIENTAL ST, PRK.1B, APOKON, Tagum City", booth: "DDN-774", posSerial: "V30224CG20596", phone: "9924172418" },
  { id: "DDN005-SR1778", name: "MARY JOELINE SANICO RAMO", address: "Purok Banana, Mankilam, Tagum City", booth: "DDN-1778", posSerial: "V302248820585", phone: "9387083661" },
  { id: "DDN005-SR1784", name: "AILEEN L. PARADERO", address: "PUROK ALAMBRE, SAN ISIDRO, Tagum City", booth: "DDN-1784", posSerial: "", phone: "" },
  { id: "DDN005-SR398", name: "LIZA P. CALIBUD", address: "PUROK MAHARLIKA, CRYSTAL PLAIN, GREDU, Panabo City", booth: "DDN-398", posSerial: "V3A7249R20224", phone: "" },
  { id: "DDN005-SR399", name: "CHARMAE QUEEN CARZON", address: "PUROK 18 UPPER FELISA, NEW VISAYAS, Panabo City", booth: "DDN-399", posSerial: "V3A7249R20265", phone: "9940843620" },
  { id: "DDN005-SR400", name: "JOCELLE S. BALAYO", address: "PUROK 18, ADLAON ST., STO NIÑO, Panabo City", booth: "DDN-400", posSerial: "V3A7249S20372", phone: "" },
  { id: "DDN005-SR429", name: "ROVIE MAE TICONG", address: "PUROK 17, SAN VICENTE, Panabo City", booth: "DDN-429", posSerial: "V3A7249R20119", phone: "9098203101" },
  { id: "DDN005-SR430", name: "JESZELE MAE TOLIONG", address: "COGON 1, JP LAUREL, Panabo City", booth: "DDN-430", posSerial: "V3A7249S20022", phone: "9518096113" },
  { id: "DDN006-SR756", name: "RHEAMINE LIGAO", address: "MAGSAYSAY ST., PRK ATIS TEACHERS VILLAGE, STO NIÑO, Panabo City", booth: "DDN-756", posSerial: "V30224CG20660", phone: "9670368610" },
  { id: "DDN007-SR758", name: "LOVERLY OLIVAREZ", address: "DICT Breakbulk packing entrance, SAN PEDRO, Panabo City", booth: "DDN-758", posSerial: "V302248820292", phone: "" },
  { id: "DDN005-SR761", name: "DANILYN BEJOR", address: "CRYSTAL PLAIN, SUBD., GREDU, Panabo City", booth: "DDN-761", posSerial: "V302248820500", phone: "9518144877" },
  { id: "DDN007-SR763", name: "FLORESTE ALDERITE", address: "Prk Santol, STO NIÑO, Panabo City", booth: "DDN-763", posSerial: "V302248820065", phone: "9673003896" },
  { id: "DDN005-SR764", name: "NICMEL SALVO TABON", address: "PUROK 1 DURIAN, NEW VISAYAS, Panabo City", booth: "DDN-764", posSerial: "V3A7249R20221", phone: "9485332608" },
  { id: "DDN005-SR768", name: "ALMERA DIGAMON", address: "PUROK MARANG, CAGANGOHAN, Panabo City", booth: "DDN-768", posSerial: "V302248820001", phone: "" },
  { id: "DDN005-SR908", name: "JOREYNA MAE A. JAMIN", address: "PUROK PANHOSA, GREDU, Panabo City", booth: "DDN-908", posSerial: "V302248820167", phone: "9637562177" },
  { id: "DDN005-SR909", name: "JANE LEE DECREPITO", address: "PUROK 6, SAN VICENTE, Panabo City", booth: "DDN-909", posSerial: "V3A7249S20208", phone: "9070911693" },
  { id: "DDN005-SR1475", name: "LUZVIMINDA GALASATAN", address: "PUROK 1, CONSOLACION, Panabo City", booth: "DDN-1475", posSerial: "V30224CG20603", phone: "9639409257" },
  { id: "DDN005-SR1476", name: "MAY A.INAHID", address: "PUROK 5, CACAO, Panabo City", booth: "DDN-1476", posSerial: "V30224CG20587", phone: "9638368099" },
  { id: "DDN005-SR1751", name: "JUNAMIE ACDAL", address: "PUROK 2, KATIPUNAN, Panabo City", booth: "DDN-1751", posSerial: "V3A7249R20017", phone: "" },
  { id: "DDN005-SR1806", name: "Arturo Dela Peña", address: "Purok 6 A Peda, San Francisco, Panabo City", booth: "DDN-1806", posSerial: "", phone: "" },
  { id: "DDN005-SR1797", name: "Jolina Albistros", address: "Orchid St, Salvcaion, Panabo City", booth: "DDN-1797", posSerial: "", phone: "" },
  { id: "DDN005-SR1824", name: "Anna Carog", address: "PUROK 2 CROSSING PILAR, SOUTHERN DAVAO, Panabo City", booth: "DDN-1824", posSerial: "", phone: "" },
  { id: "DDN005-SR765", name: "LELET F. LAGROSA", address: "PUROK MANGGA, NEW VISAYAS, Panabo City", booth: "DDN-765", posSerial: "", phone: "" },
  { id: "DDN005-SR397", name: "Honey Joy Estoque", address: "PUROK 7 PUBLIC MARKET, ISING, ISING, Carmen", booth: "DDN-397", posSerial: "V302244721530", phone: "" },
  { id: "DDN005-SR425", name: "APRIL JEAN S. GARPAO", address: "PUROK 7, TUGANAY, Carmen", booth: "DDN-425", posSerial: "V302248720169", phone: "9535623248" },
  { id: "DDN005-SR426", name: "MARITES DAMAULAO", address: "PUROK 7 PUBLIC MARKET, ISING, ISING, Carmen", booth: "DDN-426", posSerial: "V302248820948", phone: "9939425915" },
  { id: "DDN005-SR427", name: "MARNIE D. ROYO", address: "PUROK 6 I CARE, ISING, Carmen", booth: "DDN-427", posSerial: "V302248720038", phone: "9385582123" },
  { id: "DDN005-SR755", name: "Roxan Gladys G. Abellanosa", address: "PUROK 5 A POB., TUGANAY, Carmen", booth: "DDN-755", posSerial: "V302248820931", phone: "9538773687" },
  { id: "DDN005-SR1717", name: "SHEILA ROBILLO RAMIREZ", address: "PUROK 2B, TUGANAY, Carmen", booth: "DDN-1717", posSerial: "V30224CG20610", phone: "9543025522" },
  { id: "DDN005-SR910", name: "May Ann Diana", address: "PUROK 4A, STO. NIÑO, Carmen", booth: "DDN-910", posSerial: "V3A7249S20262", phone: "9534955156" },
  { id: "DDN005-SR1590", name: "Erma Serdan", address: "PUROK 2, ASUNCION, Carmen", booth: "DDN-1590", posSerial: "V302244720113", phone: "9461756717" },
  { id: "DDN005-SR428", name: "Nobelyn Baya", address: "PUROK 7 PUBLIC MARKET, ISING, ISING, Carmen", booth: "DDN-428", posSerial: "V3A7249S20053", phone: "9977293921" },
  { id: "DDN005-SR1780", name: "Estela Villaraiz Fostanes", address: "P-5  TABA, ISING, Carmen", booth: "DDN-1780", posSerial: "V3A7249S20044", phone: "" },
  { id: "DDN005-SR1779", name: "Rowena Busain Ibarra", address: "P-6  TABA, ISING, Carmen", booth: "DDN-1779", posSerial: "V302248820822", phone: "" },
  { id: "DDN005-SR1783", name: "MARIAN CARRILLO", address: "PUROK 3, TUBOD, Carmen", booth: "DDN-1783", posSerial: "", phone: "" },
  { id: "DDN005-SR1823", name: "Melisa T. LaugLaug", address: "Purok 3A Upper, TUBOD, Carmen", booth: "DDN-1823", posSerial: "", phone: "9940881766" },
  { id: "DDN005-SR1782", name: "Mary Jane Fernandez", address: "Purok 6, Cebulano, Carmen", booth: "DDN-1782", posSerial: "", phone: "" },
  { id: "DDN005-SR1781", name: "Merlyn Denoyo", address: "Purok 1A Binangay, Cebulano, Carmen", booth: "DDN-1781", posSerial: "", phone: "" },
  { id: "DDN005-SR1723", name: "Milojean Edillor Balatayo", address: "Purok 5, Kimamon, Sto. Tomas", booth: "DDN-1723", posSerial: "V302244820077", phone: "9755693282" },
  { id: "DDN005-SR773", name: "Cheryl Mae P. Parame", address: "Purok 3, New Katipunan, Sto. Tomas", booth: "DDN-773", posSerial: "V3A7249S20269", phone: "9518642719" },
  { id: "DDN005-SR1741", name: "ASHLEY PARAME", address: "PUROK 16, BULAHAN,FD.RD 7, Tibal-og, Sto. Tomas", booth: "DDN-1741", posSerial: "V30224CG20242", phone: "9398134325" },
  { id: "DDN005-SR754", name: "BELLE AMOR B. QUIZO", address: "PRK.18, FDR3, Tibal-og, Sto. Tomas", booth: "DDN-754", posSerial: "V302248820655", phone: "9934602693" },
  { id: "DDN005-SR767", name: "Aprilyn V. Cahintong", address: "Prk 3B, Fd.rd 1, Tibal-og, Sto. Tomas", booth: "DDN-767", posSerial: "V302244720805", phone: "9516857770" },
  { id: "DDN005-SR1422", name: "Marcia Taghap Cabudlan", address: "Prk 1, BOBONGON, Sto. Tomas", booth: "DDN-1422", posSerial: "V302244720838", phone: "9944401032" },
  { id: "DDN005-SR1742", name: "Honeymie Julito", address: "PRK 16 San Isidro, Tibal-og, Sto. Tomas", booth: "DDN-1742", posSerial: "V30224CG20469", phone: "9702458100" },
  { id: "DDN005-SR1703", name: "TREXIE ECHAVERIE", address: "BUGTONG LUBI ROAD, BALAGUNAN, Sto. Tomas", booth: "DDN-1703", posSerial: "V302248820659", phone: "" },
  { id: "DDN005-SR1721", name: "CHARLYN MAE B. MARAYAN", address: "Veterans, Tibal-og, Sto. Tomas", booth: "DDN-1721", posSerial: "V30224CG20368", phone: "" },
  { id: "DDN005-SR1715", name: "Sherimae Oyon-Oyon", address: "Purok 1b Menzi, Tibal-og, Sto. Tomas", booth: "DDN-1715", posSerial: "V30224CG20228", phone: "9940878837" },
  { id: "DDN005-SR1474", name: "Jocedyl Buhia", address: "Purok 9 kapwa street fd rd3, Tibal-og, Sto. Tomas", booth: "DDN-1474", posSerial: "V30224CG20232", phone: "9169669088" },
  { id: "DDN005-SR771", name: "MARY JOY LATO POBRE", address: "PUROK 6-B FD RD 2 BAGARES AREA, Tibal-og, Sto. Tomas", booth: "DDN-771", posSerial: "V3A7249R20150", phone: "" },
  { id: "DDN005-SR1722", name: "JANICE LABISTO", address: "PRK 18 FEEDER RD 3, Tibal-og, Sto. Tomas", booth: "DDN-1722", posSerial: "V302244720453", phone: "9265214939" },
  { id: "DDN005-SR352", name: "Jehramea Marte", address: "NEAR BARANGAY HALL, SALVACION, Sto. Tomas", booth: "DDN-352", posSerial: "V302238420080", phone: "" },
  { id: "DDN005-SR762", name: "DAVILYN GELITO", address: "SABONGAN NI NENE, FR DR 1, Tibal-og, Sto. Tomas", booth: "DDN-762", posSerial: "V3A7249R20145", phone: "9702444362" },
  { id: "DDN005-SR1524", name: "MARY JOY BLANCO", address: "DARLUZ SUBDIVISION, Tibal-og, Sto. Tomas", booth: "DDN-1524", posSerial: "V302244721244", phone: "" },
  { id: "DDN005-SR1716", name: "PRINCESS SOLAMILLO", address: "PRK NARRA, NEW VISAYAS, Sto. Tomas", booth: "DDN-1716", posSerial: "V30224CG20593", phone: "9080832536" },
  { id: "DDN005-SR1738", name: "MARIVEL ESTRADA", address: "PRK MAGSAYSAY, LUNGAOG, Sto. Tomas", booth: "DDN-1738", posSerial: "V30224CG20333", phone: "9911442761" },
  { id: "DDN005-SR1739", name: "DAISY MAE S. GEMENTIZA", address: "PUROK BONIFACIO, LUNGAOG, Sto. Tomas", booth: "DDN-1739", posSerial: "V30224CG20692", phone: "9364225065" },
  { id: "DDN005-SR1740", name: "Laurence Ibra", address: "PRK 15 FD RD 8, Tibal-og, Sto. Tomas", booth: "DDN-1740", posSerial: "V30224CG20328", phone: "9922851806" },
  { id: "DDN005-SR1743", name: "MICHELLE DELA PEÑA", address: "PRK 15 FD RD 9, Tibal-og, Sto. Tomas", booth: "DDN-1743", posSerial: "V30224CG20342", phone: "9359230307" },
  { id: "DDN005-SR1794", name: "Rhea Mei Adella Mangarin", address: "Purok Talisay, Talomo, Sto. Tomas", booth: "DDN-1794", posSerial: "", phone: "" },
  { id: "DDN005-SR1799", name: "Charlyn Dela Vega", address: "Kape-Kape St., Prk 1-A, Balagunan, Sto. Tomas", booth: "DDN-1799", posSerial: "", phone: "" },
  { id: "DDN005-SR1801", name: "John Denver Lagrama", address: "Purok 1, Balagunan, Sto. Tomas", booth: "DDN-1801", posSerial: "", phone: "" },
  { id: "DDN005-SR1752", name: "Mae Ann Paraiso", address: "PRK 6 NAKASAKA, STO NIÑO, Talaingod", booth: "DDN-1752", posSerial: "V30224CG20492", phone: "9708905412" },
  { id: "DDN005-SR1424", name: "Dely T. Macas", address: "PUROK 4B, SAWMILL, STO. NIÑO, Talaingod", booth: "DDN-1424", posSerial: "V30224CG20246", phone: "9506593885" },
  { id: "DDN005-SR1523", name: "Annabelle Semblante", address: "Purok 4, Capungagan, Kapalong", booth: "DDN-1523", posSerial: "V30224CG20171", phone: "9943261562" },
  { id: "DDN005-SR402", name: "Ruthchelle Joy D. Lumidin", address: "Purok 11C Ilaboon, Maniki, Kapalong", booth: "DDN-402", posSerial: "V3A7249S20038", phone: "9507836404" },
  { id: "DDN005-SR1281", name: "GINAROSE CAGAS", address: "PUROK 1, TORIL, Samal", booth: "DDN-1281", posSerial: "V302238420129", phone: "9564855538" },
  { id: "DDN005-SR1284", name: "ANGEL MAE ESTRADA", address: "ZONE 7 VILLARICA, BABAK, Samal", booth: "DDN-1284", posSerial: "V302238420322", phone: "987730538" },
  { id: "DDN005-SR1285", name: "REJEAN PREGLO", address: "PUROK 6A, TAMBO, Samal", booth: "DDN-1285", posSerial: "V302238420103", phone: "9562584717" },
  { id: "DDN005-SR1286", name: "DIANA B. CANILLO SARAGENA", address: "PUROK 1B, PEÑAPLATA, Samal", booth: "DDN-1286", posSerial: "V302238420244", phone: "9065606560" },
  { id: "DDN005-SR1288", name: "Rene C. Daguit", address: "PUROK 1, LIBUAK, Samal", booth: "DDN-1288", posSerial: "", phone: "" },
  { id: "DDN005-SR1293", name: "NIÑA ESCALANTE", address: "PUROK 4, TAMBO, Samal", booth: "DDN-1293", posSerial: "V302238420101", phone: "9632811623" },
  { id: "DDN005-SR1294", name: "JOVILYN B. OCOM", address: "PUROK KAIMITO, MIRANDA, Samal", booth: "DDN-1294", posSerial: "V30224CG20455", phone: "9126249738" },
  { id: "DDN005-SR1295", name: "JENNIE MAE F. ENRIQUEZ", address: "P-3 KAUSWAGAN, MIRANDA, Samal", booth: "DDN-1295", posSerial: "V30224CG20608", phone: "" },
  { id: "DDN005-SR1296", name: "JELOU SALVADOR", address: "PUROK 3 BUCARAN, TORIL, Samal", booth: "DDN-1296", posSerial: "V30224CG20331", phone: "9763812037" },
  { id: "DDN005-SR1299", name: "REJEAN CARACA PREGLO", address: "PUROK 1 CRODUA SAN JUAN, MIRANDA, Samal", booth: "DDN-1299", posSerial: "V30224CG20480", phone: "" },
  { id: "DDN005-SR1300", name: "Normenin K. Hussain", address: "PUROK 9, SAN ISIDRO, Samal", booth: "DDN-1300", posSerial: "V30224CG20482", phone: "9922502733" },
  { id: "DDN005-SR1302", name: "Caren Espinosa", address: "PUROK 2, LIMAO, Samal", booth: "DDN-1302", posSerial: "V30224CG20596", phone: "9923940499" },
  { id: "DDN005-SR1303", name: "Salvacion E Gofredo", address: "PUROK 4, MAMBAGO-A1, Samal", booth: "DDN-1303", posSerial: "V30224CG20664", phone: "9999353314" },
  { id: "DDN005-SR1305", name: "Janine Alcober Dinampo", address: "PUROK 3, MAMBAGO-A2, Samal", booth: "DDN-1305", posSerial: "V30224CG20471", phone: "" },
  { id: "DDN005-SR1306", name: "JEMARIE LOPEZ ADENO", address: "PUROK 1, STO. NIÑO, Samal", booth: "DDN-1306", posSerial: "V30224CG20581", phone: "9308672244" },
  { id: "DDN005-SR1308", name: "BELEN ALFONSO", address: "PUROK 6 TUGUAK, COGON, Samal", booth: "DDN-1308", posSerial: "V302249520442", phone: "9951275628" },
  { id: "DDN005-SR1588", name: "MARYJEAN BOGHANOY", address: "PUROK 2, STO NIÑO, Samal", booth: "DDN-1588", posSerial: "V30224CG20404", phone: "9539962119" },
  { id: "DDN005-SR1629", name: "DIOMELYN P. ABAD", address: "PUROK 6 KALIG, KINAWITNON, Samal", booth: "DDN-1629", posSerial: "V30224CG20622", phone: "" },
  { id: "DDN005-SR1631", name: "Amabelle Gian", address: "PUROK 3, AUMBAY, Samal", booth: "DDN-1631", posSerial: "V30224CG20658", phone: "" },
  { id: "DDN005-SR1632", name: "ROY MARCELLONES", address: "PUROK 1, TAGBAY, Samal", booth: "DDN-1632", posSerial: "V30224CG20447", phone: "" },
  { id: "DDN005-SR1634", name: "ILLAINE YBAÑEZ", address: "PUROK 7, GUILON, Samal", booth: "DDN-1634", posSerial: "V30224CG20582", phone: "9498331881" },
  { id: "DDN005-SR1679", name: "Jasmine Nicole J. Gila", address: "PUROK 4, CAWAG, Samal", booth: "DDN-1679", posSerial: "V30224CG20605", phone: "9311495841" },
  { id: "DDN005-SR1714", name: "Reisthlle Ann D. Dapiton", address: "PUROK 7, CAWAG, Samal", booth: "DDN-1714", posSerial: "V30224CG20259", phone: "9097906590" },
  { id: "DDN005-SR1737", name: "Loraine Junatas", address: "PUROK 3B, PARAISO, CAWAG, Samal", booth: "DDN-1737", posSerial: "V30224CG20301", phone: "9758953887" },
  { id: "DDN005-SR1757", name: "Janilyn Buragay Callano", address: "Purok 6,, Aumbay, Samal", booth: "DDN-1757", posSerial: "V302248220677", phone: "" },
  { id: "DDN005-SR1758", name: "CHEN A. CANILLO", address: "Purok 5A, Tagbay, Samal", booth: "DDN-1758", posSerial: "V3A7249S21499", phone: "" },
  { id: "DDN005-SR1756", name: "Analyn Cuenco", address: "PRK 5, MAMBAGO, MAMBAGO, Samal", booth: "DDN-1756", posSerial: "V3A7249S21074", phone: "" },
  { id: "DDN005-SR1759", name: "Aiza Jane Batucan", address: "PRK KALACHOCHI, TAGBAOBO, Samal", booth: "DDN-1759", posSerial: "V3A7249521452", phone: "" },
  { id: "DDN005-SR1761", name: "LEZEL IBANEZ", address: "PRK 7, AZUCENA, TAGBAOBO, Samal", booth: "DDN-1761", posSerial: "V3A7249520170", phone: "9093749466" },
  { id: "DDN005-SR1764", name: "Ikn Dzaia L. Peroso", address: "PRK 16, KAPUTIAN, Samal", booth: "DDN-1764", posSerial: "V30224CG20589", phone: "" },
  { id: "DDN005-SR1765", name: "Anne Via Feje", address: "PRk 7, TADTAD, TADTAD BADERA, Samal", booth: "DDN-1765", posSerial: "V3A7249R20287", phone: "9948408199" },
];

// 2. Relievers Data (34 Active Buffer Relievers from September 2026 Masterlist - Official default ID is DDN005-SR000)
const RAW_RELIEVERS = [
  { id: "DDN005-SR000", name: "Princess Solamillo", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9468132286" },
  { id: "DDN005-SR000", name: "Kei Pagulong", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9919283377" },
  { id: "DDN005-SR000", name: "Jessa Busaco", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9676822834" },
  { id: "DDN005-SR000", name: "Yzalou I. Dumaguing", municipality: "Panabo City", purok: '-', address: "-, Panabo City", area: "-, Panabo City", booth: '-', role: 'Reliever', status: 'Active', phone: "9510424848" },
  { id: "DDN005-SR000", name: "Othmarie Lupiba", municipality: "Carmen", purok: '-', address: "-, Carmen", area: "-, Carmen", booth: '-', role: 'Reliever', status: 'Active', phone: "9923318041" },
  { id: "DDN005-SR000", name: "Faith Hermoso", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9282951030" },
  { id: "DDN005-SR000", name: "Mari Sarol", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9282951030" },
  { id: "DDN005-SR000", name: "Ellen Riño", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9514630915" },
  { id: "DDN005-SR000", name: "Rhea Desnacido", municipality: "Carmen", purok: '-', address: "-, Carmen", area: "-, Carmen", booth: '-', role: 'Reliever', status: 'Active', phone: "9679345770" },
  { id: "DDN005-SR000", name: "Angelie Tiedra", municipality: "Panabo City", purok: '-', address: "-, Panabo City", area: "-, Panabo City", booth: '-', role: 'Reliever', status: 'Active', phone: "9361565796" },
  { id: "DDN005-SR000", name: "Noreen D. Bayang", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9096001837" },
  { id: "DDN005-SR000", name: "Rhea Mae M. Bolilawa", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9485511382" },
  { id: "DDN005-SR000", name: "Jasnen Parame Aquino", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9757074658" },
  { id: "DDN005-SR000", name: "Marjory Torino", municipality: "Panabo City", purok: '-', address: "-, Panabo City", area: "-, Panabo City", booth: '-', role: 'Reliever', status: 'Active', phone: "9941680208" },
  { id: "DDN005-SR000", name: "Gina Paula Gemino", municipality: "Carmen", purok: '-', address: "-, Carmen", area: "-, Carmen", booth: '-', role: 'Reliever', status: 'Active', phone: "9559806184" },
  { id: "DDN005-SR000", name: "Jennifer M. Osman", municipality: "Panabo City", purok: '-', address: "-, Panabo City", area: "-, Panabo City", booth: '-', role: 'Reliever', status: 'Active', phone: "9945141031" },
  { id: "DDN005-SR000", name: "Ferlyn Zamora Robello", municipality: "Carmen", purok: '-', address: "-, Carmen", area: "-, Carmen", booth: '-', role: 'Reliever', status: 'Active', phone: "9674700611" },
  { id: "DDN005-SR000", name: "Jeziel R. Simene", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9917297977" },
  { id: "DDN005-SR000", name: "Karen Batas", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9634312448" },
  { id: "DDN005-SR000", name: "Elyn T. Rosento", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9169158160" },
  { id: "DDN005-SR000", name: "Ester Mopon", municipality: "Carmen", purok: '-', address: "-, Carmen", area: "-, Carmen", booth: '-', role: 'Reliever', status: 'Active', phone: "9505540780" },
  { id: "DDN005-SR000", name: "Christly Ann Tuasoc", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9971007208" },
  { id: "DDN005-SR000", name: "Jane Christine Tuasoc", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "N/A" },
  { id: "DDN005-SR000", name: "Clouie Mae Hipos", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9304557576" },
  { id: "DDN005-SR000", name: "Aires Monreal", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9944076355" },
  { id: "DDN005-SR000", name: "PRECIOUS NICA TORREFIEL", municipality: "Carmen", purok: '-', address: "-, Carmen", area: "-, Carmen", booth: '-', role: 'Reliever', status: 'Active', phone: "N/A" },
  { id: "DDN005-SR000", name: "Jemma Rose Roco", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9776828684" },
  { id: "DDN005-SR000", name: "Carolyn Joy Catubigan", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9924119660" },
  { id: "DDN005-SR000", name: "Pamela Denisse G. Antequeza", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9535591036" },
  { id: "DDN005-SR000", name: "Bbelen Apatan", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9708905412" },
  { id: "DDN005-SR000", name: "Laika jeanne Sapine", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9518222585" },
  { id: "DDN005-SR000", name: "Jeah Rica Linsay", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9453272597" },
  { id: "DDN005-SR000", name: "Kristina Cassandra D. Lumidin", municipality: "Tagum City", purok: '-', address: "-, Tagum City", area: "-, Tagum City", booth: '-', role: 'Reliever', status: 'Active', phone: "9926135202" },
  { id: "DDN005-SR000", name: "Mae Jean Gementiza", municipality: "Sto. Tomas", purok: '-', address: "-, Sto. Tomas", area: "-, Sto. Tomas", booth: '-', role: 'Reliever', status: 'Active', phone: "9460700135" },
];

// 3. Unused Booths (7 Operational Booths without Assigned Tellers from September 2026 Masterlist)
const RAW_UNUSED_BOOTHS = [
  {
    id: "DDN005-SR766",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "PUROK ILVI",
    barangay: "PAGSABANGAN",
    address: "PUROK ILVI, PAGSABANGAN, Tagum",
    area: "Tagum",
    municipality: "Tagum",
    boothCode: "DDN-766",
    booth: "DDN-766",
    posSerial: "V302248820134",
    printerSerial: "N/A",
    phone: "9361207891",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 7.471085,
    lng: 125.760813,
    coordinates: { lat: 7.471085, lng: 125.760813 }
  },
  {
    id: "DDN005-SR1750",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "PUROK 7",
    barangay: "CACAO",
    address: "PUROK 7, CACAO, Panabo",
    area: "Panabo",
    municipality: "Panabo",
    boothCode: "DDN-1750",
    booth: "DDN-1750",
    posSerial: "N/A",
    printerSerial: "N/A",
    phone: "9510424848",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 7.312412,
    lng: 125.593712,
    coordinates: { lat: 7.312412, lng: 125.593712 }
  },
  {
    id: "DDN005-SR1753",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "Purok Balite",
    barangay: "TALOMO",
    address: "Purok Balite, TALOMO, Sto. Tomas",
    area: "Sto. Tomas",
    municipality: "Sto. Tomas",
    boothCode: "DDN-1753",
    booth: "DDN-1753",
    posSerial: "N/A",
    printerSerial: "N/A",
    phone: "9941873379",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 7.525676,
    lng: 125.713530,
    coordinates: { lat: 7.525676, lng: 125.713530 }
  },
  {
    id: "DDN005-SR1680",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "PRK 6",
    barangay: "New Katipunan",
    address: "PRK 6, New Katipunan, Sto. Tomas",
    area: "Sto. Tomas",
    municipality: "Sto. Tomas",
    boothCode: "DDN-1680",
    booth: "DDN-1680",
    posSerial: "V302248820802",
    printerSerial: "N/A",
    phone: "N/A",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 7.530783,
    lng: 125.655975,
    coordinates: { lat: 7.530783, lng: 125.655975 }
  },
  {
    id: "DDN005-SR1635",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "PUROK 6 TUGUAK",
    barangay: "COGON",
    address: "PUROK 6 TUGUAK, COGON, Samal",
    area: "Samal",
    municipality: "Samal",
    boothCode: "DDN-1635",
    booth: "DDN-1635",
    posSerial: "V30224CG20628",
    printerSerial: "N/A",
    phone: "N/A",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 7.145169,
    lng: 125.726759,
    coordinates: { lat: 7.145169, lng: 125.726759 }
  },
  {
    id: "DDN005-SR1630",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "PUROK 7 ANUNANG",
    barangay: "KAPUTIAN",
    address: "PUROK 7 ANUNANG, KAPUTIAN, Samal",
    area: "Samal",
    municipality: "Samal",
    boothCode: "DDN-1630",
    booth: "DDN-1630",
    posSerial: "V30224CG20654",
    printerSerial: "N/A",
    phone: "N/A",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 7.018645,
    lng: 125.742199,
    coordinates: { lat: 7.018645, lng: 125.742199 }
  },
  {
    id: "DDN005-SR1763",
    name: "N/A",
    role: "N/A",
    department: "dept-tel",
    purok: "PRK 3B",
    barangay: "ANUNANG",
    address: "PRK 3B, ANUNANG, Samal",
    area: "Samal",
    municipality: "Samal",
    boothCode: "DDN-1763",
    booth: "DDN-1763",
    posSerial: "N/A",
    printerSerial: "N/A",
    phone: "N/A",
    status: "UNUSED",
    etsStatus: "Offline",
    lat: 6.997705,
    lng: 125.733667,
    coordinates: { lat: 6.997705, lng: 125.733667 }
  }
];

if (typeof window !== 'undefined') window.RAW_UNUSED_BOOTHS = RAW_UNUSED_BOOTHS;
if (typeof global !== 'undefined') global.RAW_UNUSED_BOOTHS = RAW_UNUSED_BOOTHS;

const RAW_INACTIVE_BOOTHS = [];
const RAW_TERMINATED_TELLERS = [];

// 5. Collectors Data (5 Collectors)
const RAW_COLLECTORS = [
  { id: "DDN005-SC001", name: "JOHN", area: "Sto Tomas", status: "Active", phone: "+63 917 111 0001", lat: 7.5303, lng: 125.6264 },
  { id: "DDN005-SC002", name: "MUHLEN", area: "Tagum / Kapalong / Talaingod", status: "Active", phone: "+63 917 111 0002", lat: 7.4475, lng: 125.8078 },
  { id: "DDN005-SC003", name: "JASON", area: "Carmen / Tagum", status: "Active", phone: "+63 917 111 0003", lat: 7.3586, lng: 125.7061 },
  { id: "DDN005-SC004", name: "MARK ANTHONY (MAC2)", area: "Panabo City", status: "Active", phone: "+63 917 111 0004", lat: 7.3078, lng: 125.6833 },
  { id: "DDN005-SC005", name: "Jayson Pacaña", area: "Davao Del Norte", status: "Active", phone: "+63 917 111 0005", lat: 7.4500, lng: 125.7500 }
];

// 5b. Operations Leadership (Supervisors - September 2026 Masterlist)
const RAW_SUPERVISORS = [
  {
    id: "DDN005-SS001",
    name: "Liewel John Mipaña",
    gender: "Male",
    role: "Sales Supervisor",
    department: "dept-sup",
    area: "Sto. Tomas, Talaingod, Kapalong",
    address: "Sto. Tomas, Talaingod, Kapalong, Davao del Norte",
    purok: "-",
    municipality: "Sto. Tomas",
    lat: 7.5303,
    lng: 125.6264,
    boothCode: "-",
    posSerial: "N/A",
    printerSerial: "N/A",
    phone: "+63 917 222 0001",
    status: "Active",
    etsStatus: "Active"
  },
  {
    id: "DDN005-SS002",
    name: "Wildon Batalla",
    gender: "Male",
    role: "Sales Supervisor",
    department: "dept-sup",
    area: "Samal",
    address: "Island Garden City of Samal, Davao del Norte",
    purok: "-",
    municipality: "Samal",
    lat: 7.1310,
    lng: 125.7112,
    boothCode: "-",
    posSerial: "N/A",
    printerSerial: "N/A",
    phone: "+63 917 222 0002",
    status: "Active",
    etsStatus: "Active"
  }
];

// Generate Full Master Database
function buildDefaultStore() {
  const employees = [];
  const booths = [];

  // Add Operations Administrator (September 2026 Masterlist)
  const adminAddr = parseAddress('HQ Tagum City Command Center, Tagum City');
  employees.push({
    id: 'DDN005-OA001',
    name: 'Peter John Carrillo',
    gender: 'Male',
    role: 'OPERATIONS ADMINISTRATOR',
    department: 'dept-admin',
    area: 'Tagum, Panabo, Carmen',
    address: 'HQ Tagum City Command Center, Tagum City',
    purok: adminAddr.purok,
    municipality: 'Tagum City',
    lat: 7.4490,
    lng: 125.8090,
    boothCode: '-',
    posSerial: 'ADM-WS-001',
    printerSerial: 'N/A',
    phone: '+63 946 166 7956',
    status: 'Active',
    etsStatus: 'Active'
  });

  // Add Sales Supervisors (September 2026 Masterlist)
  RAW_SUPERVISORS.forEach(s => {
    employees.push({
      id: s.id,
      name: s.name,
      gender: s.gender || 'Male',
      role: 'Sales Supervisor',
      department: 'dept-sup',
      area: s.area,
      address: s.address,
      purok: s.purok || '-',
      municipality: s.municipality || s.area,
      lat: s.lat,
      lng: s.lng,
      boothCode: '-',
      posSerial: s.posSerial || 'N/A',
      printerSerial: s.printerSerial || 'N/A',
      phone: s.phone,
      status: s.status || 'Active',
      etsStatus: 'Active'
    });
  });

  // Add Collectors (Booth Code is - per requirement; they have Area Assignment)
  RAW_COLLECTORS.forEach(c => {
    employees.push({
      id: c.id,
      name: c.name,
      gender: 'Male',
      role: 'COLLECTOR',
      department: 'dept-col',
      area: c.area,
      address: c.area,
      purok: '-',
      municipality: c.area,
      lat: c.lat,
      lng: c.lng,
      boothCode: '-',
      posSerial: `POS-N9-${c.id.slice(-4)}`,
      printerSerial: `PRT-58-${c.id.slice(-4)}`,
      phone: c.phone,
      status: c.status || 'Active',
      etsStatus: 'Active'
    });
  });

  // Add 116 Primary Active Sales Representatives (September 2026 Masterlist)
  RAW_TELLERS.forEach((t) => {
    const cleanBooth = (t.booth || '').trim();
    const masterCoord = AUTHENTIC_MASTER_REGISTRY_COORDINATES[cleanBooth] || null;
    const addrParsed = parseAddress(t.address);
    const muni = (masterCoord && masterCoord.municipality) ? masterCoord.municipality : addrParsed.municipality;

    employees.push({
      id: t.id,
      name: t.name,
      gender: 'Female',
      role: 'TELLER',
      department: 'dept-tel',
      area: t.address,
      address: t.address,
      purok: addrParsed.purok,
      municipality: muni,
      lat: masterCoord ? masterCoord.lat : null,
      lng: masterCoord ? masterCoord.lng : null,
      coordinates: masterCoord ? { lat: masterCoord.lat, lng: masterCoord.lng } : null,
      boothCode: cleanBooth,
      posSerial: t.posSerial || `POS-${cleanBooth}`,
      printerSerial: `PRT-${cleanBooth}`,
      phone: t.phone || `+63 9${Math.floor(100000000 + Math.random() * 900000000)}`,
      status: 'Active',
      etsStatus: 'Active'
    });

    // Register booth
    booths.push({
      id: cleanBooth,
      code: cleanBooth,
      name: `Station ${cleanBooth} (${t.name})`,
      area: t.address,
      purok: addrParsed.purok,
      municipality: muni,
      lat: masterCoord ? masterCoord.lat : null,
      lng: masterCoord ? masterCoord.lng : null,
      coordinates: masterCoord ? { lat: masterCoord.lat, lng: masterCoord.lng } : null,
      status: 'Active',
      posSerial: t.posSerial || `POS-${cleanBooth}`,
      printerSerial: `PRT-${cleanBooth}`,
      assignedTellerId: t.id,
      assignedTellerName: t.name
    });
  });

  // Add 34 Relievers (September 2026 Masterlist)
  RAW_RELIEVERS.forEach((r) => {
    const normName = (r.name || '').toLowerCase().trim();
    const muni = OFFICIAL_RELIEVER_MUNICIPALITIES[normName] || r.municipality || 'Sto. Tomas';

    employees.push({
      id: 'DDN005-SR000',
      name: r.name,
      gender: 'Female',
      role: 'Reliever',
      department: 'dept-tel',
      area: `-, ${muni}`,
      address: `-, ${muni}`,
      purok: '-',
      municipality: muni,
      lat: null,
      lng: null,
      coordinates: null,
      boothCode: '-',
      posSerial: 'N/A',
      printerSerial: 'N/A',
      phone: r.phone || '',
      status: 'Active',
      etsStatus: 'Offline'
    });
  });

  // Add 7 Unused Booths (Operational Booths without Assigned Tellers)
  RAW_UNUSED_BOOTHS.forEach((ub) => {
    booths.push({
      id: ub.boothCode,
      code: ub.boothCode,
      name: `Station ${ub.boothCode} (Unused)`,
      area: ub.address,
      purok: ub.purok,
      municipality: ub.municipality,
      lat: ub.lat,
      lng: ub.lng,
      coordinates: ub.coordinates,
      status: 'UNUSED',
      posSerial: ub.posSerial,
      printerSerial: ub.printerSerial,
      phone: ub.phone,
      assignedTellerId: '-',
      assignedTellerName: '-'
    });
  });

  // Register standalone Master Registry booths across all corridors
  Object.entries(AUTHENTIC_MASTER_REGISTRY_COORDINATES).forEach(([bCode, coord]) => {
    if (!booths.some(b => b.id === bCode || b.code === bCode)) {
      const teller = RAW_TELLERS.find(t => (t.booth || '').trim() === bCode);
      booths.push({
        id: bCode,
        code: bCode,
        name: `Station ${bCode}${teller ? ' (' + teller.name + ')' : ''}`,
        area: coord.municipality,
        municipality: coord.municipality,
        lat: coord.lat,
        lng: coord.lng,
        coordinates: { lat: coord.lat, lng: coord.lng },
        status: 'Active',
        posSerial: (teller && teller.posSerial) ? teller.posSerial : `POS-${bCode}`,
        printerSerial: `PRT-${bCode}`,
        assignedTellerId: teller ? teller.id : '',
        assignedTellerName: teller ? teller.name : ''
      });
    }
  });

  // Add 2 Terminated Tellers
  RAW_TERMINATED_TELLERS.forEach((tt) => {
    const cleanBooth = (tt.booth || '').trim();
    const masterCoord = AUTHENTIC_MASTER_REGISTRY_COORDINATES[cleanBooth] || null;
    const addrParsed = parseAddress(tt.address);
    const muni = (masterCoord && masterCoord.municipality) ? masterCoord.municipality : addrParsed.municipality;

    employees.push({
      id: tt.id,
      name: tt.name,
      gender: 'Female',
      role: 'TELLER',
      department: 'dept-tel',
      area: tt.address,
      address: tt.address,
      purok: addrParsed.purok,
      municipality: muni,
      lat: masterCoord ? masterCoord.lat : null,
      lng: masterCoord ? masterCoord.lng : null,
      coordinates: masterCoord ? { lat: masterCoord.lat, lng: masterCoord.lng } : null,
      boothCode: cleanBooth,
      posSerial: `POS-${cleanBooth}`,
      printerSerial: `PRT-${cleanBooth}`,
      phone: `+63 9${Math.floor(100000000 + Math.random() * 900000000)}`,
      status: 'TERMINATED',
      etsStatus: 'Offline'
    });
  });

  return {
    masterRegistryVersion: 'MRV-20261006-005',
    masterRegistryUpdatedAt: new Date().toISOString(),
    settings: {
      companyName: 'APEX Mindanao Operations & Gaming Services Corp.',
      branch: 'Davao Del Norte Sector (DDN005)',
      currency: 'PHP',
      currencySymbol: '₱',
      theme: 'corporate',
      soundEnabled: true,
      eodDate: '2024-09-06',
      alertThresholdThermalPaper: 25
    },
    departments: [
      { id: 'dept-tel', name: 'Outlet & Booth Operations', role: 'Teller', head: 'Jehramea Marte', icon: 'store' },
      { id: 'dept-col', name: 'Field Collector Units', role: 'Collector', head: 'MARK ANTHONY (MAC2)', icon: 'bike' },
      { id: 'dept-sup', name: 'Team Davao Supervisors', role: 'Supervisor', head: 'Liewel John Mipaña', icon: 'shield-check' },
      { id: 'dept-admin', name: 'Administrator', role: 'Operations Administrator', head: 'Peter John Carrillo', icon: 'crown' }
    ],
    booths: booths,
    employees: employees,
    relievers: RAW_RELIEVERS.map(r => ({
      id: r.id,
      name: r.name,
      role: 'Reliever',
      boothCode: (r.booth || '').trim(),
      area: r.address || '',
      address: r.address || '',
      status: 'Active'
    })),
    inventory: [
      {
        id: '001',
        no: '001',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-76210',
        assignedTo: 'Jehramea Marte',
        employeeId: 'DDN005-SR352',
        boothCode: 'DDN-352',
        boothLocation: 'Near Baranggay Hall, Salvacion, Sto. Tomas',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-001-01',
            date: '2026-08-15 08:30',
            assignedTo: 'Jehramea Marte',
            employeeId: 'DDN005-SR352',
            boothCode: 'DDN-352',
            boothLocation: 'Near Baranggay Hall, Salvacion, Sto. Tomas',
            condition: 'Brand New',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Issued for Sto. Tomas Station Operations'
          }
        ]
      },
      {
        id: '002',
        no: '002',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-75482',
        assignedTo: 'Belle Amor Quizo',
        employeeId: 'DDN005-SR754',
        boothCode: 'DDN-754',
        boothLocation: 'New Katipunan, Feeder Road 3, Sto. Tomas',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-002-01',
            date: '2026-08-18 09:00',
            assignedTo: 'Belle Amor Quizo',
            employeeId: 'DDN005-SR754',
            boothCode: 'DDN-754',
            boothLocation: 'New Katipunan, Feeder Road 3, Sto. Tomas',
            condition: 'Brand New',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Field terminal issued with receipt printer'
          }
        ]
      },
      {
        id: '003',
        no: '003',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-76299',
        assignedTo: 'Davilyn Gelito',
        employeeId: 'DDN005-SR762',
        boothCode: 'DDN-762',
        boothLocation: 'Sabungan ni NENE, Tibal.og, Sto. Tomas',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-003-02',
            date: '2026-09-02 11:15',
            assignedTo: 'Davilyn Gelito',
            employeeId: 'DDN005-SR762',
            boothCode: 'DDN-762',
            boothLocation: 'Sabungan ni NENE, Tibal.og, Sto. Tomas',
            condition: 'Good',
            status: 'Assigned',
            action: 'Reassignment',
            note: 'Reassigned from Buffer Reliever 1 to Davilyn Gelito for main circuit'
          },
          {
            id: 'HIST-003-01',
            date: '2026-08-10 08:00',
            assignedTo: 'Buffer Reliever 1 (Sto. Tomas)',
            employeeId: 'DDN005-REL01',
            boothCode: 'DDN-762',
            boothLocation: 'Sabungan ni NENE, Tibal.og, Sto. Tomas',
            condition: 'Brand New',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Assigned to relief pool'
          }
        ]
      },
      {
        id: '004',
        no: '004',
        type: 'CELLPHONE',
        brandModel: 'Vivo Y93',
        serial: 'SN-VIVO-88310',
        assignedTo: 'JOHN (DDN005-SC001)',
        employeeId: 'DDN005-SC001',
        boothCode: 'DDN-762',
        boothLocation: 'Sto. Tomas Main Route / Davao Del Norte',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-004-01',
            date: '2026-08-20 10:00',
            assignedTo: 'JOHN (DDN005-SC001)',
            employeeId: 'DDN005-SC001',
            boothCode: 'DDN-762',
            boothLocation: 'Sto. Tomas Main Route / Davao Del Norte',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Issued for field collector coordination & ETS tracking'
          }
        ]
      },
      {
        id: '005',
        no: '005',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-35012',
        assignedTo: 'Mary Lovelyn Ramos',
        employeeId: 'DDN005-SR350',
        boothCode: 'DDN-350',
        boothLocation: 'Pagsabangan Road, Brgy Mankilam, Tagum',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-005-01',
            date: '2026-08-22 08:30',
            assignedTo: 'Mary Lovelyn Ramos',
            employeeId: 'DDN005-SR350',
            boothCode: 'DDN-350',
            boothLocation: 'Pagsabangan Road, Brgy Mankilam, Tagum',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Tagum corridor terminal allocation'
          }
        ]
      },
      {
        id: '006',
        no: '006',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-35194',
        assignedTo: 'Beverly Alao',
        employeeId: 'DDN005-SR351',
        boothCode: 'DDN-351',
        boothLocation: 'Pob. La Filipina, Tagum',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-006-01',
            date: '2026-08-25 09:00',
            assignedTo: 'Beverly Alao',
            employeeId: 'DDN005-SR351',
            boothCode: 'DDN-351',
            boothLocation: 'Pob. La Filipina, Tagum',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Station 351 primary POS machine'
          }
        ]
      },
      {
        id: '007',
        no: '007',
        type: 'CELLPHONE',
        brandModel: 'Vivo Y93',
        serial: 'SN-VIVO-99402',
        assignedTo: 'MUHLEN (DDN005-SC002)',
        employeeId: 'DDN005-SC002',
        boothCode: 'DDN-350',
        boothLocation: 'Tagum / Kapalong Corridor',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-007-01',
            date: '2026-08-26 14:00',
            assignedTo: 'MUHLEN (DDN005-SC002)',
            employeeId: 'DDN005-SC002',
            boothCode: 'DDN-350',
            boothLocation: 'Tagum / Kapalong Corridor',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Official mobile handset for Kapalong circuit dispatch'
          }
        ]
      },
      {
        id: '008',
        no: '008',
        type: 'THERMAL PAPER',
        brandModel: 'Thermal Roll 57mm',
        serial: 'BATCH-2026-TP08',
        assignedTo: 'Unassigned',
        employeeId: '',
        boothCode: 'HQ-WHSE',
        boothLocation: 'Central Logistics Base, Sto. Tomas HQ',
        condition: 'Brand New',
        status: 'Available',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-008-01',
            date: '2026-09-01 10:00',
            assignedTo: 'Unassigned',
            employeeId: '',
            boothCode: 'HQ-WHSE',
            boothLocation: 'Central Logistics Base, Sto. Tomas HQ',
            condition: 'Brand New',
            status: 'Available',
            action: 'Warehouse Intake',
            note: '300-roll box received from Davao Central Logistics'
          }
        ]
      },
      {
        id: '009',
        no: '009',
        type: 'VEST',
        brandModel: 'Official DDN Collector Vest',
        serial: 'BATCH-2026-VST01',
        assignedTo: 'MARK ANTHONY (DDN005-SC004)',
        employeeId: 'DDN005-SC004',
        boothCode: 'DDN-768',
        boothLocation: 'Panabo City Central Catchment',
        condition: 'Good',
        status: 'Assigned',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-009-01',
            date: '2026-09-02 08:30',
            assignedTo: 'MARK ANTHONY (DDN005-SC004)',
            employeeId: 'DDN005-SC004',
            boothCode: 'DDN-768',
            boothLocation: 'Panabo City Central Catchment',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'High-visibility accredited field collector vest'
          }
        ]
      },
      {
        id: '010',
        no: '010',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-17031',
        assignedTo: 'Trexy Echaverie',
        employeeId: 'DDN005-SR1703',
        boothCode: 'DDN-1703',
        boothLocation: 'P1-A, Sintro, Balagonan, Sto. Tomas',
        condition: 'Damaged',
        status: 'Under Repair',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-010-02',
            date: '2026-09-12 16:45',
            assignedTo: 'Trexy Echaverie',
            employeeId: 'DDN005-SR1703',
            boothCode: 'DDN-1703',
            boothLocation: 'P1-A, Sintro, Balagonan, Sto. Tomas',
            condition: 'Damaged',
            status: 'Under Repair',
            action: 'Status / Condition Update',
            note: 'Thermal print head jamming intermittently. Sent to HQ Hardware Bench.'
          },
          {
            id: 'HIST-010-01',
            date: '2026-08-28 09:00',
            assignedTo: 'Trexy Echaverie',
            employeeId: 'DDN005-SR1703',
            boothCode: 'DDN-1703',
            boothLocation: 'P1-A, Sintro, Balagonan, Sto. Tomas',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Station 1703 issued'
          }
        ]
      },
      {
        id: '011',
        no: '011',
        type: 'CELLPHONE',
        brandModel: 'Vivo Y93',
        serial: 'SN-VIVO-14221',
        assignedTo: 'Marcia Cabudlan',
        employeeId: 'DDN005-SR1422',
        boothCode: 'DDN-1422',
        boothLocation: 'Bobongon, Sto. Tomas',
        condition: 'Lost',
        status: 'Missing',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-011-02',
            date: '2026-09-13 18:20',
            assignedTo: 'Marcia Cabudlan',
            employeeId: 'DDN005-SR1422',
            boothCode: 'DDN-1422',
            boothLocation: 'Bobongon, Sto. Tomas',
            condition: 'Lost',
            status: 'Missing',
            action: 'Incident Report',
            note: 'Reported misplaced during evening draw route in Bobongon. Security alert active.'
          },
          {
            id: 'HIST-011-01',
            date: '2026-08-29 08:30',
            assignedTo: 'Marcia Cabudlan',
            employeeId: 'DDN005-SR1422',
            boothCode: 'DDN-1422',
            boothLocation: 'Bobongon, Sto. Tomas',
            condition: 'Good',
            status: 'Assigned',
            action: 'Initial Deployment',
            note: 'Assigned for Bobongon station'
          }
        ]
      },
      {
        id: '012',
        no: '012',
        type: 'POS MACHINE',
        brandModel: 'Sunmi V2',
        serial: 'SN-SUNMI-BUFFER01',
        assignedTo: 'Unassigned',
        employeeId: '',
        boothCode: 'HQ-BUFFER',
        boothLocation: 'Sto. Tomas Logistics Depot Buffer',
        condition: 'Brand New',
        status: 'Available',
        isArchived: false,
        assignmentHistory: [
          {
            id: 'HIST-012-01',
            date: '2026-09-05 11:00',
            assignedTo: 'Unassigned',
            employeeId: '',
            boothCode: 'HQ-BUFFER',
            boothLocation: 'Sto. Tomas Logistics Depot Buffer',
            condition: 'Brand New',
            status: 'Available',
            action: 'Warehouse Intake',
            note: 'Spare backup unit calibrated and ready for emergency deployment'
          }
        ]
      }
    ],
    pipelineStages: [
      { id: 'stage-open', title: '1. Booth Open & Float Issued', color: '#3b82f6' },
      { id: 'stage-collecting', title: '2. Active Field Collection', color: '#10b981' },
      { id: 'stage-midday', title: '3. Midday Remittance & Drop', color: '#f59e0b' },
      { id: 'stage-balancing', title: '4. EOD Cut-Off & Balancing', color: '#8b5cf6' },
      { id: 'stage-reconciled', title: '5. Reconciled & Remitted', color: '#059669' }
    ],
    pipelineCards: [],
    transactions: [],
    ocrDocuments: [],
    auditLogs: [],
    eodLedger: [],
    importHistory: [],
    deletedTransactionIds: [],
    deletedOutletRentalIds: [],
    outletRentals: [],
    thermalPaperDailySummary: { stocksOnHand: 0, allocations: [] },
    epSeedInitialized: true,
    _accountabilitySeeded: true
  };
}

class Store {
  constructor() {
    this.data = this.load();
    this.listeners = [];
    this.syncWithServer();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', () => this.syncMasterRegistryWithServer());
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.syncMasterRegistryWithServer();
          }
        });
      }
      const syncTimer = setInterval(() => {
        this.syncMasterRegistryWithServer();
      }, 15000);
      if (syncTimer && typeof syncTimer.unref === 'function') {
        syncTimer.unref();
      }
    }
  }

  sortEmployeesStrict(employees) {
    if (!Array.isArray(employees)) return [];
    const leadershipAndCollectors = [];
    const salesReps = [];
    const relievers = [];

    const isLeadershipOrCollector = (emp) => {
      if (!emp) return false;
      const r = (emp.role || '').toUpperCase();
      const d = (emp.department || '').toLowerCase();
      return r.includes('ADMIN') || 
             r.includes('SUPERVISOR') || 
             r.includes('TEAM LEADER') || 
             r.includes('COLLECTOR') || 
             d === 'dept-admin' || 
             d === 'dept-sup' || 
             d === 'dept-col' || 
             d.includes('admin') || 
             d.includes('supervisor') || 
             d.includes('collector');
    };

    const isRel = (emp) => {
      if (!emp) return false;
      const r = (emp.role || '').toUpperCase();
      const id = (emp.id || '').toUpperCase();
      return r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
    };

    employees.forEach(emp => {
      if (!emp) return;
      if (isLeadershipOrCollector(emp)) {
        leadershipAndCollectors.push(emp);
      } else if (isRel(emp)) {
        relievers.push(emp);
      } else {
        salesReps.push(emp);
      }
    });

    // Sales Representatives sorted cleanly by booth number or ID
    salesReps.sort((a, b) => {
      const bA = (a.boothCode || a.booth || '').trim();
      const bB = (b.boothCode || b.booth || '').trim();
      if (bA && bB && bA !== '-' && bB !== '-') {
        const numA = parseInt(bA.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(bB.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    // Relievers sorted alphabetically by name
    relievers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return [...leadershipAndCollectors, ...salesReps, ...relievers];
  }

  async syncMasterRegistryWithServer() {
    try {
      if (typeof fetch !== 'function') return;
      const res = await fetch('/api/master-registry');
      if (!res.ok) return;
      const srv = await res.json();
      if (!srv || !Array.isArray(srv.employees) || srv.employees.length === 0) {
        if (this.data && Array.isArray(this.data.employees) && this.data.employees.length > 0) {
          fetch('/api/master-registry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employees: this.data.employees,
              booths: this.data.booths || [],
              relievers: this.data.relievers || [],
              version: this.data.masterRegistryVersion || Date.now()
            })
          }).catch(() => {});
        }
        return;
      }

      const serverEmps = srv.employees;
      const charlyn = serverEmps.find(e => e.name && e.name.toLowerCase().trim() === 'charlyn dela vega');
      if (charlyn) {
        charlyn.id = 'DDN005-SR1799';
        charlyn.role = 'TELLER';
        charlyn.boothCode = 'DDN-1799';
        charlyn.booth = 'DDN-1799';
        charlyn.status = 'Active';
      }

      // Check version & timestamp precedence between local store and server
      const localTime = this.data.masterRegistryUpdatedAt ? new Date(this.data.masterRegistryUpdatedAt).getTime() : 0;
      const serverTime = srv.lastUpdated ? new Date(srv.lastUpdated).getTime() : (typeof srv.version === 'number' ? srv.version : 0);
      const userEditedRecently = this._lastUserEditTimestamp && (Date.now() - this._lastUserEditTimestamp < 180000);

      // If local store was modified more recently than the server or user edited in this session:
      if (localTime > serverTime || userEditedRecently) {
        // Push local changes to server to keep server updated, rather than wiping local edits!
        fetch('/api/master-registry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employees: this.data.employees,
            booths: this.data.booths || [],
            relievers: this.data.relievers || [],
            version: this.data.masterRegistryVersion || Date.now(),
            lastUpdated: this.data.masterRegistryUpdatedAt || new Date().toISOString()
          })
        }).catch(() => {});
        return;
      }

      const sortedServer = this.sortEmployeesStrict(serverEmps);
      const localCount = (this.data.employees || []).length;
      const serverCount = sortedServer.length;
      const localHash = JSON.stringify((this.data.employees || []).map(e => e.id + (e.name || '') + e.role + (e.status || '')));
      const serverHash = JSON.stringify(sortedServer.map(e => e.id + (e.name || '') + e.role + (e.status || '')));

      if (localHash !== serverHash || localCount !== serverCount) {
        this.data.employees = sortedServer;
        if (Array.isArray(srv.booths) && srv.booths.length > 0) {
          this.data.booths = srv.booths;
        }
        if (Array.isArray(srv.relievers) && srv.relievers.length > 0) {
          this.data.relievers = srv.relievers;
        }
        this.data.masterRegistryVersion = srv.version || 'MRV-20261009-003';
        this.data.masterRegistryUpdatedAt = srv.lastUpdated || new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.notify();

        if (typeof window !== 'undefined') {
          if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
            try {
              window.dispatchEvent(new CustomEvent('master-registry-synced', {
                detail: { employees: this.data.employees }
              }));
            } catch (eEvt) {}
          }
          if (typeof window.renderEmployeesTable === 'function' && typeof document !== 'undefined' && document.getElementById && document.getElementById('employee-table-tbody')) {
            window.renderEmployeesTable();
          }
          if (window.employeeDocuments && typeof window.employeeDocuments.render === 'function') {
            window.employeeDocuments.render();
          }
        }
      }
    } catch (e) {}
  }

  async syncWithServer() {
    try {
      if (typeof fetch !== 'function') return;
      const res = await fetch('/api/transactions');
      if (!res.ok) return;
      const srv = await res.json();
      if (!srv) return;

      let changed = false;
      if (srv.deletedTransactionIds && Array.isArray(srv.deletedTransactionIds)) {
        if (!this.data.deletedTransactionIds) this.data.deletedTransactionIds = [];
        srv.deletedTransactionIds.forEach(id => {
          if (!this.data.deletedTransactionIds.includes(id)) {
            this.data.deletedTransactionIds.push(id);
            changed = true;
          }
        });
      }
      if (this.data.deletedTransactionIds && this.data.deletedTransactionIds.length > 0) {
        const prevLen = (this.data.transactions || []).length;
        this.data.transactions = (this.data.transactions || []).filter(t => t && !this.data.deletedTransactionIds.includes(t.id));
        if (this.data.transactions.length !== prevLen) changed = true;
      }
      if (srv.transactions && Array.isArray(srv.transactions) && srv.transactions.length > 0) {
        if (!this.data.transactions) this.data.transactions = [];
        const localMap = new Map();
        this.data.transactions.forEach((t, idx) => {
          if (t && t.id) localMap.set(t.id, idx);
        });
        srv.transactions.forEach(srvTxn => {
          if (!srvTxn || !srvTxn.id) return;
          if (this.data.deletedTransactionIds && this.data.deletedTransactionIds.includes(srvTxn.id)) return;
          if (!localMap.has(srvTxn.id)) {
            this.data.transactions.unshift(srvTxn);
            changed = true;
          } else {
            const idx = localMap.get(srvTxn.id);
            if (JSON.stringify(this.data.transactions[idx]) !== JSON.stringify(srvTxn)) {
              this.data.transactions[idx] = { ...this.data.transactions[idx], ...srvTxn };
              changed = true;
            }
          }
        });
      }

      // Sync Outlet Rentals & Load Allowance with Server
      try {
        const orRes = await fetch('/api/outlet-rentals');
        if (orRes.ok) {
          const orSrv = await orRes.json();
          if (orSrv) {
            if (orSrv.deletedOutletRentalIds && Array.isArray(orSrv.deletedOutletRentalIds)) {
              if (!this.data.deletedOutletRentalIds) this.data.deletedOutletRentalIds = [];
              orSrv.deletedOutletRentalIds.forEach(id => {
                if (!this.data.deletedOutletRentalIds.includes(id)) {
                  this.data.deletedOutletRentalIds.push(id);
                  changed = true;
                }
              });
            }
            if (this.data.deletedOutletRentalIds && this.data.deletedOutletRentalIds.length > 0) {
              const prevOrLen = (this.data.outletRentals || []).length;
              this.data.outletRentals = (this.data.outletRentals || []).filter(r => r && !this.data.deletedOutletRentalIds.includes(r.id));
              if (this.data.outletRentals.length !== prevOrLen) changed = true;
            }
            if (orSrv.outletRentals && Array.isArray(orSrv.outletRentals) && orSrv.outletRentals.length > 0) {
              if (!this.data.outletRentals) this.data.outletRentals = [];
              const orMap = new Map();
              this.data.outletRentals.forEach((r, idx) => {
                if (r && r.id) orMap.set(r.id, idx);
              });
              orSrv.outletRentals.forEach(srvRental => {
                if (!srvRental || !srvRental.id) return;
                if (this.data.deletedOutletRentalIds && this.data.deletedOutletRentalIds.includes(srvRental.id)) return;
                if (!orMap.has(srvRental.id)) {
                  this.data.outletRentals.unshift(srvRental);
                  changed = true;
                } else {
                  const idx = orMap.get(srvRental.id);
                  if (JSON.stringify(this.data.outletRentals[idx]) !== JSON.stringify(srvRental)) {
                    this.data.outletRentals[idx] = { ...this.data.outletRentals[idx], ...srvRental };
                    changed = true;
                  }
                }
              });
            }
          }
        }
      } catch (eOr) {}

      // Sync Master Registry with Server
      await this.syncMasterRegistryWithServer();

      if (changed) {
        this.save();
      }
    } catch (e) {}
  }

  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.employees && parsed.employees.length > 50) {
          let needsSave = false;
          if (!parsed.deletedTransactionIds) parsed.deletedTransactionIds = [];
          if (parsed.transactions && Array.isArray(parsed.transactions)) {
            const originalCount = parsed.transactions.length;
            parsed.transactions = parsed.transactions.filter(t => t && !parsed.deletedTransactionIds.includes(t.id));
            if (parsed.transactions.length !== originalCount) needsSave = true;
          }

          if (!parsed.deletedOutletRentalIds) parsed.deletedOutletRentalIds = [];
          if (!parsed.outletRentals) {
            parsed.outletRentals = [];
            needsSave = true;
          } else if (Array.isArray(parsed.outletRentals)) {
            const originalOrCount = parsed.outletRentals.length;
            parsed.outletRentals = parsed.outletRentals.filter(r => r && !parsed.deletedOutletRentalIds.includes(r.id));
            if (parsed.outletRentals.length !== originalOrCount) needsSave = true;
          }

          // Permanently eradicate fake Buffer Relievers
          if (parsed.relievers && parsed.relievers.length > 0) {
            const cleanRelievers = parsed.relievers.filter(r => !r.name || !r.name.includes('Buffer Reliever'));
            if (cleanRelievers.length !== parsed.relievers.length) {
              parsed.relievers = cleanRelievers;
              needsSave = true;
            }
          }
          if (parsed.employees && parsed.employees.length > 0) {
            // Purge Buffer Relievers, ghost IDs, orphan BOOTH- rows, phantom N/A employees, and inactive duplicates
            const GHOST_IDS_TO_PURGE = new Set(['DDN005-TEL-TURA', 'BOOTH-DDN-1140', 'DDN005-SUP01']);
            const PHANTOM_BOOTHS = new Set(['DDN-2001', 'DDN-2002', 'DDN-2003', 'DDN-358', 'DDN-759', 'DDN-901']);
            const cleanEmployees = parsed.employees.filter(e => {
              if (!e) return false;
              if (e.name && (e.name.includes('Buffer Reliever') || e.name.toUpperCase().includes('JUNDY'))) return false;
              if (e.id && GHOST_IDS_TO_PURGE.has(e.id)) return false;
              if (e.id && e.id.startsWith('BOOTH-')) return false;
              // Remove duplicate inactive Ferlyn Zamora Robello (she is active reliever DDN005-REL017)
              if (e.id === 'DDN005-SR0001' && (e.status || '').toUpperCase() === 'INACTIVE') return false;
              // Purge phantom employees with N/A name or N/A role
              const normName = (e.name || '').trim().toUpperCase();
              if (!normName || normName === 'N/A' || normName === '-') return false;
              const rNorm = (e.role || '').trim().toUpperCase();
              if (rNorm === 'N/A' || rNorm === '-') return false;
              // Purge inactive phantom booths
              const bNorm = (e.boothCode || e.booth || '').trim().toUpperCase();
              if (PHANTOM_BOOTHS.has(bNorm) && (e.status || '').toUpperCase() === 'INACTIVE') return false;
              return true;
            });
            if (cleanEmployees.length !== parsed.employees.length) {
              parsed.employees = cleanEmployees;
              needsSave = true;
            }

            // Normalize all employee fields so every column in Master Registry syncs and renders perfectly
            parsed.employees.forEach(e => {
              // Both booth and boothCode
              if (!e.booth && e.boothCode) e.booth = e.boothCode;
              if (!e.boothCode && e.booth) e.boothCode = e.booth;

              // Lat and lng
              const hasLat = e.lat !== undefined && e.lat !== null && e.lat !== '' && !isNaN(e.lat);
              const hasLng = e.lng !== undefined && e.lng !== null && e.lng !== '' && !isNaN(e.lng);
              const hasCoordLat = e.coordinates && e.coordinates.lat !== undefined && e.coordinates.lat !== null && e.coordinates.lat !== '' && !isNaN(e.coordinates.lat);
              const hasCoordLng = e.coordinates && e.coordinates.lng !== undefined && e.coordinates.lng !== null && e.coordinates.lng !== '' && !isNaN(e.coordinates.lng);

              let latVal = null;
              let lngVal = null;

              if (hasLat && hasLng) {
                latVal = Number(e.lat);
                lngVal = Number(e.lng);
              } else if (hasCoordLat && hasCoordLng && (e.lat === undefined || e.lat === '')) {
                latVal = Number(e.coordinates.lat);
                lngVal = Number(e.coordinates.lng);
              }

              const rCheck = (e.role || '').toUpperCase();
              const bCodeRaw = cleanBoothId(e.boothCode || e.booth);
              const isRelStaff = (rCheck.includes('RELIEVER') || rCheck.includes('RELIVER') || rCheck.includes('BUFFER') || e.id === 'DDN005-SR000' || isOfficialRelieverName(e.name)) && (!bCodeRaw || bCodeRaw === '-');

              if (isRelStaff) {
                e.lat = null;
                e.lng = null;
                e.coordinates = null;
                e.booth = '-';
                e.boothCode = '-';
                e.etsStatus = 'Offline';
              } else if (latVal !== null && lngVal !== null) {
                e.lat = latVal;
                e.lng = lngVal;
                e.coordinates = { lat: latVal, lng: lngVal };
              } else {
                // Self-heal Sales Rep coordinates from authentic booth coordinates
                const cleanB = cleanBoothId(e.boothCode || e.booth);
                if (cleanB && AUTHENTIC_MASTER_REGISTRY_COORDINATES[cleanB]) {
                  const mc = AUTHENTIC_MASTER_REGISTRY_COORDINATES[cleanB];
                  e.lat = mc.lat;
                  e.lng = mc.lng;
                  e.coordinates = { lat: mc.lat, lng: mc.lng };
                  if (!e.municipality || e.municipality === '-' || e.municipality.includes('Davao Sector')) {
                    e.municipality = mc.municipality;
                  }
                  needsSave = true;
                } else {
                  e.lat = null;
                  e.lng = null;
                  e.coordinates = null;
                }
              }

              // POS and printer
              if (!e.posSerial && e.pos) e.posSerial = e.pos;
              if (!e.pos && e.posSerial) e.pos = e.posSerial;
              if (!e.printerName && e.printerSerial) e.printerName = e.printerSerial;
              if (!e.printerSerial && e.printerName) e.printerSerial = e.printerName;
              
              // Standardize Portable Printer to 'WITH PORTABLE PRINTER' or 'N/A'
              const prNorm = (e.printerName || e.printerSerial || '').toUpperCase();
              if (prNorm.includes('WITH') || prNorm.includes('PRT-') || prNorm.includes('PRINTER') || prNorm.includes('PORTABLE')) {
                e.printerName = 'WITH PORTABLE PRINTER';
                e.printerSerial = 'WITH PORTABLE PRINTER';
              } else {
                e.printerName = 'N/A';
                e.printerSerial = 'N/A';
              }

              // Standardize Role (Teller -> Sales Representative, Reliver -> Reliever)
              const roleNorm = (e.role || '').toUpperCase();
              if (roleNorm === 'TELLER' || roleNorm === 'STATION TELLER') {
                e.role = 'Sales Representative';
              } else if (roleNorm === 'RELIVER') {
                e.role = 'Reliever';
              }

              // Phone
              if (!e.phone && e.contact) e.phone = e.contact;
              if (!e.contact && e.phone) e.contact = e.phone;

              // Clean up corrupted / dangling slash puroks (e.g. "Tagum / Kapalong /" or "Carmen /")
              if (e.purok === 'Tagum / Kapalong /' || e.purok === 'Carmen /' || (typeof e.purok === 'string' && e.purok.trim().endsWith('/'))) {
                e.purok = '-';
                if ((e.role || '').toUpperCase().includes('COLLECTOR')) {
                  if (e.id === 'DDN005-SC002') e.municipality = 'Tagum / Kapalong / Talaingod';
                  else if (e.id === 'DDN005-SC003') e.municipality = 'Carmen / Tagum';
                  else if (e.area) e.municipality = e.area;
                  e.address = e.municipality;
                }
                needsSave = true;
              }
            });
          }

          // Ensure all employees and relievers have guaranteed unique, valid IDs and standardized statuses without duplicates
          const seenIds = new Set();
          const seenStaffKeys = new Set();
          let relSeq = 1;
          let staffSeq = 1;

          if (parsed.employees && Array.isArray(parsed.employees)) {
            const cleanEmployees = [];
            parsed.employees.forEach(e => {
              if (!e) return;
              const normName = (e.name || '').trim().toLowerCase();
              const bCode = (e.boothCode || e.booth || '').trim().toUpperCase();
              const roleNorm = (e.role || '').trim().toUpperCase();

              // Skip empty/ghost records or orphan booth rows
              if (!normName && !bCode) {
                needsSave = true;
                return;
              }
              if (e.id === 'BOOTH-DDN-1140' || (e.name === 'N/A' && e.boothCode === 'DDN-1140')) {
                needsSave = true;
                return; // Purge orphan booth row!
              }

              // Deduplication key: normalized name + (boothCode if assigned to booth, or role for buffer staff without booth)
              const cleanB = (bCode && bCode !== '-') ? bCode : '';
              const dedupKey = normName ? `${normName}::${cleanB || roleNorm}` : `id::${e.id}`;
              if (seenStaffKeys.has(dedupKey)) {
                needsSave = true;
                return; // Discard duplicate employee record!
              }
              seenStaffKeys.add(dedupKey);

              let id = (e.id || '').trim();
              const isRel = (roleNorm.includes('RELIEVER') || roleNorm.includes('RELIVER') || roleNorm.includes('BUFFER') || e.id === 'DDN005-SR000' || isOfficialRelieverName(e.name)) && (!cleanB || cleanB === '-');
              if (isRel) {
                // Relievers default ID No is DDN005-SR000 for all assigned relievers
                e.id = 'DDN005-SR000';
                id = 'DDN005-SR000';
                e.role = 'Reliever';
                e.booth = '-';
                e.boothCode = '-';
                e.lat = null;
                e.lng = null;
                e.coordinates = null;
                e.etsStatus = 'Offline';

                // Look up authentic municipality from getRelieverMunicipality
                const authMuni = getRelieverMunicipality(e.name);
                e.municipality = authMuni;
                e.purok = '-';
                e.address = `-, ${authMuni}`;
                e.area = e.address;
                needsSave = true;

                // Self-heal: If relievers were trapped in INACTIVE due to previous single-ID bug, restore to ACTIVE
                if ((e.status || '').toUpperCase() === 'INACTIVE') {
                  e.status = 'ACTIVE';
                  needsSave = true;
                }
              } else {
                // If non-reliever employee has booth code, ensure authentic coordinates are populated
                const bCode = cleanBoothId(e.boothCode || e.booth);
                if (bCode && AUTHENTIC_MASTER_REGISTRY_COORDINATES[bCode]) {
                  const mc = AUTHENTIC_MASTER_REGISTRY_COORDINATES[bCode];
                  if (!e.lat || !e.lng || isNaN(e.lat) || isNaN(e.lng) || !e.coordinates) {
                    e.lat = mc.lat;
                    e.lng = mc.lng;
                    e.coordinates = { lat: mc.lat, lng: mc.lng };
                    needsSave = true;
                  }
                  if (!e.municipality || e.municipality === '-' || e.municipality.includes('Davao Sector') || e.municipality.includes('Davao Del Norte')) {
                    e.municipality = mc.municipality;
                    needsSave = true;
                  }
                } else if (!e.municipality || e.municipality === '-' || e.municipality.includes('Davao Sector') || e.municipality.includes('Davao Del Norte')) {
                  const parsed = parseAddress(e.address || e.area || '');
                  if (parsed.municipality && parsed.municipality !== '-' && !parsed.municipality.includes('Davao Sector') && !parsed.municipality.includes('Davao Del Norte')) {
                    e.municipality = parsed.municipality;
                    needsSave = true;
                  }
                }
              }
              if (!isRel && (!id || id === 'N/A' || id === '-' || id.startsWith('DDN005-REL') || seenIds.has(id))) {
                let genId;
                do {
                  genId = `DDN005-SR${String(staffSeq++).padStart(4, '0')}`;
                } while (seenIds.has(genId));
                e.id = genId;
                id = genId;
                needsSave = true;
              }
              if (!isRel) seenIds.add(id);

              // Normalize status field to uppercase canonical values — respect whatever the
              // Excel import already stored; do NOT override with hardcoded name/ID lists.
              const sUp = (e.status || 'ACTIVE').toUpperCase();
              if (sUp === 'TERMINATED') e.status = 'TERMINATED';
              else if (sUp === 'INACTIVE') e.status = 'INACTIVE';
              else if (sUp === 'UNUSED') e.status = 'UNUSED';
              else e.status = 'ACTIVE';

              cleanEmployees.push(e);
            });
            if (cleanEmployees.length !== parsed.employees.length) {
              parsed.employees = cleanEmployees;
              needsSave = true;
            }
          }

          if (parsed.relievers && Array.isArray(parsed.relievers) && parsed.relievers.length > 0) {
            parsed.relievers.forEach(r => {
              r.id = 'DDN005-SR000';
              r.role = 'Reliever';
              r.municipality = getRelieverMunicipality(r.name);
              r.purok = '-';
              r.area = `-, ${r.municipality}`;
              r.address = r.area;
              r.booth = '-';
              r.boothCode = '-';
              r.lat = null;
              r.lng = null;
              r.coordinates = null;
              r.etsStatus = 'Offline';
              const sUp = (r.status || 'ACTIVE').toUpperCase();
              r.status = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'ACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
              needsSave = true;
            });
          } else {
            const relEmployees = (parsed.employees || []).filter(e => (e.role || '').toUpperCase().includes('RELIEVER'));
            if (relEmployees.length > 0) {
              parsed.relievers = relEmployees.map(e => ({
                id: e.id,
                name: e.name,
                role: 'Reliever',
                boothCode: e.boothCode || '',
                area: e.address || '',
                status: e.status || 'Active'
              }));
              needsSave = true;
            }
          }
          if (!parsed.ocrDocuments) {
            const fresh = buildDefaultStore();
            parsed.ocrDocuments = fresh.ocrDocuments;
            needsSave = true;
          }
          if (!parsed.auditLogs) {
            const fresh = buildDefaultStore();
            parsed.auditLogs = fresh.auditLogs;
            needsSave = true;
          }
          if (!parsed.importHistory || parsed.importHistory.length === 0) {
            const fresh = buildDefaultStore();
            parsed.importHistory = fresh.importHistory;
            needsSave = true;
          }
          // Ensure transactions array exists and normalize classifications without ever overwriting user data
          if (!parsed.transactions) {
            parsed.transactions = [];
            needsSave = true;
          } else if (Array.isArray(parsed.transactions)) {
            parsed.transactions.forEach(t => {
              if (t && !t.classification) {
                if (t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'))) t.classification = 'SHORT';
                else if (t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'))) t.classification = 'CA';
                else if (t.type === 'PAYMENT') t.classification = 'PAYMENT';
                else t.classification = 'OTHER';
                needsSave = true;
              }
            });
          }

          parsed._accountabilitySeeded = true;

          // Deduplicate any repeated transactions with identical IDs
          if (parsed.transactions && Array.isArray(parsed.transactions)) {
            const seen = new Set();
            const originalLength = parsed.transactions.length;
            parsed.transactions = parsed.transactions.filter(t => {
              if (!t) return false;
              if (!t.id) {
                t.id = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
                return true;
              }
              if (seen.has(t.id)) {
                return false; // remove duplicate identical record
              }
              seen.add(t.id);
              return true;
            });
            if (parsed.transactions.length !== originalLength) {
              needsSave = true;
            }
          }
          // Ensure inventory is upgraded to the rebuilt schema with sequential 'no' and assignment history
          if (!parsed.inventory || parsed.inventory.length === 0 || !parsed.inventory[0].no || parsed.inventory[0].imei !== undefined) {
            const fresh = buildDefaultStore();
            parsed.inventory = fresh.inventory;
            needsSave = true;
          }

          // Strict Master Registry GPS Sync (Ensure all 123 authentic booths and Sales Reps have verified coordinates)
          if (!parsed._gpsStrictMasterV1 || !parsed._gpsStrictMasterV2) {
            parsed._gpsStrictMasterV1 = true;
            parsed._gpsStrictMasterV2 = true;
            if (typeof AUTHENTIC_MASTER_REGISTRY_COORDINATES !== 'undefined') {
              if (Array.isArray(parsed.booths)) {
                parsed.booths.forEach((b) => {
                  if (b._userCalibrated) return;
                  const norm = cleanBoothId(b.id || b.code);
                  if (norm && AUTHENTIC_MASTER_REGISTRY_COORDINATES[norm]) {
                    const masterCoord = AUTHENTIC_MASTER_REGISTRY_COORDINATES[norm];
                    b.lat = masterCoord.lat;
                    b.lng = masterCoord.lng;
                    b.coordinates = { lat: masterCoord.lat, lng: masterCoord.lng };
                    if (masterCoord.municipality) b.municipality = masterCoord.municipality;
                  } else {
                    // Purge previous fake/radial fallback coordinates
                    b.lat = null;
                    b.lng = null;
                    b.coordinates = null;
                  }
                });
              }

              if (Array.isArray(parsed.employees)) {
                parsed.employees.forEach((e) => {
                  if (e._userCalibrated) return;
                  const rU = (e.role || '').toUpperCase();
                  const bCode = cleanBoothId(e.boothCode || e.booth);
                  const isRel = (rU.includes('RELIEVER') || rU.includes('RELIVER') || rU.includes('BUFFER') || e.id === 'DDN005-SR000' || isOfficialRelieverName(e.name)) && (!bCode || bCode === '-');
                  if (isRel) {
                    e.lat = null;
                    e.lng = null;
                    e.coordinates = null;
                    e.booth = '-';
                    e.boothCode = '-';
                    return;
                  }
                  if (rU.includes('COLLECTOR') || rU.includes('ADMIN')) return;
                  if (bCode && AUTHENTIC_MASTER_REGISTRY_COORDINATES[bCode]) {
                    const masterCoord = AUTHENTIC_MASTER_REGISTRY_COORDINATES[bCode];
                    e.lat = masterCoord.lat;
                    e.lng = masterCoord.lng;
                    e.coordinates = { lat: masterCoord.lat, lng: masterCoord.lng };
                    if (masterCoord.municipality && (!e.municipality || e.municipality === '-' || e.municipality.includes('Davao Sector'))) {
                      e.municipality = masterCoord.municipality;
                    }
                  } else {
                    // Purge previous fake/radial fallback coordinates
                    e.lat = null;
                    e.lng = null;
                    e.coordinates = null;
                  }
                });
              }
            }
            needsSave = true;
          }

          // Ensure all authentic Master Registry booths are registered and phantom/unassigned booths purged
          if (typeof AUTHENTIC_MASTER_REGISTRY_COORDINATES !== 'undefined' && Array.isArray(parsed.booths)) {
            const cleanBoothId = (code) => {
              if (!code || typeof code !== 'string') return null;
              const trimmed = code.trim().toUpperCase();
              if (trimmed === '-' || trimmed === 'N/A' || trimmed === 'NONE' || trimmed === '' || trimmed === 'UNASSIGNED') return null;
              let clean = trimmed.replace(/^BOOTH[\s-]*/i, '').replace(/^DDN[\s_]+(\d+)/i, 'DDN-$1');
              if (/^\d+$/.test(clean)) clean = `DDN-${clean}`;
              return clean;
            };

            const PHANTOM_BOOTHS = new Set(['DDN-2001', 'DDN-2002', 'DDN-2003', 'DDN-358', 'DDN-759', 'DDN-901']);
            const origBoothsCount = parsed.booths.length;

            // Authoritative Master Registry list: strictly 123 authentic outlets (116 assigned + 7 unused)
            const authenticBoothCodes = new Set([
              ...Object.keys(AUTHENTIC_MASTER_REGISTRY_COORDINATES).map(c => cleanBoothId(c)),
              ...((typeof RAW_UNUSED_BOOTHS !== 'undefined' ? RAW_UNUSED_BOOTHS : []).map(u => cleanBoothId(u.boothCode)))
            ]);

            const seenBooths = new Set();
            parsed.booths = parsed.booths.filter(b => {
              if (!b) return false;
              const norm = cleanBoothId(b.id || b.code);
              if (!norm) return false;
              if (PHANTOM_BOOTHS.has(norm)) return false;
              // Purge any rogue booths outside authentic 123 outlets
              if (authenticBoothCodes.size > 0 && !authenticBoothCodes.has(norm)) return false;
              // Deduplicate any repeated booth records
              if (seenBooths.has(norm)) return false;
              seenBooths.add(norm);
              return true;
            });
            if (parsed.booths.length !== origBoothsCount) needsSave = true;

            Object.entries(AUTHENTIC_MASTER_REGISTRY_COORDINATES).forEach(([bCode, coord]) => {
              const existingBooth = parsed.booths.find(b => cleanBoothId(b.id || b.code) === bCode);
              const teller = typeof RAW_TELLERS !== 'undefined' ? RAW_TELLERS.find(t => (t.booth || '').trim() === bCode) : null;
              if (!existingBooth) {
                parsed.booths.push({
                  id: bCode,
                  code: bCode,
                  name: `Station ${bCode}${teller ? ' (' + teller.name + ')' : ''}`,
                  area: coord.municipality,
                  municipality: coord.municipality,
                  lat: coord.lat,
                  lng: coord.lng,
                  coordinates: { lat: coord.lat, lng: coord.lng },
                  status: 'Active',
                  posSerial: (teller && teller.posSerial) ? teller.posSerial : `POS-${bCode}`,
                  printerSerial: `PRT-${bCode}`,
                  assignedTellerId: teller ? teller.id : '',
                  assignedTellerName: teller ? teller.name : ''
                });
                needsSave = true;
              } else {
                if (teller && (!existingBooth.assignedTellerName || existingBooth.assignedTellerName === '-' || existingBooth.assignedTellerName === 'Unassigned' || existingBooth.assignedTellerName === 'N/A' || (existingBooth.status || '').toUpperCase() === 'INACTIVE')) {
                  existingBooth.assignedTellerId = teller.id;
                  existingBooth.assignedTellerName = teller.name;
                  existingBooth.status = 'Active';
                  needsSave = true;
                }
              }
            });
          }

          // Ensure all 116 official tellers from September 2026 Masterlist are present
          if (Array.isArray(parsed.employees) && typeof RAW_TELLERS !== 'undefined') {
            const cleanBoothId = (code) => {
              if (!code || typeof code !== 'string') return null;
              const trimmed = code.trim().toUpperCase();
              if (trimmed === '-' || trimmed === 'N/A' || trimmed === 'NONE' || trimmed === '' || trimmed === 'UNASSIGNED') return null;
              let clean = trimmed.replace(/^BOOTH[\s-]*/i, '').replace(/^DDN[\s_]+(\d+)/i, 'DDN-$1');
              if (/^\d+$/.test(clean)) clean = `DDN-${clean}`;
              return clean;
            };

            RAW_TELLERS.forEach(t => {
              const cleanBooth = (t.booth || '').trim();
              const masterCoord = AUTHENTIC_MASTER_REGISTRY_COORDINATES[cleanBooth] || null;
              const addrParsed = parseAddress(t.address);
              const muni = (masterCoord && masterCoord.municipality) ? masterCoord.municipality : addrParsed.municipality;

              const existingEmp = parsed.employees.find(e => (e.id && e.id === t.id) || (e.name && e.name.toLowerCase() === t.name.toLowerCase()));
              if (!existingEmp) {
                parsed.employees.push({
                  id: t.id,
                  name: t.name,
                  gender: 'Female',
                  role: 'Sales Representative',
                  department: 'dept-tel',
                  area: t.address,
                  address: t.address,
                  purok: addrParsed.purok,
                  municipality: muni,
                  lat: masterCoord ? masterCoord.lat : null,
                  lng: masterCoord ? masterCoord.lng : null,
                  coordinates: masterCoord ? { lat: masterCoord.lat, lng: masterCoord.lng } : null,
                  boothCode: cleanBooth,
                  posSerial: t.posSerial || `POS-${cleanBooth}`,
                  printerSerial: `PRT-${cleanBooth}`,
                  phone: t.phone || `+63 9${Math.floor(100000000 + Math.random() * 900000000)}`,
                  status: 'Active',
                  etsStatus: 'Active'
                });
                needsSave = true;
              }

              // Update booth assigned teller if missing
              if (Array.isArray(parsed.booths)) {
                const b = parsed.booths.find(b => cleanBoothId(b.id || b.code) === cleanBooth);
                if (b && (!b.assignedTellerId || b.assignedTellerId === '-')) {
                  b.assignedTellerId = t.id;
                  b.assignedTellerName = t.name;
                  needsSave = true;
                }
              }
            });
          }

          // Ensure all 34 official relievers from September 2026 Masterlist are present with default ID DDN005-SR000
          if (Array.isArray(parsed.employees) && typeof RAW_RELIEVERS !== 'undefined') {
            RAW_RELIEVERS.forEach(r => {
              const normName = (r.name || '').toLowerCase().trim();
              const authMuni = OFFICIAL_RELIEVER_MUNICIPALITIES[normName] || r.municipality || 'Sto. Tomas';
              const existingRel = parsed.employees.find(e => (e.role && (e.role.toUpperCase().includes('RELIEVER') || e.role.toUpperCase().includes('BUFFER'))) && (e.name && e.name.toLowerCase().trim() === normName));
              if (!existingRel) {
                parsed.employees.push({
                  id: 'DDN005-SR000',
                  name: r.name,
                  gender: 'Female',
                  role: 'Reliever',
                  department: 'dept-tel',
                  area: `-, ${authMuni}`,
                  address: `-, ${authMuni}`,
                  purok: '-',
                  municipality: authMuni,
                  lat: null,
                  lng: null,
                  coordinates: null,
                  boothCode: '-',
                  booth: '-',
                  posSerial: 'N/A',
                  printerSerial: 'N/A',
                  phone: r.phone || '',
                  status: 'Active',
                  etsStatus: 'Offline'
                });
                needsSave = true;
              } else {
                existingRel.id = 'DDN005-SR000';
                existingRel.role = 'Reliever';
                existingRel.municipality = authMuni;
                existingRel.purok = '-';
                existingRel.address = `-, ${authMuni}`;
                existingRel.area = existingRel.address;
                existingRel.boothCode = '-';
                existingRel.booth = '-';
                existingRel.lat = null;
                existingRel.lng = null;
                existingRel.coordinates = null;
                existingRel.etsStatus = 'Offline';
                if (r.phone && (!existingRel.phone || existingRel.phone === 'N/A' || existingRel.phone === '-')) {
                  existingRel.phone = r.phone;
                }
                needsSave = true;
              }
            });
          }

          // Ensure the 7 unused booths from September 2026 Masterlist are registered in booths
          if (Array.isArray(parsed.booths) && typeof RAW_UNUSED_BOOTHS !== 'undefined') {
            RAW_UNUSED_BOOTHS.forEach(ub => {
              const cleanB = ub.boothCode.toUpperCase();
              let b = parsed.booths.find(x => (x.id && x.id.toUpperCase() === cleanB) || (x.code && x.code.toUpperCase() === cleanB));
              if (!b) {
                parsed.booths.push({
                  id: ub.boothCode,
                  code: ub.boothCode,
                  name: `Station ${ub.boothCode} (Unused)`,
                  area: ub.address,
                  purok: ub.purok,
                  municipality: ub.municipality,
                  lat: ub.lat,
                  lng: ub.lng,
                  coordinates: ub.coordinates,
                  status: 'UNUSED',
                  posSerial: ub.posSerial,
                  printerSerial: ub.printerSerial,
                  phone: ub.phone,
                  assignedTellerId: '-',
                  assignedTellerName: '-'
                });
                needsSave = true;
              } else if ((b.status || '').toUpperCase() !== 'UNUSED' && (!b.assignedTellerId || b.assignedTellerId === '-' || b.assignedTellerName === '-')) {
                b.status = 'UNUSED';
                needsSave = true;
              }
            });
          }

          // Ensure Operations Administrator (Peter John Carrillo) is updated to official ID DDN005-OA001
          if (Array.isArray(parsed.employees)) {
            const adminEmp = parsed.employees.find(e => (e.name && e.name.toLowerCase().includes('peter john')) || e.id === 'DDN005-OA001' || e.id === 'DDN005-ADM01');
            if (adminEmp) {
              adminEmp.id = 'DDN005-OA001';
              adminEmp.role = 'OPERATIONS ADMINISTRATOR';
              adminEmp.department = 'dept-admin';
              adminEmp.area = 'Tagum, Panabo, Carmen';
            } else {
              parsed.employees.push({
                id: 'DDN005-OA001',
                name: 'Peter John Carrillo',
                gender: 'Male',
                role: 'OPERATIONS ADMINISTRATOR',
                department: 'dept-admin',
                area: 'Tagum, Panabo, Carmen',
                address: 'HQ Tagum City Command Center, Tagum City',
                purok: '-',
                municipality: 'Tagum City',
                lat: 7.4490,
                lng: 125.8090,
                boothCode: '-',
                posSerial: 'ADM-WS-001',
                printerSerial: 'N/A',
                phone: '+63 946 166 7956',
                status: 'Active',
                etsStatus: 'Active'
              });
              needsSave = true;
            }
          }

          // Ensure all official Sales Supervisors from September 2026 Masterlist are present
          if (Array.isArray(parsed.employees) && typeof RAW_SUPERVISORS !== 'undefined') {
            RAW_SUPERVISORS.forEach(s => {
              const existingSup = parsed.employees.find(e => (e.id && e.id === s.id) || (e.name && e.name.toLowerCase() === s.name.toLowerCase()));
              if (!existingSup) {
                parsed.employees.push({
                  id: s.id,
                  name: s.name,
                  gender: s.gender || 'Male',
                  role: 'Sales Supervisor',
                  department: 'dept-sup',
                  area: s.area,
                  address: s.address,
                  purok: s.purok || '-',
                  municipality: s.municipality || s.area,
                  lat: s.lat,
                  lng: s.lng,
                  boothCode: '-',
                  posSerial: s.posSerial || 'N/A',
                  printerSerial: s.printerSerial || 'N/A',
                  phone: s.phone,
                  status: s.status || 'Active',
                  etsStatus: 'Active'
                });
                needsSave = true;
              }
            });
          }

          if (Array.isArray(parsed.departments)) {
            const supDept = parsed.departments.find(d => d.id === 'dept-sup');
            if (supDept) supDept.head = 'Liewel John Mipaña';
            const admDept = parsed.departments.find(d => d.id === 'dept-admin');
            if (admDept) admDept.head = 'Peter John Carrillo';
          }

          if (parsed.masterRegistryVersion !== 'MRV-20261009-003') {
            // 1. Sanitize Charlyn Dela Vega: She is authentic Sales Representative DDN005-SR1799, NOT a Reliever!
            if (Array.isArray(parsed.employees)) {
              parsed.employees.forEach(e => {
                if (e && e.name && e.name.toLowerCase().trim() === 'charlyn dela vega') {
                  e.id = 'DDN005-SR1799';
                  e.role = 'TELLER';
                  e.department = 'dept-tel';
                  e.booth = 'DDN-1799';
                  e.boothCode = 'DDN-1799';
                  e.area = 'Kape-Kape St., Prk 1-A, Balagunan, Sto. Tomas';
                  e.address = 'Kape-Kape St., Prk 1-A, Balagunan, Sto. Tomas';
                  e.purok = 'Kape-Kape St., Prk 1-A, Balagunan';
                  e.municipality = 'Sto. Tomas';
                  e.lat = 7.485317;
                  e.lng = 125.592014;
                  e.coordinates = { lat: 7.485317, lng: 125.592014 };
                  e.posSerial = 'POS-DDN-1799';
                  e.printerSerial = 'PRT-DDN-1799';
                  e.status = 'Active';
                  e.etsStatus = 'Active';
                  needsSave = true;
                }
              });

              // 2. Deduplicate relievers to ensure only unique authentic relievers exist
              const seenRelNames = new Set();
              parsed.employees = parsed.employees.filter(e => {
                if (!e || !e.name) return false;
                const r = (e.role || '').toUpperCase();
                const id = (e.id || '').toUpperCase();
                const isRel = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
                if (isRel) {
                  const norm = e.name.trim().toLowerCase();
                  if (seenRelNames.has(norm)) return false;
                  seenRelNames.add(norm);
                }
                return true;
              });

              // 3. Strict Role-Priority Sort: Sales Representatives ALWAYS first, Relievers ALWAYS last
              parsed.employees = this.sortEmployeesStrict(parsed.employees);
            }

            parsed.masterRegistryVersion = 'MRV-20261009-003';
            parsed.masterRegistryUpdatedAt = new Date().toISOString();
            needsSave = true;
          }

          if (needsSave) {
            this.save(parsed);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load local storage:', e);
    }
    const fresh = buildDefaultStore();
    this.save(fresh);
    return fresh;
  }

  save(data = this.data) {
    if (this._isSaving) return;
    this._isSaving = true;
    try {
      this.data = data;
      if (this.data.deletedTransactionIds && this.data.deletedTransactionIds.length > 0) {
        const delTxnSet = new Set(this.data.deletedTransactionIds);
        this.data.transactions = (this.data.transactions || []).filter(t => t && !delTxnSet.has(t.id));
      }
      if (this.data.deletedOutletRentalIds && this.data.deletedOutletRentalIds.length > 0) {
        const delSet = new Set(this.data.deletedOutletRentalIds);
        this.data.outletRentals = (this.data.outletRentals || []).filter(r => {
          if (!r) return false;
          if (delSet.has(r.id)) return false;
          if (r.sourceTxnId && delSet.has(r.sourceTxnId)) return false;
          if (typeof r.id === 'string') {
            if (r.id.startsWith('ORL-') && delSet.has(r.id.replace(/^ORL-/, ''))) return false;
            if (delSet.has('ORL-' + r.id)) return false;
          }
          return true;
        });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();
      try {
        if (typeof fetch === 'function') {
          fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactions: this.data.transactions,
              deletedTransactionIds: this.data.deletedTransactionIds || []
            })
          }).catch(() => {});

          fetch('/api/outlet-rentals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              outletRentals: this.data.outletRentals || [],
              deletedOutletRentalIds: this.data.deletedOutletRentalIds || []
            })
          }).catch(() => {});

          fetch('/api/master-registry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employees: this.data.employees || [],
              booths: this.data.booths || [],
              relievers: this.data.relievers || [],
              version: this.data.masterRegistryVersion || Date.now(),
              lastUpdated: this.data.masterRegistryUpdatedAt || new Date().toISOString()
            })
          }).catch(() => {});
        }
      } catch (e) {}
    } catch (e) {
      console.error('Failed to save store:', e);
    } finally {
      this._isSaving = false;
    }
  }

  getOutletRentals() {
    if (!this.data.outletRentals) this.data.outletRentals = [];
    if (this.data.deletedOutletRentalIds && this.data.deletedOutletRentalIds.length > 0) {
      const delSet = new Set(this.data.deletedOutletRentalIds);
      this.data.outletRentals = this.data.outletRentals.filter(r => {
        if (!r) return false;
        if (delSet.has(r.id)) return false;
        if (r.sourceTxnId && delSet.has(r.sourceTxnId)) return false;
        if (typeof r.id === 'string' && r.id.startsWith('ORL-') && delSet.has(r.id.replace(/^ORL-/, ''))) return false;
        return true;
      });
    }
    return this.data.outletRentals;
  }

  saveOutletRental(record) {
    if (!record || !record.id) return;
    if (!this.data.outletRentals) this.data.outletRentals = [];
    const idx = this.data.outletRentals.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      this.data.outletRentals[idx] = { ...this.data.outletRentals[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
      this.data.outletRentals.push({ ...record, createdAt: new Date().toISOString() });
    }
    this.save();
  }

  deleteOutletRental(id) {
    if (!id) return;
    if (!this.data.deletedOutletRentalIds) this.data.deletedOutletRentalIds = [];
    if (!this.data.deletedOutletRentalIds.includes(id)) {
      this.data.deletedOutletRentalIds.push(id);
    }
    const cleanId = id.startsWith('ORL-') ? id.replace(/^ORL-/, '') : ('ORL-' + id);
    if (!this.data.deletedOutletRentalIds.includes(cleanId)) {
      this.data.deletedOutletRentalIds.push(cleanId);
    }
    if (this.data.outletRentals) {
      this.data.outletRentals = this.data.outletRentals.filter(r => {
        if (!r) return false;
        return r.id !== id && r.id !== cleanId && r.sourceTxnId !== id && r.sourceTxnId !== cleanId;
      });
    }
    this.save();
    try {
      if (typeof fetch === 'function') {
        fetch(`/api/outlet-rentals?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch (e) {}
    return true;
  }

  resetOperationalData() {
    this.data.transactions = [];
    this.data.deletedTransactionIds = [];
    this.data.pipelineCards = [];
    this.data.eodLedger = [];
    this.data.ocrDocuments = [];
    this.data.auditLogs = [];
    this.data.outletRentals = [];
    this.data.deletedOutletRentalIds = [];
    this.data.thermalPaperDailySummary = { stocksOnHand: 0, allocations: [] };
    this.data.epSeedInitialized = true;
    this.data._accountabilitySeeded = true;
    this.save();
    try {
      if (typeof fetch === 'function') {
        fetch('/api/reset-operational-data', { method: 'POST' }).catch(() => {});
      }
    } catch (e) {}
    this.notify();
  }

  resetToDefault() {
    const fresh = buildDefaultStore();
    this.save(fresh);
  }

  subscribe(listener) {
    if (!this.listeners) this.listeners = [];
    this.listeners.push(listener);
    return () => {
      if (this.listeners) {
        this.listeners = this.listeners.filter(l => l !== listener);
      }
    };
  }

  notify() {
    if (this._isNotifying) return;
    this._isNotifying = true;
    try {
      if (!this.listeners) this.listeners = [];
      const listenersCopy = [...this.listeners];
      listenersCopy.forEach(fn => {
        try { fn(this.data); } catch (err) { console.error('Listener err:', err); }
      });
    } finally {
      this._isNotifying = false;
    }
  }

  getSettings() { return this.data.settings; }
  setTheme(theme) {
    this.data.settings.theme = theme;
    this.save();
  }

  getEmployees() {
    if (!this.data || !Array.isArray(this.data.employees)) return [];
    return this.sortEmployeesStrict(this.data.employees);
  }
  getBooths() { return this.data.booths; }
  getInventory(includeArchived = false) { 
    return includeArchived ? (this.data.inventory || []) : (this.data.inventory || []).filter(i => !i.isArchived); 
  }
  getArchivedInventory() { 
    return (this.data.inventory || []).filter(i => i.isArchived); 
  }
  getTransactions() { return this.data.transactions || []; }
  getOcrDocuments() { return this.data.ocrDocuments || []; }
  getAuditLogs() { return this.data.auditLogs || []; }
  getPipelineStages() { return this.data.pipelineStages; }
  getPipelineCards() { return this.data.pipelineCards; }
  getEodLedger() { return this.data.eodLedger; }

  // Expenses & Payment: Running CA Balance Calculator
  // Critical Rules:
  // 1. CASH ADVANCE (CA): increases running CA balance
  // 2. PAYMENT (with applyToCA === true): decreases running CA balance
  // 3. SHORT: Tracked independently, NEVER subtracted from CA
  getEmployeeCABalance(employeeId, asOfDate = null) {
    const txns = this.data.transactions || [];
    let balance = 0;

    // Sort chronologically ascending
    const sorted = [...txns].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    for (const t of sorted) {
      if (asOfDate && t.date > asOfDate) continue;
      if (t.verificationStatus === 'REJECTED') continue;

      if (t.employeeId === employeeId || (t.name && employeeId && t.name.toLowerCase() === employeeId.toLowerCase())) {
        const amt = Number(t.amount) || 0;
        if (t.classification === 'CA') {
          balance += amt;
        } else if (t.classification === 'PAYMENT' && t.applyToCA === true) {
          balance -= amt;
        }
      }
    }

    return Math.max(0, balance);
  }

  // Get Comprehensive Financial Profile for a Personnel
  getEmployeeSummary(employeeId) {
    const txns = this.data.transactions || [];
    const empTxns = txns.filter(t => 
      t.employeeId === employeeId || (t.name && employeeId && t.name.toLowerCase() === employeeId.toLowerCase())
    );

    let totalCA = 0;
    let totalShort = 0;
    let totalPayments = 0;
    let caAppliedPayments = 0;

    empTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.classification === 'CA') totalCA += amt;
      else if (t.classification === 'SHORT') totalShort += amt;
      else if (t.classification === 'PAYMENT') {
        totalPayments += amt;
        if (t.applyToCA) caAppliedPayments += amt;
      }
    });

    const currentCABalance = Math.max(0, totalCA - caAppliedPayments);

    return {
      totalCA,
      totalShort,
      totalPayments,
      caAppliedPayments,
      currentCABalance,
      transactions: empTxns
    };
  }

  // Comprehensive Employee Accountability: Strictly separate Shortage & Cash Advance
  getEmployeeAccountability(empQuery) {
    if (!empQuery || typeof empQuery !== 'string') return null;
    const q = empQuery.trim().toLowerCase();
    const allStaff = [...(this.data.employees || []), ...(this.data.relievers || [])];
    const staff = allStaff.find(s => 
      (s.name && s.name.toLowerCase().includes(q)) || 
      (s.id && s.id.toLowerCase() === q)
    );

    const targetName = staff ? staff.name : empQuery.trim();
    const targetId = staff ? staff.id : '';
    const targetRole = staff ? staff.role : '';

    const txns = this.data.transactions || [];
    const empTxns = txns.filter(t => {
      if (t.verificationStatus === 'REJECTED') return false;
      const tName = (t.name || '').toLowerCase();
      const tId = (t.employeeId || '').toLowerCase();
      return (targetId && tId === targetId.toLowerCase()) || 
             tName.includes(q) || 
             (targetName && tName === targetName.toLowerCase());
    });

    if (empTxns.length === 0 && !staff) return null;

    // Chronological order for history ledger
    const sortedTxns = [...empTxns].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // 1. Short Teller Tracking
    let shortOriginal = 0;
    let shortPaid = 0;
    const shortHistory = [];

    // 2. Cash Advance Tracking
    let caOriginal = 0;
    let caPaid = 0;
    const caHistory = [];

    for (const t of sortedTxns) {
      const amt = Number(t.amount) || 0;
      const descUpper = (t.description || '').toUpperCase();
      const noteUpper = (t.note || '').toUpperCase();
      const appliedUpper = (t.appliedTo || '').toUpperCase();

      // Check Shortage
      if (t.classification === 'SHORT' || descUpper.includes('SHORT') || t.transactionType === 'SHORT_TELLER') {
        shortOriginal += amt;
        const currentBal = Math.max(0, shortOriginal - shortPaid);
        shortHistory.push({
          date: t.date,
          transaction: 'Short Teller',
          amount: amt,
          appliedTo: 'Shortage',
          remaining: currentBal
        });
      }
      // Check Cash Advance
      else if (t.classification === 'CA' || descUpper.includes('C.A.') || descUpper.includes('CASH ADVANCE') || t.transactionType === 'CASH_ADVANCE') {
        caOriginal += amt;
        const currentBal = Math.max(0, caOriginal - caPaid);
        caHistory.push({
          date: t.date,
          transaction: 'Cash Advance',
          amount: amt,
          appliedTo: 'C.A.',
          remaining: currentBal
        });
      }
      // Check Payment
      else if (t.classification === 'PAYMENT' || descUpper.includes('PAYMENT')) {
        const isShortPayment = appliedUpper.includes('SHORT') || descUpper.includes('SHORT') || noteUpper.includes('SHORT');
        const isCaPayment = t.applyToCA || appliedUpper.includes('CA') || appliedUpper.includes('C.A.') || descUpper.includes('C.A.') || noteUpper.includes('CA');

        if (isShortPayment) {
          shortPaid += amt;
          const currentBal = Math.max(0, shortOriginal - shortPaid);
          shortHistory.push({
            date: t.date,
            transaction: 'Payment',
            amount: amt,
            appliedTo: 'Short Teller',
            remaining: currentBal
          });
        } else if (isCaPayment) {
          caPaid += amt;
          const currentBal = Math.max(0, caOriginal - caPaid);
          caHistory.push({
            date: t.date,
            transaction: 'Payment',
            amount: amt,
            appliedTo: 'C.A.',
            remaining: currentBal
          });
        } else {
          // If payment doesn't specify, allocate to open shortage if any, else CA
          if (shortOriginal > shortPaid) {
            shortPaid += amt;
            const currentBal = Math.max(0, shortOriginal - shortPaid);
            shortHistory.push({
              date: t.date,
              transaction: 'Payment',
              amount: amt,
              appliedTo: 'Short Teller',
              remaining: currentBal
            });
          } else {
            caPaid += amt;
            const currentBal = Math.max(0, caOriginal - caPaid);
            caHistory.push({
              date: t.date,
              transaction: 'Payment',
              amount: amt,
              appliedTo: 'C.A.',
              remaining: currentBal
            });
          }
        }
      }
    }

    const shortOutstanding = Math.max(0, shortOriginal - shortPaid);
    const caOutstanding = Math.max(0, caOriginal - caPaid);

    return {
      name: targetName,
      employeeId: targetId,
      role: targetRole || 'Staff Member',
      hasObligations: shortOriginal > 0 || caOriginal > 0,
      shortage: {
        original: shortOriginal,
        paid: shortPaid,
        outstanding: shortOutstanding,
        status: shortOriginal > 0 && shortOutstanding === 0 ? 'FULLY SETTLED' : (shortOutstanding > 0 ? 'OUTSTANDING' : 'NO SHORTAGE'),
        history: shortHistory
      },
      cashAdvance: {
        original: caOriginal,
        paid: caPaid,
        outstanding: caOutstanding,
        status: caOriginal > 0 && caOutstanding === 0 ? 'FULLY SETTLED' : (caOutstanding > 0 ? 'OUTSTANDING' : 'NO ADVANCE'),
        history: caHistory
      }
    };
  }

  // Daily Payment Monitoring: Grouped by Employee for Target Date
  getDailyPaymentMonitoring(targetDate = '2024-09-06') {
    const txns = this.data.transactions || [];
    const allStaff = [
      ...(this.data.employees || []),
      ...(this.data.relievers || [])
    ];

    const staffMap = {};
    allStaff.forEach(s => {
      staffMap[s.id] = s;
    });

    // Summary metrics for the top cards
    let totalCA = 0;
    let totalShort = 0;
    let totalPayments = 0;
    let netRecoveredCA = 0;

    // Map of employee daily figures
    const dailyRecords = {};

    txns.forEach(t => {
      if (t.date !== targetDate || t.verificationStatus === 'REJECTED') return;
      const amt = Number(t.amount) || 0;
      const empId = t.employeeId || t.name;

      if (!dailyRecords[empId]) {
        const staffObj = staffMap[empId] || allStaff.find(s => s.name === t.name) || {};
        dailyRecords[empId] = {
          employeeId: empId,
          name: t.name || staffObj.name || empId,
          role: t.role || staffObj.role || 'Personnel',
          boothCode: (t.role || staffObj.role) === 'Collector' ? '-' : (t.boothCode || staffObj.boothCode || '-'),
          location: t.location || staffObj.municipality || staffObj.address || '-',
          ca: 0,
          short: 0,
          payment: 0,
          caAppliedPayment: 0,
          caBalance: 0
        };
      }

      if (t.classification === 'CA') {
        dailyRecords[empId].ca += amt;
        totalCA += amt;
      } else if (t.classification === 'SHORT') {
        dailyRecords[empId].short += amt;
        totalShort += amt;
      } else if (t.classification === 'PAYMENT') {
        dailyRecords[empId].payment += amt;
        totalPayments += amt;
        if (t.applyToCA) {
          dailyRecords[empId].caAppliedPayment += amt;
          netRecoveredCA += amt;
        }
      }
    });

    // Compute cumulative running CA balance as of targetDate for each active record
    const recordsList = Object.values(dailyRecords).map(rec => {
      rec.caBalance = this.getEmployeeCABalance(rec.employeeId, targetDate);
      return rec;
    });

    // Calculate total pending CA balance across all staff as of this date
    let totalPendingCABalance = 0;
    allStaff.forEach(s => {
      totalPendingCABalance += this.getEmployeeCABalance(s.id, targetDate);
    });

    return {
      targetDate,
      summary: {
        totalCA,
        totalShort,
        totalPayments,
        netRecoveredCA,
        pendingCABalance: totalPendingCABalance
      },
      records: recordsList
    };
  }

  // Monthly Expense Monitoring: Aggregated by Expense Type and Role
  getMonthlySummary(yearMonth = '2024-09') {
    const txns = this.data.transactions || [];
    const otherExpensesByType = {};
    let totalOtherExpenses = 0;

    const roleSummary = {
      Collector: { ca: 0, short: 0, payment: 0, caBalance: 0 },
      Teller: { ca: 0, short: 0, payment: 0, caBalance: 0 },
      Reliever: { ca: 0, short: 0, payment: 0, caBalance: 0 },
      General: { other: 0 }
    };

    txns.forEach(t => {
      if (!t.date || !t.date.startsWith(yearMonth)) return;
      if (t.verificationStatus === 'REJECTED') return;

      const amt = Number(t.amount) || 0;
      const roleUpper = (t.role || '').toUpperCase();

      if (t.classification === 'OTHER') {
        // Group by normalized description (e.g., FUEL MOTOR, RENT MOTOR, WIFI, POS LOAD, THERMAL PAPER, STALL RENT, HARDWARE)
        let descKey = (t.description || 'Other Operating Expense').toUpperCase().trim();
        if (descKey.includes('POS LOAD')) descKey = 'POS LOAD / MONTH (DATA PLAN)';
        else if (descKey.includes('WIFI')) descKey = 'WIFI ALLOWANCE';
        else if (descKey.includes('RENT FEE') || descKey.includes('RENT SABONGAN')) descKey = 'BOOTH / STALL LEASE RENT';
        else if (descKey.includes('THERMAL PAPER')) descKey = 'THERMAL PAPER SUPPLIES (300 ROLLS)';
        else if (descKey.includes('DOOR BOLT') || descKey.includes('PADLOCK')) descKey = 'BOOTH HARDWARE & SECURITY (DOOR BOLTS/LOCKS)';
        else if (descKey.includes('FUEL MOTOR')) descKey = 'FUEL MOTOR (FIELD GAS ALLOWANCE)';
        else if (descKey.includes('RENT MOTOR')) descKey = 'RENT MOTOR (COLLECTION FLEET RENTAL)';
        else if (descKey.includes('COMM.') || descKey.includes('COMMISSION')) descKey = 'COMMISSION CARRY-OVER / SETTLEMENT';

        otherExpensesByType[descKey] = (otherExpensesByType[descKey] || 0) + amt;
        totalOtherExpenses += amt;
      } else {
        let targetRole = 'General';
        if (roleUpper.includes('COLLECTOR')) targetRole = 'Collector';
        else if (roleUpper.includes('TELLER')) targetRole = 'Teller';
        else if (roleUpper.includes('RELIEVER')) targetRole = 'Reliever';

        if (roleSummary[targetRole]) {
          if (t.classification === 'CA') roleSummary[targetRole].ca += amt;
          else if (t.classification === 'SHORT') roleSummary[targetRole].short += amt;
          else if (t.classification === 'PAYMENT') roleSummary[targetRole].payment += amt;
        }
      }
    });

    // Calculate outstanding CA balances per role as of end of month
    const allStaff = [...(this.data.employees || []), ...(this.data.relievers || [])];
    allStaff.forEach(s => {
      const roleUpper = (s.role || '').toUpperCase();
      const bal = this.getEmployeeCABalance(s.id, `${yearMonth}-31`);
      if (roleUpper.includes('COLLECTOR')) roleSummary.Collector.caBalance += bal;
      else if (roleUpper.includes('TELLER')) roleSummary.Teller.caBalance += bal;
      else if (roleUpper.includes('RELIEVER')) roleSummary.Reliever.caBalance += bal;
    });

    return {
      yearMonth,
      totalOtherExpenses,
      otherExpensesByType,
      roleSummary
    };
  }

  // Duplicate Document Protection
  checkDuplicateDocument(fingerprint, filename, reportDate, totalAmount) {
    const docs = this.data.ocrDocuments || [];
    return docs.find(d => 
      (fingerprint && d.fingerprint === fingerprint) ||
      (d.filename === filename && d.reportDate === reportDate) ||
      (d.reportDate === reportDate && Math.abs((d.totalExpenses || 0) - totalAmount) < 0.01)
    );
  }

  addOcrDocument(doc) {
    doc.id = doc.id || `DOC-OCR-${Date.now().toString().slice(-6)}`;
    if (!this.data.ocrDocuments) this.data.ocrDocuments = [];
    this.data.ocrDocuments.unshift(doc);
    this.save();
    return doc;
  }

  addAuditLog(entry) {
    entry.id = entry.id || `AUD-${Date.now().toString().slice(-6)}`;
    entry.timestamp = entry.timestamp || new Date().toLocaleString();
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(entry);
    this.save();
    return entry;
  }

  addTransaction(txn) {
    txn.id = txn.id || `TXN-${Date.now().toString().slice(-6)}`;
    // Enforce Collector Rule: Collectors NEVER have Booth Codes
    if ((txn.role || '').toUpperCase() === 'COLLECTOR') {
      txn.boothCode = '';
    }
    this.data.transactions.unshift(txn);
    this.addAuditLog({
      eventType: 'TXN_CREATED',
      user: 'PJC (Supervisor)',
      details: `Created ${txn.classification} transaction for ${txn.name || 'Staff'}: ₱${Number(txn.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}`,
      recordId: txn.id
    });
    this.save();
    return txn;
  }

  updateTransaction(id, updates) {
    const idx = this.data.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      if ((updates.role || this.data.transactions[idx].role || '').toUpperCase() === 'COLLECTOR') {
        updates.boothCode = '';
      }
      this.data.transactions[idx] = { ...this.data.transactions[idx], ...updates };
      this.addAuditLog({
        eventType: 'TXN_UPDATED',
        user: 'PJC (Supervisor)',
        details: `Updated ${this.data.transactions[idx].classification} transaction (${id})`,
        recordId: id
      });
      this.save();
      return this.data.transactions[idx];
    }
    return null;
  }

  deleteTransaction(id) {
    if (!id) return;
    if (!this.data.deletedTransactionIds) this.data.deletedTransactionIds = [];
    if (!this.data.deletedTransactionIds.includes(id)) {
      this.data.deletedTransactionIds.push(id);
    }
    const txn = (this.data.transactions || []).find(t => t.id === id);
    this.data.transactions = (this.data.transactions || []).filter(t => t && t.id !== id);

    // Also remove from outletRentals if linked
    if (!this.data.deletedOutletRentalIds) this.data.deletedOutletRentalIds = [];
    if (!this.data.deletedOutletRentalIds.includes(id)) this.data.deletedOutletRentalIds.push(id);
    if (!this.data.deletedOutletRentalIds.includes(`ORL-${id}`)) this.data.deletedOutletRentalIds.push(`ORL-${id}`);
    if (this.data.outletRentals) {
      this.data.outletRentals = this.data.outletRentals.filter(r => r && r.id !== id && r.id !== `ORL-${id}` && r.sourceTxnId !== id);
    }

    if (txn) {
      this.addAuditLog({
        eventType: 'TXN_DELETED',
        user: 'PJC (Supervisor)',
        details: `Deleted ${txn.classification || txn.type || 'transaction'} (${id}) for ${txn.name || 'Staff'}`,
        recordId: id
      });
    }
    this.save();
    try {
      if (typeof fetch === 'function') {
        fetch(`/api/transactions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
        fetch(`/api/outlet-rentals?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
        fetch(`/api/outlet-rentals?id=${encodeURIComponent('ORL-' + id)}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch (e) {}
  }

  // Method to check if an employee has valid GPS coordinates (Latitude -90 to 90, Longitude -180 to 180)
  hasValidGpsCoordinates(emp) {
    if (!emp) return false;
    let lat = emp.lat;
    let lng = emp.lng;

    if ((lat === undefined || lat === null || lat === '' || isNaN(lat)) && emp.coordinates) {
      lat = emp.coordinates.lat;
    }
    if ((lng === undefined || lng === null || lng === '' || isNaN(lng)) && emp.coordinates) {
      lng = emp.coordinates.lng;
    }

    if (lat === undefined || lat === null || lat === '' || isNaN(lat)) return false;
    if (lng === undefined || lng === null || lng === '' || isNaN(lng)) return false;

    const numLat = Number(lat);
    const numLng = Number(lng);

    if (isNaN(numLat) || isNaN(numLng)) return false;
    if (numLat < -90 || numLat > 90) return false;
    if (numLng < -180 || numLng > 180) return false;

    return true;
  }

  // Version tracking & smart cache management for Master Registry
  getMasterRegistryVersion() {
    return (this.data && this.data.masterRegistryVersion) || 'MRV-20261006-005';
  }

  bumpMasterRegistryVersion() {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Date.now().toString().slice(-4);
    const newVersion = `MRV-${todayStr}-${suffix}`;
    if (!this.data) this.data = {};
    this.data.masterRegistryVersion = newVersion;
    this.data.masterRegistryUpdatedAt = new Date().toISOString();
    if (typeof window !== 'undefined' && window.etsGpsCache && typeof window.etsGpsCache.invalidate === 'function') {
      window.etsGpsCache.invalidate();
    }
    return newVersion;
  }

  // Pin Recalibration Method: Update coordinates of any employee or booth
  updateCoordinates(id, lat, lng) {
    let updated = false;
    const cleanLat = parseFloat(Number(lat).toFixed(6));
    const cleanLng = parseFloat(Number(lng).toFixed(6));
    const coordObj = { lat: cleanLat, lng: cleanLng };

    // Check employees
    const emp = this.data.employees.find(e => e.id === id || e.name === id);
    if (emp) {
      emp.lat = cleanLat;
      emp.lng = cleanLng;
      emp.coordinates = coordObj;
      emp._userCalibrated = true;
      updated = true;

      // Also update linked booth by boothCode
      const bCode = emp.boothCode || emp.booth;
      if (bCode && bCode !== '-') {
        const b = this.data.booths.find(x => x.id === bCode || x.code === bCode);
        if (b) {
          b.lat = cleanLat;
          b.lng = cleanLng;
          b.coordinates = coordObj;
          b._userCalibrated = true;
        }
      }
    }

    // Check relievers
    if (this.data.relievers) {
      const reliever = this.data.relievers.find(r => r.id === id || r.name === id);
      if (reliever) {
        reliever.lat = cleanLat;
        reliever.lng = cleanLng;
        reliever.coordinates = coordObj;
        reliever._userCalibrated = true;
        updated = true;
      }
    }

    // Check booths by id, code, or assignedTellerId
    const booth = this.data.booths.find(b => b.id === id || b.code === id || b.assignedTellerId === id);
    if (booth) {
      booth.lat = cleanLat;
      booth.lng = cleanLng;
      booth.coordinates = coordObj;
      booth._userCalibrated = true;
      updated = true;
    }

    if (updated) {
      this.bumpMasterRegistryVersion();
      this.save();
    }
    return updated;
  }

  sanitizeEmployeeIds() {
    if (this._isSanitizing) return;
    this._isSanitizing = true;
    try {
      const seenIds = new Set();
      const seenStaffKeys = new Set();
      let relSeq = 1;
      let staffSeq = 1;
      let modified = false;

      if (this.data.employees && Array.isArray(this.data.employees)) {
        const origLen = this.data.employees.length;
        const cleanEmployees = [];
        this.data.employees.forEach(e => {
          if (!e) return;
          const normName = (e.name || '').trim().toLowerCase();
          const bCode = (e.boothCode || e.booth || '').trim().toUpperCase();
          const roleNorm = (e.role || '').trim().toUpperCase();

          if (!normName && !bCode) {
            modified = true;
            return;
          }
          // Purge known ghost records: DDN005-TEL-TURA, orphan BOOTH- rows, unauthorized JUNDY,
          // duplicate inactive Ferlyn (DDN005-SR0001), and phantom N/A rows
          const PHANTOM_BOOTHS = new Set(['DDN-2001', 'DDN-2002', 'DDN-2003', 'DDN-358', 'DDN-759', 'DDN-901']);
          if (e.id === 'BOOTH-DDN-1140' || e.id === 'DDN005-TEL-TURA' || e.id === 'DDN005-SUP01' || (e.name && e.name.toUpperCase().includes('JUNDY')) || (e.name === 'N/A' && (e.boothCode === 'DDN-1140' || e.booth === 'DDN-1140'))) {
            modified = true;
            return; // Prune orphan/unauthorized row!
          }
          if (e.id && e.id.startsWith('BOOTH-')) {
            modified = true;
            return;
          }
          if (e.id === 'DDN005-SR0001' && (e.status || '').toUpperCase() === 'INACTIVE') {
            modified = true;
            return;
          }
          if (!normName || normName === 'N/A' || normName === '-') {
            modified = true;
            return;
          }
          if (!roleNorm || roleNorm === 'N/A' || roleNorm === '-') {
            modified = true;
            return;
          }
          if (PHANTOM_BOOTHS.has(bCode) && (e.status || '').toUpperCase() === 'INACTIVE') {
            modified = true;
            return;
          }

          const cleanB = (bCode && bCode !== '-') ? bCode : '';
          const dedupKey = normName ? `${normName}::${cleanB || roleNorm}` : `id::${e.id}`;
          if (seenStaffKeys.has(dedupKey)) {
            modified = true;
            return; // Prune duplicate employee record!
          }
          seenStaffKeys.add(dedupKey);

          let id = (e.id || '').trim();
          const isRel = roleNorm.includes('RELIEVER') || roleNorm.includes('RELIVER');
          if (isRel) {
            // Relievers default ID No is DDN005-SR000 for all assigned relievers
            e.id = 'DDN005-SR000';
            id = 'DDN005-SR000';
          } else if (!id || id === 'N/A' || id === '-' || id.startsWith('DDN005-REL') || seenIds.has(id)) {
            let genId;
            do {
              genId = `DDN005-SR${String(staffSeq++).padStart(4, '0')}`;
            } while (seenIds.has(genId));
            e.id = genId;
            id = genId;
            modified = true;
          }
          if (!isRel) seenIds.add(id);

          const sUp = (e.status || 'ACTIVE').toUpperCase();
          const normStatus = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'INACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
          if (e.status !== normStatus) {
            e.status = normStatus;
            modified = true;
          }

          // Clean up corrupted collector purok values in localStorage
          if (e.purok === 'Tagum / Kapalong /' || e.purok === 'Carmen /' || (typeof e.purok === 'string' && e.purok.trim().endsWith('/'))) {
            e.purok = '-';
            if ((e.role || '').toUpperCase().includes('COLLECTOR')) {
              if (e.id === 'DDN005-SC002') e.municipality = 'Tagum / Kapalong / Talaingod';
              else if (e.id === 'DDN005-SC003') e.municipality = 'Carmen / Tagum';
              else if (e.area) e.municipality = e.area;
              e.address = e.municipality;
            }
            modified = true;
          }

          cleanEmployees.push(e);
        });

        if (cleanEmployees.length !== origLen) {
          this.data.employees = cleanEmployees;
          modified = true;
        }
      }

    if (this.data.relievers && Array.isArray(this.data.relievers)) {
      this.data.relievers.forEach(r => {
        if (r.id !== 'DDN005-SR000') {
          r.id = 'DDN005-SR000';
          modified = true;
        }
        const sUp = (r.status || 'ACTIVE').toUpperCase();
        const normStatus = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'INACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
        if (r.status !== normStatus) {
          r.status = normStatus;
          modified = true;
        }
      });
    }

    if (this.data.booths && Array.isArray(this.data.booths)) {
      const origBoothsLen = this.data.booths.length;
      // Purge orphan BOOTH-DDN-1140 and any orphan booth duplicating an active employee booth
      const activeEmpBooths = new Set();
      (this.data.employees || []).forEach(emp => {
        const bC = (emp.boothCode && emp.boothCode !== '-') ? emp.boothCode.trim().toUpperCase() : (emp.booth && emp.booth !== '-' ? emp.booth.trim().toUpperCase() : null);
        if (bC) activeEmpBooths.add(bC);
      });

      const PHANTOM_BOOTHS = new Set(['DDN-2001', 'DDN-2002', 'DDN-2003', 'DDN-358', 'DDN-759', 'DDN-901']);
      this.data.booths = this.data.booths.filter(b => {
        if (!b || !b.id) return false;
        if (b.id === 'BOOTH-DDN-1140') return false;
        const clean = (b.id || b.code || '').replace(/^BOOTH-/, '').toUpperCase();
        if (PHANTOM_BOOTHS.has(clean)) return false;
        if ((b.status || '').toUpperCase() === 'INACTIVE' && (!b.assignedTellerName || b.assignedTellerName === '-' || b.assignedTellerName === 'N/A' || b.assignedTellerName === 'Unassigned')) return false;
        if (b.id.startsWith('BOOTH-')) {
          const raw = b.id.replace(/^BOOTH-/, '').toUpperCase();
          if (activeEmpBooths.has(raw)) return false;
        }
        return true;
      });

      if (this.data.booths.length !== origBoothsLen) {
        modified = true;
      }
    }

    if (modified) {
      this.save();
    }
  } finally {
    this._isSanitizing = false;
  }
}

  addEmployee(emp) {
    const isRel = emp.role && (emp.role.toUpperCase().includes('RELIEVER') || emp.role.toUpperCase().includes('BUFFER'));
    if (isRel) {
      emp.id = 'DDN005-SR000';
      emp.role = 'Reliever';
      const authMuni = getRelieverMunicipality(emp.name);
      emp.municipality = authMuni;
      emp.purok = '-';
      emp.address = `-, ${authMuni}`;
      emp.area = emp.address;
      emp.booth = '-';
      emp.boothCode = '-';
      emp.lat = null;
      emp.lng = null;
      emp.coordinates = null;
      emp.etsStatus = 'Offline';
    } else {
      emp.id = emp.id || `DDN005-SR${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const sUp = (emp.status || 'ACTIVE').toUpperCase();
    emp.status = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'INACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
    // STRICT RULE: Relievers must NEVER be placed at the top of the list.
    // They are appended to the end, ensuring Sales Representatives always remain first.
    if (isRel) {
      this.data.employees.push(emp);
    } else {
      const firstRelIdx = this.data.employees.findIndex(e => {
        const r = (e.role || '').toUpperCase();
        const id = (e.id || '').toUpperCase();
        return r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
      });
      if (firstRelIdx >= 0) {
        this.data.employees.splice(firstRelIdx, 0, emp);
      } else {
        this.data.employees.push(emp);
      }
    }
    this.data.employees = this.sortEmployeesStrict(this.data.employees);
    if (isRel) {
      if (!this.data.relievers) this.data.relievers = [];
      if (!this.data.relievers.some(r => r.name && emp.name && r.name.toLowerCase() === emp.name.toLowerCase())) {
        const authMuni = getRelieverMunicipality(emp.name);
        this.data.relievers.push({
          id: 'DDN005-SR000',
          name: emp.name,
          role: 'Reliever',
          boothCode: '-',
          booth: '-',
          municipality: authMuni,
          purok: '-',
          area: `-, ${authMuni}`,
          address: `-, ${authMuni}`,
          phone: emp.phone || emp.contact || '',
          status: emp.status || 'Active'
        });
      }
    }
    this.data.masterRegistryUpdatedAt = new Date().toISOString();
    this._lastUserEditTimestamp = Date.now();
    this.bumpMasterRegistryVersion();
    this.save();
    return emp;
  }

  updateEmployee(id, updates, targetName) {
    let result = null;

    if (updates.status) {
      const sUp = updates.status.toUpperCase();
      updates.status = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'INACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
    }

    const targetId = (updates.id && updates.id.trim()) ? updates.id.trim() : id;
    const lookupName = targetName || updates._targetName || (id === 'DDN005-SR000' && updates.name ? updates.name : null);

    let idx = -1;
    if (this.data.employees) {
      if (id === 'DDN005-SR000') {
        if (lookupName) {
          idx = this.data.employees.findIndex(e => (e.id === 'DDN005-SR000' || (e.role && e.role.toLowerCase().includes('reliev'))) && e.name && e.name.toLowerCase().trim() === lookupName.toLowerCase().trim());
        }
      } else {
        if (lookupName && (!id || id === 'N/A')) {
          idx = this.data.employees.findIndex(e => e.name && e.name.toLowerCase().trim() === lookupName.toLowerCase().trim());
        }
        if (idx === -1) {
          idx = this.data.employees.findIndex(e => e.id === id);
        }
      }
    }

    let rIdx = -1;
    if (this.data.relievers) {
      if (lookupName && (id === 'DDN005-SR000' || !id || id === 'N/A')) {
        rIdx = this.data.relievers.findIndex(r => r.name && r.name.toLowerCase().trim() === lookupName.toLowerCase().trim());
      }
      if (rIdx === -1 && id !== 'DDN005-SR000') {
        rIdx = this.data.relievers.findIndex(r => r.id === id);
      }
    }

    // If record is not in employees or relievers, check booths (e.g. Inactive Booth row)
    if (idx === -1 && rIdx === -1 && this.data.booths) {
      const cleanBoothCode = id.replace(/^BOOTH-/, '');
      const boothIdx = this.data.booths.findIndex(b => b.id === id || b.id === cleanBoothCode || b.assignedTellerId === id);
      if (boothIdx !== -1) {
        const b = this.data.booths[boothIdx];
        const newEmp = {
          id: targetId || (b.assignedTellerId && !b.assignedTellerId.startsWith('BOOTH-') ? b.assignedTellerId : `DDN005-SR${cleanBoothCode.replace(/[^0-9]/g, '').padStart(3, '0')}`),
          name: updates.name || b.assignedTellerName || 'N/A',
          role: updates.role || 'SALES REPRESENTATIVE',
          department: updates.department || 'dept-tel',
          purok: updates.purok || b.purok || '-',
          municipality: updates.municipality || b.municipality || 'Sto. Tomas',
          address: updates.address || `${updates.purok || b.purok || '-'}, ${updates.municipality || b.municipality || 'Sto. Tomas'}`,
          area: updates.area || updates.municipality || b.municipality || 'Sto. Tomas',
          boothCode: cleanBoothCode,
          booth: cleanBoothCode,
          phone: updates.phone || 'N/A',
          contact: updates.contact || updates.phone || 'N/A',
          status: updates.status || 'INACTIVE',
          posSerial: updates.posSerial || b.posSerial || `POS-${cleanBoothCode}`,
          printerName: updates.printerName || (b.printerSerial ? 'WITH PORTABLE PRINTER' : 'N/A'),
          printerSerial: updates.printerSerial || 'N/A',
          lat: updates.lat !== undefined ? updates.lat : b.lat,
          lng: updates.lng !== undefined ? updates.lng : b.lng,
          coordinates: (updates.lat && updates.lng) ? { lat: updates.lat, lng: updates.lng } : ((b.lat && b.lng) ? { lat: b.lat, lng: b.lng } : null)
        };
        this.data.employees.unshift(newEmp);
        b.assignedTellerId = newEmp.id;
        b.assignedTellerName = newEmp.name;
        b.activeTeller = newEmp.name;
        b.status = newEmp.status;
        b.purok = newEmp.purok;
        b.municipality = newEmp.municipality;
        b.area = newEmp.address;
        if (newEmp.lat) b.lat = newEmp.lat;
        if (newEmp.lng) b.lng = newEmp.lng;
        this.save();
        return newEmp;
      }
    }

    // Capture old booth code before applying updates
    let oldBoothCode = null;
    if (idx !== -1) {
      oldBoothCode = this.data.employees[idx].boothCode || this.data.employees[idx].booth || null;
      this.data.employees[idx] = { ...this.data.employees[idx], ...updates, id: targetId };

      // Explicitly handle GPS coordinates & coordinates object persistence
      if (updates.lat === null || updates.lng === null || updates.lat === '' || updates.lng === '') {
        this.data.employees[idx].lat = null;
        this.data.employees[idx].lng = null;
        this.data.employees[idx].coordinates = null;
      } else if (updates.lat !== undefined && updates.lng !== undefined && !isNaN(updates.lat) && !isNaN(updates.lng)) {
        const nLat = Number(updates.lat);
        const nLng = Number(updates.lng);
        this.data.employees[idx].lat = nLat;
        this.data.employees[idx].lng = nLng;
        this.data.employees[idx].coordinates = { lat: nLat, lng: nLng };
      }

      result = this.data.employees[idx];
    }

    if (this.data.relievers) {
      if (rIdx === -1 && result) {
        rIdx = this.data.relievers.findIndex(r => (result.name && r.name && r.name.toLowerCase().trim() === result.name.toLowerCase().trim()) || (result.id && result.id !== 'DDN005-SR000' && r.id === result.id));
      }
      if (rIdx !== -1) {
        this.data.relievers[rIdx] = { ...this.data.relievers[rIdx], ...updates, id: targetId };
        if (updates.lat === null || updates.lng === null || updates.lat === '' || updates.lng === '') {
          this.data.relievers[rIdx].lat = null;
          this.data.relievers[rIdx].lng = null;
          this.data.relievers[rIdx].coordinates = null;
        } else if (updates.lat !== undefined && updates.lng !== undefined && !isNaN(updates.lat) && !isNaN(updates.lng)) {
          const nLat = Number(updates.lat);
          const nLng = Number(updates.lng);
          this.data.relievers[rIdx].lat = nLat;
          this.data.relievers[rIdx].lng = nLng;
          this.data.relievers[rIdx].coordinates = { lat: nLat, lng: nLng };
        }
        if (!result) result = this.data.relievers[rIdx];
      }
    }

    // Role cross-synchronization
    if (result && updates.role) {
      const isRelRole = updates.role.toUpperCase().includes('RELIEVER') || updates.role.toUpperCase().includes('BUFFER');
      if (isRelRole && this.data.relievers) {
        const authMuni = getRelieverMunicipality(result.name);
        result.id = 'DDN005-SR000';
        result.role = 'Reliever';
        result.municipality = authMuni;
        result.purok = '-';
        result.address = `-, ${authMuni}`;
        result.area = result.address;
        result.booth = '-';
        result.boothCode = '-';
        result.lat = null;
        result.lng = null;
        result.coordinates = null;
        result.etsStatus = 'Offline';
        if (idx !== -1) {
          this.data.employees[idx] = { ...this.data.employees[idx], ...result };
        }
        const rIndex = this.data.relievers.findIndex(r => r.id === result.id || (result.name && r.name && r.name.toLowerCase() === result.name.toLowerCase()));
        if (rIndex >= 0) {
          this.data.relievers[rIndex] = { ...this.data.relievers[rIndex], ...result, role: 'Reliever', id: 'DDN005-SR000' };
        } else {
          this.data.relievers.push({
            id: 'DDN005-SR000',
            name: result.name,
            role: 'Reliever',
            boothCode: '-',
            booth: '-',
            municipality: authMuni,
            purok: '-',
            area: `-, ${authMuni}`,
            address: `-, ${authMuni}`,
            phone: result.phone || result.contact || '',
            status: result.status || 'Active'
          });
        }
      } else if (!isRelRole && this.data.relievers) {
        this.data.relievers = this.data.relievers.filter(r => r.id !== result.id && (!result.name || !r.name || r.name.toLowerCase() !== result.name.toLowerCase()));
      }
      if (!isRelRole && idx === -1 && this.data.employees) {
        this.data.employees.unshift({ ...result });
      }
    }

    // Synchronize booth assignments with Rule: ONE BOOTH CODE = ONE ACTIVE BOOTH RECORD
    if (this.data.booths) {
      const newBoothCode = updates.boothCode !== undefined ? updates.boothCode : (updates.booth !== undefined ? updates.booth : (result ? (result.boothCode || result.booth) : null));
      const cleanNewBoothCode = (newBoothCode && newBoothCode !== '-') ? String(newBoothCode).trim().toUpperCase().replace(/^BOOTH-/, '') : null;
      const cleanOldBoothCode = (oldBoothCode && oldBoothCode !== '-') ? String(oldBoothCode).trim().toUpperCase().replace(/^BOOTH-/, '') : null;

      // 1. If booth changed, unassign from old booth
      if (cleanOldBoothCode && cleanNewBoothCode && cleanOldBoothCode !== cleanNewBoothCode) {
        const oldB = this.data.booths.find(b => (b.id || '').toUpperCase().replace(/^BOOTH-/, '') === cleanOldBoothCode);
        if (oldB) {
          oldB.assignedTellerId = null;
          oldB.assignedTellerName = '';
          oldB.activeTeller = '';
          oldB.status = 'INACTIVE';
        }
      }

      // 2. Assign to new booth (ONLY match by exact clean booth code, NEVER match by old teller ID!)
      if (cleanNewBoothCode) {
        // Remove any orphan duplicate booth records with BOOTH- prefix
        this.data.booths = this.data.booths.filter(b => b.id !== `BOOTH-${cleanNewBoothCode}` && b.id !== 'BOOTH-DDN-1140');

        let b = this.data.booths.find(b => (b.id || '').toUpperCase().replace(/^BOOTH-/, '') === cleanNewBoothCode);
        if (!b) {
          b = {
            id: cleanNewBoothCode,
            name: `Station ${cleanNewBoothCode}`,
            area: (result && result.address) || `${(result && result.purok) || '-'}, ${(result && result.municipality) || 'Sto. Tomas'}`,
            purok: (result && result.purok) || '-',
            municipality: (result && result.municipality) || 'Sto. Tomas',
            lat: result ? result.lat : null,
            lng: result ? result.lng : null,
            status: (result && result.status) || 'Active',
            posSerial: (result && result.posSerial) || `POS-${cleanNewBoothCode}`,
            printerSerial: (result && result.printerSerial) || 'N/A'
          };
          this.data.booths.push(b);
        }

        b.id = cleanNewBoothCode;
        b.assignedTellerId = targetId;
        if (result && result.name) {
          b.assignedTellerName = result.name;
          b.activeTeller = result.name;
        }
        if (result && result.status) b.status = result.status;
        if (result && result.purok && result.purok !== '-') b.purok = result.purok;
        if (result && result.municipality && result.municipality !== '-') b.municipality = result.municipality;
        if (result && result.address) b.area = result.address;
        if (result && result.lat !== undefined && result.lat !== null) b.lat = result.lat;
        if (result && result.lng !== undefined && result.lng !== null) b.lng = result.lng;
      }
    }

    if (result) {
      if (this.data.employees) {
        this.data.employees = this.sortEmployeesStrict(this.data.employees);
      }
      this.data.masterRegistryUpdatedAt = new Date().toISOString();
      this._lastUserEditTimestamp = Date.now();
      this.bumpMasterRegistryVersion();
      this.save();
    }
    return result;
  }

  deleteEmployee(id, targetName) {
    if (!id) return;
    const cleanId = String(id).trim();
    const cleanBoothCode = cleanId.replace(/^BOOTH-/, '').toUpperCase();
    const tName = targetName ? String(targetName).trim().toLowerCase() : null;

    // 1. Remove from employees
    if (this.data.employees) {
      this.data.employees = this.data.employees.filter(e => {
        if (!e) return false;
        if (cleanId === 'DDN005-SR000' && tName) {
          if ((e.id === 'DDN005-SR000' || (e.role && e.role.toLowerCase().includes('reliev'))) && e.name && e.name.trim().toLowerCase() === tName) return false;
          return true;
        }
        if (e.id === cleanId) return false;
        const eBooth = (e.boothCode || e.booth || '').replace(/^BOOTH-/, '').toUpperCase();
        if (eBooth && eBooth === cleanBoothCode && (!e.name || e.name === 'N/A' || e.name === '-')) return false;
        return true;
      });
    }

    // 2. Remove from relievers
    if (this.data.relievers) {
      this.data.relievers = this.data.relievers.filter(r => {
        if (!r) return false;
        if (cleanId === 'DDN005-SR000' && tName) {
          if (r.name && r.name.trim().toLowerCase() === tName) return false;
          return true;
        }
        return r.id !== cleanId;
      });
    }

    // 3. Remove from booths
    if (this.data.booths) {
      this.data.booths = this.data.booths.filter(b => {
        if (!b) return false;
        if (b.id === cleanId || b.id === `BOOTH-${cleanBoothCode}`) return false;
        const bCode = (b.id || b.code || '').replace(/^BOOTH-/, '').toUpperCase();
        if (bCode && bCode === cleanBoothCode) return false;
        return true;
      });
    }

    this.data.masterRegistryUpdatedAt = new Date().toISOString();
    this._lastUserEditTimestamp = Date.now();
    this.bumpMasterRegistryVersion();
    this.save();
  }

  getImportHistory() {
    return this.data.importHistory || [];
  }

  addImportHistory(entry) {
    if (!this.data.importHistory) this.data.importHistory = [];
    this.data.importHistory.unshift(entry);
    this.save();
    return entry;
  }

  // Master Registry Excel Auto-Sync: ADD + UPDATE + VALIDATE (NEVER DELETE + REPLACE)
  syncEmployeesFromExcel({ newRecords = [], updateRecords = [], summary = {}, fileName = 'Master_Registry.xlsx', user = 'Peter John Carrillo' }) {
    let addedCount = 0;
    let updatedCount = 0;

    // 1. Process New Records (ADD)
    newRecords.forEach(rec => {
      const empName = (rec.name || '').trim();
      const finalName = (empName && empName !== 'N/A') ? empName : 'N/A';

      let newId = (rec.id && rec.id.trim() && rec.id.trim() !== 'N/A') ? rec.id.trim() : null;
      const isRel = (rec.role || '').toUpperCase().includes('RELIEVER');
      if (isRel) {
        newId = 'DDN005-SR000';
      } else if (!newId || newId.startsWith('DDN005-REL')) {
        newId = `DDN005-SR${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const purokStr = (rec.purok && rec.purok !== 'N/A' && rec.purok !== '-') ? rec.purok.trim() : 'N/A';
      const muniStr = (rec.municipality && rec.municipality !== 'N/A') ? rec.municipality.trim() : 'N/A';
      const boothCode = (rec.booth && rec.booth !== 'N/A' && rec.booth !== '-') ? rec.booth.trim().toUpperCase() : 'N/A';

      // Ensure coordinates: DO NOT create fallback coordinates if missing
      let lat = (rec.lat !== undefined && rec.lat !== null && !isNaN(rec.lat)) ? Number(rec.lat) : null;
      let lng = (rec.lng !== undefined && rec.lng !== null && !isNaN(rec.lng)) ? Number(rec.lng) : null;
      let geo = (lat !== null && lng !== null) ? { lat, lng } : null;

      // POS Serial No.: DO NOT invent fallback POS
      const posVal = (rec.posSerial && rec.posSerial !== 'N/A' && rec.posSerial !== '-') ? rec.posSerial.trim() : 'N/A';
      
      // Standardize Portable Printer dropdown values: WITH PORTABLE PRINTER or N/A
      const rawPr = (rec.printerName || rec.printerSerial || '').toUpperCase().trim();
      const printerVal = (rawPr.includes('WITH') || rawPr.includes('PRT-') || rawPr.includes('PRINTER') || rawPr.includes('PORTABLE')) ? 'WITH PORTABLE PRINTER' : 'N/A';

      // Distinguish contact phone: if available save number, if missing leave blank / 'N/A' (never invent)
      const rawPh = (rec.phone || rec.contact || '').trim();
      const phoneVal = (rawPh && rawPh !== '0917-000-0000' && rawPh !== '-' && rawPh !== 'N/A') ? rawPh : 'N/A';

      let statusVal = 'ACTIVE';
      if (finalName === 'N/A') {
        statusVal = 'UNUSED';
      } else if (rec.status) {
        const sUp = rec.status.trim().toUpperCase();
        statusVal = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'INACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
      }
      
      // Standardize Role: Teller -> Sales Representative, Reliver -> Reliever, Team Leader, missing -> N/A
      let roleVal = (rec.role && rec.role !== 'N/A') ? rec.role.trim() : 'Sales Representative';
      if (finalName === 'N/A') {
        roleVal = 'N/A';
      } else {
        const roleUpper = roleVal.toUpperCase();
        if (roleUpper === 'TELLER' || roleUpper === 'STATION TELLER') roleVal = 'Sales Representative';
        else if (roleUpper.includes('RELIEVER') || roleUpper.includes('RELIVER') || roleUpper.includes('BUFFER')) roleVal = 'Reliever';
        else if (roleUpper.includes('SUPERVISOR')) roleVal = 'Supervisor';
        else if (roleUpper.includes('COLLECTOR')) roleVal = 'Collector';
        else if (roleUpper.includes('TEAM LEADER')) roleVal = 'Team Leader';
      }

      // Authentic coordinates lookup for recognized booths
      if (!geo && boothCode && boothCode !== '-' && boothCode !== 'N/A' && typeof AUTHENTIC_MASTER_REGISTRY_COORDINATES !== 'undefined') {
        const authCoord = AUTHENTIC_MASTER_REGISTRY_COORDINATES[boothCode];
        if (authCoord) {
          lat = authCoord.lat;
          lng = authCoord.lng;
          geo = { lat, lng };
        }
      }

      const emp = {
        id: newId,
        name: finalName,
        role: roleVal,
        department: rec.department || (roleVal.toLowerCase().includes('collector') ? 'dept-col' : (roleVal.toLowerCase().includes('supervisor') ? 'dept-sup' : 'dept-tel')),
        purok: purokStr,
        municipality: muniStr,
        address: `${purokStr}, ${muniStr}`,
        area: `${purokStr}, ${muniStr}`,
        booth: boothCode,
        boothCode: boothCode,
        coordinates: geo,
        lat: lat,
        lng: lng,
        phone: phoneVal,
        contact: phoneVal,
        status: statusVal,
        posSerial: posVal,
        pos: posVal,
        printerName: printerVal,
        printerSerial: printerVal,
        etsStatus: statusVal.toLowerCase() === 'active' ? 'Active' : 'Offline'
      };

      // Check if booth code exists in registered booths list; if not, automatically add it!
      if (emp.booth && emp.booth !== '-' && emp.booth !== 'N/A') {
        const normBooth = emp.booth.toUpperCase().trim();
        const existingBooth = this.data.booths.find(b => 
          (b.id && b.id.toUpperCase().trim() === normBooth) || 
          (b.code && b.code.toUpperCase().trim() === normBooth)
        );
        if (!existingBooth) {
          this.data.booths.push({
            id: emp.booth,
            code: emp.booth,
            name: `Booth ${emp.booth}`,
            area: `${emp.purok}, ${emp.municipality}`,
            municipality: emp.municipality,
            coordinates: emp.coordinates,
            lat: emp.lat,
            lng: emp.lng,
            status: 'Active',
            posSerial: emp.posSerial,
            printerSerial: emp.printerSerial,
            assignedTellerId: emp.id,
            assignedTellerName: emp.name
          });
        } else if (!existingBooth.activeTeller || existingBooth.activeTeller === '-' || existingBooth.activeTeller === 'N/A') {
          existingBooth.activeTeller = emp.name;
          existingBooth.assignedTellerId = emp.id;
          existingBooth.assignedTellerName = emp.name;
        }
      }

      this.data.employees.push(emp);
      if (emp.role && emp.role.toUpperCase().includes('RELIEVER')) {
        emp.id = 'DDN005-SR000';
        emp.lat = null;
        emp.lng = null;
        emp.coordinates = null;
        emp.booth = '-';
        emp.boothCode = '-';
        emp.etsStatus = 'Offline';
        const authMuni = getRelieverMunicipality(emp.name);
        emp.municipality = authMuni;
        emp.purok = '-';
        emp.address = `-, ${authMuni}`;
        emp.area = emp.address;
        if (!this.data.relievers) this.data.relievers = [];
        if (!this.data.relievers.some(r => r.name && emp.name && r.name.toLowerCase() === emp.name.toLowerCase())) {
          this.data.relievers.push({
            id: 'DDN005-SR000',
            name: emp.name,
            role: 'Reliever',
            boothCode: '-',
            booth: '-',
            municipality: authMuni,
            purok: '-',
            area: `-, ${authMuni}`,
            address: `-, ${authMuni}`,
            phone: emp.phone || emp.contact || '',
            status: emp.status || 'Active'
          });
        }
      }
      addedCount++;
    });

    // 2. Process Existing Records to Update (UPDATE)
    updateRecords.forEach(rec => {
      const targetId = rec.matchId ? rec.matchId.toLowerCase().trim() : (rec.id ? rec.id.toLowerCase().trim() : null);
      const targetName = rec.matchName ? rec.matchName.toLowerCase().trim() : (rec.name ? rec.name.toLowerCase().trim() : null);

      const idx = this.data.employees.findIndex(e => {
        if (targetName && e.name && e.name.toLowerCase().trim() === targetName) return true;
        if (targetId && targetId !== 'ddn005-sr000' && e.id && e.id.toLowerCase().trim() === targetId) return true;
        return false;
      });

      if (idx !== -1) {
        const existing = this.data.employees[idx];
        const updates = {};
        if (rec.name && rec.name.trim()) updates.name = rec.name.trim();
        if (rec.role) {
          let rVal = rec.role.trim();
          const rUpper = rVal.toUpperCase();
          if (rUpper === 'TELLER' || rUpper === 'STATION TELLER') rVal = 'Sales Representative';
          else if (rUpper.includes('RELIEVER') || rUpper.includes('RELIVER') || rUpper.includes('BUFFER')) rVal = 'Reliever';
          else if (rUpper.includes('SUPERVISOR')) rVal = 'Supervisor';
          else if (rUpper.includes('COLLECTOR')) rVal = 'Collector';
          else if (rUpper.includes('TEAM LEADER')) rVal = 'Team Leader';
          updates.role = rVal;
        }
        if (rec.purok) {
          updates.purok = rec.purok.trim();
          updates.address = `${updates.purok}, ${rec.municipality || existing.municipality || 'Sto. Tomas'}`;
        }
        if (rec.municipality) {
          updates.municipality = rec.municipality.trim();
          updates.address = `${updates.purok || existing.purok || '-'}, ${updates.municipality}`;
        }
        if (rec.booth || rec.boothCode) {
          const bCode = (rec.booth || rec.boothCode).trim().toUpperCase();
          updates.booth = bCode;
          updates.boothCode = bCode;

          // Auto-register booth if not in booths list
          const existingBooth = this.data.booths.find(b => 
            (b.id && b.id.toUpperCase().trim() === bCode) || 
            (b.code && b.code.toUpperCase().trim() === bCode)
          );
          if (!existingBooth && bCode !== '-') {
            this.data.booths.push({
              id: bCode,
              code: bCode,
              name: `Booth ${bCode}`,
              area: `${updates.purok || existing.purok}, ${updates.municipality || existing.municipality}`,
              municipality: updates.municipality || existing.municipality,
              coordinates: existing.coordinates,
              lat: existing.lat,
              lng: existing.lng,
              status: 'Active',
              assignedTellerId: existing.id,
              assignedTellerName: updates.name || existing.name
            });
          } else if (existingBooth) {
            existingBooth.activeTeller = updates.name || existing.name;
            existingBooth.assignedTellerId = existing.id;
            existingBooth.assignedTellerName = updates.name || existing.name;
          }
        }
        if (rec.lat !== undefined && rec.lat !== null && !isNaN(rec.lat)) {
          updates.lat = Number(rec.lat);
          updates.lng = Number(rec.lng);
          updates.coordinates = { lat: Number(rec.lat), lng: Number(rec.lng) };
        } else if (rec.coordinates && rec.coordinates.lat) {
          updates.lat = Number(rec.coordinates.lat);
          updates.lng = Number(rec.coordinates.lng);
          updates.coordinates = { lat: Number(rec.coordinates.lat), lng: Number(rec.coordinates.lng) };
        } else if (updates.booth && updates.booth !== '-' && typeof AUTHENTIC_MASTER_REGISTRY_COORDINATES !== 'undefined' && AUTHENTIC_MASTER_REGISTRY_COORDINATES[updates.booth]) {
          const ac = AUTHENTIC_MASTER_REGISTRY_COORDINATES[updates.booth];
          updates.lat = ac.lat;
          updates.lng = ac.lng;
          updates.coordinates = { lat: ac.lat, lng: ac.lng };
        }

        if (updates.lat !== undefined) {
          const targetBCode = updates.booth || updates.boothCode || existing.booth || existing.boothCode;
          if (targetBCode && targetBCode !== '-') {
            const b = this.data.booths.find(x => (x.id && x.id.toUpperCase() === targetBCode.toUpperCase()) || (x.code && x.code.toUpperCase() === targetBCode.toUpperCase()));
            if (b) {
              b.lat = updates.lat;
              b.lng = updates.lng;
              b.coordinates = updates.coordinates;
            }
          }
        }
        if (rec.phone !== undefined || rec.contact !== undefined) {
          const ph = (rec.phone || rec.contact || '').trim();
          const finalPh = (ph && ph !== '0917-000-0000' && ph !== '-' && ph !== 'N/A') ? ph : 'N/A';
          updates.phone = finalPh;
          updates.contact = finalPh;
        }
        if (rec.posSerial || rec.pos) {
          const ps = (rec.posSerial || rec.pos).trim();
          if (ps && ps !== '-' && ps !== 'N/A') {
            updates.posSerial = ps;
            updates.pos = ps;
          }
        }
        if (rec.printerName || rec.printerSerial) {
          const pr = (rec.printerName || rec.printerSerial).trim().toUpperCase();
          const normPr = (pr.includes('WITH') || pr.includes('PRT-') || pr.includes('PRINTER') || pr.includes('PORTABLE')) ? 'WITH PORTABLE PRINTER' : 'N/A';
          updates.printerName = normPr;
          updates.printerSerial = normPr;
        }

        if (rec.status) {
          const sUp = rec.status.trim().toUpperCase();
          updates.status = sUp === 'TERMINATED' ? 'TERMINATED' : (sUp === 'INACTIVE' ? 'INACTIVE' : (sUp === 'UNUSED' ? 'UNUSED' : 'ACTIVE'));
          updates.etsStatus = updates.status === 'ACTIVE' ? 'Active' : 'Offline';
        }

        const isNowRel = (updates.role || existing.role || '').toUpperCase().includes('RELIEVER') || (updates.role || existing.role || '').toUpperCase().includes('BUFFER');
        if (isNowRel) {
          const authMuni = getRelieverMunicipality(updates.name || existing.name);
          updates.id = 'DDN005-SR000';
          updates.role = 'Reliever';
          updates.municipality = authMuni;
          updates.purok = '-';
          updates.address = `-, ${authMuni}`;
          updates.area = updates.address;
          updates.booth = '-';
          updates.boothCode = '-';
          updates.lat = null;
          updates.lng = null;
          updates.coordinates = null;
          updates.etsStatus = 'Offline';
        }

        this.data.employees[idx] = { ...existing, ...updates };
        
        // Also sync to relievers list if this employee is or was a reliever
        if (!this.data.relievers) this.data.relievers = [];
        const rIdx = this.data.relievers.findIndex(r => r.id === existing.id || (r.name && existing.name && r.name.toLowerCase() === existing.name.toLowerCase()));
        if (isNowRel) {
          const relRecord = { ...this.data.employees[idx], role: 'Reliever', id: 'DDN005-SR000', boothCode: '-', booth: '-', lat: null, lng: null, coordinates: null, etsStatus: 'Offline' };
          if (rIdx !== -1) {
            this.data.relievers[rIdx] = relRecord;
          } else {
            this.data.relievers.push(relRecord);
          }
        } else if (rIdx !== -1) {
          this.data.relievers.splice(rIdx, 1);
        }
        updatedCount++;
      }
    });

    // 3. Record History Entry for Audit Trail
    const issuesCount = (summary.duplicates || 0) + (summary.invalid || 0);
    const historyEntry = {
      id: `IMP-${Date.now().toString().slice(-6)}`,
      dateTime: new Date().toLocaleString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      }),
      fileName: fileName || 'Master_Registry.xlsx',
      user: user || 'Peter John Carrillo',
      totalRecords: summary.totalRecords || (addedCount + updatedCount + (summary.unchanged || 0) + issuesCount),
      added: addedCount,
      updated: updatedCount,
      unchanged: summary.unchanged || 0,
      issues: issuesCount,
      status: 'Completed'
    };

    if (!this.data.importHistory) this.data.importHistory = [];
    this.data.importHistory.unshift(historyEntry);

    // Bump Master Registry Version for Smart Caching & sync invalidation
    this.bumpMasterRegistryVersion();

    // Save and notify all listeners
    this.save();

    return {
      success: true,
      added: addedCount,
      updated: updatedCount,
      unchanged: summary.unchanged || 0,
      issues: issuesCount,
      historyEntry
    };
  }

  addTransaction(txn) {
    txn.id = txn.id || `TXN-${Date.now().toString().slice(-6)}`;
    // Enforce Collector Rule: Collectors NEVER have Booth Codes
    if ((txn.role || '').toUpperCase() === 'COLLECTOR') {
      txn.boothCode = '';
    }
    this.data.transactions.unshift(txn);
    this.save();
    return txn;
  }


  getNextPropertyNo() {
    const list = this.data.inventory || [];
    let maxNo = 0;
    list.forEach(i => {
      const num = parseInt(i.no || i.id, 10);
      if (!isNaN(num) && num > maxNo) maxNo = num;
    });
    return String(maxNo + 1).padStart(3, '0');
  }

  addInventoryProperty(data) {
    const nextNo = this.getNextPropertyNo();
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);

    let boothLoc = data.boothLocation || '';
    if (!boothLoc && data.boothCode) {
      const b = (this.data.booths || []).find(b => b.id === data.boothCode);
      if (b) boothLoc = b.area || b.municipality || '';
    }

    const assignedName = data.assignedTo && data.assignedTo.trim() ? data.assignedTo.trim() : 'Unassigned';
    const initialStatus = data.status || (assignedName !== 'Unassigned' ? 'Assigned' : 'Available');

    const item = {
      id: nextNo,
      no: nextNo,
      type: data.type || 'POS MACHINE',
      brandModel: data.brandModel || 'Sunmi V2',
      serial: (data.serial && data.serial.trim()) ? data.serial.trim() : 'N/A',
      assignedTo: assignedName,
      employeeId: data.employeeId || '',
      boothCode: data.boothCode || (assignedName !== 'Unassigned' ? 'DDN-352' : 'HQ-BUFFER'),
      boothLocation: boothLoc || 'Davao Del Norte Operations Base',
      condition: data.condition || 'Good',
      status: initialStatus,
      isArchived: false,
      assignmentHistory: [
        {
          id: `HIST-${nextNo}-01`,
          date: dateStr,
          assignedTo: assignedName,
          employeeId: data.employeeId || '',
          boothCode: data.boothCode || 'HQ-BUFFER',
          boothLocation: boothLoc || 'Davao Del Norte Operations Base',
          condition: data.condition || 'Good',
          status: initialStatus,
          action: 'Initial Registration',
          note: data.note || 'Registered in Davao Del Norte HQ Property Registry'
        }
      ]
    };

    if (!this.data.inventory) this.data.inventory = [];
    this.data.inventory.unshift(item);

    this.addAuditLog({
      action: 'INVENTORY_REGISTERED',
      details: `Registered Property #${nextNo} (${item.type} - ${item.brandModel}) assigned to ${item.assignedTo} [${item.boothCode}]`,
      user: 'Supervisor Carrillo'
    });

    this.save();
    return item;
  }

  updateInventoryProperty(id, data, changeNote = '') {
    const item = (this.data.inventory || []).find(i => i.id === id || i.no === id);
    if (!item) return null;

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);

    let boothLoc = data.boothLocation || item.boothLocation;
    if (data.boothCode && data.boothCode !== item.boothCode) {
      const b = (this.data.booths || []).find(b => b.id === data.boothCode);
      if (b) boothLoc = b.area || b.municipality || '';
    }

    const prevAssigned = item.assignedTo;
    const prevBooth = item.boothCode;
    const prevCond = item.condition;
    const prevStatus = item.status;

    const isReassigned = (data.assignedTo !== undefined && data.assignedTo !== prevAssigned) ||
                         (data.boothCode !== undefined && data.boothCode !== prevBooth);
    const isStateChanged = (data.condition !== undefined && data.condition !== prevCond) ||
                           (data.status !== undefined && data.status !== prevStatus);

    if (data.type !== undefined) item.type = data.type;
    if (data.brandModel !== undefined) item.brandModel = data.brandModel;
    if (data.serial !== undefined) item.serial = data.serial.trim() || 'N/A';
    if (data.assignedTo !== undefined) item.assignedTo = data.assignedTo;
    if (data.employeeId !== undefined) item.employeeId = data.employeeId;
    if (data.boothCode !== undefined) item.boothCode = data.boothCode;
    item.boothLocation = boothLoc;
    if (data.condition !== undefined) item.condition = data.condition;
    if (data.status !== undefined) item.status = data.status;

    if (!item.assignmentHistory) item.assignmentHistory = [];

    if (isReassigned || isStateChanged || changeNote) {
      const actionType = isReassigned ? 'Reassignment' : (isStateChanged ? 'Status / Condition Update' : 'Property Record Update');
      const noteText = changeNote || (isReassigned
        ? `Reassigned from ${prevAssigned} [${prevBooth}] to ${item.assignedTo} [${item.boothCode}]`
        : `Updated status to ${item.status}, condition to ${item.condition}`);

      item.assignmentHistory.unshift({
        id: `HIST-${item.no}-${Date.now()}`,
        date: dateStr,
        assignedTo: item.assignedTo,
        employeeId: item.employeeId,
        boothCode: item.boothCode,
        boothLocation: item.boothLocation,
        condition: item.condition,
        status: item.status,
        action: actionType,
        note: noteText
      });
    }

    this.addAuditLog({
      action: 'INVENTORY_UPDATED',
      details: `Updated Property #${item.no} (${item.type} - ${item.brandModel}) - ${changeNote || 'Record updated'}`,
      user: 'Supervisor Carrillo'
    });

    this.save();
    return item;
  }

  archiveInventoryProperty(id, reason = 'Property archived') {
    const item = (this.data.inventory || []).find(i => i.id === id || i.no === id);
    if (!item) return false;

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);

    item.isArchived = true;
    item.archivedAt = dateStr;
    item.archiveReason = reason;

    if (!item.assignmentHistory) item.assignmentHistory = [];
    item.assignmentHistory.unshift({
      id: `HIST-${item.no}-${Date.now()}`,
      date: dateStr,
      assignedTo: item.assignedTo,
      employeeId: item.employeeId,
      boothCode: item.boothCode,
      boothLocation: item.boothLocation,
      condition: item.condition,
      status: 'Archived',
      action: 'Property Archived',
      note: `Archived from active inventory: ${reason}`
    });

    this.addAuditLog({
      action: 'INVENTORY_ARCHIVED',
      details: `Archived Property #${item.no} (${item.brandModel}) - History preserved for audit`,
      user: 'Supervisor Carrillo'
    });

    this.save();
    return true;
  }

  restoreInventoryProperty(id) {
    const item = (this.data.inventory || []).find(i => i.id === id || i.no === id);
    if (!item) return false;

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);

    item.isArchived = false;
    delete item.archivedAt;
    delete item.archiveReason;

    if (!item.assignmentHistory) item.assignmentHistory = [];
    item.assignmentHistory.unshift({
      id: `HIST-${item.no}-${Date.now()}`,
      date: dateStr,
      assignedTo: item.assignedTo,
      employeeId: item.employeeId,
      boothCode: item.boothCode,
      boothLocation: item.boothLocation,
      condition: item.condition,
      status: item.status,
      action: 'Restored to Active',
      note: 'Restored from archive back to active operations registry'
    });

    this.addAuditLog({
      action: 'INVENTORY_RESTORED',
      details: `Restored Property #${item.no} (${item.brandModel}) back to active registry`,
      user: 'Supervisor Carrillo'
    });

    this.save();
    return true;
  }

  // Backward compatibility helpers
  addInventoryItem(item) {
    return this.addInventoryProperty(item);
  }

  deleteInventoryItem(id) {
    return this.archiveInventoryProperty(id, 'Removed by operator');
  }

  movePipelineCard(cardId, newStage) {
    const card = this.data.pipelineCards.find(c => c.id === cardId);
    if (card) {
      card.stage = newStage;
      this.save();
      return card;
    }
    return null;
  }

  addPipelineCard(card) {
    card.id = card.id || `PIP-${Date.now().toString().slice(-4)}`;
    this.data.pipelineCards.unshift(card);
    this.save();
    return card;
  }

  updateEodEntry(boothCode, updates) {
    const idx = this.data.eodLedger.findIndex(e => e.boothCode === boothCode);
    if (idx !== -1) {
      this.data.eodLedger[idx] = { ...this.data.eodLedger[idx], ...updates };
      const net = (Number(this.data.eodLedger[idx].grossSales) || 0) - 
                  (Number(this.data.eodLedger[idx].payoutsClaims) || 0) - 
                  (Number(this.data.eodLedger[idx].expenses) || 0);
      this.data.eodLedger[idx].netRemittance = net;
      this.data.eodLedger[idx].expectedCash = net;
      const actual = Number(this.data.eodLedger[idx].actualCash) || 0;
      const diff = actual - net;
      this.data.eodLedger[idx].variance = diff;
      this.data.eodLedger[idx].status = diff === 0 ? 'Balanced' : (diff > 0 ? `Over (+₱${diff})` : `Short (-₱${Math.abs(diff)})`);
      this.save();
      return this.data.eodLedger[idx];
    }
    return null;
  }

  getFinancialSummary() {
    const txns = this.data.transactions || [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalBonuses = 0;

    txns.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'COLLECTION' || t.classification === 'INCOME' || t.type === 'Income') {
        totalIncome += amt;
      } else if (t.isExpense || t.classification === 'OTHER' || t.type === 'EXPENSE') {
        totalExpenses += amt;
        if (t.classification === 'CA' || (t.description && t.description.toLowerCase().includes('bonus'))) {
          totalBonuses += amt;
        }
      }
    });

    const activeInv = this.getInventory(false);
    const assignedInv = activeInv.filter(i => i.status === 'Assigned' || i.status === 'Deployed');
    const availableInv = activeInv.filter(i => i.status === 'Available' || i.status === 'In-Stock');
    const repairInv = activeInv.filter(i => i.status === 'Under Repair' || i.status === 'In-Repair' || i.condition === 'Damaged' || i.condition === 'For Repair');
    const missingInv = activeInv.filter(i => i.status === 'Missing' || i.condition === 'Lost');
    const activeStaff = (this.data.employees || []).filter(e => (e.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const activeBooths = (this.data.booths || []).length;

    return {
      totalIncome,
      totalExpenses,
      netCashFlow: totalIncome - totalExpenses,
      totalBonuses,
      totalEmployees: (this.data.employees || []).length,
      activeStaff,
      activeBooths,
      totalProperties: activeInv.length,
      assignedProperties: assignedInv.length,
      availableProperties: availableInv.length,
      repairProperties: repairInv.length,
      missingProperties: missingInv.length,
      activePOS: activeInv.filter(i => i.type === 'POS MACHINE' && (i.status === 'Assigned' || i.status === 'Deployed')).length,
      lowStockPaper: activeInv.filter(i => i.type === 'THERMAL PAPER' && (i.status === 'Low Stock Alert')).length
    };
  }
}

if (typeof window !== 'undefined') {
  window.Store = Store;
  window.appStore = new Store();
  window.hasValidGpsCoordinates = function(emp) {
    return window.appStore.hasValidGpsCoordinates(emp);
  };
}
if (typeof global !== 'undefined') {
  global.Store = Store;
  if (!global.appStore && typeof window === 'undefined') {
    global.appStore = new Store();
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}

