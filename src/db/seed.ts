import bcrypt from 'bcryptjs';
import { query, closePool } from './pool';
import { env } from '../config/env';
import { logger } from '../config/logger';

async function seed(): Promise<void> {
  logger.info('Seeding database...');

  // ----- Settings singleton -----
  await query(
    `INSERT INTO settings (id, gym_name, currency, default_grace_period_days)
     VALUES (true, $1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    ['My Gym', env.currency, env.defaultGracePeriodDays]
  );

  // ----- Owner user -----
  const existing = await query('SELECT id FROM users WHERE email = $1', [env.seedOwnerEmail]);
  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(env.seedOwnerPassword, 12);
    await query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'owner', true)`,
      [env.seedOwnerEmail, hash, env.seedOwnerName]
    );
    logger.info(`  + Owner user created: ${env.seedOwnerEmail}`);
  } else {
    logger.info('  - Owner user already exists');
  }

  // ----- Default membership plans (configuration, editable in app) -----
  const plans = [
    { name: 'Monthly', duration: 30, price: 4000, reg: 1000, grace: 5 },
    { name: 'Quarterly', duration: 90, price: 10500, reg: 1000, grace: 7 },
    { name: 'Half Yearly', duration: 180, price: 19000, reg: 1000, grace: 10 },
    { name: 'Annual', duration: 365, price: 34000, reg: 0, grace: 15 },
  ];
  for (const p of plans) {
    const exists = await query('SELECT id FROM membership_plans WHERE name = $1', [p.name]);
    if (exists.rowCount === 0) {
      await query(
        `INSERT INTO membership_plans (name, duration_days, price, registration_fee, grace_period_days)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.name, p.duration, p.price, p.reg, p.grace]
      );
    }
  }
  logger.info('  + Default membership plans ensured');

  logger.info('Seeding complete.');
}

seed()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, 'Seed failed');
    await closePool();
    process.exit(1);
  });
