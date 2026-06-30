import { Request, Response } from 'express';
import { realtimeBus, RealtimeEvent } from './events';
import { verifyAccessToken } from '../auth/tokens';
import { Unauthorized } from '../utils/errors';

/**
 * Server-Sent Events stream. Browsers' EventSource cannot set Authorization
 * headers, so the access token is passed as a query parameter (?token=).
 */
export function sseHandler(req: Request, res: Response): void {
  const token = (req.query.token as string) || '';
  try {
    verifyAccessToken(token);
  } catch {
    throw Unauthorized('Invalid token for realtime stream');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

  const listener = (event: RealtimeEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  realtimeBus.on('event', listener);

  // heartbeat to keep proxies from closing the connection
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtimeBus.off('event', listener);
    res.end();
  });
}
