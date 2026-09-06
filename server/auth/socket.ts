import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { ServerConfig } from '../config/env';
import { serverFlag } from '../lib/flags';
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
 * identity from there and ignore payload-provided names/ids. Gated by
 * `secureKahootIdentity` (default ON); when off, connections are allowed
 * unauthenticated for rollback compatibility.
 */
export function createSocketAuth(config: ServerConfig) {
  return function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
    socket.data.requestId = crypto.randomUUID();

    if (!serverFlag('secureKahootIdentity', true)) {
      next();
      return;
    }

    if (isDevIdentityEnabled(config)) {
      const rawUserId = socket.handshake.auth?.userId;
      const rawName = socket.handshake.auth?.displayName;
      const principal = resolveDevPrincipal({
        userId: typeof rawUserId === 'string' ? rawUserId : null,
        displayName: typeof rawName === 'string' ? rawName : null,
      });
      if (!principal) {
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

/** True when the connection has a verified principal (or secure identity is off). */
export function socketIsAuthenticated(socket: Socket): boolean {
  return Boolean(socket.data.principal) || !serverFlag('secureKahootIdentity', true);
}
