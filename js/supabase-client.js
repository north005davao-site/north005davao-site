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

  const SUPABASE_URL = 'https://hokykdkyyuarrelxcychy.supabase.co';
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
  }

  window.supabaseSync = new SupabaseSyncManager();
})();
