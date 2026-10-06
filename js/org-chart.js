/**
 * =============================================================================
 * APEX OmniERP - Organizational Charts Module
 * Dynamic Hierarchical Leadership & Field Operations Structure
 * Single Source of Truth: Master Registry (appStore.data.employees)
 * =============================================================================
 */

(function(window) {
  'use strict';

  let currentSearchQuery = '';
  let currentMuniFilter = 'all';
  let currentRoleFilter = 'all';
  let currentViewMode = 'tree'; // 'tree' or 'grid'

  function isAdministrator(emp) {
    if (!emp) return false;
    const r = (emp.role || '').toUpperCase();
    const d = (emp.department || '').toLowerCase();
    return r.includes('ADMIN') || d === 'dept-admin' || d.includes('admin');
  }

  function isSupervisor(emp) {
    if (!emp) return false;
    if (isAdministrator(emp)) return false;
    const r = (emp.role || '').toUpperCase();
    const d = (emp.department || '').toLowerCase();
    return r.includes('SUPERVISOR') || r.includes('TEAM LEADER') || d === 'dept-sup' || d.includes('supervisor');
  }

  function isCollector(emp) {
    if (!emp) return false;
    if (isAdministrator(emp) || isSupervisor(emp)) return false;
    const r = (emp.role || '').toUpperCase();
    const d = (emp.department || '').toLowerCase();
    return r.includes('COLLECTOR') || d === 'dept-col' || d.includes('collector');
  }

  const OrgChartModule = {
    _initialized: false,

    init() {
      if (this._initialized) return;
      this._initialized = true;
      this.bindEvents();
    },

    bindEvents() {
      const searchInput = document.getElementById('org-chart-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          currentSearchQuery = (e.target.value || '').trim().toLowerCase();
          this.render();
        });
      }

      const muniSelect = document.getElementById('org-chart-filter-muni');
      if (muniSelect) {
        muniSelect.addEventListener('change', (e) => {
          currentMuniFilter = e.target.value;
          this.render();
        });
      }

      const roleSelect = document.getElementById('org-chart-filter-role');
      if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
          currentRoleFilter = e.target.value;
          this.render();
        });
      }
    },

    setViewMode(mode) {
      if (window.sfx) window.sfx.playClick();
      currentViewMode = mode;
      const btnTree = document.getElementById('org-btn-view-tree');
      const btnGrid = document.getElementById('org-btn-view-grid');
      if (btnTree && btnGrid) {
        if (mode === 'tree') {
          btnTree.classList.add('btn-primary');
          btnTree.classList.remove('btn-secondary');
          btnGrid.classList.add('btn-secondary');
          btnGrid.classList.remove('btn-primary');
        } else {
          btnGrid.classList.add('btn-primary');
          btnGrid.classList.remove('btn-secondary');
          btnTree.classList.add('btn-secondary');
          btnTree.classList.remove('btn-primary');
        }
      }
      this.render();
    },

    getHierarchyData() {
      const store = window.appStore;
      const allEmployees = (store && store.getEmployees) ? (store.getEmployees() || []) : [];

      // Filter authoritative organizational hierarchy groups
      let admins = allEmployees.filter(isAdministrator);
      let supervisors = allEmployees.filter(isSupervisor);
      let collectors = allEmployees.filter(isCollector);

      // Check registered accounts in authManager as authoritative secondary source
      if (window.authManager && typeof window.authManager.getUsers === 'function') {
        const users = window.authManager.getUsers() || [];
        users.forEach(u => {
          if (!u || u.status === 'Pending') return;
          const uRole = (u.role || '').toUpperCase();
          const uPos = (u.position || '').toUpperCase();
          const uDept = (u.department || '').toLowerCase();
          
          if (uRole.includes('ADMIN') || uPos.includes('ADMIN') || uDept.includes('admin')) {
            if (!admins.some(a => (a.id && a.id === u.employeeId) || (a.name && a.name.toLowerCase() === u.name.toLowerCase()))) {
              admins.push({
                id: u.employeeId || u.id,
                name: u.name,
                role: 'OPERATIONS ADMINISTRATOR',
                department: 'dept-admin',
                phone: u.phone || 'N/A',
                status: u.status || 'Active',
                municipality: 'HQ Tagum City Command Center',
                area: 'HQ Tagum City Command Center'
              });
            }
          } else if (uRole.includes('SUPERVISOR') || uPos.includes('SUPERVISOR') || uDept.includes('sup')) {
            if (!u.name.toUpperCase().includes('JUNDY') && !supervisors.some(s => (s.id && s.id === u.employeeId) || (s.name && s.name.toLowerCase() === u.name.toLowerCase()))) {
              supervisors.push({
                id: u.employeeId || u.id,
                name: u.name,
                role: 'SUPERVISOR',
                department: 'dept-sup',
                phone: u.phone || 'N/A',
                status: u.status || 'Active',
                municipality: 'Davao Del Norte Sector Command',
                area: 'Davao Del Norte Sector Command'
              });
            }
          } else if (uRole.includes('COLLECTOR') || uPos.includes('COLLECTOR') || uDept.includes('col')) {
            if (!collectors.some(c => (c.id && c.id === u.employeeId) || (c.name && c.name.toLowerCase() === u.name.toLowerCase()))) {
              collectors.push({
                id: u.employeeId || u.id,
                name: u.name,
                role: 'COLLECTOR',
                department: 'dept-col',
                phone: u.phone || 'N/A',
                status: u.status || 'Active',
                municipality: 'Field Route',
                area: 'Field Route'
              });
            }
          }
        });
      }

      // Explicitly purge any trace of unauthorized JUNDY
      admins = admins.filter(e => !e.name || !e.name.toUpperCase().includes('JUNDY'));
      supervisors = supervisors.filter(e => !e.name || !e.name.toUpperCase().includes('JUNDY'));
      collectors = collectors.filter(e => !e.name || !e.name.toUpperCase().includes('JUNDY'));

      const allOrg = [...admins, ...supervisors, ...collectors];

      return { admins, supervisors, collectors, allOrg };
    },

    matchesFilter(emp) {
      if (!emp) return false;

      // Municipality / Area Filter
      if (currentMuniFilter !== 'all') {
        const muni = (emp.municipality || emp.area || emp.address || '').toLowerCase();
        const target = currentMuniFilter.toLowerCase();
        if (!muni.includes(target)) return false;
      }

      // Role Filter
      if (currentRoleFilter !== 'all') {
        if (currentRoleFilter === 'admin' && !isAdministrator(emp)) return false;
        if (currentRoleFilter === 'supervisor' && !isSupervisor(emp)) return false;
        if (currentRoleFilter === 'collector' && !isCollector(emp)) return false;
      }

      // Search Filter
      if (currentSearchQuery) {
        const q = currentSearchQuery;
        const name = (emp.name || '').toLowerCase();
        const id = (emp.id || '').toLowerCase();
        const role = (emp.role || '').toLowerCase();
        const muni = (emp.municipality || emp.area || emp.address || '').toLowerCase();
        const phone = (emp.phone || emp.contact || '').toLowerCase();
        const matches = name.includes(q) || id.includes(q) || role.includes(q) || muni.includes(q) || phone.includes(q);
        if (!matches) return false;
      }

      return true;
    },

    render() {
      this.init();
      const container = document.getElementById('org-chart-tree-container');
      if (!container) return;

      const { admins, supervisors, collectors, allOrg } = this.getHierarchyData();

      // Update KPI Counter Badges in Org Chart View Header
      const countTotal = document.getElementById('org-kpi-total');
      const countAdmins = document.getElementById('org-kpi-admins');
      const countSupervisors = document.getElementById('org-kpi-supervisors');
      const countCollectors = document.getElementById('org-kpi-collectors');
      const countMunis = document.getElementById('org-kpi-munis');

      if (countTotal) countTotal.textContent = allOrg.length;
      if (countAdmins) countAdmins.textContent = admins.length;
      if (countSupervisors) countSupervisors.textContent = supervisors.length;
      if (countCollectors) countCollectors.textContent = collectors.length;

      if (countMunis) {
        const uniqueMunis = new Set();
        allOrg.forEach(e => {
          const m = e.municipality || e.area;
          if (m && m !== '-') uniqueMunis.add(m);
        });
        countMunis.textContent = uniqueMunis.size || 6;
      }

      // Filtered subsets for rendering
      const filteredAdmins = admins.filter(e => this.matchesFilter(e));
      const filteredSupervisors = supervisors.filter(e => this.matchesFilter(e));
      const filteredCollectors = collectors.filter(e => this.matchesFilter(e));

      const totalFiltered = filteredAdmins.length + filteredSupervisors.length + filteredCollectors.length;

      if (totalFiltered === 0) {
        container.innerHTML = `
          <div class="org-empty-state" style="text-align: center; padding: 60px 20px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--border-color); border-radius: 12px; margin: 20px 0;">
            <div style="font-size: 42px; margin-bottom: 12px;">🔍</div>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">No Organizational Records Found</h3>
            <p style="font-size: 13px; color: var(--text-muted); max-width: 460px; margin: 0 auto;">No leadership or collector staff match your current search/filter criteria. Try resetting the filters or add a new personnel record.</p>
            <button class="btn btn-secondary btn-sm" style="margin-top: 16px;" onclick="window.orgChartModule.resetFilters()">
              🔄 Reset Filters
            </button>
          </div>
        `;
        return;
      }

      if (currentViewMode === 'grid') {
        container.innerHTML = this.renderGridView(filteredAdmins, filteredSupervisors, filteredCollectors);
      } else {
        container.innerHTML = this.renderTreeView(filteredAdmins, filteredSupervisors, filteredCollectors);
      }
    },

    renderTreeView(admins, supervisors, collectors) {
      let html = `<div class="org-chart-tree-wrapper">`;

      // LEVEL 1: OPERATIONS ADMINISTRATOR
      if (admins.length > 0) {
        html += `
          <div class="org-level org-level-admin">
            <div class="org-level-header">
              <div class="org-level-badge level-badge-admin">
                <span class="org-level-icon">👑</span>
                <span class="org-level-title">OPERATIONS ADMINISTRATOR</span>
                <span class="org-level-count">${admins.length}</span>
              </div>
            </div>
            <div class="org-cards-row org-cards-admin">
              ${admins.map(emp => this.renderEmployeeCard(emp, 'admin')).join('')}
            </div>
            <div class="org-tree-line-vertical"></div>
          </div>
        `;
      }

      // LEVEL 2: SUPERVISORS
      if (supervisors.length > 0) {
        html += `
          <div class="org-level org-level-supervisor">
            <div class="org-tree-line-horizontal" style="display: ${supervisors.length > 1 ? 'block' : 'none'};"></div>
            <div class="org-level-header">
              <div class="org-level-badge level-badge-supervisor">
                <span class="org-level-icon">👔</span>
                <span class="org-level-title">FIELD SUPERVISORS</span>
                <span class="org-level-count">${supervisors.length}</span>
              </div>
            </div>
            <div class="org-cards-row org-cards-supervisor">
              ${supervisors.map(emp => this.renderEmployeeCard(emp, 'supervisor')).join('')}
            </div>
            <div class="org-tree-line-vertical"></div>
          </div>
        `;
      }

      // LEVEL 3: COLLECTORS
      if (collectors.length > 0) {
        // Group collectors optionally by municipality / corridor for clean hierarchy layout
        html += `
          <div class="org-level org-level-collector">
            <div class="org-tree-line-horizontal" style="display: ${collectors.length > 1 ? 'block' : 'none'};"></div>
            <div class="org-level-header">
              <div class="org-level-badge level-badge-collector">
                <span class="org-level-icon">🛵</span>
                <span class="org-level-title">FIELD COLLECTOR UNITS</span>
                <span class="org-level-count">${collectors.length}</span>
              </div>
            </div>
            <div class="org-cards-grid org-cards-collector">
              ${collectors.map(emp => this.renderEmployeeCard(emp, 'collector')).join('')}
            </div>
          </div>
        `;
      }

      html += `</div>`;
      return html;
    },

    renderGridView(admins, supervisors, collectors) {
      let html = `<div class="org-chart-grid-wrapper" style="display: flex; flex-direction: column; gap: 24px;">`;

      if (admins.length > 0) {
        html += `
          <div class="org-grid-section">
            <div class="org-section-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #fbbf24; font-size: 14px;">
                <span>👑</span> Operations Administrator
              </div>
              <span class="badge badge-warning" style="font-size: 11px;">${admins.length} Total</span>
            </div>
            <div class="org-cards-grid org-cards-admin-grid">
              ${admins.map(emp => this.renderEmployeeCard(emp, 'admin')).join('')}
            </div>
          </div>
        `;
      }

      if (supervisors.length > 0) {
        html += `
          <div class="org-grid-section">
            <div class="org-section-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #c084fc; font-size: 14px;">
                <span>👔</span> Team Davao Supervisors
              </div>
              <span class="badge badge-purple" style="font-size: 11px;">${supervisors.length} Active</span>
            </div>
            <div class="org-cards-grid org-cards-supervisor-grid">
              ${supervisors.map(emp => this.renderEmployeeCard(emp, 'supervisor')).join('')}
            </div>
          </div>
        `;
      }

      if (collectors.length > 0) {
        html += `
          <div class="org-grid-section">
            <div class="org-section-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #38bdf8; font-size: 14px;">
                <span>🛵</span> Field Collector Units
              </div>
              <span class="badge badge-info" style="font-size: 11px;">${collectors.length} Active</span>
            </div>
            <div class="org-cards-grid org-cards-collector-grid">
              ${collectors.map(emp => this.renderEmployeeCard(emp, 'collector')).join('')}
            </div>
          </div>
        `;
      }

      html += `</div>`;
      return html;
    },

    renderEmployeeCard(emp, levelType) {
      const isAdminUser = typeof window.authManager !== 'undefined' ? window.authManager.isAdmin() : true;
      const statusUpper = (emp.status || 'ACTIVE').toUpperCase();
      const isActive = statusUpper === 'ACTIVE';

      // Role display & badge styling
      let roleDisplay = (emp.role || '').toUpperCase();
      let roleBadgeClass = 'badge-info';
      let cardAccentClass = 'org-card-collector';
      let avatarBg = '#0284c7';
      let avatarIcon = '🛵';

      if (levelType === 'admin' || isAdministrator(emp)) {
        roleDisplay = 'OPERATIONS ADMINISTRATOR';
        roleBadgeClass = 'badge-warning';
        cardAccentClass = 'org-card-admin';
        avatarBg = '#d97706';
        avatarIcon = '👑';
      } else if (levelType === 'supervisor' || isSupervisor(emp)) {
        roleDisplay = 'SUPERVISOR';
        roleBadgeClass = 'badge-purple';
        cardAccentClass = 'org-card-supervisor';
        avatarBg = '#7c3aed';
        avatarIcon = '👔';
      } else {
        roleDisplay = 'COLLECTOR';
        roleBadgeClass = 'badge-teal';
        cardAccentClass = 'org-card-collector';
        avatarBg = '#059669';
        avatarIcon = '🛵';
      }

      // Format initial avatar text
      const nameStr = emp.name || 'N/A';
      const initials = nameStr.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'EMP';

      // Municipality / Assignment
      const muni = emp.municipality && emp.municipality !== '-' ? emp.municipality : (emp.area || 'Davao Del Norte');
      const address = emp.address && emp.address !== '-' ? emp.address : muni;

      // Contact phone
      const phone = emp.phone && emp.phone !== '-' && emp.phone !== 'N/A' ? emp.phone : 'N/A';

      // Status Badge
      const statusBadge = isActive
        ? `<span class="badge badge-success" style="font-size: 10px; font-weight: 700; letter-spacing: 0.3px;"><span class="status-dot dot-active"></span>ACTIVE</span>`
        : `<span class="badge badge-danger" style="font-size: 10px; font-weight: 700; letter-spacing: 0.3px;"><span class="status-dot dot-inactive"></span>${statusUpper}</span>`;

      // GPS location indicator
      const hasGps = (emp.lat && emp.lng) || (emp.coordinates && emp.coordinates.lat);
      const gpsBtn = hasGps
        ? `<button class="org-action-icon-btn" onclick="window.orgChartModule.focusOnMap('${emp.id}')" title="Locate on Live ETS Map">📍</button>`
        : '';

      // Edit Button
      const editBtn = isAdminUser
        ? `<button class="btn btn-secondary btn-xs" onclick="window.editEmployee('${emp.id}')" style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px;" title="Edit Employee in Master Registry">
            <span>✏️</span> Edit
          </button>`
        : '';

      const detailsBtn = `<button class="btn btn-secondary btn-xs" onclick="window.viewEmployeeDetails('${emp.id}')" style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px;" title="View Full Employee Profile">
          <span>👁️</span> Details
        </button>`;

      return `
        <div class="org-node-card ${cardAccentClass}" id="org-card-${emp.id}">
          <div class="org-card-header">
            <div class="org-avatar-wrap">
              <div class="org-avatar" style="background: ${avatarBg};">
                ${initials}
              </div>
              <span class="org-avatar-badge">${avatarIcon}</span>
            </div>
            <div class="org-card-meta">
              <div class="org-emp-name" title="${nameStr}">${nameStr}</div>
              <div class="org-emp-id">${emp.id || '-'}</div>
            </div>
            <div class="org-card-status">
              ${statusBadge}
            </div>
          </div>

          <div class="org-card-body">
            <div class="org-field-row">
              <span class="org-field-label">Position:</span>
              <span class="badge ${roleBadgeClass}" style="font-size: 10.5px; font-weight: 700;">${roleDisplay}</span>
            </div>
            <div class="org-field-row">
              <span class="org-field-label">Assignment:</span>
              <span class="org-field-value org-muni-val" title="${address}">
                <span style="color: var(--accent-gold); margin-right: 3px;">📍</span> ${muni}
              </span>
            </div>
            <div class="org-field-row">
              <span class="org-field-label">Contact:</span>
              <span class="org-field-value">
                ${phone !== 'N/A' ? `<a href="tel:${phone}" style="color: var(--primary); text-decoration: none; font-weight: 600;">📞 ${phone}</a>` : '<span style="color: var(--text-dim);">N/A</span>'}
              </span>
            </div>
            ${emp.posSerial && emp.posSerial !== '-' ? `
            <div class="org-field-row">
              <span class="org-field-label">Device S/N:</span>
              <span class="org-field-value" style="font-family: var(--font-mono); font-size: 11px;">${emp.posSerial}</span>
            </div>` : ''}
          </div>

          <div class="org-card-footer">
            <div class="org-card-actions-left">
              ${detailsBtn}
              ${editBtn}
            </div>
            <div class="org-card-actions-right">
              ${gpsBtn}
            </div>
          </div>
        </div>
      `;
    },

    focusOnMap(empId) {
      if (window.sfx) window.sfx.playClick();
      if (typeof window.switchView === 'function') {
        window.switchView('view-tracking');
        setTimeout(() => {
          if (window.etsMap && typeof window.etsMap.focusEmployeeMarker === 'function') {
            window.etsMap.focusEmployeeMarker(empId);
          }
        }, 300);
      }
    },

    resetFilters() {
      if (window.sfx) window.sfx.playClick();
      currentSearchQuery = '';
      currentMuniFilter = 'all';
      currentRoleFilter = 'all';

      const searchInput = document.getElementById('org-chart-search');
      if (searchInput) searchInput.value = '';

      const muniSelect = document.getElementById('org-chart-filter-muni');
      if (muniSelect) muniSelect.value = 'all';

      const roleSelect = document.getElementById('org-chart-filter-role');
      if (roleSelect) roleSelect.value = 'all';

      this.render();
    },

    printOrgChart() {
      if (window.sfx) window.sfx.playClick();
      window.print();
    }
  };

  // Expose globally
  window.orgChartModule = OrgChartModule;

})(window);
