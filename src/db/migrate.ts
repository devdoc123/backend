import fs from 'fs';
import path from 'path';
import { pool, query, closePool } from './pool';
import { logger } from '../config/logger';

// Works whether running via tsx (src) or compiled (dist). Falls back to source.
const CANDIDATE_DIRS = [
  path.join(__dirname, 'migrations'),
  path.join(process.cwd(), 'src', 'db', 'migrations'),
];
const MIGRATIONS_DIR = CANDIDATE_DIRS.find((dir) => fs.existsSync(dir)) ?? CANDIDATE_DIRS[0];

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const res = await query<{ name: string }>('SELECT name FROM schema_migrations');
  return new Set(res.rows.map((r) => r.name));
}

async function run(): Promise<void> {
  logger.info('Running database migrations...');
  await ensureMigrationsTable();
  const applied = await appliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`  - ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info(`  + ${file} applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, file }, 'Migration failed');
      throw err;
    } finally {
      client.release();
    }
  }
  logger.info('Migrations complete.');
}

run()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, 'Migration runner failed');
    await closePool();
    process.exit(1);
  });
