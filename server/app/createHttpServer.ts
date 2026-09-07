/**
 * HTTP + realtime composition root (Phase 2 §4, acc. #10/#11).
 *
 * Builds the Express app, the Node HTTP server and the Socket.IO layer as one
 * unit **without calling `listen`** — `server/index.ts` is the only place that
 * binds a port. Tests construct the whole stack in-process.
 */

import { createServer, type Server as HttpServer } from 'node:http';
import type { Server as IoServer } from 'socket.io';
import { createApp, type AppDeps } from '../app';
import type { RoomManager } from '../roomManager';
import { createRealtimeServer } from './createRealtimeServer';

export interface HttpServerBundle {
  app: ReturnType<typeof createApp>;
  httpServer: HttpServer;
  io: IoServer;
  rooms: RoomManager;
  close: () => Promise<void>;
}

export function createHttpServer(deps: AppDeps): HttpServerBundle {
  const app = createApp(deps);
  const httpServer = createServer(app);
  const realtime = createRealtimeServer(httpServer, deps.config);

  return {
    app,
    httpServer,
    io: realtime.io,
    rooms: realtime.rooms,
    close: async () => {
      await realtime.close();
      await new Promise<void>((resolve) => {
        if (!httpServer.listening) return resolve();
        httpServer.close(() => resolve());
      });
    },
  };
}
