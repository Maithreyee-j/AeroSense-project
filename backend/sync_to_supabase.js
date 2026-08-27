/**
 * AeroSense - Database to Supabase Migration & Live Sync Script
 * File: backend/sync_to_supabase.js
 * 
 * Usage: node backend/sync_to_supabase.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getSupabase, isSupabaseConfigured } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const DB_PATH = path.join(ROOT_DIR, 'data/database.json');

async function main() {
  console.log(`\n======================================================`);
  console.log(`☁️ AEROSENSE -> SUPABASE DATABASE SYNC & MIGRATION`);
  console.log(`======================================================\n`);

  if (!isSupabaseConfigured()) {
    console.log(`⚠️ [CONFIG NOTICE] Supabase credentials not found or set to placeholder in .env`);
    console.log(`\n👉 To connect your live Supabase cloud database:`);
    console.log(`   1. Open https://supabase.com and create or open your project.`);
    console.log(`   2. Copy your Project URL & Anon/Service Role API Key.`);
    console.log(`   3. Add them to your .env file:`);
    console.log(`      SUPABASE_URL=https://your-project-id.supabase.co`);
    console.log(`      SUPABASE_KEY=your-supabase-service-role-or-anon-key\n`);
    console.log(`   4. Run the SQL script in Supabase SQL Editor:`);
    console.log(`      supabase_schema.sql (located in your project root)\n`);
    console.log(`   5. Re-run: npm run db:sync:supabase`);
    console.log(`======================================================\n`);
    return;
  }

  const sb = getSupabase();
  console.log(`🔌 Connected to Supabase Project: ${process.env.SUPABASE_URL}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Local database file not found at ${DB_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(raw);

  const users = db.users || [];
  console.log(`\n📦 Migrating ${users.length} User Account(s)...`);

  let syncedCount = 0;
  for (const u of users) {
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
      emergency_contact_name: u.emergencyContactName || 'Emergency Contact',
      emergency_contact_phone: u.emergencyContactPhone || u.phone || null,
      settings: u.settings || { notifications: true, locationSharing: true, theme: 'blue-white' },
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from('users').upsert(payload, { onConflict: 'email' });
    if (error) {
      console.error(`   ❌ Failed to sync user [${u.email}]: ${error.message}`);
    } else {
      console.log(`   ✅ User [${u.name} <${u.email}>] successfully synced to Supabase.`);
      syncedCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SYNC COMPLETE: ${syncedCount}/${users.length} Users successfully uploaded to Supabase!`);
  console.log(`\n👉 You can now view, modify ("rechange"), and access emergency data in the Supabase Table Editor:`);
  console.log(`   • Table: 'users' -> name, email, phone, emergency_contact_phone, blood_group`);
  console.log(`   • Table: 'sms_alerts' -> live emergency SOS dispatches`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
