import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { ServerConfig } from '../config/env';
import { metrics } from '../lib/metrics';
import { isDevIdentityEnabled, resolveDevPrincipal } from './devIdentityProvider';
import { verifyTelegramInitData } from './telegramInitData';
import type { AuthenticatedPrincipal } from './principal';

declare module 'socket.io' {
  interface SocketData {
    principal?: AuthenticatedPrincipal;
    requestId?: string;
  }
}

function extractInitData(socket: Socket): string {
  const fromAuth = socket.handshake.auth?.initData;
  if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
  const header = socket.handshake.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header) return header;
  return '';
}

/**
 * Socket.IO handshake authentication (Phase 1 §11 — identity boundary only).
 *
 * Attaches a verified `socket.data.principal`. Authenticated handlers must read
 * identity from there and ignore payload-provided names/ids. There is no
 * unauthenticated fallback: WS4 part 2 removed the `secureKahootIdentity`
 * break-glass.
 */
export function createSocketAuth(config: ServerConfig) {
  return function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
    socket.data.requestId = crypto.randomUUID();

    if (isDevIdentityEnabled(config)) {
      const rawUserId = socket.handshake.auth?.userId;
      const rawName = socket.handshake.auth?.displayName;
      const principal = resolveDevPrincipal({
        userId: typeof rawUserId === 'string' ? rawUserId : null,
        displayName: typeof rawName === 'string' ? rawName : null,
      });
      if (!principal) {
        metrics.inc('auth_failed_total', { reason: 'dev_identity_unavailable', channel: 'socket' });
        next(new Error('unauthorized'));
        return;
      }
      socket.data.principal = principal;
      next();
      return;
    }

    const result = verifyTelegramInitData(extractInitData(socket), config.telegramBotToken, {
      maxAgeSec: config.authInitDataMaxAgeSec,
    });
    if (!result.ok) {
      metrics.inc('auth_failed_total', { reason: result.code, channel: 'socket' });
      next(new Error('unauthorized'));
      return;
    }
    socket.data.principal = result.principal;
    next();
  };
}

export function installSocketAuth(io: Server, config: ServerConfig): void {
  io.use(createSocketAuth(config));
}

/** True when the connection has a verified principal. */
export function socketIsAuthenticated(socket: Socket): boolean {
  return Boolean(socket.data.principal);
}
