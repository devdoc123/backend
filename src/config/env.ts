import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function asNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProd: optional('NODE_ENV', 'development') === 'production',
  port: asNumber('PORT', 4000),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gym_ms'),
  databaseSsl: optional('DATABASE_SSL', 'false') === 'true',

  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtAccessTtl: optional('JWT_ACCESS_TTL', '24h'),
  jwtRefreshTtl: optional('JWT_REFRESH_TTL', '365d'),

  redisUrl: optional('REDIS_URL', ''),

  defaultGracePeriodDays: asNumber('DEFAULT_GRACE_PERIOD_DAYS', 5),
  defaultDialCode: optional('DEFAULT_DIAL_CODE', '92'),
  currency: optional('CURRENCY', 'PKR'),

  seedOwnerEmail: optional('SEED_OWNER_EMAIL', 'admin@gym.local'),
  seedOwnerPassword: optional('SEED_OWNER_PASSWORD', 'Admin@123456'),
  seedOwnerName: optional('SEED_OWNER_NAME', 'Gym Owner'),
};

export type Env = typeof env;
