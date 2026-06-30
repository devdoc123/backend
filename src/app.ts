import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { apiLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { cache } from './cache/cache';
import { pool } from './db/pool';
import apiRouter from './routes';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // allow same-origin / curl (no origin) and configured origins
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url?.startsWith('/api/events') },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  // Health checks (no auth, no rate limit)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'gym-ms-backend', time: new Date().toISOString() });
  });

  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      const redis = await cache.healthy();
      res.json({ status: 'ready', database: 'up', cache: redis ? 'up' : 'degraded' });
    } catch {
      res.status(503).json({ status: 'not-ready', database: 'down' });
    }
  });

  // API
  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
