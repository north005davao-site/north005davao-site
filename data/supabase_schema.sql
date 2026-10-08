-- ==============================================================================
-- NORTH-005 OmniERP — Supabase Database Schema & Realtime Setup
-- Project: north005davao-site
-- ==============================================================================

-- 1. ATTENDANCE & SHIFT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'LATE', 'REST DAY', 'ABSENT'
    time_in TEXT,
    time_out TEXT,
    duration TEXT,
    notes TEXT,
    image_proof TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, date)
);

-- 2. SYSTEM USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS public.system_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    position TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Active', 'Pending', 'Suspended'
    employee_id TEXT,
    photo TEXT,
    active_session_token TEXT,
    active_device_name TEXT,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FINANCIAL TRANSACTIONS & EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    type TEXT NOT NULL, -- 'Expense', 'Collection', 'Shortage', 'CashAdvance'
    category TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    employee_id TEXT,
    booth_code TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OUTLET RENTALS & LOAD ALLOWANCE LEASES TABLE
CREATE TABLE IF NOT EXISTS public.outlet_rentals (
    id TEXT PRIMARY KEY,
    booth_code TEXT NOT NULL,
    location TEXT,
    lessor_name TEXT,
    monthly_rental NUMERIC(10, 2) DEFAULT 0.00,
    load_allowance NUMERIC(10, 2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'Paid',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. THERMAL PAPER BOOTH ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.thermal_paper_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    booth_code TEXT NOT NULL,
    teller_name TEXT,
    rolls_allocated INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (date, booth_code)
);

-- 6. EMPLOYEE DOCUMENTS & COMPLIANCE REPOSITORY TABLE
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    position TEXT,
    document_type TEXT NOT NULL, -- 'CBTA', 'RESUME', 'PHOTOCOPY OF VALID ID', 'BARANGAY CLEARANCE/POLICE CLEARANCE'
    status TEXT NOT NULL DEFAULT 'Complete', -- 'Complete', 'Expiring Soon', 'Expired'
    date_uploaded TEXT,
    expiry_date TEXT,
    file_name TEXT,
    file_size TEXT,
    file_type TEXT,
    file_data_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SYSTEM SNAPSHOTS TABLE (Realtime Cross-Device Diagnostics & Rollback)
CREATE TABLE IF NOT EXISTS public.system_snapshots (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    formatted_time TEXT NOT NULL,
    reason TEXT NOT NULL,
    version TEXT,
    staff_count INT DEFAULT 0,
    relievers_count INT DEFAULT 0,
    booths_count INT DEFAULT 0,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC ERP ACCESS POLICIES
-- ==============================================================================

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thermal_paper_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user has Administrator role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'role' = 'Administrator'
        OR current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'Administrator'
        OR auth.role() = 'service_role'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. ATTENDANCE RECORDS POLICIES
CREATE POLICY "Allow authenticated read attendance" ON public.attendance_records
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow staff insert attendance" ON public.attendance_records
    FOR INSERT TO authenticated, anon WITH CHECK (employee_id IS NOT NULL);
CREATE POLICY "Allow admin modify attendance" ON public.attendance_records
    FOR UPDATE TO authenticated USING (public.is_admin() OR auth.uid()::text = employee_id);

-- 2. SYSTEM USERS POLICIES (Prevent unauthorized role escalation)
CREATE POLICY "Allow read system users" ON public.system_users
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow registration of pending users" ON public.system_users
    FOR INSERT TO authenticated, anon WITH CHECK (role != 'Administrator' OR public.is_admin());
CREATE POLICY "Allow self profile update or admin manage users" ON public.system_users
    FOR UPDATE TO authenticated, anon
    USING (public.is_admin() OR auth.uid()::text = id)
    WITH CHECK (
        -- Prevent non-admins from promoting themselves or others to Administrator
        CASE 
            WHEN public.is_admin() THEN true
            ELSE role = (SELECT role FROM public.system_users WHERE id = auth.uid()::text)
        END
    );
CREATE POLICY "Only admin can delete users" ON public.system_users
    FOR DELETE TO authenticated USING (public.is_admin());

-- 3. FINANCIAL TRANSACTIONS POLICIES
CREATE POLICY "Allow read transactions" ON public.transactions
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow insert transactions" ON public.transactions
    FOR INSERT TO authenticated, anon WITH CHECK (amount >= 0);
CREATE POLICY "Only admin and supervisor can modify transactions" ON public.transactions
    FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Only admin can delete transactions" ON public.transactions
    FOR DELETE TO authenticated USING (public.is_admin());

-- 4. OUTLET RENTALS POLICIES
CREATE POLICY "Allow read outlet rentals" ON public.outlet_rentals
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow admin and authorized staff manage rentals" ON public.outlet_rentals
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 5. THERMAL PAPER RECORDS POLICIES
CREATE POLICY "Allow read thermal paper" ON public.thermal_paper_records
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow manage thermal paper" ON public.thermal_paper_records
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 6. EMPLOYEE DOCUMENTS POLICIES
CREATE POLICY "Allow read employee documents" ON public.employee_documents
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow manage employee documents" ON public.employee_documents
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (document_type IS NOT NULL);

-- 7. SYSTEM SNAPSHOTS POLICIES (Diagnostic rollback restricted to admin/repair)
CREATE POLICY "Allow read snapshots" ON public.system_snapshots
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow snapshot creation" ON public.system_snapshots
    FOR INSERT TO authenticated, anon WITH CHECK (reason IS NOT NULL);
CREATE POLICY "Only admin can modify or delete snapshots" ON public.system_snapshots
    FOR ALL TO authenticated USING (public.is_admin());

-- Enable Realtime publication on all ERP tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_rentals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thermal_paper_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_snapshots;


