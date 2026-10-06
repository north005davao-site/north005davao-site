/**
 * NORTH-005 OmniERP — Employee Tracking System (ETS) & GIS Map Engine
 * Precision STL BOOTH Geolocation & Live Master Registry GPS Mapping
 */

(function () {
  'use strict';

  // Centralized Municipality -> Color Mapping Configuration (Section 7 & 8)
  // Panabo City = GREEN, Sto. Tomas = YELLOW, Carmen = RED, Kapalong = BLUE, Tagum City = PURPLE, Talaingod = PINK, Samal = CYAN
  const DEFAULT_MUNICIPALITY_COLORS = {
    'Panabo City': '#10b981',  // GREEN
    'Panabo': '#10b981',
    'Sto. Tomas': '#eab308',   // YELLOW
    'Santo Tomas': '#eab308',
    'Carmen': '#ef4444',       // RED
    'Kapalong': '#3b82f6',     // BLUE
    'Tagum City': '#8b5cf6',   // PURPLE
    'Tagum': '#8b5cf6',
    'Talaingod': '#ec4899',    // PINK
    'Samal': '#06b6d4',        // CYAN
    'Island Garden City of Samal': '#06b6d4',
    'Asuncion': '#f97316',     // ORANGE
    'New Corella': '#14b8a6',  // TEAL
    'San Isidro': '#6366f1',   // INDIGO
    'Braulio E. Dujali': '#84cc16' // LIME
  };

  const MUNICIPALITY_FALLBACK_PALETTE = [
    '#10b981', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#d97706', '#059669'
  ];

  function getStoredMunicipalityColorMap() {
    try {
      const raw = localStorage.getItem('NORTH005_MUNI_COLORS');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse stored muni colors', e);
    }
    return { ...DEFAULT_MUNICIPALITY_COLORS };
  }

  function saveMunicipalityColorMap(map) {
    try {
      localStorage.setItem('NORTH005_MUNI_COLORS', JSON.stringify(map));
    } catch (e) {
      console.warn('Could not persist muni colors', e);
    }
  }

  function resolveMunicipalityColor(muni) {
    if (!muni || muni === '-') return '#eab308';
    const cleanMuni = muni.trim();
    const map = getStoredMunicipalityColorMap();
    
    // Exact or case-insensitive match
    for (const [key, color] of Object.entries(map)) {
      if (key.toLowerCase() === cleanMuni.toLowerCase()) {
        return color;
      }
    }

    // Substring match (e.g. "Panabo" in "Panabo City")
    for (const [key, color] of Object.entries(map)) {
      if (cleanMuni.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(cleanMuni.toLowerCase())) {
        map[cleanMuni] = color;
        saveMunicipalityColorMap(map);
        return color;
      }
    }

    const usedColors = Object.values(map);
    const available = MUNICIPALITY_FALLBACK_PALETTE.find(c => !usedColors.includes(c)) || '#64748b';
    map[cleanMuni] = available;
    saveMunicipalityColorMap(map);
    return available;
  }

  /**
   * Helper: Normalize Booth Code to canonical "DDN-xxx" format.
   * Returns null for non-booth values ('-', 'N/A', empty, etc.) so roaming collectors/admins are excluded.
   */
  function normalizeBoothCode(code) {
    if (!code || typeof code !== 'string') return null;
    const trimmed = code.trim().toUpperCase();
    if (trimmed === '-' || trimmed === 'N/A' || trimmed === 'NONE' || trimmed === '' || trimmed === 'UNASSIGNED') {
      return null;
    }
    // Remove "BOOTH-" or "BOOTH " prefix
    let clean = trimmed.replace(/^BOOTH[\s-]*/i, '');
    // Normalize "DDN 760" or "DDN_760" -> "DDN-760"
    clean = clean.replace(/^DDN[\s_]+(\d+)/i, 'DDN-$1');
    // If digits only like "760", convert to "DDN-760"
    if (/^\d+$/.test(clean)) {
      clean = `DDN-${clean}`;
    }
    return clean;
  }

  /**
   * Robust GPS Coordinate Parser
   * Supports: numbers, string pairs ("7.5303, 125.6264"), latitude/longitude, lat/lng objects, arrays [lat, lng]
   * Enforces: Latitude = first coordinate, Longitude = second coordinate
   * Detects and corrects inverted coordinates (e.g. [125.x, 7.x] -> [7.x, 125.x])
   * Validates: Plausible Davao del Norte geographic bounding box and global bounds (-90..90, -180..180)
   */
  function parseGpsCoordinates(record) {
    if (!record) return { isValid: false, reason: 'GPS UNAVAILABLE' };

    let rawLat = record.lat !== undefined && record.lat !== null && record.lat !== '' ? record.lat : record.latitude;
    let rawLng = record.lng !== undefined && record.lng !== null && record.lng !== '' ? record.lng : record.longitude;

    // Check record.coordinates if object, array, or string
    if ((rawLat === undefined || rawLng === undefined) && record.coordinates) {
      if (typeof record.coordinates === 'object' && record.coordinates !== null) {
        if (Array.isArray(record.coordinates) && record.coordinates.length >= 2) {
          rawLat = record.coordinates[0];
          rawLng = record.coordinates[1];
        } else {
          rawLat = record.coordinates.lat !== undefined ? record.coordinates.lat : record.coordinates.latitude;
          rawLng = record.coordinates.lng !== undefined ? record.coordinates.lng : record.coordinates.longitude;
        }
      } else if (typeof record.coordinates === 'string' && record.coordinates.trim()) {
        const parts = record.coordinates.trim().split(/[,;\s]+/).filter(Boolean);
        if (parts.length >= 2) {
          rawLat = parts[0];
          rawLng = parts[1];
        }
      }
    }

    // Check if GPS is provided as a composite string e.g. "7.5303, 125.6264"
    const composite = record.gps || record.gps_coordinates || record.gpsCoordinates || record.rawCoordinates || record.coordinatesStr;
    if ((rawLat === undefined || rawLng === undefined) && typeof composite === 'string' && composite.trim()) {
      const parts = composite.trim().split(/[,;\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        rawLat = parts[0];
        rawLng = parts[1];
      }
    }

    if (rawLat === undefined || rawLat === null || rawLat === '' || rawLng === undefined || rawLng === null || rawLng === '') {
      return { isValid: false, reason: 'GPS UNAVAILABLE' };
    }

    let lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat).replace(/[^\d.-]/g, ''));
    let lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng).replace(/[^\d.-]/g, ''));

    if (isNaN(lat) || isNaN(lng)) {
      return { isValid: false, reason: 'GPS INVALID' };
    }

    // Section 4: Coordinate Inversion Guard.
    // In Davao del Norte (Region XI, Philippines), Latitude is ~6.0°..9.0° N and Longitude is ~124.5°..127.0° E.
    // If coordinates were entered inverted as [longitude, latitude] e.g. [125.625, 7.524], lat is > 50 and lng is < 50.
    if (lat > 50 && lng < 50) {
      const temp = lat;
      lat = lng;
      lng = temp;
    }

    // Reject (0, 0) default coordinates
    if (lat === 0 && lng === 0) {
      return { isValid: false, reason: 'GPS INVALID (0,0)' };
    }

    // Global Latitude/Longitude Range Check
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { isValid: false, reason: 'GPS OUT OF GLOBAL BOUNDS' };
    }

    // Section 6: Plausibility bounds check for Davao del Norte region
    const isPlausibleDavao = (lat >= 6.0 && lat <= 9.0 && lng >= 124.5 && lng <= 127.0);
    if (!isPlausibleDavao) {
      console.warn(`[GPS Validation Warning] Coordinate (${lat}, ${lng}) is outside Davao del Norte corridor.`);
    }

    // Valid coordinate
    return {
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      isValid: true
    };
  }

  window.parseGpsCoordinates = parseGpsCoordinates;
  window.normalizeBoothCode = normalizeBoothCode;
  window.getMunicipalityColor = resolveMunicipalityColor;
  window.getMunicipalityColorMap = getStoredMunicipalityColorMap;

  class EtsMapEngine {
    constructor() {
      this.map = null;
      this.markers = {
        booths: L.layerGroup()
      };
      this.allMarkerInstances = {}; // mapped by boothCode and emp.id -> L.marker
      this.initialized = false;
      this.calibrationMode = false;
      this.calibrationTargetId = null;
    }

    init(containerId = 'ets-map-container') {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (this.initialized && this.map) {
        // Immediate and staggered invalidation to guarantee full tile rendering without gray zones
        this.invalidateMapSize();
        return;
      }

      // Center on Davao Del Norte (Tagum / Sto. Tomas / Panabo sector)
      const ddnCenter = [7.4475, 125.8078];
      this.map = L.map(containerId, {
        center: ddnCenter,
        zoom: 11,
        zoomControl: true,
        preferCanvas: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors | NORTH-005 Davao Del Norte HQ'
      }).addTo(this.map);

      // Add booth markers layer
      this.markers.booths.addTo(this.map);

      // Handle window resize events
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', () => {
          if (this.map) this.map.invalidateSize();
        });
      }

      // Pin calibration click listener
      this.map.on('click', (e) => {
        if (this.calibrationTargetId) {
          this.setCoordinateForTarget(this.calibrationTargetId, e.latlng.lat, e.latlng.lng);
        }
      });

      this.initialized = true;
      this.renderAllMarkers();
      this.invalidateMapSize();
    }

    invalidateMapSize() {
      if (!this.map) return;
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 50);
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 200);
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 450);
    }

    // Marker icon representing an STL BOOTH with municipality color
    createSvgIcon(color, glyphText = '🏪', isDraggable = false, title = 'STL BOOTH') {
      return L.divIcon({
        className: 'custom-ets-marker',
        html: `
          <div title="${title}" style="
            background: ${color};
            color: #ffffff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            border: 2px solid ${isDraggable ? '#f59e0b' : '#ffffff'};
            font-weight: 700;
            font-size: 13px;
            position: relative;
            cursor: ${isDraggable ? 'grab' : 'pointer'};
            ${isDraggable ? 'animation: pulse-border 1.5s infinite;' : ''}
          ">
            ${glyphText}
            <div style="
              position: absolute;
              bottom: -6px;
              left: 11px;
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 6px solid ${color};
            "></div>
          </div>
        `,
        iconSize: [34, 40],
        iconAnchor: [17, 40],
        popupAnchor: [0, -38]
      });
    }

    /**
     * Renders STL Booth markers deduplicated strictly by unique Booth Code.
     * Uses real Master Registry coordinates only.
     * Never plots collectors/admin (boothCode = '-') as booth markers.
     * Validates that Latitude is first and Longitude is second.
     */
    renderAllMarkers() {
      if (!this.map) return;
      const store = window.appStore;
      if (!store) return;

      this.markers.booths.clearLayers();
      this.allMarkerInstances = {};

      const registeredBooths = store.getBooths() || [];
      const employees = store.getEmployees() || [];
      const relievers = (store.data && store.data.relievers) || [];
      const allStaff = [...employees, ...relievers.filter(r => !employees.some(e => e.id === r.id))];
      const isDraggable = this.calibrationMode;
      const isAdmin = window.authManager && window.authManager.isAdmin();

      // Collect all distinct booths keyed strictly by normalized Booth Code
      const boothMap = new Map();

      // 1. Ingest Master Registry registered booths
      registeredBooths.forEach(b => {
        const normCode = normalizeBoothCode(b.id || b.code);
        if (!normCode) return; // Skip non-booth entries like '-'

        boothMap.set(normCode, {
          normBoothCode: normCode,
          rawBoothCode: b.id || b.code || normCode,
          boothRecord: b,
          municipality: b.municipality || '',
          address: b.area || b.address || '',
          status: b.status || 'Active',
          staffList: []
        });
      });

      // 2. Associate assigned personnel to booths by normalized Booth Code
      allStaff.forEach(emp => {
        const normCode = normalizeBoothCode(emp.boothCode || emp.booth);
        if (!normCode) return; // Skip collectors, admins, and unassigned roaming personnel

        if (!boothMap.has(normCode)) {
          boothMap.set(normCode, {
            normBoothCode: normCode,
            rawBoothCode: emp.boothCode || emp.booth || normCode,
            boothRecord: null,
            municipality: emp.municipality || '',
            address: emp.address || emp.area || emp.purok || '',
            status: emp.status || 'Active',
            staffList: [emp]
          });
        } else {
          const entry = boothMap.get(normCode);
          if (!entry.staffList.some(s => s.id === emp.id)) {
            entry.staffList.push(emp);
          }
          if (!entry.municipality && emp.municipality) entry.municipality = emp.municipality;
          if (!entry.address && (emp.address || emp.area)) entry.address = emp.address || emp.area;
        }
      });

      const bounds = [];
      const auditSummary = {
        totalMasterRegistryBooths: boothMap.size,
        recordsWithValidGps: 0,
        recordsWithInvalidGps: 0,
        recordsWithMissingGps: 0,
        estMarkersCreated: 0,
        estMarkersMissing: 0,
        validBoothCodes: [],
        missingBoothCodes: [],
        invalidBoothCodes: []
      };

      boothMap.forEach((entry, normBoothCode) => {
        // Resolve GPS Coordinates from the Master Registry records for this booth
        // Priority 1: Registered booth record in Master Registry
        let gps = { isValid: false };
        if (entry.boothRecord) {
          gps = parseGpsCoordinates(entry.boothRecord);
        }

        // Priority 2: Assigned staff records for this booth
        if (!gps.isValid && entry.staffList.length > 0) {
          for (const s of entry.staffList) {
            const altGps = parseGpsCoordinates(s);
            if (altGps.isValid) {
              gps = altGps;
              break;
            }
          }
        }

        // Section 11 & 12: If no valid GPS coordinates exist in Master Registry, DO NOT place on map!
        // Record and log the specific Booth Code for diagnostic tracking
        if (!gps.isValid) {
          if (gps.reason && (gps.reason.includes('INVALID') || gps.reason.includes('BOUNDS'))) {
            auditSummary.recordsWithInvalidGps++;
            auditSummary.invalidBoothCodes.push(normBoothCode);
          } else {
            auditSummary.recordsWithMissingGps++;
            auditSummary.missingBoothCodes.push(normBoothCode);
          }
          auditSummary.estMarkersMissing++;
          console.warn(`[ETS GPS Audit] Booth: ${normBoothCode} - GPS: Missing / Invalid (${gps.reason || 'UNAVAILABLE'}). Marker: Not rendered.`);
          return;
        }

        auditSummary.recordsWithValidGps++;
        auditSummary.estMarkersCreated++;
        auditSummary.validBoothCodes.push(normBoothCode);

        const lat = gps.lat;
        const lng = gps.lng;
        bounds.push([lat, lng]);

        // Resolve Municipality
        let muni = entry.municipality;
        if (!muni || muni === '-') {
          const addr = (entry.address || '').toLowerCase();
          if (addr.includes('panabo')) muni = 'Panabo City';
          else if (addr.includes('tomas') || addr.includes('tibal') || addr.includes('feeder')) muni = 'Sto. Tomas';
          else if (addr.includes('carmen')) muni = 'Carmen';
          else if (addr.includes('kapalong')) muni = 'Kapalong';
          else if (addr.includes('tagum')) muni = 'Tagum City';
          else if (addr.includes('talaingod')) muni = 'Talaingod';
          else if (addr.includes('samal')) muni = 'Samal';
          else muni = 'Sto. Tomas';
        }

        const color = resolveMunicipalityColor(muni);
        const boothDisplay = normBoothCode;
        const staffNames = entry.staffList.length > 0 ? entry.staffList.map(s => s.name).join(', ') : 'Unassigned';
        const staffDetails = entry.staffList.length > 0 ? entry.staffList.map(s => {
          let r = s.role || 'Staff';
          const rU = r.toUpperCase();
          if (rU === 'TELLER' || rU === 'STATION TELLER') r = 'Sales Representative';
          return `<div style="font-size:12px; color:var(--text-main); margin-bottom:2px;">• <strong>${s.name}</strong> <span style="color:#64748b; font-size:11px;">(${r})</span></div>`;
        }).join('') : '<div style="font-size:12px; color:#64748b; font-style:italic;">No staff currently assigned</div>';

        const icon = this.createSvgIcon(color, '🏪', isDraggable, `STL BOOTH: ${boothDisplay} (${muni})`);
        const marker = L.marker([lat, lng], {
          icon,
          draggable: isDraggable
        });

        marker.bindTooltip(`<strong>STL BOOTH:</strong> ${boothDisplay} • ${staffNames} (${muni})`, { direction: 'top' });

        const primaryStaffId = entry.staffList[0] ? entry.staffList[0].id : (entry.boothRecord ? entry.boothRecord.id : normBoothCode);
        let adminActions = '';
        if (isAdmin) {
          adminActions = `
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <button onclick="window.openPrecisionCalibrateModal('${primaryStaffId}')" style="flex: 1; padding: 6px 10px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11.5px; font-weight: 700;">
                ✏️ Recalibrate Pin
              </button>
            </div>
          `;
        }

        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 250px; line-height: 1.4;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; background: ${color}; color: #ffffff; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">
                STL BOOTH: ${boothDisplay}
              </span>
              <span style="font-size: 11.5px; font-weight: 700; color: ${color};">
                ● ${muni}
              </span>
            </div>
            <div style="margin-bottom: 6px; padding: 6px 8px; background: rgba(0,0,0,0.04); border-radius: 4px;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Assigned Personnel:</div>
              ${staffDetails}
            </div>
            <div style="font-size: 12px; margin-bottom: 3px;"><strong>Municipality:</strong> <span style="font-weight: 700; color: ${color};">${muni}</span></div>
            <div style="font-size: 12px; margin-bottom: 3px;"><strong>Location / Address:</strong> ${entry.address || '-'}</div>
            <div style="font-size: 12px; margin-bottom: 3px;"><strong>GPS Coordinates:</strong> <span style="font-family: monospace; font-weight: 700; color: #2563eb;">${lat.toFixed(6)}, ${lng.toFixed(6)}</span></div>
            <div style="font-size: 12px; margin-bottom: 4px;"><strong>Status:</strong> <span style="font-weight: 700; color: #16a34a;">● ${entry.status}</span></div>
            ${adminActions}
          </div>
        `);

        // Index marker under canonical normBoothCode, raw variations, and all associated personnel
        this.allMarkerInstances[normBoothCode] = marker;
        if (entry.rawBoothCode) this.allMarkerInstances[entry.rawBoothCode] = marker;
        this.allMarkerInstances[normBoothCode.replace('-', ' ')] = marker; // "DDN 754"
        this.allMarkerInstances[normBoothCode.replace('DDN-', '')] = marker; // "754"

        entry.staffList.forEach(s => {
          this.allMarkerInstances[s.id] = marker;
          if (s.name) this.allMarkerInstances[s.name.toLowerCase().trim()] = marker;
        });

        if (entry.boothRecord && entry.boothRecord.id) {
          this.allMarkerInstances[entry.boothRecord.id] = marker;
        }

        this.markers.booths.addLayer(marker);
      });

      this.lastAuditSummary = auditSummary;
      console.log(`[ETS GPS Audit Summary] Total Master Registry Booths: ${auditSummary.totalMasterRegistryBooths} | Valid GPS: ${auditSummary.recordsWithValidGps} | Missing GPS: ${auditSummary.recordsWithMissingGps} | Invalid GPS: ${auditSummary.recordsWithInvalidGps} | EST Markers Rendered: ${auditSummary.estMarkersCreated} | Missing Markers: ${auditSummary.estMarkersMissing}`);
    }

    // Draggable Calibration Mode
    toggleCalibrationMode() {
      this.calibrationMode = !this.calibrationMode;
      this.renderAllMarkers();

      const banner = document.getElementById('ets-calibration-banner');
      if (banner) {
        banner.style.display = this.calibrationMode ? 'flex' : 'none';
      }
    }

    focusCoordinates(lat, lng, zoom = 15) {
      if (!this.map) return;
      this.map.setView([lat, lng], zoom, { animate: true });
      this.invalidateMapSize();
    }
  }

  window.etsMap = new EtsMapEngine();
  window.getEtsGpsAuditReport = function() {
    return window.etsMap ? window.etsMap.lastAuditSummary : null;
  };

})();
