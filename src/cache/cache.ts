import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Cache abstraction. Uses Upstash/Redis when REDIS_URL is configured,
 * otherwise falls back to a process-local in-memory cache so the system
 * still runs (single instance) without Redis.
 */
interface CacheDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(keys: string[]): Promise<void>;
  delByPrefix(prefix: string): Promise<void>;
  ping(): Promise<boolean>;
}

class MemoryCache implements CacheDriver {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(keys: string[]): Promise<void> {
    for (const k of keys) this.store.delete(k);
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

class RedisCache implements CacheDriver {
  constructor(private client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
    const pipeline = this.client.pipeline();
    let count = 0;
    for await (const keys of stream) {
      for (const key of keys as string[]) {
        pipeline.del(key);
        count++;
      }
    }
    if (count) await pipeline.exec();
  }

  async ping(): Promise<boolean> {
    const res = await this.client.ping();
    return res === 'PONG';
  }
}

let driver: CacheDriver;

if (env.redisUrl) {
  const client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  client.on('error', (err) => logger.error({ err }, 'Redis error'));
  client.on('connect', () => logger.info('Redis connected'));
  driver = new RedisCache(client);
} else {
  logger.warn('REDIS_URL not set - using in-memory cache (single instance only)');
  driver = new MemoryCache();
}

const KEY_PREFIX = 'gymms:';

export const cache = {
  /** Get a JSON value from cache, or null. */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await driver.get(KEY_PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.error({ err, key }, 'cache.get failed');
      return null;
    }
  },

  /** Store a JSON value with optional TTL in seconds. */
  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await driver.set(KEY_PREFIX + key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      logger.error({ err, key }, 'cache.set failed');
    }
  },

  /** Cache-aside helper. */
  async remember<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await producer();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },

  async invalidate(...keys: string[]): Promise<void> {
    try {
      await driver.del(keys.map((k) => KEY_PREFIX + k));
    } catch (err) {
      logger.error({ err, keys }, 'cache.invalidate failed');
    }
  },

  /** Invalidate every key under a logical namespace, e.g. "dashboard:". */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      await driver.delByPrefix(KEY_PREFIX + prefix);
    } catch (err) {
      logger.error({ err, prefix }, 'cache.invalidatePrefix failed');
    }
  },

  async healthy(): Promise<boolean> {
    try {
      return await driver.ping();
    } catch {
      return false;
    }
  },
};

/** Logical cache namespaces used across the app for coordinated invalidation. */
export const CacheKeys = {
  dashboard: 'dashboard:',
  reports: 'reports:',
  members: 'members:',
  memberLookup: 'lookup:',
  stats: 'stats:',
  search: 'search:',
};
