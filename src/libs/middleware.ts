import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IpManager } from '../core/IpManager.js';

export type NextFunction = (err?: unknown) => void;

/**
 * Creates an Express-compatible middleware that resolves the real client IP
 * from X-Forwarded-For / X-Real-IP headers and attaches it to `req.resolvedIp`.
 *
 * This is a standalone utility — it does not call IpManager directly.
 * Use the resolved IP in your route handler when calling deviceManager.identify().
 */
export function createIpMiddleware(_ipManager?: IpManager) {
  return function ipMiddleware(
    req: IncomingMessage & { resolvedIp?: string },
    _res: ServerResponse,
    next: NextFunction,
  ): void {
    req.resolvedIp = resolveIp(req);
    next();
  };
}

/** Extract real IP respecting up to 2 trusted proxy hops */
export function resolveIp(req: IncomingMessage): string {
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ips = (Array.isArray(xff) ? xff[0] : xff)
      .split(',')
      .map((s) => s.trim());
    // First IP in XFF chain is the client
    if (ips[0]) return ips[0];
  }

  return (req.socket as { remoteAddress?: string }).remoteAddress ?? 'unknown';
}
