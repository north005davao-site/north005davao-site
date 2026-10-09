/**
 * NORTH-005 OmniERP — Supabase Cloud Database & Realtime Synchronization Client
 * Project: north005davao-site
 * 
 * Provides instantaneous cross-device real-time sync for:
 * - System Users & Role Approvals
 * - Master Registry Workforce & Booth Assignments
 * - Attendance Records & Proof Photos
 * - Financial Transactions & Expenses
 * - Outlet Rentals
 * - Thermal Paper Logs
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://hokykdkyyuarrelxychy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhva3lrZGt5eXVhcnJlbHh5Y2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mzc5ODQsImV4cCI6MjEwNjUxMzk4NH0.YKlQEM90r5LBEyRKr-qy0YSxYXFhumeYW8o9G6C0V9k';

  class SupabaseSyncManager {
    constructor() {
      this.url = SUPABASE_URL;
      this.key = SUPABASE_ANON_KEY;
      this.client = null;
      this.isOnline = false;
      this.initClient();
    }

    initClient() {
      try {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
          this.client = window.supabase.createClient(this.url, this.key, {
            auth: {
              persistSession: true,
              autoRefreshToken: true
            }
          });
          this.isOnline = true;
          console.log('⚡ Supabase Client initialized successfully for north005davao-site');
          this.setupRealtimeListeners();
        } else {
          console.warn('Supabase SDK not loaded yet. Retrying in 1 second...');
          setTimeout(() => this.initClient(), 1000);
        }
      } catch (err) {
        console.error('Supabase initialization error:', err);
      }
    }

    /* ------------------------------------------------------------------ */
    /* REALTIME SUBSCRIPTION LISTENERS                                     */
    /* ------------------------------------------------------------------ */

    setupRealtimeListeners() {
      if (!this.client) return;

      try {
        // Listen for live attendance record updates
        this.client
          .channel('public:attendance_records')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
            console.log('🔄 Realtime Attendance update received:', payload);
            if (window.workforceAttendanceModule && typeof window.workforceAttendanceModule.render === 'function') {
              window.workforceAttendanceModule.render();
            }
          })
          .subscribe();

        // Listen for live transaction / expense updates
        this.client
          .channel('public:transactions')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
            console.log('🔄 Realtime Transaction update received:', payload);
            if (window.expensesPayment && typeof window.expensesPayment.renderCurrentTab === 'function') {
              window.expensesPayment.renderCurrentTab();
            }
          })
          .subscribe();

        // Listen for live compliance / employee document updates (Cross-Device Sync)
        this.client
          .channel('public:employee_documents')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_documents' }, (payload) => {
            console.log('🔄 Realtime Employee Document update received:', payload);
            if (window.employeeDocumentsModule && typeof window.employeeDocumentsModule.handleRealtimeUpdate === 'function') {
              window.employeeDocumentsModule.handleRealtimeUpdate(payload);
            }
          })
          .subscribe();

        // Listen for live System Snapshots & Auto-Repair Checkpoints (Realtime Cross-Device Sync)
        this.client
          .channel('public:system_snapshots')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'system_snapshots' }, (payload) => {
            console.log('🔄 Realtime Snapshot update received:', payload);
            if (window.productionSuite && window.productionSuite.snapshotManager && typeof window.productionSuite.snapshotManager.handleRealtimeSnapshotUpdate === 'function') {
              window.productionSuite.snapshotManager.handleRealtimeSnapshotUpdate(payload);
            }
          })
          .subscribe();

        // Listen for Single Active Device Session changes (Enforce 1 Login to 1 Device)
        this.client
          .channel('public:system_users_sessions')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_users' }, (payload) => {
            if (payload && payload.new && window.authManager && typeof window.authManager.handleConcurrentSessionKick === 'function') {
              window.authManager.handleConcurrentSessionKick(payload.new);
            }
          })
          .subscribe();
      } catch (e) {
        console.warn('Could not attach realtime listeners:', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* ATTENDANCE SYNC HELPERS                                            */
    /* ------------------------------------------------------------------ */

    async syncAttendanceRecord(record) {
      if (!this.client) return;
      try {
        const { data, error } = await this.client
          .from('attendance_records')
          .upsert({
            employee_id: record.employeeId,
            date: record.date || new Date().toISOString().split('T')[0],
            status: record.status,
            time_in: record.timeIn,
            time_out: record.timeOut,
            duration: record.duration,
            notes: record.notes,
            image_proof: record.imageProof || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'employee_id,date' });

        if (error) {
          console.warn('Supabase attendance sync notice:', error.message);
        }
      } catch (err) {
        console.error('Failed to sync attendance to Supabase:', err);
      }
    }

    /* ------------------------------------------------------------------ */
    /* USER ACCOUNT SYNC HELPERS                                          */
    /* ------------------------------------------------------------------ */

    async syncUserAccount(user) {
      if (!this.client) return;
      try {
        const { data, error } = await this.client
          .from('system_users')
          .upsert({
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            phone: user.phone,
            position: user.position,
            role: user.role,
            department: user.department,
            status: user.status,
            employee_id: user.employeeId || null,
            photo: user.photo || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'username' });

        if (error) {
          console.warn('Supabase user account sync notice:', error.message);
        }
      } catch (err) {
        console.error('Failed to sync user account to Supabase:', err);
      }
    }

    async fetchUsers() {
      if (!this.client) return null;
      try {
        const { data, error } = await this.client
          .from('system_users')
          .select('*');
        if (error) {
          console.warn('Supabase fetchUsers notice:', error.message);
          return null;
        }
        return data;
      } catch (err) {
        console.error('Failed to fetch users from Supabase:', err);
        return null;
      }
    }

    async deleteUserAccount(username) {
      if (!this.client || !username) return;
      try {
        await this.client
          .from('system_users')
          .delete()
          .eq('username', username);
      } catch (err) {
        console.warn('Supabase deleteUserAccount notice:', err);
      }
    }

    /* ------------------------------------------------------------------ */
    /* EMPLOYEE COMPLIANCE DOCUMENTS SYNC HELPERS (CROSS-DEVICE)           */
    /* ------------------------------------------------------------------ */

    async syncEmployeeDocument(doc) {
      if (!this.client || !doc) return false;
      try {
        const payload = {
          id: doc.id,
          employee_id: doc.employeeId,
          employee_name: doc.employeeName,
          position: doc.position || doc.employeeRole || 'Staff',
          document_type: doc.documentType,
          status: doc.status || 'Complete',
          date_uploaded: doc.dateUploaded || new Date().toISOString().split('T')[0],
          expiry_date: doc.expiryDate || '—',
          file_name: doc.fileName || null,
          file_size: doc.fileSize || null,
          file_type: doc.fileType || null,
          file_data_url: doc.fileDataUrl || null,
          notes: doc.notes || '',
          updated_at: new Date().toISOString()
        };

        const { data, error } = await this.client
          .from('employee_documents')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          console.warn('Supabase employee document sync notice:', error.message);
          return false;
        }
        return true;
      } catch (err) {
        console.error('Failed to sync employee document to Supabase:', err);
        return false;
      }
    }

    async fetchEmployeeDocuments() {
      if (!this.client) return null;
      try {
        const { data, error } = await this.client
          .from('employee_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Supabase fetchEmployeeDocuments notice:', error.message);
          return null;
        }
        if (!Array.isArray(data)) return [];

        // Map snake_case DB columns to camelCase expected by frontend module
        return data.map(d => ({
          id: d.id,
          employeeId: d.employee_id,
          employeeName: d.employee_name,
          position: d.position,
          documentType: d.document_type,
          status: d.status,
          dateUploaded: d.date_uploaded,
          expiryDate: d.expiry_date,
          fileName: d.file_name,
          fileSize: d.file_size,
          fileType: d.file_type,
          fileDataUrl: d.file_data_url,
          notes: d.notes
        }));
      } catch (err) {
        console.error('Failed to fetch employee documents from Supabase:', err);
        return null;
      }
    }

    async deleteEmployeeDocument(id, employeeId, documentType) {
      if (!this.client || (!id && !employeeId)) return false;
      try {
        let success = true;
        if (id) {
          const { error } = await this.client
            .from('employee_documents')
            .delete()
            .eq('id', id);
          if (error) {
            console.warn('Supabase deleteEmployeeDocument notice:', error.message);
            success = false;
          }
        }
        if (employeeId && documentType) {
          await this.client
            .from('employee_documents')
            .delete()
            .eq('employee_id', employeeId)
            .eq('document_type', documentType)
            .catch(() => {});
        } else if (employeeId) {
          await this.client
            .from('employee_documents')
            .delete()
            .eq('employee_id', employeeId)
            .catch(() => {});
        }
        return success;
      } catch (err) {
        console.error('Failed to delete employee document from Supabase:', err);
        return false;
      }
    }

    /* ------------------------------------------------------------------ */
    /* SYSTEM SNAPSHOTS & AUTO-REPAIR CHECKPOINTS SYNC HELPERS            */
    /* ------------------------------------------------------------------ */

    async syncSnapshot(snapshot) {
      if (!this.client || !snapshot) return false;
      try {
        const payload = {
          id: snapshot.id,
          timestamp: snapshot.timestamp || new Date().toISOString(),
          formatted_time: snapshot.formattedTime || new Date().toLocaleString(),
          reason: snapshot.reason || 'Manual Snapshot',
          version: snapshot.version || 'MRV-CURRENT',
          staff_count: snapshot.staffCount || 0,
          relievers_count: snapshot.relieversCount || 0,
          booths_count: snapshot.boothsCount || 0,
          data: snapshot.data || null,
          created_at: new Date().toISOString()
        };

        if (this.client) {
          const { error } = await this.client
            .from('system_snapshots')
            .upsert(payload, { onConflict: 'id' });

          if (!error) success = true;
          else console.warn('Supabase snapshot sync notice:', error.message);
        }

        // Server API fallback
        try {
          if (typeof fetch !== 'undefined') {
            const res = await fetch('/api/snapshots');
            let current = res.ok ? await res.json() : { snapshots: [] };
            let list = Array.isArray(current) ? current : (current.snapshots || []);
            list = list.filter(s => s.id !== snapshot.id);
            list.unshift(snapshot);
            await fetch('/api/snapshots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ snapshots: list })
            });
            success = true;
          }
        } catch (e) {}

        return success;
      } catch (err) {
        console.error('Failed to sync snapshot:', err);
        return false;
      }
    }

    async fetchSnapshots() {
      try {
        if (this.client) {
          const { data, error } = await this.client
            .from('system_snapshots')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(10);

          if (!error && Array.isArray(data) && data.length > 0) {
            return data.map(s => ({
              id: s.id,
              timestamp: s.timestamp,
              formattedTime: s.formatted_time,
              reason: s.reason,
              version: s.version,
              staffCount: s.staff_count,
              relieversCount: s.relievers_count,
              boothsCount: s.booths_count,
              data: s.data
            }));
          }
        }

        // Server API fallback
        if (typeof fetch !== 'undefined') {
          const res = await fetch('/api/snapshots');
          if (res.ok) {
            const json = await res.json();
            return Array.isArray(json) ? json : (json.snapshots || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch snapshots:', err);
      }
      return null;
    }

    async deleteSnapshot(id) {
      if (!id) return false;
      let success = false;
      try {
        if (this.client) {
          const { error } = await this.client
            .from('system_snapshots')
            .delete()
            .eq('id', id);

          if (!error) success = true;
          else console.warn('Supabase deleteSnapshot notice:', error.message);
        }

        // Server API fallback
        try {
          if (typeof fetch !== 'undefined') {
            await fetch(`/api/snapshots?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            success = true;
          }
        } catch (e) {}

        return success;
      } catch (err) {
        console.error('Failed to delete snapshot:', err);
        return false;
      }
    }

    /* ------------------------------------------------------------------ */
    /* SINGLE ACTIVE DEVICE SESSION MANAGEMENT (1 LOGIN PER ACCOUNT)      */
    /* ------------------------------------------------------------------ */

    async updateActiveUserSession(username, sessionToken, deviceName) {
      if (!username) return false;
      let success = false;

      // 1. Authoritative Server ERP Session API
      try {
        if (typeof fetch !== 'undefined') {
          const res = await fetch('/api/user-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              active_session_token: sessionToken,
              active_device_name: deviceName,
              last_active_at: new Date().toISOString()
            })
          });
          if (res.ok) success = true;
        }
      } catch (_) {}

      // 2. Best-effort Supabase cloud database sync
      try {
        if (this.client && this.isOnline) {
          await this.client
            .from('system_users')
            .update({
              active_session_token: sessionToken,
              active_device_name: deviceName,
              last_active_at: new Date().toISOString()
            })
            .eq('username', username);
        }
      } catch (_) {}

      return success;
    }

    async fetchUserSession(username) {
      if (!username) return null;

      // 1. Authoritative Server ERP Session API (same-origin, zero CORS preflight overhead)
      try {
        if (typeof fetch !== 'undefined') {
          const res = await fetch(`/api/user-sessions?username=${encodeURIComponent(username)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.session || data.active_session_token || data.username)) {
              return data.session || data;
            }
          }
        }
      } catch (_) {}

      // 2. Fallback to Supabase cloud database if available
      try {
        if (this.client && this.isOnline) {
          const { data, error } = await this.client
            .from('system_users')
            .select('active_session_token, active_device_name, last_active_at')
            .eq('username', username)
            .maybeSingle();

          if (!error && data) return data;
        }
      } catch (_) {}

      return null;
    }
  }

  window.supabaseSync = new SupabaseSyncManager();
})();
