import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const DATABASE_URL = typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : '';
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const profilesPath = path.join(rootDir, 'profiles.json');
const accountsPath = path.join(rootDir, 'accounts.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

const profiles = readJson(profilesPath);
const accounts = readJson(accountsPath);

const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
const needsSsl = sslMode === 'require' || /sslmode=require/i.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined
});

async function ensureTables() {
  await pool.query(`
    create table if not exists profiles (
      profile_id text primary key,
      name text not null,
      color text not null,
      appearance jsonb not null default '{}'::jsonb,
      x double precision,
      y double precision,
      z double precision,
      progress jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists accounts (
      username text primary key,
      salt text not null,
      hash text not null,
      profile_id text not null references profiles(profile_id) on delete cascade,
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query('create index if not exists idx_accounts_profile_id on accounts(profile_id);');
}

async function migrateProfiles() {
  let count = 0;
  for (const [profileId, profile] of Object.entries(profiles)) {
    if (!profileId) continue;
    await pool.query(
      `insert into profiles (profile_id, name, color, appearance, x, y, z, progress, updated_at)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, now())
       on conflict (profile_id) do update
       set name = excluded.name,
           color = excluded.color,
           appearance = excluded.appearance,
           x = excluded.x,
           y = excluded.y,
           z = excluded.z,
           progress = excluded.progress,
           updated_at = now()`,
      [
        profileId,
        typeof profile?.name === 'string' && profile.name ? profile.name : `Player-${String(profileId).slice(0, 4)}`,
        typeof profile?.color === 'string' && profile.color ? profile.color : '#38bdf8',
        JSON.stringify(profile?.appearance || {}),
        Number.isFinite(Number(profile?.x)) ? Number(profile.x) : null,
        Number.isFinite(Number(profile?.y)) ? Number(profile.y) : null,
        Number.isFinite(Number(profile?.z)) ? Number(profile.z) : null,
        JSON.stringify(profile?.progress || {})
      ]
    );
    count += 1;
  }
  return count;
}

async function migrateAccounts() {
  let count = 0;
  for (const [username, account] of Object.entries(accounts)) {
    if (!username) continue;
    const salt = typeof account?.salt === 'string' ? account.salt : '';
    const hash = typeof account?.hash === 'string' ? account.hash : '';
    const profileId = typeof account?.profileId === 'string' && account.profileId ? account.profileId : `acct-${username}`;
    if (!salt || !hash) continue;
    await pool.query(
      `insert into accounts (username, salt, hash, profile_id, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (username) do update
       set salt = excluded.salt,
           hash = excluded.hash,
           profile_id = excluded.profile_id,
           updated_at = now()`,
      [username, salt, hash, profileId]
    );
    count += 1;
  }
  return count;
}

async function main() {
  try {
    await ensureTables();
    const profileCount = await migrateProfiles();
    const accountCount = await migrateAccounts();
    console.log(`Migrated ${profileCount} profiles and ${accountCount} accounts to Postgres.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
