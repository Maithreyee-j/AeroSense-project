import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data/database.json');
const isMemory = DATA_FILE === ':memory:';

export const users = new Map();
export const familyRequests = [];
export const notifications = [];
export const locations = new Map();
export const smsAlerts = [];

function initDb() {
  if (isMemory) return;

  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      if (raw.trim()) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          for (const u of data.users) {
            const key = String(u.email || '').trim().toLowerCase();
            if (key) users.set(key, u);
          }
        }
        if (Array.isArray(data.familyRequests)) {
          familyRequests.push(...data.familyRequests);
        }
        if (Array.isArray(data.notifications)) {
          notifications.push(...data.notifications);
        }
        if (Array.isArray(data.smsAlerts)) {
          smsAlerts.push(...data.smsAlerts);
        }
        if (Array.isArray(data.locations)) {
          for (const l of data.locations) {
            if (l.userId) locations.set(l.userId, l);
          }
        }
      }
    }
  } catch (err) {
    console.error('Warning: Failed to load database from file, using empty memory store:', err.message);
  }
}

export function saveDb() {
  if (isMemory) return;

  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      users: Array.from(users.values()),
      familyRequests,
      notifications,
      smsAlerts: smsAlerts.slice(-100),
      locations: Array.from(locations.entries()).map(([userId, loc]) => ({ userId, ...loc }))
    };

    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('Error saving database to disk:', err.message);
  }
}

initDb();
