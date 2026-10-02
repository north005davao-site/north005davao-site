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

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC ERP ACCESS POLICIES
-- ==============================================================================

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thermal_paper_records ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for authenticated ERP operations via Supabase anon key
CREATE POLICY "Allow all operations for ERP attendance" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for ERP users" ON public.system_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for ERP transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for ERP rentals" ON public.outlet_rentals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for ERP thermal paper" ON public.thermal_paper_records FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime publication on all ERP tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_rentals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thermal_paper_records;
