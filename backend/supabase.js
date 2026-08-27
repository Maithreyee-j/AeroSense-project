/**
 * AeroSense - Comprehensive Supabase Cloud Database Integration Layer
 * File: backend/supabase.js
 * 
 * Synchronizes:
 *  1. users (Accounts, Profiles, Medical Tags, Emergency Contacts)
 *  2. family_connections (Family Safety Network & Consent)
 *  3. kids_profiles (School Commute & Pediatric Vulnerability)
 *  4. live_locations (Real-time GPS Telemetry)
 *  5. notifications (AQI & Exposure Risk Warnings)
 *  6. sms_alerts (Emergency SMS Dispatches & Audit Logs)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Default to live project credentials with process.env priority
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fxgdbwbmwywyqcfzkiqy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_publishable_yXEJnhEATdKKq5kYKANEvg_Mcrpyy5g';

let supabaseClient = null;

export function isSupabaseConfigured() {
  const url = String(SUPABASE_URL || '').trim();
  const key = String(SUPABASE_KEY || '').trim();
  return Boolean(
    url && 
    key && 
    url.startsWith('https://') && 
    !url.includes('your-project') && 
    !key.includes('your-supabase')
  );
}

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

// ----------------------------------------------------------------------------
// 1. Users (Registration, Profiles, Emergency Contacts)
// ----------------------------------------------------------------------------
export async function syncUserToSupabase(u) {
  if (process.env.DATA_FILE === ':memory:' || process.env.NODE_ENV === 'test') {
    return { ok: true, reason: 'Test/Memory mode skipped' };
  }
  if (!u || !u.email || u.email.endsWith('@aerosense.local')) {
    return { ok: true, reason: 'Local test account skipped' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'Supabase not configured' };

  try {
    const payload = {
      id: u.id,
      name: u.name,
      email: u.email,
      password_hash: u.passwordHash,
      role: u.role || 'user',
      phone: u.phone || null,
      age: u.age ? Number(u.age) : null,
      gender: u.gender || null,
      blood_group: u.bloodGroup || null,
      health_issues: Array.isArray(u.healthIssues) ? u.healthIssues : [],
      emergency_contact_name: u.emergencyContactName || null,
      emergency_contact_phone: u.emergencyContactPhone || null,
      settings: u.settings || { notifications: true, locationSharing: true, theme: 'blue-white' },
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from('users')
      .upsert(payload, { onConflict: 'email' })
      .select();

    if (error) {
      console.error('[SUPABASE USER SYNC ERROR]', error.message);
      return { ok: false, error: error.message };
    }
    console.log(`[SUPABASE SYNC] ☁️ User [${u.name} <${u.email}>] saved to Supabase 'users' table!`);
    return { ok: true, data };
  } catch (err) {
    console.error('[SUPABASE USER SYNC EXCEPTION]', err);
    return { ok: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// 2. Family Connections
// ----------------------------------------------------------------------------
export async function syncFamilyConnectionToSupabase(fc) {
  if (process.env.DATA_FILE === ':memory:' || process.env.NODE_ENV === 'test') return null;
  const sb = getSupabase();
  if (!sb || !fc) return null;

  try {
    const payload = {
      id: fc.id,
      from_user_id: fc.from,
      to_user_id: fc.to || null,
      to_email: fc.toEmail || null,
      status: fc.status || 'pending',
      created_at: fc.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb.from('family_connections').upsert(payload, { onConflict: 'id' });
    if (error) console.error('[SUPABASE FAMILY SYNC ERROR]', error.message);
    else console.log(`[SUPABASE SYNC] ☁️ Family connection saved to Supabase!`);
    return data;
  } catch (err) {
    console.error('[SUPABASE FAMILY SYNC EXCEPTION]', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 3. Kids Profiles
// ----------------------------------------------------------------------------
export async function syncKidToSupabase(kid) {
  if (process.env.DATA_FILE === ':memory:' || process.env.NODE_ENV === 'test') return null;
  const sb = getSupabase();
  if (!sb || !kid) return null;

  try {
    const payload = {
      id: kid.id,
      parent_id: kid.parentId,
      name: kid.name,
      school_name: kid.schoolName,
      school_lat: kid.lat,
      school_lon: kid.lon,
      age: kid.age ? Number(kid.age) : null,
      allergies: Array.isArray(kid.allergies) ? kid.allergies : [],
      asthma_level: kid.asthmaLevel || 'None',
      alerts_enabled: kid.alertsEnabled !== false,
      created_at: kid.createdAt || new Date().toISOString()
    };
    const { data, error } = await sb.from('kids_profiles').upsert(payload, { onConflict: 'id' });
    if (error) console.error('[SUPABASE KID SYNC ERROR]', error.message);
    else console.log(`[SUPABASE SYNC] ☁️ Kid Profile [${kid.name}] saved to Supabase 'kids_profiles' table!`);
    return data;
  } catch (err) {
    console.error('[SUPABASE KID SYNC EXCEPTION]', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 4. Live Locations
// ----------------------------------------------------------------------------
export async function syncLocationToSupabase(userId, userName, lat, lon, accuracy = 10.0) {
  if (process.env.DATA_FILE === ':memory:' || process.env.NODE_ENV === 'test') return null;
  const sb = getSupabase();
  if (!sb || !userId || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const payload = {
      user_id: userId,
      user_name: userName || 'User',
      latitude: lat,
      longitude: lon,
      accuracy: accuracy || 10.0,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb.from('live_locations').upsert(payload, { onConflict: 'user_id' });
    if (error) console.error('[SUPABASE LOCATION SYNC ERROR]', error.message);
    return data;
  } catch (err) {
    console.error('[SUPABASE LOCATION SYNC EXCEPTION]', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 5. Notifications
// ----------------------------------------------------------------------------
export async function syncNotificationToSupabase(n) {
  if (process.env.DATA_FILE === ':memory:' || process.env.NODE_ENV === 'test') return null;
  const sb = getSupabase();
  if (!sb || !n) return null;

  try {
    const payload = {
      id: n.id,
      user_id: n.userId,
      type: n.severity || 'warning',
      title: n.title || 'AeroSense Notification',
      message: n.message || '',
      read: Boolean(n.read),
      created_at: n.createdAt || new Date().toISOString()
    };
    const { data, error } = await sb.from('notifications').upsert(payload, { onConflict: 'id' });
    if (error) console.error('[SUPABASE NOTIFICATION SYNC ERROR]', error.message);
    return data;
  } catch (err) {
    console.error('[SUPABASE NOTIFICATION SYNC EXCEPTION]', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 6. SMS Alerts & SOS Dispatches
// ----------------------------------------------------------------------------
export async function logEmergencySosToSupabase(fromUserId, toPhone, message, type = 'EMERGENCY_SOS') {
  if (process.env.DATA_FILE === ':memory:' || process.env.NODE_ENV === 'test') return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb.from('sms_alerts').insert({
      from_user_id: fromUserId,
      to_phone: toPhone,
      type,
      message,
      status: 'sent',
      created_at: new Date().toISOString()
    });
    if (error) console.error('[SUPABASE SOS LOG ERROR]', error.message);
    else console.log(`[SUPABASE SYNC] ☁️ Emergency SMS Alert dispatched & saved to Supabase!`);
    return data;
  } catch (err) {
    console.error('[SUPABASE SOS LOG EXCEPTION]', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Master Full Sync (Syncs all collections on startup)
// ----------------------------------------------------------------------------
export async function syncMasterDatabaseToSupabase(dbCollections) {
  if (!isSupabaseConfigured()) return;
  const { users, familyRequests, kidsProfiles, smsAlerts, notifications } = dbCollections;

  console.log(`[SUPABASE] 🚀 Initializing Master Real-Time Sync to Supabase...`);

  if (users) {
    for (const u of users.values()) {
      await syncUserToSupabase(u);
    }
  }
  if (kidsProfiles) {
    for (const k of kidsProfiles) {
      await syncKidToSupabase(k);
    }
  }
  if (familyRequests) {
    for (const fc of familyRequests) {
      await syncFamilyConnectionToSupabase(fc);
    }
  }
  console.log(`[SUPABASE] ✅ Master Database Synced to Supabase!`);
}
