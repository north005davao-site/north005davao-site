/**
 * NORTH-005 OmniERP — User & Access Management Module
 * Interactive KPI Card Tabs, Pagination, Search Dropdown, and Modal Confirmations.
 */

(function () {
  'use strict';

  class UserManagementModule {
    constructor() {
      this.searchQuery = '';
      this.roleFilter = 'all';
      this.statusFilter = 'all';
      this.activeKpiTab = 'all'; // 'all', 'Active', 'Pending', 'Administrator', 'Supervisor', 'Collector'

      // Pagination
      this.currentPage = 1;
      this.pageSize = 10;

      // Pending modal operations
      this.pendingSaveData = null;
      this.pendingDeleteId = null;
    }

    init() {
      this.populateDatalist();
      this.render();
    }

    getUsers() {
      if (window.authManager && typeof window.authManager.getUsers === 'function') {
        return window.authManager.getUsers();
      }
      return [];
    }

    populateDatalist() {
      const datalist = document.getElementById('user-mgmt-search-datalist');
      if (!datalist) return;
      const users = this.getUsers();
      datalist.innerHTML = users.map(u => `
        <option value="${u.name}">
        <option value="@${u.username}">
        <option value="${u.email}">
        <option value="${u.position}">
        <option value="${u.role}">
      `).join('');
    }

    setKpiTab(tabKey) {
      this.activeKpiTab = tabKey;
      this.currentPage = 1;

      // Update card active classes
      const cardMap = {
        'all': 'um-tab-total',
        'Active': 'um-tab-active',
        'Pending': 'um-tab-pending',
        'Administrator': 'um-tab-admin',
        'Supervisor': 'um-tab-supervisor',
        'Collector': 'um-tab-collector'
      };

      document.querySelectorAll('.kpi-card-tab').forEach(card => card.classList.remove('active'));
      const activeCard = document.getElementById(cardMap[tabKey]);
      if (activeCard) activeCard.classList.add('active');

      // Align dropdown filters if applicable
      const roleEl = document.getElementById('user-mgmt-filter-role');
      const statusEl = document.getElementById('user-mgmt-filter-status');

      if (tabKey === 'Administrator' || tabKey === 'Supervisor' || tabKey === 'Collector') {
        if (roleEl) roleEl.value = tabKey;
        if (statusEl) statusEl.value = 'all';
        this.roleFilter = tabKey;
        this.statusFilter = 'all';
      } else if (tabKey === 'Active' || tabKey === 'Pending') {
        if (statusEl) statusEl.value = tabKey;
        if (roleEl) roleEl.value = 'all';
        this.statusFilter = tabKey;
        this.roleFilter = 'all';
      } else {
        if (roleEl) roleEl.value = 'all';
        if (statusEl) statusEl.value = 'all';
        this.roleFilter = 'all';
        this.statusFilter = 'all';
      }

      this.render();
    }

    filterUsers() {
      const searchEl = document.getElementById('user-mgmt-search');
      const roleEl = document.getElementById('user-mgmt-filter-role');
      const statusEl = document.getElementById('user-mgmt-filter-status');

      if (searchEl) this.searchQuery = searchEl.value.trim().toLowerCase();
      if (roleEl) this.roleFilter = roleEl.value;
      if (statusEl) this.statusFilter = statusEl.value;

      this.currentPage = 1;
      this.render();
    }

    setPage(page) {
      this.currentPage = page;
      this.render();
    }

    setPageSize(size) {
      this.pageSize = parseInt(size, 10) || 10;
      this.currentPage = 1;
      this.render();
    }

    render() {
      const tbody = document.getElementById('user-mgmt-tbody');
      if (!tbody) return;

      const users = this.getUsers();
      const isAdmin = window.authManager && window.authManager.isAdmin();
      const currentUser = window.authManager ? window.authManager.getCurrentUser() : null;

      // Update KPIs counters
      const totalCount = users.length;
      const activeCount = users.filter(u => u.status === 'Active').length;
      const pendingCount = users.filter(u => u.status === 'Pending').length;
      const adminCount = users.filter(u => u.role === 'Administrator').length;
      const supervisorCount = users.filter(u => u.role === 'Supervisor').length;
      const collectorCount = users.filter(u => u.role === 'Collector').length;

      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setTxt('kpi-users-total', totalCount);
      setTxt('kpi-users-active', activeCount);
      setTxt('kpi-users-pending', pendingCount);
      setTxt('kpi-users-admin', adminCount);
      setTxt('kpi-users-supervisor', supervisorCount);
      setTxt('kpi-users-collector', collectorCount);

      // Pending alert
      const pendingAlert = document.getElementById('pending-users-alert');
      if (pendingAlert) {
        pendingAlert.style.display = (isAdmin && pendingCount > 0) ? 'block' : 'none';
        pendingAlert.innerHTML = `⚠️ <strong>${pendingCount} Pending User${pendingCount > 1 ? 's' : ''}</strong> awaiting Administrator activation.`;
      }

      // Filter users
      const filtered = users.filter(u => {
        // KPI Tab Filter
        if (this.activeKpiTab === 'Active' && u.status !== 'Active') return false;
        if (this.activeKpiTab === 'Pending' && u.status !== 'Pending') return false;
        if (this.activeKpiTab === 'Administrator' && u.role !== 'Administrator') return false;
        if (this.activeKpiTab === 'Supervisor' && u.role !== 'Supervisor') return false;
        if (this.activeKpiTab === 'Collector' && u.role !== 'Collector') return false;

        // Dropdown filters
        if (this.roleFilter !== 'all' && u.role !== this.roleFilter) return false;
        if (this.statusFilter !== 'all' && u.status !== this.statusFilter) return false;

        // Search Query
        if (this.searchQuery) {
          const q = this.searchQuery.replace(/^@/, '');
          const target = `${u.name} ${u.username} ${u.email} ${u.phone} ${u.position} ${u.role} ${u.status}`.toLowerCase();
          if (!target.includes(q)) return false;
        }
        return true;
      });

      // Pagination Calculation
      const totalRecords = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalRecords / this.pageSize));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      if (this.currentPage < 1) this.currentPage = 1;

      const startIndex = (this.currentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, totalRecords);
      const paginated = filtered.slice(startIndex, endIndex);

      // Render Pagination Bar
      this.renderPagination(totalRecords, totalPages);

      if (paginated.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.6;">👥</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">No User Accounts Found</div>
              <div style="font-size: 12px;">No system accounts match your search filters or active tab. Try resetting filters.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = paginated.map(u => {
        const isSelf = currentUser && currentUser.username === u.username;
        const initials = window.authManager ? window.authManager.getInitials(u.name) : '??';

        let roleBadge = '';
        if (u.role === 'Administrator') {
          roleBadge = `<span class="badge" style="background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.5);font-weight:700;padding:3px 8px;border-radius:4px;font-size:11px;">👑 Administrator</span>`;
        } else if (u.role === 'Supervisor') {
          roleBadge = `<span class="badge" style="background:rgba(59,130,246,0.18);color:#93c5fd;border:1px solid rgba(59,130,246,0.5);font-weight:700;padding:3px 8px;border-radius:4px;font-size:11px;">👔 Supervisor</span>`;
        } else if (u.role === 'Collector') {
          roleBadge = `<span class="badge" style="background:rgba(16,185,129,0.18);color:#6ee7b7;border:1px solid rgba(16,185,129,0.5);font-weight:700;padding:3px 8px;border-radius:4px;font-size:11px;">🚚 Collector</span>`;
        } else {
          roleBadge = `<span class="badge badge-neutral" style="padding:3px 8px;font-size:11px;">${u.role || 'Staff'}</span>`;
        }

        let statusBadge = '';
        if (u.status === 'Active') {
          statusBadge = `<span class="badge badge-success" style="padding:3px 8px;font-size:11px;">● Active</span>`;
        } else if (u.status === 'Pending') {
          statusBadge = `<span class="badge badge-warning" style="background:rgba(245,158,11,0.25);color:#fbbf24;border:1px solid #f59e0b;padding:3px 8px;font-size:11px;font-weight:700;">⏳ Pending Approval</span>`;
        } else if (u.status === 'Suspended') {
          statusBadge = `<span class="badge badge-danger" style="padding:3px 8px;font-size:11px;">⚠️ Suspended</span>`;
        } else {
          statusBadge = `<span class="badge badge-neutral" style="padding:3px 8px;font-size:11px;">Inactive</span>`;
        }

        const avatarBg = u.role === 'Administrator' 
          ? 'linear-gradient(135deg, #f59e0b, #b45309)' 
          : (u.role === 'Supervisor' 
              ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' 
              : (u.role === 'Collector' 
                  ? 'linear-gradient(135deg, #10b981, #047857)' 
                  : 'linear-gradient(135deg, #64748b, #334155)'));

        const avatarHtml = u.photo
          ? `<img src="${u.photo}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1.5px solid var(--accent-gold);" alt="${u.name}">`
          : `<div style="width:34px;height:34px;border-radius:50%;background:${avatarBg};color:#fff;font-weight:800;font-size:11.5px;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${initials}</div>`;

        let actionBtns = '';
        if (isAdmin) {
          if (u.status === 'Pending') {
            actionBtns += `
              <button class="btn btn-xs" onclick="window.userManagementModule.quickApprove('${u.id}')" style="background:#10b981;color:#000;font-weight:700;padding:3px 8px;font-size:11px;margin-right:4px;" title="Approve & Activate Account">
                ✓ Approve
              </button>
            `;
          } else if (u.status === 'Active' && !isSelf) {
            actionBtns += `
              <button class="btn btn-xs btn-secondary" onclick="window.userManagementModule.toggleSuspend('${u.id}')" style="color:#f59e0b;padding:3px 6px;font-size:11px;margin-right:4px;" title="Suspend User">
                ⏸ Suspend
              </button>
            `;
          } else if (u.status === 'Suspended') {
            actionBtns += `
              <button class="btn btn-xs btn-secondary" onclick="window.userManagementModule.toggleSuspend('${u.id}')" style="color:#10b981;padding:3px 6px;font-size:11px;margin-right:4px;" title="Reactivate User">
                ▶ Reactivate
              </button>
            `;
          }

          actionBtns += `
            <button class="btn btn-xs btn-secondary" onclick="window.userManagementModule.openEditUserModal('${u.id}')" style="padding:3px 8px;font-size:11px;margin-right:4px;" title="Edit Account">
              ✏️ Edit
            </button>
          `;

          if (!isSelf) {
            actionBtns += `
              <button class="btn btn-xs btn-secondary" onclick="window.userManagementModule.promptDelete('${u.id}')" style="color:#ef4444;padding:3px 8px;font-size:11px;" title="Delete User">
                🗑️ Delete
              </button>
            `;
          }
        } else {
          actionBtns = `<span style="font-size:11px;color:var(--text-muted);">View-only</span>`;
        }

        return `
          <tr style="${isSelf ? 'background: rgba(245, 158, 11, 0.04);' : ''}">
            <td style="text-align: center;">${avatarHtml}</td>
            <td>
              <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">
                ${u.name} ${isSelf ? '<span class="badge badge-warning" style="font-size:9.5px;padding:1px 4px;margin-left:4px;">YOU</span>' : ''}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">@${u.username}</div>
            </td>
            <td>
              <div style="font-size: 12px; color: var(--text-main);">${u.email || '-'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${u.phone || '-'}</div>
            </td>
            <td>
              <div style="font-size: 12px; font-weight: 600;">${u.position || 'Operations Staff'}</div>
            </td>
            <td style="text-align: center;">${roleBadge}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="font-size: 11.5px; color: var(--text-muted);">${u.dateCreated || '-'}</td>
            <td style="font-size: 11.5px; color: var(--text-muted);">${u.lastLogin || 'Never'}</td>
            <td style="text-align: center; white-space: nowrap;">${actionBtns}</td>
          </tr>
        `;
      }).join('');
    }

    renderPagination(totalRecords, totalPages) {
      const container = document.getElementById('user-mgmt-pagination');
      if (!container) return;

      let pagesHtml = '';
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
          pagesHtml += `
            <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="window.userManagementModule.setPage(${i})">
              ${i}
            </button>
          `;
        } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
          pagesHtml += `<span style="color:var(--text-muted);padding:0 2px;">...</span>`;
        }
      }

      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
            Rows per page:
            <select class="form-select" onchange="window.userManagementModule.setPageSize(this.value)" style="padding:2px 8px;font-size:12px;width:auto;display:inline-block;margin-left:4px;">
              <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="15" ${this.pageSize === 15 ? 'selected' : ''}>15</option>
              <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20</option>
              <option value="25" ${this.pageSize === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
          </div>
          <div style="font-size:12px;color:var(--text-muted);font-weight:600;">
            Page ${this.currentPage} of ${totalPages} <span style="opacity:0.6;">(${totalRecords} accounts)</span>
          </div>
        </div>
        <div class="pagination-controls">
          <button class="pagination-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.userManagementModule.setPage(${this.currentPage - 1})">
            Previous
          </button>
          ${pagesHtml}
          <button class="pagination-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="window.userManagementModule.setPage(${this.currentPage + 1})">
            Next
          </button>
        </div>
      `;
    }

    openCreateUserModal() {
      if (!window.authManager || !window.authManager.isAdmin()) {
        alert('Permission Denied: Only Administrators can create accounts.');
        return;
      }
      document.getElementById('user-form-modal-title').textContent = 'Create New System User Account';
      document.getElementById('user-form-id').value = '';
      document.getElementById('user-form-fullname').value = '';
      document.getElementById('user-form-username').value = '';
      document.getElementById('user-form-username').disabled = false;
      document.getElementById('user-form-position').value = '';
      document.getElementById('user-form-email').value = '';
      document.getElementById('user-form-phone').value = '';
      document.getElementById('user-form-role').value = 'Supervisor';
      document.getElementById('user-form-status').value = 'Active';
      document.getElementById('user-form-password').value = '';
      document.getElementById('user-form-password').placeholder = 'Min. 6 characters';
      document.getElementById('user-form-photo').value = '';

      const modal = document.getElementById('modal-user-account-form');
      if (modal) modal.classList.add('active');
    }

    openEditUserModal(id) {
      if (!window.authManager || !window.authManager.isAdmin()) {
        alert('Permission Denied: Only Administrators can edit user accounts.');
        return;
      }
      const users = this.getUsers();
      const user = users.find(u => u.id === id);
      if (!user) return;

      document.getElementById('user-form-modal-title').textContent = `Edit User: ${user.name} (@${user.username})`;
      document.getElementById('user-form-id').value = user.id;
      document.getElementById('user-form-fullname').value = user.name;
      document.getElementById('user-form-username').value = user.username;
      document.getElementById('user-form-username').disabled = true;
      document.getElementById('user-form-position').value = user.position || '';
      document.getElementById('user-form-email').value = user.email || '';
      document.getElementById('user-form-phone').value = user.phone || '';
      document.getElementById('user-form-role').value = user.role;
      document.getElementById('user-form-status').value = user.status;
      document.getElementById('user-form-password').value = '';
      document.getElementById('user-form-password').placeholder = 'Leave blank to keep unchanged';
      document.getElementById('user-form-photo').value = user.photo || '';

      const modal = document.getElementById('modal-user-account-form');
      if (modal) modal.classList.add('active');
    }

    closeUserFormModal() {
      const modal = document.getElementById('modal-user-account-form');
      if (modal) modal.classList.remove('active');
    }

    /* --- CONFIRMATION MODAL BEFORE SAVE --- */
    saveUserAccount() {
      const id = document.getElementById('user-form-id').value;
      const fullname = document.getElementById('user-form-fullname').value.trim();
      const username = document.getElementById('user-form-username').value.trim().toLowerCase();
      const position = document.getElementById('user-form-position').value.trim();
      const email = document.getElementById('user-form-email').value.trim();
      const phone = document.getElementById('user-form-phone').value.trim();
      const role = document.getElementById('user-form-role').value;
      const status = document.getElementById('user-form-status').value;
      const password = document.getElementById('user-form-password').value;
      const photo = document.getElementById('user-form-photo').value.trim();

      if (!fullname) { alert('Full Name is required.'); return; }
      if (!username) { alert('Username is required.'); return; }

      const users = this.getUsers();
      if (!id) {
        if (!password || password.length < 6) {
          alert('Password must be at least 6 characters.');
          return;
        }
        if (users.some(u => u.username === username)) {
          alert(`Username "@${username}" already exists.`);
          return;
        }
      }

      this.pendingSaveData = { id, fullname, username, position, email, phone, role, status, password, photo };

      // Show confirmation modal
      const confirmModal = document.getElementById('modal-user-confirm-save');
      if (confirmModal) confirmModal.classList.add('active');
    }

    cancelSaveConfirmation() {
      this.pendingSaveData = null;
      const confirmModal = document.getElementById('modal-user-confirm-save');
      if (confirmModal) confirmModal.classList.remove('active');
    }

    executeSaveUser() {
      if (!this.pendingSaveData) return;
      const { id, fullname, username, position, email, phone, role, status, password, photo } = this.pendingSaveData;
      const users = this.getUsers();

      if (!id) {
        const now = new Date();
        const newUser = {
          id: `USR-${String(Date.now()).slice(-5)}`,
          username,
          name: fullname,
          email: email || `${username}@apex-omni.ph`,
          phone: phone || 'N/A',
          position: position || (role === 'Administrator' ? 'Operations Administrator' : (role === 'Collector' ? 'Field Collector' : 'Operations Supervisor')),
          role,
          status,
          password,
          photo,
          dateCreated: now.toISOString().split('T')[0],
          lastLogin: 'Never'
        };
        users.push(newUser);
        window.authManager.saveUsers(users);
        window.authManager.logHistory(username, 'Created', `Account created by Admin (${role})`);
        alert(`User account "${fullname}" created successfully.`);
      } else {
        const idx = users.findIndex(u => u.id === id);
        if (idx !== -1) {
          // Check last admin protection
          if (users[idx].role === 'Administrator' && role !== 'Administrator') {
            const otherAdmins = users.filter(u => u.id !== id && u.role === 'Administrator' && u.status === 'Active');
            if (otherAdmins.length === 0) {
              alert('Cannot change role: The system requires at least one active Administrator.');
              this.cancelSaveConfirmation();
              return;
            }
          }

          users[idx].name = fullname;
          users[idx].position = position;
          users[idx].email = email;
          users[idx].phone = phone;
          users[idx].role = role;
          users[idx].status = status;
          users[idx].photo = photo;
          if (password && password.length >= 6) {
            users[idx].password = password;
          }

          window.authManager.saveUsers(users);

          // If updating active session user, update sessionStorage
          const cur = window.authManager.getCurrentUser();
          if (cur && cur.id === id) {
            window.authManager.setSessionUser(users[idx]);
          }
          alert(`User account "${fullname}" updated.`);
        }
      }

      this.cancelSaveConfirmation();
      this.closeUserFormModal();
      this.render();
      window.authManager.updateProfileUi();
      this.populateDatalist();
    }

    /* --- CONFIRMATION MODAL BEFORE DELETE --- */
    promptDelete(id) {
      if (!window.authManager || !window.authManager.isAdmin()) return;
      const users = this.getUsers();
      const user = users.find(u => u.id === id);
      if (!user) return;

      const cur = window.authManager.getCurrentUser();
      if (cur && cur.id === id) {
        alert('You cannot delete your own currently logged-in account.');
        return;
      }

      if (user.role === 'Administrator') {
        const otherAdmins = users.filter(u => u.id !== id && u.role === 'Administrator');
        if (otherAdmins.length === 0) {
          alert('Cannot delete the only remaining Administrator.');
          return;
        }
      }

      this.pendingDeleteId = id;
      const targetEl = document.getElementById('delete-user-name-target');
      if (targetEl) {
        targetEl.innerHTML = `Are you sure you want to permanently delete <strong>${user.name}</strong> (<code>@${user.username}</code>)?`;
      }

      const modal = document.getElementById('modal-user-confirm-delete');
      if (modal) modal.classList.add('active');
    }

    cancelDeleteConfirmation() {
      this.pendingDeleteId = null;
      const modal = document.getElementById('modal-user-confirm-delete');
      if (modal) modal.classList.remove('active');
    }

    executeDeleteUser() {
      if (!this.pendingDeleteId) return;
      const users = this.getUsers();
      const user = users.find(u => u.id === this.pendingDeleteId);
      if (user) {
        if (window.authManager && typeof window.authManager.deleteUser === 'function') {
          window.authManager.deleteUser(this.pendingDeleteId);
        } else {
          const updated = users.filter(u => u.id !== this.pendingDeleteId);
          window.authManager.saveUsers(updated);
        }
        alert(`Account "@${user.username}" (${user.name}) has been permanently deleted.`);
      }

      this.cancelDeleteConfirmation();
      this.render();
      this.populateDatalist();
    }

    quickApprove(id) {
      if (!window.authManager || !window.authManager.isAdmin()) return;
      const users = this.getUsers();
      const user = users.find(u => u.id === id);
      if (!user) return;

      const isSupervisor = confirm(
        `Activate account for "${user.name}" (@${user.username})?\n\n` +
        `Click [OK] to assign role: SUPERVISOR (Recommended)\n` +
        `Click [Cancel] to assign role: ADMINISTRATOR`
      );

      user.role = isSupervisor ? 'Supervisor' : 'Administrator';
      user.status = 'Active';

      window.authManager.saveUsers(users);
      window.authManager.logHistory(user.username, 'Approved', `Activated as ${user.role}`);
      alert(`Account "@${user.username}" is now ACTIVE as ${user.role}.`);
      this.render();
      window.authManager.updateProfileUi();
    }

    toggleSuspend(id) {
      if (!window.authManager || !window.authManager.isAdmin()) return;
      const users = this.getUsers();
      const user = users.find(u => u.id === id);
      if (!user) return;

      const cur = window.authManager.getCurrentUser();
      if (cur && cur.id === id) {
        alert('You cannot suspend your own currently active account.');
        return;
      }

      if (user.status === 'Active') {
        user.status = 'Suspended';
        alert(`Account "@${user.username}" suspended.`);
      } else {
        user.status = 'Active';
        alert(`Account "@${user.username}" reactivated.`);
      }

      window.authManager.saveUsers(users);
      this.render();
    }
  }

  window.userManagementModule = new UserManagementModule();
})();
