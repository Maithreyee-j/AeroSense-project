/**
 * AeroSense - Supabase Cloud Database Integration & Emergency Data Layer
 * File: backend/supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

let supabaseClient = null;

export function isSupabaseConfigured() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '').trim();
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

/**
 * Upserts a user into Supabase with all emergency contacts and health metrics.
 */
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
      console.error('[SUPABASE SYNC ERROR]', error.message);
      return { ok: false, error: error.message };
    }
    console.log(`[SUPABASE SYNC] ☁️ Successfully saved user [${u.name} <${u.email}>] to Supabase 'users' table!`);
    return { ok: true, data };
  } catch (err) {
    console.error('[SUPABASE UNEXPECTED ERROR]', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Fetches the user from Supabase by email or ID.
 */
export async function fetchUserFromSupabase(emailOrId) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const query = sb.from('users').select('*');
    if (emailOrId.includes('@')) {
      query.eq('email', emailOrId.toLowerCase().trim());
    } else {
      query.eq('id', emailOrId);
    }
    const { data, error } = await query.single();
    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      passwordHash: data.password_hash,
      role: data.role,
      phone: data.phone || '',
      age: data.age,
      gender: data.gender || '',
      bloodGroup: data.blood_group || '',
      healthIssues: data.health_issues || [],
      emergencyContactName: data.emergency_contact_name || '',
      emergencyContactPhone: data.emergency_contact_phone || '',
      settings: data.settings || { notifications: true, locationSharing: true, theme: 'blue-white' }
    };
  } catch {
    return null;
  }
}

/**
 * Syncs a child profile to Supabase.
 */
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
      age: kid.age,
      allergies: kid.allergies || [],
      created_at: kid.createdAt || new Date().toISOString()
    };
    const { data, error } = await sb.from('kids_profiles').upsert(payload, { onConflict: 'id' });
    if (error) console.error('[SUPABASE KID SYNC ERROR]', error.message);
    return data;
  } catch (err) {
    console.error('[SUPABASE KID SYNC EXCEPTION]', err);
    return null;
  }
}

/**
 * Syncs real-time GPS coordinates to Supabase.
 */
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

/**
 * Logs an emergency SOS alert dispatch to Supabase.
 */
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
    return data;
  } catch (err) {
    console.error('[SUPABASE SOS LOG EXCEPTION]', err);
    return null;
  }
}
