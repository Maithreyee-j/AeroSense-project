/**
 * AeroSense - Comprehensive 6-Table Supabase Synchronization Script
 * File: backend/sync_to_supabase.js
 * 
 * Usage: npm run db:sync:supabase
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { 
  getSupabase, 
  isSupabaseConfigured,
  syncUserToSupabase,
  syncKidToSupabase,
  syncFamilyConnectionToSupabase,
  syncLocationToSupabase,
  syncNotificationToSupabase,
  logEmergencySosToSupabase
} from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const DB_PATH = path.join(ROOT_DIR, 'data/database.json');

async function main() {
  console.log(`\n======================================================`);
  console.log(`☁️ AEROSENSE -> SUPABASE COMPREHENSIVE 6-TABLE SYNC`);
  console.log(`======================================================\n`);

  if (!isSupabaseConfigured()) {
    console.log(`⚠️ [CONFIG NOTICE] Supabase credentials not found in .env`);
    return;
  }

  const sb = getSupabase();
  console.log(`🔌 Connected to Supabase: https://fxgdbwbmwywyqcfzkiqy.supabase.co\n`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Local database file not found at ${DB_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(raw);

  // 1. Users
  const users = db.users || [];
  console.log(`👤 1. Syncing ${users.length} Users...`);
  for (const u of users) {
    await syncUserToSupabase(u);
  }

  // 2. Kids Profiles
  const kids = db.kidsProfiles || [];
  console.log(`\n👶 2. Syncing ${kids.length} Kids Profiles...`);
  for (const k of kids) {
    await syncKidToSupabase(k);
  }

  // 3. Family Connections
  const family = db.familyRequests || [];
  console.log(`\n👨‍👩‍👧 3. Syncing ${family.length} Family Connections...`);
  for (const f of family) {
    await syncFamilyConnectionToSupabase(f);
  }

  // 4. Live Locations
  const locations = db.locations || [];
  console.log(`\n📍 4. Syncing ${locations.length} Live Locations...`);
  for (const l of locations) {
    const u = users.find(x => x.id === l.userId);
    await syncLocationToSupabase(l.userId, u?.name || 'User', l.lat, l.lon, l.accuracy);
  }

  // 5. Notifications
  const notifs = db.notifications || [];
  console.log(`\n🔔 5. Syncing ${notifs.length} Notifications...`);
  for (const n of notifs) {
    await syncNotificationToSupabase(n);
  }

  // 6. SMS Alerts
  const sms = db.smsAlerts || [];
  console.log(`\n🚨 6. Syncing ${sms.length} Emergency SMS Alerts...`);
  for (const s of sms) {
    await logEmergencySosToSupabase(s.fromUserId, s.toPhone, s.message, s.type);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 6-TABLE SYNC COMPLETE! All tables are now populated in Supabase.`);
  console.log(`👉 Switch between tabs in Supabase Table Editor to view:`);
  console.log(`   • 'users' (${users.length} records)`);
  console.log(`   • 'kids_profiles' (${kids.length} records)`);
  console.log(`   • 'family_connections' (${family.length} records)`);
  console.log(`   • 'live_locations' (${locations.length} records)`);
  console.log(`   • 'notifications' (${notifs.length} records)`);
  console.log(`   • 'sms_alerts' (${sms.length} records)`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
