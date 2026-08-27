-- ============================================================================
-- AeroSense Cloud Database Schema for Supabase (PostgreSQL)
-- Application: AeroSense Atmospheric Intelligence & Emergency Health Network
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- TABLE: users (User Accounts, Emergency Profiles & Health Vulnerabilities)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    phone VARCHAR(30),
    age INTEGER,
    gender VARCHAR(30),
    blood_group VARCHAR(15),
    health_issues TEXT[] DEFAULT '{}',
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(30),
    settings JSONB DEFAULT '{"notifications": true, "locationSharing": true, "theme": "blue-white"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- TABLE: kids_profiles (School Commute & Pediatric Vulnerability Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kids_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    age INTEGER,
    school_name VARCHAR(255),
    school_lat DOUBLE PRECISION,
    school_lon DOUBLE PRECISION,
    commute_mode VARCHAR(50) DEFAULT 'Bus',
    departure_time VARCHAR(20),
    return_time VARCHAR(20),
    allergies TEXT[] DEFAULT '{}',
    asthma_level VARCHAR(50) DEFAULT 'None',
    alerts_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- TABLE: family_connections (Mutual Family Network & Geosharing Permissions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    to_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- TABLE: notifications (Atmospheric Risk Alerts & System Warnings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'warning',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- TABLE: sms_alerts (Emergency SMS Dispatch & Incident Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    to_phone VARCHAR(30) NOT NULL,
    type VARCHAR(50) DEFAULT 'AQI_RISK_WARNING', -- 'AQI_RISK_WARNING' | 'EMERGENCY_SOS'
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- TABLE: live_locations (Real-Time GPS Coordinates & Safety Telemetry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_locations (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    user_name VARCHAR(150),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION DEFAULT 10.0,
    speed DOUBLE PRECISION DEFAULT 0.0,
    heading DOUBLE PRECISION DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Indexes for Rapid Emergency Lookups & Telemetry
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_emergency_phone ON public.users(emergency_contact_phone);
CREATE INDEX IF NOT EXISTS idx_kids_parent ON public.kids_profiles(parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_user ON public.sms_alerts(from_user_id);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kids_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and service role full read/write access
CREATE POLICY "Allow public select for registered users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert for registration" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow full access for kids" ON public.kids_profiles FOR ALL USING (true);
CREATE POLICY "Allow full access for family" ON public.family_connections FOR ALL USING (true);
CREATE POLICY "Allow full access for notifications" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Allow full access for sms_alerts" ON public.sms_alerts FOR ALL USING (true);
CREATE POLICY "Allow full access for live_locations" ON public.live_locations FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- Initial Data Seed (Primary User: Maithreyee)
-- ----------------------------------------------------------------------------
INSERT INTO public.users (
    id, name, email, password_hash, role, phone,
    emergency_contact_name, emergency_contact_phone, settings
) VALUES (
    '5d895eef-240a-4e45-903d-0d5faf34c8ca',
    'Maithreyee',
    'maithreyee1104@gmail.com',
    '$2b$10$ELDy2qDwUDbF5UJNB/D29O2CGWeMNR36Nnm3LHex4iAB.dAG0u6qK',
    'user',
    '6379103565',
    'Emergency Contact',
    '6379103565',
    '{"notifications": true, "locationSharing": true, "theme": "blue-white"}'::jsonb
) ON CONFLICT (email) DO UPDATE SET
    phone = EXCLUDED.phone,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    updated_at = NOW();
