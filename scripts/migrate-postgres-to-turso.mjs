import { createClient } from '@libsql/client';
import { Pool } from 'pg';

const SOURCE_DATABASE_URL = typeof process.env.SOURCE_DATABASE_URL === 'string'
  ? process.env.SOURCE_DATABASE_URL.trim()
  : '';
const DATABASE_URL = typeof process.env.DATABASE_URL === 'string'
  ? process.env.DATABASE_URL.trim()
  : '';
const TURSO_DATABASE_URL = typeof process.env.TURSO_DATABASE_URL === 'string'
  ? process.env.TURSO_DATABASE_URL.trim()
  : '';
const TURSO_AUTH_TOKEN = typeof process.env.TURSO_AUTH_TOKEN === 'string'
  ? process.env.TURSO_AUTH_TOKEN.trim()
  : '';

const sourceUrl = SOURCE_DATABASE_URL || DATABASE_URL;

if (!sourceUrl) {
  console.error('Missing SOURCE_DATABASE_URL (or DATABASE_URL) for Postgres source.');
  process.exit(1);
}
if (!TURSO_DATABASE_URL) {
  console.error('Missing TURSO_DATABASE_URL for Turso target.');
  process.exit(1);
}

const sslModeRaw = String(process.env.SOURCE_PGSSLMODE || process.env.PGSSLMODE || '').toLowerCase();
const sourceNeedsSsl = sslModeRaw === 'require' || /sslmode=require/i.test(sourceUrl);

const pg = new Pool({
  connectionString: sourceUrl,
  ssl: sourceNeedsSsl ? { rejectUnauthorized: false } : undefined
});

const turso = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN || undefined
});

function toJsonText(value, fallback = {}) {
  if (value === null || value === undefined) return JSON.stringify(fallback);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(fallback);
  }
}

async function ensureTursoTables() {
  await turso.execute('pragma foreign_keys = on');
  await turso.execute(`
    create table if not exists profiles (
      profile_id text primary key,
      name text not null,
      color text not null,
      appearance text not null default '{}',
      x real,
      y real,
      z real,
      progress text not null default '{}',
      updated_at text not null default (datetime('now'))
    )
  `);
  await turso.execute(`
    create table if not exists accounts (
      username text primary key,
      salt text not null,
      hash text not null,
      profile_id text not null references profiles(profile_id) on delete cascade,
      updated_at text not null default (datetime('now'))
    )
  `);
  await turso.execute('create index if not exists idx_accounts_profile_id on accounts(profile_id)');
}

async function migrateProfiles() {
  const result = await pg.query(
    'select profile_id, name, color, appearance, x, y, z, progress from profiles'
  );
  let count = 0;
  for (const row of result.rows) {
    await turso.execute({
      sql: `insert into profiles (profile_id, name, color, appearance, x, y, z, progress, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            on conflict(profile_id) do update
            set name = excluded.name,
                color = excluded.color,
                appearance = excluded.appearance,
                x = excluded.x,
                y = excluded.y,
                z = excluded.z,
                progress = excluded.progress,
                updated_at = datetime('now')`,
      args: [
        row.profile_id,
        row.name,
        row.color,
        toJsonText(row.appearance),
        Number.isFinite(Number(row.x)) ? Number(row.x) : null,
        Number.isFinite(Number(row.y)) ? Number(row.y) : null,
        Number.isFinite(Number(row.z)) ? Number(row.z) : null,
        toJsonText(row.progress)
      ]
    });
    count += 1;
  }
  return count;
}

async function migrateAccounts() {
  const result = await pg.query(
    'select username, salt, hash, profile_id from accounts'
  );
  let count = 0;
  for (const row of result.rows) {
    await turso.execute({
      sql: `insert into accounts (username, salt, hash, profile_id, updated_at)
            values (?, ?, ?, ?, datetime('now'))
            on conflict(username) do update
            set salt = excluded.salt,
                hash = excluded.hash,
                profile_id = excluded.profile_id,
                updated_at = datetime('now')`,
      args: [row.username, row.salt, row.hash, row.profile_id]
    });
    count += 1;
  }
  return count;
}

async function main() {
  try {
    await ensureTursoTables();
    const profileCount = await migrateProfiles();
    const accountCount = await migrateAccounts();
    console.log(`Migrated ${profileCount} profiles and ${accountCount} accounts from Postgres to Turso.`);
  } finally {
    await pg.end();
    if (typeof turso.close === 'function') {
      await turso.close();
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
