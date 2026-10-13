#!/usr/bin/env node
/**
 * Applies backend/database/supabase.full-setup.sql straight to your Supabase Postgres,
 * bypassing the dashboard SQL editor (which can mangle long scripts).
 *
 *   cd backend
 *   npm install pg --no-save
 *   # PowerShell:  $env:DATABASE_URL = "postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres"
 *   node scripts/apply-setup.js            # runs the setup (all-or-nothing)
 *   node scripts/apply-setup.js --reset    # FIRST wipes the public schema (new, empty projects only!)
 *
 * Get the URL: Supabase -> Connect -> "Session pooler" -> URI. Keep the password private.
 */
const fs = require('fs');
const path = require('path');

let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error('Missing the "pg" package. Run:  npm install pg --no-save');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first (Supabase -> Connect -> Session pooler -> URI).');
  process.exit(1);
}

const RESET_SQL = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
`;

(async () => {
  const file = path.join(__dirname, '..', 'database', 'supabase.full-setup.sql');
  const sql = fs.readFileSync(file, 'utf8');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (process.argv.includes('--reset')) {
      console.log('Resetting public schema...');
      await client.query(RESET_SQL);
    }
    console.log('Applying supabase.full-setup.sql (one transaction)...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('DONE - database is set up.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED:', err.message);
    if (err.position) {
      const line = sql.slice(0, Number(err.position)).split('\n').length;
      const lines = sql.split('\n');
      console.error(`Around line ${line} of supabase.full-setup.sql:`);
      console.error(lines.slice(Math.max(0, line - 4), line + 2).join('\n'));
    }
    if (err.where) console.error('Where:', err.where);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
