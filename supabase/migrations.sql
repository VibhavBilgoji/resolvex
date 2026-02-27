-- ============================================================
-- ResolveX - Smart Citizen Grievance Redressal System
-- Supabase Database Migration
-- Run this in the Supabase SQL Editor (in order)
-- ============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('citizen', 'department_admin', 'system_super_admin');
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'rejected');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');

-- ============================================================
-- 3. TABLES
-- ============================================================

-- DEPARTMENTS (created before users/complaints as it is referenced by both)
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USERS (mirrors auth.users, populated via trigger on sign-up)
CREATE TABLE users (
    id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    role          user_role DEFAULT 'citizen',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMPLAINTS
CREATE TABLE complaints (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id          UUID REFERENCES users(id) ON DELETE SET NULL,

    title               TEXT NOT NULL,
    original_text       TEXT NOT NULL,
    translated_text     TEXT,
    image_url           TEXT,

    -- Location Strategy
    latitude            FLOAT,
    longitude           FLOAT,
    address_landmark    TEXT NOT NULL,
    pincode             TEXT NOT NULL,
    municipal_ward      TEXT,

    -- AI Routing Result
    category            TEXT,
    priority            priority_level,
    department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
    status              complaint_status DEFAULT 'open',
    ai_confidence_score FLOAT,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RESOLUTIONS (for RAG & resolution history)
CREATE TABLE resolutions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id         UUID REFERENCES complaints(id) ON DELETE CASCADE,
    resolved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_text      TEXT NOT NULL,
    resolution_embedding vector(768),
    resolved_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

-- Complaint lookup by citizen
CREATE INDEX idx_complaints_citizen_id ON complaints(citizen_id);

-- Complaint lookup by department (for admin dashboards)
CREATE INDEX idx_complaints_department_id ON complaints(department_id);

-- Complaint lookup by status
CREATE INDEX idx_complaints_status ON complaints(status);

-- Complaint lookup by municipal ward
CREATE INDEX idx_complaints_municipal_ward ON complaints(municipal_ward);

-- Complaint lookup by priority
CREATE INDEX idx_complaints_priority ON complaints(priority);

-- Resolution lookup by complaint
CREATE INDEX idx_resolutions_complaint_id ON resolutions(complaint_id);

-- pgvector IVFFlat index for fast ANN similarity search
-- NOTE: Populate with data before creating this index for best performance.
-- Re-create with a higher `lists` value once you have > 1000 resolutions.
CREATE INDEX idx_resolutions_embedding ON resolutions
    USING ivfflat (resolution_embedding vector_cosine_ops)
    WITH (lists = 100);

-- ============================================================
-- 5. AUTO-UPDATE `updated_at` TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. AUTO-CREATE USER PROFILE ON SIGN-UP TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'citizen'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;

-- --------------------
-- Helper function: get current user's role from the users table
-- --------------------
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's department_id
CREATE OR REPLACE FUNCTION get_my_department_id()
RETURNS UUID AS $$
    SELECT department_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- --------------------
-- USERS policies
-- --------------------

-- Any authenticated user can read their own profile
CREATE POLICY "users_select_own"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Super admins can read all user profiles
CREATE POLICY "users_select_all_super_admin"
    ON users FOR SELECT
    USING (get_my_role() = 'system_super_admin');

-- Users can update their own profile (name only; role changes require super admin)
CREATE POLICY "users_update_own"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Super admins can update any user (e.g., assign roles and departments)
CREATE POLICY "users_update_super_admin"
    ON users FOR UPDATE
    USING (get_my_role() = 'system_super_admin');

-- Insert handled by trigger; block direct inserts except service role
CREATE POLICY "users_insert_trigger_only"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- --------------------
-- DEPARTMENTS policies
-- --------------------

-- All authenticated users can read departments (needed for complaint form dropdowns)
CREATE POLICY "departments_select_authenticated"
    ON departments FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only super admins can insert/update/delete departments
CREATE POLICY "departments_insert_super_admin"
    ON departments FOR INSERT
    WITH CHECK (get_my_role() = 'system_super_admin');

CREATE POLICY "departments_update_super_admin"
    ON departments FOR UPDATE
    USING (get_my_role() = 'system_super_admin');

CREATE POLICY "departments_delete_super_admin"
    ON departments FOR DELETE
    USING (get_my_role() = 'system_super_admin');

-- --------------------
-- COMPLAINTS policies
-- --------------------

-- Citizens can insert their own complaints
CREATE POLICY "complaints_insert_citizen"
    ON complaints FOR INSERT
    WITH CHECK (auth.uid() = citizen_id);

-- Citizens can read only their own complaints
CREATE POLICY "complaints_select_own"
    ON complaints FOR SELECT
    USING (auth.uid() = citizen_id);

-- Department admins can read complaints assigned to their department
CREATE POLICY "complaints_select_dept_admin"
    ON complaints FOR SELECT
    USING (
        get_my_role() = 'department_admin'
        AND department_id = get_my_department_id()
    );

-- Department admins can update complaints in their department
CREATE POLICY "complaints_update_dept_admin"
    ON complaints FOR UPDATE
    USING (
        get_my_role() = 'department_admin'
        AND department_id = get_my_department_id()
    );

-- Super admins have full read/write access to complaints
CREATE POLICY "complaints_all_super_admin"
    ON complaints FOR ALL
    USING (get_my_role() = 'system_super_admin');

-- Service role (used by AI pipeline server actions) can update any complaint
-- This is handled via the admin client (SUPABASE_SERVICE_ROLE_KEY) which bypasses RLS.

-- --------------------
-- RESOLUTIONS policies
-- --------------------

-- Citizens can read resolutions for their own complaints
CREATE POLICY "resolutions_select_own_complaint"
    ON resolutions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = resolutions.complaint_id
              AND complaints.citizen_id = auth.uid()
        )
    );

-- Department admins can read/insert resolutions for their department's complaints
CREATE POLICY "resolutions_select_dept_admin"
    ON resolutions FOR SELECT
    USING (
        get_my_role() = 'department_admin'
        AND EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = resolutions.complaint_id
              AND complaints.department_id = get_my_department_id()
        )
    );

CREATE POLICY "resolutions_insert_dept_admin"
    ON resolutions FOR INSERT
    WITH CHECK (
        get_my_role() = 'department_admin'
        AND EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = resolutions.complaint_id
              AND complaints.department_id = get_my_department_id()
        )
    );

-- Super admins have full access to resolutions
CREATE POLICY "resolutions_all_super_admin"
    ON resolutions FOR ALL
    USING (get_my_role() = 'system_super_admin');

-- ============================================================
-- 8. SEED DATA — Default Departments
-- ============================================================

INSERT INTO departments (name, description) VALUES
    ('Water Supply & Sewerage',  'Handles water supply issues, drainage, and sewerage maintenance'),
    ('Public Works Department',  'Roads, bridges, footpaths, and public infrastructure maintenance'),
    ('Electricity Board',        'Power outages, faulty street lights, and electrical hazards'),
    ('Sanitation & Waste',       'Garbage collection, street cleaning, and waste disposal'),
    ('Health Department',        'Public health complaints, hospital issues, and epidemic control'),
    ('Education Department',     'Government school grievances and mid-day meal complaints'),
    ('Revenue Department',       'Property tax, land records, and revenue-related complaints'),
    ('Transport Department',     'Public transport, road safety, and traffic management'),
    ('Urban Planning',           'Illegal constructions, encroachments, and zoning violations'),
    ('Police & Law Enforcement', 'Public safety complaints, noise pollution, and law enforcement');