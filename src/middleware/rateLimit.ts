import rateLimit from 'express-rate-limit';

const jsonHandler = (_req: any, res: any) => {
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down' },
  });
};

/** Global limiter applied to all API routes. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

/** Stricter limiter for authentication endpoints to mitigate brute force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});
