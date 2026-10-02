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
   * Robust GPS Coordinate Parser
   * Supports: numbers, string pairs ("7.5303, 125.6264"), latitude/longitude, lat/lng objects
   * Validates: -90 <= lat <= 90 and -180 <= lng <= 180
   */
  function parseGpsCoordinates(record) {
    if (!record) return { isValid: false, reason: 'GPS UNAVAILABLE' };

    let rawLat = record.lat !== undefined && record.lat !== null && record.lat !== '' ? record.lat : record.latitude;
    let rawLng = record.lng !== undefined && record.lng !== null && record.lng !== '' ? record.lng : record.longitude;

    if ((rawLat === undefined || rawLng === undefined) && record.coordinates) {
      rawLat = record.coordinates.lat !== undefined ? record.coordinates.lat : record.coordinates.latitude;
      rawLng = record.coordinates.lng !== undefined ? record.coordinates.lng : record.coordinates.longitude;
    }

    // Check if GPS is provided as a composite string e.g. "7.5303, 125.6264"
    const composite = record.gps || record.gps_coordinates || record.gpsCoordinates;
    if ((rawLat === undefined || rawLng === undefined) && typeof composite === 'string' && composite.trim()) {
      const parts = composite.split(/[,;\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        rawLat = parts[0];
        rawLng = parts[1];
      }
    }

    if (rawLat === undefined || rawLat === null || rawLat === '' || rawLng === undefined || rawLng === null || rawLng === '') {
      return { isValid: false, reason: 'GPS UNAVAILABLE' };
    }

    const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat).replace(/[^\d.-]/g, ''));
    const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng).replace(/[^\d.-]/g, ''));

    if (isNaN(lat) || isNaN(lng)) {
      return { isValid: false, reason: 'GPS INVALID' };
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { isValid: false, reason: 'GPS INVALID' };
    }

    // Coordinate is valid and within legitimate bounds
    return {
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      isValid: true
    };
  }

  window.parseGpsCoordinates = parseGpsCoordinates;
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
     * Renders STL Booth markers deduplicated by unique Booth Code.
     * Uses real Master Registry coordinates only.
     */
    renderAllMarkers() {
      if (!this.map) return;
      const store = window.appStore;
      if (!store) return;

      this.markers.booths.clearLayers();
      this.allMarkerInstances = {};

      const employees = store.getEmployees() || [];
      const relievers = (store.data && store.data.relievers) || [];
      const allStaff = [...employees, ...relievers.filter(r => !employees.some(e => e.id === r.id))];
      const isDraggable = this.calibrationMode;
      const isAdmin = window.authManager && window.authManager.isAdmin();

      // Group staff by unique Booth Code for deduplicated marker placement
      const boothMap = new Map();

      allStaff.forEach(emp => {
        const boothCode = (emp.boothCode || emp.booth || '').trim();
        const key = boothCode || emp.id;

        if (!boothMap.has(key)) {
          boothMap.set(key, {
            boothCode: boothCode || emp.id,
            municipality: emp.municipality || '',
            address: emp.address || emp.area || emp.purok || '',
            status: emp.status || 'Active',
            staffList: [emp],
            primaryRecord: emp
          });
        } else {
          const entry = boothMap.get(key);
          entry.staffList.push(emp);
          if (!entry.municipality && emp.municipality) entry.municipality = emp.municipality;
          if (!entry.address && (emp.address || emp.area)) entry.address = emp.address || emp.area;
        }
      });

      const bounds = [];

      boothMap.forEach((entry, boothKey) => {
        // Resolve GPS Coordinates from the Master Registry records for this booth
        let gps = parseGpsCoordinates(entry.primaryRecord);
        if (!gps.isValid) {
          // Check other assigned staff records for valid booth GPS
          for (const s of entry.staffList) {
            const altGps = parseGpsCoordinates(s);
            if (altGps.isValid) {
              gps = altGps;
              break;
            }
          }
        }

        // If no valid GPS coordinates exist in Master Registry, DO NOT place on map!
        if (!gps.isValid) {
          return;
        }

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
        const boothDisplay = entry.boothCode || boothKey;
        const staffNames = entry.staffList.map(s => s.name).join(', ');
        const staffDetails = entry.staffList.map(s => {
          let r = s.role || 'Staff';
          const rU = r.toUpperCase();
          if (rU === 'TELLER' || rU === 'STATION TELLER') r = 'Sales Representative';
          return `<div style="font-size:12px; color:var(--text-main); margin-bottom:2px;">• <strong>${s.name}</strong> <span style="color:#64748b; font-size:11px;">(${r})</span></div>`;
        }).join('');

        const icon = this.createSvgIcon(color, '🏪', isDraggable, `STL BOOTH: ${boothDisplay} (${muni})`);
        const marker = L.marker([lat, lng], {
          icon,
          draggable: isDraggable
        });

        marker.bindTooltip(`<strong>STL BOOTH:</strong> ${boothDisplay} • ${staffNames} (${muni})`, { direction: 'top' });

        let adminActions = '';
        if (isAdmin) {
          adminActions = `
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <button onclick="window.openPrecisionCalibrateModal('${entry.primaryRecord.id}')" style="flex: 1; padding: 6px 10px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11.5px; font-weight: 700;">
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

        // Index marker by boothCode and by all associated staff IDs for instant lookup on click
        this.allMarkerInstances[boothDisplay] = marker;
        this.allMarkerInstances[boothKey] = marker;
        entry.staffList.forEach(s => {
          this.allMarkerInstances[s.id] = marker;
          if (s.name) this.allMarkerInstances[s.name.toLowerCase().trim()] = marker;
        });

        this.markers.booths.addLayer(marker);
      });
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

})();
