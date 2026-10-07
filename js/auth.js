/**
 * NORTH-005 OmniERP — Authentication, User Account System & Role-Based Access Control
 * 
 * SESSION ARCHITECTURE:
 * - User accounts database → localStorage (shared, persistent across tabs/sessions)
 * - Current session user  → sessionStorage (isolated per tab/browser session)
 * 
 * ROLES & DEPARTMENTS:
 * 1. Administrator          → Administrator (Full Admin Access)
 * 2. Team Davao Supervisors → Supervisor (Operational Supervision)
 * 3. Field Collector Units  → Collector (Core Operations + View-Only Cash Advance Tracker)
 */

(function () {
  'use strict';

  // Session key stored in sessionStorage (isolated per browser tab/session)
  const SESSION_KEY = 'north005_session_user_v2';

  // Shared persistent storage keys (in localStorage - shared across sessions for user DB and history)
  const USERS_STORAGE_KEY = 'north005_system_users_v3';
  const LOGIN_HISTORY_KEY  = 'north005_login_history_v2';
  const DELETED_USERS_KEY  = 'north005_deleted_users';

  /**
   * Default system accounts with strict Department -> Role mapping.
   * Only the Master Administrator is seeded by default.
   */
  const DEFAULT_USERS = [
    {
      id: 'USR-001',
      username: 'admin',
      name: 'Peter John Carrillo',
      email: 'pjc.admin@apex-omni.ph',
      phone: '+63 946 166 7956',
      position: 'Operations Administrator',
      role: 'Administrator',
      department: 'Administrator',
      status: 'Active',
      password: 'Admin123!',
      photo: '',
      dateCreated: '2026-09-01',
      lastLogin: '2026-10-01 22:00'
    }
  ];

  class AuthManager {
    constructor() {
      this.initUsers();
      this.currentUser = this.loadSessionUser();
      this.initDom();
      this.updateProfileUi();
      this.applyRoleRestrictions();
    }

    /* ------------------------------------------------------------------ */
    /* USER DATABASE (localStorage — shared, persistent)                  */
    /* ------------------------------------------------------------------ */

    initUsers() {
      try {
        const stored = localStorage.getItem(USERS_STORAGE_KEY);
        let deletedList = [];
        try {
          const dRaw = localStorage.getItem(DELETED_USERS_KEY);
          if (dRaw) deletedList = JSON.parse(dRaw);
        } catch (e) { deletedList = []; }

        if (!stored) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
        } else {
          let list = JSON.parse(stored);
          if (!Array.isArray(list) || list.length === 0) {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
          } else {
            // Permanently purge unauthorized JUNDY / supervisor accounts and deleted accounts
            const cleanList = list.filter(u => {
              if (!u) return false;
              if (u.id === 'USR-002' || u.username === 'supervisor') return false;
              if (u.name && u.name.toUpperCase().includes('JUNDY')) return false;
              // Check tombstoned accounts
              if (deletedList.some(d => d === u.id || d === u.username || (u.name && d.toLowerCase() === u.name.toLowerCase()))) return false;
              // Permanently respect deletion of default Mark Anthony (MAC2) account
              if (u.id === 'USR-003' || u.username === 'collector') {
                return false;
              }
              return true;
            });
            let modified = cleanList.length !== list.length;
            list = cleanList;

            // Ensure default Administrator exists in list if missing
            DEFAULT_USERS.forEach(def => {
              if (def.role === 'Administrator' && !list.some(u => u.username === def.username || u.role === 'Administrator')) {
                list.push(def);
                modified = true;
              }
            });
            if (modified) {
              localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      }

      // Background sync with Supabase cloud database
      this.syncUsersWithSupabase();
    }

    async syncUsersWithSupabase() {
      try {
        if (window.supabaseSync && typeof window.supabaseSync.fetchUsers === 'function') {
          const remoteUsers = await window.supabaseSync.fetchUsers();
          if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
            const currentList = this.getUsers();
            let changed = false;
            remoteUsers.forEach(ru => {
              const idx = currentList.findIndex(u => u.username === ru.username || u.id === ru.id);
              if (idx === -1) {
                currentList.push({
                  id: ru.id || ('USR-' + Math.random().toString(36).substr(2, 6).toUpperCase()),
                  username: ru.username,
                  name: ru.name || ru.username,
                  email: ru.email || '',
                  phone: ru.phone || '',
                  position: ru.position || 'Operations Staff',
                  role: ru.role || 'Staff',
                  department: ru.department || 'General Operations',
                  status: ru.status || 'Active',
                  password: ru.password || 'User123!',
                  photo: ru.photo || '',
                  dateCreated: ru.created_at ? ru.created_at.split('T')[0] : '2026-09-01',
                  lastLogin: ru.last_login || 'Never'
                });
                changed = true;
              }
            });
            if (changed) {
              this.saveUsers(currentList);
            }
          }
        }
      } catch (err) {
        console.warn('Could not sync users with Supabase:', err);
      }
    }

    getUsers() {
      try {
        const stored = localStorage.getItem(USERS_STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [...DEFAULT_USERS];
        let deletedList = [];
        try {
          const dRaw = localStorage.getItem(DELETED_USERS_KEY);
          if (dRaw) deletedList = JSON.parse(dRaw);
        } catch (e) { deletedList = []; }

        // Strictly filter out any unauthorized JUNDY accounts and tombstoned accounts
        return list.filter(u => {
          if (!u) return false;
          if (u.id === 'USR-002' || u.username === 'supervisor') return false;
          if (u.name && u.name.toUpperCase().includes('JUNDY')) return false;
          if (deletedList.some(d => d === u.id || d === u.username || (u.name && d.toLowerCase() === u.name.toLowerCase()))) return false;
          if (u.id === 'USR-003' || u.username === 'collector') {
            return false;
          }
          return true;
        });
      } catch (e) {
        return [...DEFAULT_USERS];
      }
    }

    saveUsers(users) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      if (window.userManagementModule && typeof window.userManagementModule.render === 'function') {
        window.userManagementModule.render();
      }
    }

    deleteUser(id) {
      const users = this.getUsers();
      const user = users.find(u => u.id === id || u.username === id);
      if (!user) return false;

      // Add to persistent deletion tombstone
      try {
        const dRaw = localStorage.getItem(DELETED_USERS_KEY);
        const deletedList = dRaw ? JSON.parse(dRaw) : [];
        if (!deletedList.includes(user.id)) deletedList.push(user.id);
        if (user.username && !deletedList.includes(user.username)) deletedList.push(user.username);
        if (user.name && !deletedList.includes(user.name.toLowerCase())) deletedList.push(user.name.toLowerCase());
        localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(deletedList));
      } catch (e) {}

      const remaining = users.filter(u => u.id !== user.id && u.username !== user.username);
      this.saveUsers(remaining);
      this.logHistory(user.username, 'Deleted', 'Account permanently deleted by Administrator');
      return true;
    }

    /* ------------------------------------------------------------------ */
    /* SESSION STATE (sessionStorage — isolated per tab/browser session)  */
    /* ------------------------------------------------------------------ */

    loadSessionUser() {
      try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          // Purge session if user is unauthorized JUNDY
          if (user && (user.id === 'USR-002' || user.username === 'supervisor' || (user.name && user.name.toUpperCase().includes('JUNDY')))) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
          }
          const users = this.getUsers();
          const found = users.find(u => u.username === user.username);
          if (found && found.status === 'Active') return found;
        }
      } catch (e) {}
      return null;
    }

    setSessionUser(user) {
      this.currentUser = user;
      if (user) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
      this.updateProfileUi();
      this.applyRoleRestrictions();
    }

    getCurrentUser() {
      return this.currentUser;
    }

    isAuthenticated() {
      return !!this.currentUser;
    }

    isAdmin() {
      if (!this.currentUser) return false;
      const r = (this.currentUser.role || '').toUpperCase();
      return r === 'ADMINISTRATOR' || r === 'OPERATIONS ADMINISTRATOR';
    }

    isSupervisor() {
      if (!this.currentUser) return false;
      const r = (this.currentUser.role || '').toUpperCase();
      return r === 'SUPERVISOR';
    }

    isCollector() {
      if (!this.currentUser) return false;
      const r = (this.currentUser.role || '').toUpperCase();
      return r === 'COLLECTOR';
    }

    isTeller() {
      if (!this.currentUser) return false;
      const r = (this.currentUser.role || '').toUpperCase();
      const p = (this.currentUser.position || '').toUpperCase();
      return r === 'TELLER' || p === 'TELLER' || r.includes('SALES REP') || r.includes('STATION TELLER');
    }

    isReliever() {
      if (!this.currentUser) return false;
      const r = (this.currentUser.role || '').toUpperCase();
      const p = (this.currentUser.position || '').toUpperCase();
      return r === 'RELIEVER' || p === 'RELIEVER' || r.includes('BUFFER RELIEVER');
    }

    /**
     * Role-Based Access Control Guard
     * Validates whether current logged-in user can access target viewId
     */
    canAccessView(viewId) {
      if (!this.currentUser) return false;
      if (this.isAdmin()) return true;

      if (this.isSupervisor()) {
        // Supervisors have operational oversight but no user management admin controls or system settings
        return viewId !== 'view-user-management' && viewId !== 'view-settings';
      }

      if (this.isCollector()) {
        // Collector Allowed Modules:
        // Dashboard, ETS Live Tracking, Sales & Collection, Master Registry (view-only), and Finance (locked strictly to view-only CA tab)
        const allowedCollectorViews = [
          'view-dashboard',
          'view-tracking',
          'view-pipelines',
          'view-employees',
          'view-finance',
          'view-expenses'
        ];

        return allowedCollectorViews.includes(viewId);
      }

      if (this.isTeller() || this.isReliever()) {
        // Teller & Reliever: STRICTLY Attendance / Workforce Monitoring ONLY
        return viewId === 'view-workforce-attendance';
      }

      return false;
    }

    /* ------------------------------------------------------------------ */
    /* LOGIN / LOGOUT / REGISTER                                          */
    /* ------------------------------------------------------------------ */

    login(username, password) {
      if (window.productionSuite && typeof window.productionSuite.checkRateLimit === 'function') {
        const rateCheck = window.productionSuite.checkRateLimit(username);
        if (!rateCheck.allowed) {
          return { success: false, message: rateCheck.message };
        }
      }

      const users = this.getUsers();
      const user = users.find(u => {
        const uName = (u.username || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const q = (username || '').toLowerCase().trim();
        return uName === q || uEmail === q;
      });

      if (!user) {
        if (window.productionSuite) window.productionSuite.recordFailedAttempt(username);
        this.logHistory(username, 'Failed', 'User not found');
        return { success: false, message: 'Invalid username or password.' };
      }
      if (user.password !== password) {
        if (window.productionSuite) {
          const res = window.productionSuite.recordFailedAttempt(username);
          if (res && res.locked) {
            return { success: false, message: `Security Cooldown: 5 consecutive failed attempts. Please wait ${res.remainingSec}s.` };
          }
        }
        this.logHistory(username, 'Failed', 'Incorrect password');
        return { success: false, message: 'Invalid username or password.' };
      }
      if (user.status === 'Pending') {
        this.logHistory(username, 'Blocked', 'Pending administrator approval');
        return { success: false, message: 'ACCOUNT STATUS: PENDING ADMINISTRATOR APPROVAL.\nYour account is pending verification and approval by the Administrator.' };
      }
      if (user.status === 'Suspended') {
        this.logHistory(username, 'Blocked', 'Account suspended');
        return { success: false, message: 'This account has been suspended. Contact the System Administrator.' };
      }
      if (user.status === 'Inactive') {
        this.logHistory(username, 'Blocked', 'Account inactive');
        return { success: false, message: 'This account is inactive.' };
      }

      if (window.productionSuite) window.productionSuite.resetRateLimit(username);

      const now = new Date();
      user.lastLogin = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      const idx = users.findIndex(u => u.username === user.username);
      if (idx !== -1) { users[idx] = user; this.saveUsers(users); }

      this.setSessionUser(user);
      this.logHistory(username, 'Success', `Logged in as ${user.role}`);

      return { success: true, user };
    }

    logout() {
      if (this.currentUser) {
        this.logHistory(this.currentUser.username, 'Logout', 'User signed out');
      }
      this.setSessionUser(null);
      this.showLoginModal();
    }

    register(data) {
      const users = this.getUsers();
      const cleanUsername = (data.username || '').trim().toLowerCase();
      const cleanName = (data.name || '').trim();
      const cleanEmail = (data.email || '').trim().toLowerCase();
      const pos = (data.position || 'Teller').trim();

      if (!cleanUsername) return { success: false, message: 'Username is required.' };
      if (!cleanName) return { success: false, message: 'Full name is required.' };
      if (!data.password || data.password.length < 6) return { success: false, message: 'Password must be at least 6 characters.' };
      if (data.password !== data.confirmPassword) return { success: false, message: 'Passwords do not match.' };
      if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
        return { success: false, message: 'Username already taken. Choose another.' };
      }
      if (cleanEmail && users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
        return { success: false, message: 'Email address already registered. Use another.' };
      }

      // Master Registry Verification Check
      const store = window.appStore;
      const employees = store ? store.getEmployees() : [];
      const relievers = (store && store.data && Array.isArray(store.data.relievers)) ? store.data.relievers : [];
      const allMasterStaff = [...employees, ...relievers];
      const cleanLowerName = cleanName.toLowerCase();

      // Find matched employee in Master Registry by name or email
      const matchedEmp = allMasterStaff.find(e => {
        if (!e) return false;
        const eName = (e.name || '').trim().toLowerCase();
        const eEmail = (e.email || '').trim().toLowerCase();
        return (eName && (eName === cleanLowerName || cleanLowerName.includes(eName) || eName.includes(cleanLowerName))) ||
               (cleanEmail && eEmail === cleanEmail);
      });

      let department = 'Outlet & Booth Operations';
      let role = 'Teller';
      let status = 'Pending';
      let linkedEmpId = null;

      // Position Verification against Master Registry
      if (pos === 'Teller') {
        department = 'Outlet & Booth Operations';
        role = 'Teller';
        if (matchedEmp) {
          const empRole = (matchedEmp.role || '').toUpperCase();
          const isTellerRole = empRole.includes('TELLER') || empRole.includes('SALES') || !empRole.includes('SUPERVISOR');
          if (isTellerRole) {
            status = 'Active';
            linkedEmpId = matchedEmp.id;
          } else {
            status = 'Pending';
          }
        } else {
          status = 'Pending'; // Not found in Master Registry -> Pending Admin Approval
        }
      } else if (pos === 'Reliever') {
        department = 'Outlet & Booth Operations';
        role = 'Reliever';
        if (matchedEmp) {
          status = 'Active';
          linkedEmpId = matchedEmp.id;
        } else {
          status = 'Pending'; // Not found in Master Registry -> Pending Admin Approval
        }
      } else if (pos === 'Collector') {
        department = 'Field Collector Units';
        role = 'Collector';
        if (matchedEmp) {
          const empRole = (matchedEmp.role || '').toUpperCase();
          if (empRole.includes('COLLECTOR') || matchedEmp.department === 'dept-col' || cleanLowerName.includes('mark anthony') || cleanLowerName.includes('mac2')) {
            status = 'Active';
            linkedEmpId = matchedEmp.id;
          } else {
            status = 'Pending';
          }
        } else {
          status = 'Pending';
        }
      } else if (pos === 'Supervisor') {
        department = 'Team Davao Supervisors';
        role = 'Supervisor';
        if (matchedEmp) {
          const empRole = (matchedEmp.role || '').toUpperCase();
          if (empRole.includes('SUPERVISOR') || empRole.includes('LEADER') || matchedEmp.department === 'dept-sup') {
            status = 'Active';
            linkedEmpId = matchedEmp.id;
          } else {
            status = 'Pending';
          }
        } else {
          status = 'Pending';
        }
      } else if (pos === 'Operations Administrator' || pos === 'Administrator') {
        const isAuthorizedAdmin = matchedEmp && (
          (matchedEmp.role || '').toUpperCase().includes('ADMIN') ||
          matchedEmp.department === 'dept-admin' ||
          matchedEmp.id === 'DDN005-OA001' ||
          matchedEmp.id === 'DDN005-ADM01' ||
          cleanLowerName.includes('peter john') || cleanLowerName.includes('carrillo')
        );

        if (isAuthorizedAdmin) {
          department = 'Administrator';
          role = 'Operations Administrator';
          status = 'Active';
          linkedEmpId = matchedEmp ? matchedEmp.id : 'DDN005-OA001';
        } else {
          department = 'Administrator';
          role = 'Operations Administrator';
          status = 'Pending'; // Non-verified admin sign-up must be pending
        }
      }

      const now = new Date();
      const newUser = {
        id: `USR-${String(Date.now()).slice(-5)}`,
        username: cleanUsername,
        name: cleanName,
        email: cleanEmail || `${cleanUsername}@north005.com`,
        phone: data.phone ? data.phone.trim() : (matchedEmp && matchedEmp.phone ? matchedEmp.phone : 'N/A'),
        position: pos,
        role: role,
        department: department,
        status: status,
        employeeId: linkedEmpId,
        password: data.password,
        photo: data.photo || '',
        dateCreated: now.toISOString().split('T')[0],
        lastLogin: 'Never'
      };

      users.push(newUser);
      this.saveUsers(users);

      // Sync user to Supabase Cloud
      if (window.supabaseSync && typeof window.supabaseSync.syncUserAccount === 'function') {
        window.supabaseSync.syncUserAccount(newUser);
      }

      this.logHistory(cleanUsername, 'Registered', `Account created (${pos} → ${role}, Status: ${status})`);
      return { success: true, user: newUser };
    }

    /* ------------------------------------------------------------------ */
    /* LOGIN HISTORY                                                       */
    /* ------------------------------------------------------------------ */

    logHistory(username, status, notes = '') {
      try {
        const now = new Date();
        const record = {
          id: 'LOG-' + Date.now(),
          date: now.toISOString().split('T')[0],
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          username: username || 'anonymous',
          status,
          notes,
          logoutTime: null
        };
        const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(record);
        if (list.length > 500) list.length = 500;
        localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(list));
      } catch (e) {}
    }

    getLoginHistory() {
      try {
        const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

    /* ------------------------------------------------------------------ */
    /* UI — PROFILE CARD & ROLE RESTRICTIONS                              */
    /* ------------------------------------------------------------------ */

    getInitials(name) {
      if (!name) return '??';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    updateProfileUi() {
      const user = this.currentUser;
      const avatarEl     = document.getElementById('current-user-avatar');
      const nameEl       = document.getElementById('current-user-name');
      const roleBadgeEl  = document.getElementById('current-user-role-badge');

      if (!user) {
        if (avatarEl)    avatarEl.textContent = '??';
        if (nameEl)      nameEl.textContent   = 'Not Logged In';
        if (roleBadgeEl) { roleBadgeEl.textContent = 'Guest'; roleBadgeEl.className = 'operator-role badge badge-neutral'; }
        return;
      }

      // Avatar
      if (avatarEl) {
        if (user.photo) {
          avatarEl.innerHTML = `<img src="${user.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${user.name}">`;
        } else {
          avatarEl.textContent = this.getInitials(user.name);
          avatarEl.style.background = this.isAdmin()
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : (this.isCollector() ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)');
        }
      }

      // Name
      if (nameEl) {
        nameEl.textContent = user.name;
        nameEl.title = `${user.name} (@${user.username})`;
      }

      // Role badge
      if (roleBadgeEl) {
        roleBadgeEl.textContent = user.role;
        if (this.isAdmin()) {
          roleBadgeEl.style.cssText = 'background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid #f59e0b;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;';
        } else if (this.isCollector()) {
          roleBadgeEl.style.cssText = 'background:rgba(16,185,129,0.18);color:#34d399;border:1px solid #10b981;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;';
        } else {
          roleBadgeEl.style.cssText = 'background:rgba(59,130,246,0.18);color:#93c5fd;border:1px solid #3b82f6;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;';
        }
      }

      // Sidebar pending badge (Admins only)
      const pendingBadge = document.getElementById('sidebar-pending-users-badge');
      if (pendingBadge) {
        if (this.isAdmin()) {
          const count = this.getUsers().filter(u => u.status === 'Pending').length;
          pendingBadge.textContent = count;
          pendingBadge.style.display = count > 0 ? 'inline-block' : 'none';
        } else {
          pendingBadge.style.display = 'none';
        }
      }
    }

    applyRoleRestrictions() {
      const isAdmin = this.isAdmin();
      const isSupervisor = this.isSupervisor();
      const isCollector = this.isCollector();
      const isTeller = this.isTeller();
      const isReliever = this.isReliever();
      const isStaffTellerOrReliever = isTeller || isReliever;

      // Sidebar nav items access
      const setNavVisibility = (viewId, visible) => {
        const item = document.querySelector(`.sidebar-nav .nav-item[data-view="${viewId}"]`);
        if (item) item.style.display = visible ? 'flex' : 'none';
      };

      if (isStaffTellerOrReliever) {
        // Tellers & Relievers: ONLY Attendance / Workforce Monitoring is accessible
        setNavVisibility('view-dashboard', false);
        setNavVisibility('view-tracking', false);
        setNavVisibility('view-pipelines', false);
        setNavVisibility('view-pos-terminals', false);
        setNavVisibility('view-employees', false);
        setNavVisibility('view-expenses', false);
        setNavVisibility('view-finance', false);
        setNavVisibility('view-inventory', false);
        setNavVisibility('view-user-management', false);
        setNavVisibility('view-workforce-attendance', true);
        setNavVisibility('view-org-chart', false);
        setNavVisibility('view-employee-documents', false);
        setNavVisibility('view-thermal-paper', false);
        setNavVisibility('view-audit-discrepancy', false);
        setNavVisibility('view-settings', false);

        // Auto-redirect to attendance if currently viewing restricted module
        const activePanel = document.querySelector('.view-panel.active');
        const activeViewId = activePanel ? activePanel.id : '';
        if (activeViewId && activeViewId !== 'view-workforce-attendance' && typeof window.switchView === 'function') {
          window.switchView('view-workforce-attendance', false);
        }
      } else if (isCollector) {
        // Collector: Dashboard, Tracking, Pipelines, Master Registry (view-only), and Finance (locked to view-only CA tab)
        setNavVisibility('view-dashboard', true);
        setNavVisibility('view-tracking', true);
        setNavVisibility('view-pipelines', true);
        setNavVisibility('view-pos-terminals', false);
        setNavVisibility('view-employees', true);
        setNavVisibility('view-expenses', true);
        setNavVisibility('view-finance', true);
        setNavVisibility('view-inventory', false); // Blocked: Outlet Rentals & Load Allowance
        setNavVisibility('view-user-management', false); // Blocked
        setNavVisibility('view-workforce-attendance', false); // Blocked
        setNavVisibility('view-org-chart', false); // Blocked
        setNavVisibility('view-employee-documents', false); // Blocked
        setNavVisibility('view-thermal-paper', false); // Blocked
        setNavVisibility('view-audit-discrepancy', false);
        setNavVisibility('view-settings', false);

        // Auto-redirect to dashboard if currently viewing restricted module
        const activePanel = document.querySelector('.view-panel.active');
        const activeViewId = activePanel ? activePanel.id : '';
        if (activeViewId && !this.canAccessView(activeViewId) && typeof window.switchView === 'function') {
          window.switchView('view-dashboard', false);
        }
      } else {
        // Administrator & Supervisor
        setNavVisibility('view-dashboard', true);
        setNavVisibility('view-tracking', true);
        setNavVisibility('view-pipelines', true);
        setNavVisibility('view-pos-terminals', isAdmin || isSupervisor);
        setNavVisibility('view-employees', true);
        setNavVisibility('view-expenses', true);
        setNavVisibility('view-finance', true);
        setNavVisibility('view-inventory', true);
        setNavVisibility('view-user-management', isAdmin);
        setNavVisibility('view-workforce-attendance', true);
        setNavVisibility('view-org-chart', true);
        setNavVisibility('view-employee-documents', true);
        setNavVisibility('view-thermal-paper', true);
        setNavVisibility('view-audit-discrepancy', true);
        setNavVisibility('view-settings', isAdmin);
      }

      // Master Registry action buttons
      const btnAddEmp    = document.querySelector('button[onclick="window.openAddEmployeeModal()"]');
      const btnUpload    = document.getElementById('btn-upload-excel');
      const btnImport    = document.querySelector('button[onclick="window.openImportHistoryModal()"]');
      if (btnAddEmp)  btnAddEmp.style.display  = isAdmin ? 'inline-flex' : 'none';
      if (btnUpload)  btnUpload.style.display   = isAdmin ? 'inline-flex' : 'none';
      if (btnImport)  btnImport.style.display   = isAdmin ? 'inline-flex' : 'none';

      // Re-render table to apply/remove edit/delete per-row controls
      if (typeof window.renderEmployeesTable === 'function') {
        window.renderEmployeesTable();
      }

      // Pending badge in sidebar
      const pendingCount = document.getElementById('sidebar-pending-users-badge');
      if (pendingCount) pendingCount.style.display = isAdmin ? '' : 'none';

      // Expenses & Payment module view-only enforcement for Collector
      if (window.expensesPayment && typeof window.expensesPayment.renderCurrentTab === 'function') {
        window.expensesPayment.renderCurrentTab();
      }

      // Trigger workforce attendance re-render if loaded
      if (window.workforceAttendanceModule && typeof window.workforceAttendanceModule.render === 'function') {
        window.workforceAttendanceModule.render();
      }
    }

    /* ------------------------------------------------------------------ */
    /* MODAL & LANDING PORTAL HELPERS                                      */
    /* ------------------------------------------------------------------ */

    showLoginModal() {
      const portal = document.getElementById('landing-page-portal');
      if (portal) {
        portal.style.display = 'flex';
      }
      const modal = document.getElementById('modal-auth-login');
      if (modal) modal.classList.add('active');
      if (typeof window.switchLandingTab === 'function') {
        window.switchLandingTab('login');
      }
    }

    hideLoginModal() {
      const portal = document.getElementById('landing-page-portal');
      if (portal) {
        portal.style.display = 'none';
      }
      const modal = document.getElementById('modal-auth-login');
      if (modal) modal.classList.remove('active');
    }

    initDom() {
      // Close profile dropdown when clicking outside
      document.addEventListener('click', (e) => {
        const menu    = document.getElementById('user-profile-menu');
        const trigger = document.getElementById('user-profile-trigger');
        if (menu && menu.style.display === 'block') {
          if (!menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
            menu.style.display = 'none';
          }
        }
      });

      // Restore remembered username if set
      try {
        const rem = localStorage.getItem('north005_remembered_username');
        const uInput = document.getElementById('auth-login-username');
        const remCheck = document.getElementById('landing-remember-me');
        if (rem && uInput) {
          uInput.value = rem;
          if (remCheck) remCheck.checked = true;
        }
      } catch (e) {}

      if (!this.currentUser) {
        setTimeout(() => this.showLoginModal(), 50);
      } else {
        const portal = document.getElementById('landing-page-portal');
        if (portal) portal.style.display = 'none';
      }
    }
  }

  /* -------------------------------------------------------------------- */
  /* GLOBAL SINGLETON                                                      */
  /* -------------------------------------------------------------------- */
  window.authManager = new AuthManager();

  /* -------------------------------------------------------------------- */
  /* GLOBAL WINDOW FUNCTIONS (Personal Profile Management)                */
  /* -------------------------------------------------------------------- */

  window.toggleUserMenu = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('user-profile-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  };

  /* --- MY PROFILE --- */
  window.openMyProfileModal = function () {
    const user = window.authManager.getCurrentUser();
    if (!user) return;
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || 'N/A'; };
    setTxt('profile-view-name',      user.name);
    setTxt('profile-view-username',  '@' + user.username);
    setTxt('profile-view-email',     user.email);
    setTxt('profile-view-phone',     user.phone);
    setTxt('profile-view-position',  user.position);
    setTxt('profile-view-created',   user.dateCreated);
    setTxt('profile-view-lastlogin', user.lastLogin);

    const roleEl = document.getElementById('profile-view-role');
    if (roleEl) {
      roleEl.textContent = user.role;
      roleEl.className = window.authManager.isAdmin() ? 'badge badge-warning' : (window.authManager.isCollector() ? 'badge badge-success' : 'badge badge-info');
    }
    const statusEl = document.getElementById('profile-view-status');
    if (statusEl) {
      statusEl.textContent = user.status;
      statusEl.className = user.status === 'Active' ? 'badge badge-success' : 'badge badge-neutral';
    }
    const avatarEl = document.getElementById('profile-view-avatar');
    if (avatarEl) {
      if (user.photo) {
        avatarEl.innerHTML = `<img src="${user.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${user.name}">`;
      } else {
        avatarEl.innerHTML = window.authManager.getInitials(user.name);
      }
    }

    const menu = document.getElementById('user-profile-menu');
    if (menu) menu.style.display = 'none';
    document.getElementById('modal-my-profile').classList.add('active');
  };

  /* --- EDIT PROFILE (WITH IMAGE UPLOAD & PREVIEW) --- */
  window.openEditProfileModal = function () {
    const user = window.authManager.getCurrentUser();
    if (!user) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('edit-profile-name',     user.name);
    setVal('edit-profile-email',    user.email);
    setVal('edit-profile-phone',    user.phone);
    setVal('edit-profile-position', user.position);
    
    const photoDataEl = document.getElementById('edit-profile-photo-data');
    if (photoDataEl) photoDataEl.value = user.photo || '';

    const previewImg = document.getElementById('edit-profile-preview-avatar');
    const previewInitials = document.getElementById('edit-profile-preview-initials');
    if (user.photo) {
      if (previewImg) { previewImg.src = user.photo; previewImg.style.display = 'block'; }
      if (previewInitials) previewInitials.style.display = 'none';
    } else {
      if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
      if (previewInitials) {
        previewInitials.textContent = window.authManager.getInitials(user.name);
        previewInitials.style.display = 'flex';
      }
    }

    const menu = document.getElementById('user-profile-menu');
    if (menu) menu.style.display = 'none';
    document.getElementById('modal-edit-profile').classList.add('active');
  };

  window.handleProfilePhotoUpload = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected image exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      const photoDataEl = document.getElementById('edit-profile-photo-data');
      if (photoDataEl) photoDataEl.value = dataUrl;

      const previewImg = document.getElementById('edit-profile-preview-avatar');
      const previewInitials = document.getElementById('edit-profile-preview-initials');
      if (previewImg) {
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
      }
      if (previewInitials) {
        previewInitials.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeProfilePhoto = function () {
    const photoDataEl = document.getElementById('edit-profile-photo-data');
    if (photoDataEl) photoDataEl.value = '';

    const previewImg = document.getElementById('edit-profile-preview-avatar');
    const previewInitials = document.getElementById('edit-profile-preview-initials');
    const user = window.authManager.getCurrentUser();

    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (previewInitials) {
      previewInitials.textContent = user ? window.authManager.getInitials(user.name) : '??';
      previewInitials.style.display = 'flex';
    }

    const fileInput = document.getElementById('edit-profile-file-input');
    if (fileInput) fileInput.value = '';
  };

  window.saveProfileEdits = function () {
    const user = window.authManager.getCurrentUser();
    if (!user) return;
    const name = document.getElementById('edit-profile-name').value.trim();
    if (!name) { alert('Please enter your full name.'); return; }

    user.name     = name;
    user.email    = document.getElementById('edit-profile-email').value.trim();
    user.phone    = document.getElementById('edit-profile-phone').value.trim();
    user.position = document.getElementById('edit-profile-position').value.trim();
    
    const photoDataEl = document.getElementById('edit-profile-photo-data');
    user.photo = photoDataEl ? photoDataEl.value : (user.photo || '');

    const users = window.authManager.getUsers();
    const idx   = users.findIndex(u => u.username === user.username);
    if (idx !== -1) { users[idx] = { ...users[idx], ...user }; window.authManager.saveUsers(users); }
    window.authManager.setSessionUser(user);
    window.authManager.updateProfileUi();

    const menuName = document.getElementById('menu-user-fullname');
    if (menuName) menuName.textContent = user.name;
    const menuEmail = document.getElementById('menu-user-email');
    if (menuEmail) menuEmail.textContent = user.email || `${user.username}@apex-omni.ph`;

    document.getElementById('modal-edit-profile').classList.remove('active');
    alert('Personal Profile updated successfully.');
  };

  /* --- CHANGE PASSWORD --- */
  window.openChangePasswordModal = function () {
    ['pw-current','pw-new','pw-confirm'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const menu = document.getElementById('user-profile-menu');
    if (menu) menu.style.display = 'none';
    document.getElementById('modal-change-password').classList.add('active');
  };

  window.savePasswordChange = function () {
    const user = window.authManager.getCurrentUser();
    if (!user) return;
    const cur     = document.getElementById('pw-current').value;
    const next    = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    if (user.password !== cur)  { alert('Incorrect current password.'); return; }
    if (!next || next.length < 6) { alert('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { alert('Passwords do not match.'); return; }

    user.password = next;
    const users = window.authManager.getUsers();
    const idx   = users.findIndex(u => u.username === user.username);
    if (idx !== -1) { users[idx].password = next; window.authManager.saveUsers(users); }
    window.authManager.setSessionUser(user);
    window.authManager.logHistory(user.username, 'Password Change', 'Password updated successfully');
    document.getElementById('modal-change-password').classList.remove('active');
    alert('Password changed successfully.');
  };

  /* --- LOGIN HISTORY --- */
  window.openLoginHistoryModal = function () {
    const menu = document.getElementById('user-profile-menu');
    if (menu) menu.style.display = 'none';
    const tbody = document.getElementById('login-history-tbody');
    if (!tbody) { document.getElementById('modal-login-history').classList.add('active'); return; }

    const list = window.authManager.getLoginHistory();
    const user = window.authManager.getCurrentUser();
    const filtered = window.authManager.isAdmin() ? list : list.filter(l => l.username === (user ? user.username : ''));

    tbody.innerHTML = filtered.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No login events recorded yet.</td></tr>`
      : filtered.map(l => {
          const cls = l.status === 'Success' ? 'badge-success' : (l.status === 'Logout' ? 'badge-neutral' : 'badge-danger');
          return `<tr>
            <td><strong>${l.date}</strong></td>
            <td>${l.time}</td>
            <td><code>@${l.username}</code></td>
            <td style="text-align:center;"><span class="badge ${cls}">${l.status}</span></td>
            <td style="color:var(--text-muted);font-size:12px;">${l.notes || '-'}</td>
          </tr>`;
        }).join('');

    document.getElementById('modal-login-history').classList.add('active');
  };

  /* --- LOGOUT --- */
  window.requestLogout = function () {
    const menu = document.getElementById('user-profile-menu');
    if (menu) menu.style.display = 'none';
    document.getElementById('modal-logout-confirm').classList.add('active');
  };

  window.confirmLogout = function () {
    document.getElementById('modal-logout-confirm').classList.remove('active');
    window.authManager.logout();
  };

  window.cancelLogout = function () {
    document.getElementById('modal-logout-confirm').classList.remove('active');
  };

  /* --- LOGIN FORM --- */
  window.submitLoginForm = function () {
    const uInput = document.getElementById('auth-login-username');
    const pInput = document.getElementById('auth-login-password');
    const errAlert = document.getElementById('login-error-alert');
    const rememberMe = document.getElementById('landing-remember-me');

    if (errAlert) {
      errAlert.style.display = 'none';
      errAlert.textContent = '';
    }

    const u = (uInput ? uInput.value : '').trim();
    const p = pInput ? pInput.value : '';

    if (!u || !p) {
      const msg = 'Please enter both username and password.';
      if (errAlert) {
        errAlert.textContent = msg;
        errAlert.style.display = 'block';
      } else if (typeof alert === 'function') {
        alert(msg);
      }
      return;
    }

    const res = window.authManager.login(u, p);
    if (!res.success) {
      if (errAlert) {
        errAlert.textContent = res.message;
        errAlert.style.display = 'block';
      } else if (typeof alert === 'function') {
        alert(res.message);
      }
      return;
    }

    // Handle Remember Me persistence
    try {
      if (rememberMe && rememberMe.checked) {
        localStorage.setItem('north005_remembered_username', u);
      } else {
        localStorage.removeItem('north005_remembered_username');
      }
    } catch (e) {}

    window.authManager.hideLoginModal();
    if (typeof window.refreshDashboard === 'function') {
      window.refreshDashboard();
    }
  };

  /* --- SIGN UP FORM --- */
  window.openSignUpModal = function () {
    if (typeof window.switchLandingTab === 'function') {
      window.switchLandingTab('signup');
    }
    const modal = document.getElementById('modal-auth-signup');
    if (modal) modal.classList.add('active');
  };

  window.submitSignUpForm = function () {
    const errEl = document.getElementById('signup-error-alert');
    if (errEl) {
      errEl.style.display = 'none';
      errEl.textContent = '';
    }

    const data = {
      name:            (document.getElementById('reg-name') ? document.getElementById('reg-name').value : '').trim(),
      username:        (document.getElementById('reg-username') ? document.getElementById('reg-username').value : '').trim(),
      email:           (document.getElementById('reg-email') ? document.getElementById('reg-email').value : '').trim(),
      phone:           (document.getElementById('reg-phone') ? document.getElementById('reg-phone').value : '').trim(),
      position:        (document.getElementById('reg-position') ? document.getElementById('reg-position').value : 'Collector').trim(),
      password:        document.getElementById('reg-password') ? document.getElementById('reg-password').value : '',
      confirmPassword: document.getElementById('reg-confirm-password') ? document.getElementById('reg-confirm-password').value : '',
      photo:           document.getElementById('reg-photo') ? document.getElementById('reg-photo').value : ''
    };

    const res = window.authManager.register(data);
    if (!res.success) {
      if (errEl) {
        errEl.textContent = res.message;
        errEl.style.display = 'block';
      } else if (typeof alert === 'function') {
        alert(res.message);
      }
      return;
    }

    const modalAuth = document.getElementById('modal-auth-signup');
    if (modalAuth) modalAuth.classList.remove('active');

    // Switch back to Login Tab and populate username
    if (typeof window.switchLandingTab === 'function') {
      window.switchLandingTab('login');
    }
    window.authManager.showLoginModal();

    // Auto-fill username in login modal for quick sign in
    const loginUserEl = document.getElementById('auth-login-username');
    if (loginUserEl) loginUserEl.value = res.user.username;
    const loginPwEl = document.getElementById('auth-login-password');
    if (loginPwEl) {
      loginPwEl.value = '';
      loginPwEl.focus();
    }

    if (res.user.status === 'Pending') {
      alert(
        `Account Registration Submitted!\n\n` +
        `Your account "@${res.user.username}" (${res.user.position}) is PENDING authorization from the primary System Administrator before Administrator privileges can be granted.`
      );
    } else {
      alert(
        `Account Created Successfully!\n\n` +
        `Welcome, ${res.user.name}!\n` +
        `Verified Position: ${res.user.position} (${res.user.department} → ${res.user.role})\n\n` +
        `You can now sign in using your credentials.`
      );
    }
  };

  /* --- LANDING PORTAL CONTROLS --- */
  window.switchLandingTab = function (tabName) {
    const tabLogin = document.getElementById('tab-trigger-login');
    const tabSignup = document.getElementById('tab-trigger-signup');
    const paneLogin = document.getElementById('landing-pane-login');
    const paneSignup = document.getElementById('landing-pane-signup');

    const errLogin = document.getElementById('login-error-alert');
    const errSignup = document.getElementById('signup-error-alert');
    if (errLogin) { errLogin.style.display = 'none'; errLogin.textContent = ''; }
    if (errSignup) { errSignup.style.display = 'none'; errSignup.textContent = ''; }

    if (tabName === 'signup') {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabSignup) tabSignup.classList.add('active');
      if (paneLogin) paneLogin.style.display = 'none';
      if (paneSignup) paneSignup.style.display = 'block';
    } else {
      if (tabSignup) tabSignup.classList.remove('active');
      if (tabLogin) tabLogin.classList.add('active');
      if (paneSignup) paneSignup.style.display = 'none';
      if (paneLogin) paneLogin.style.display = 'block';
    }
  };

  window.togglePasswordVisibility = function (inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    if (!input) return;
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    if (btn) {
      btn.innerHTML = isPw
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
  };

  /* --- AUXILIARY MODALS: TERMS, PRIVACY, FORGOT PASSWORD --- */
  window.openLandingTermsModal = function () {
    const modal = document.getElementById('modal-landing-terms');
    if (modal) modal.style.display = 'flex';
  };
  window.closeLandingTermsModal = function () {
    const modal = document.getElementById('modal-landing-terms');
    if (modal) modal.style.display = 'none';
  };

  window.openLandingPrivacyModal = function () {
    const modal = document.getElementById('modal-landing-privacy');
    if (modal) modal.style.display = 'flex';
  };
  window.closeLandingPrivacyModal = function () {
    const modal = document.getElementById('modal-landing-privacy');
    if (modal) modal.style.display = 'none';
  };

  window.openLandingForgotModal = function () {
    const modal = document.getElementById('modal-landing-forgot');
    if (modal) modal.style.display = 'flex';
  };
  window.closeLandingForgotModal = function () {
    const modal = document.getElementById('modal-landing-forgot');
    if (modal) modal.style.display = 'none';
  };

})();
