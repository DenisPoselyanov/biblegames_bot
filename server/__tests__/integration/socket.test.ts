import { createServer, type Server as HttpServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { loadConfig, type ServerConfig } from '../../config/env';
import { installSocketAuth, socketIsAuthenticated } from '../../auth/socket';
import { signInitData, TEST_BOT_TOKEN } from '../helpers/telegramFixture';

interface Harness {
  httpServer: HttpServer;
  io: Server;
  url: string;
  clients: ClientSocket[];
}

const harnesses: Harness[] = [];

afterEach(() => {
  for (const h of harnesses.splice(0)) {
    for (const c of h.clients) c.close();
    h.io.close();
    h.httpServer.close();
  }
});

async function startHarness(config: ServerConfig): Promise<Harness> {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  installSocketAuth(io, config);

  io.on('connection', (socket) => {
    socket.on('ping_auth', (_p: unknown, ack: (r: unknown) => void) => {
      ack({ authenticated: socketIsAuthenticated(socket), principal: socket.data.principal ?? null });
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as { port: number }).port;
  const harness: Harness = { httpServer, io, url: `http://localhost:${port}`, clients: [] };
  harnesses.push(harness);
  return harness;
}

function connect(h: Harness, auth: Record<string, unknown>): Promise<ClientSocket> {
  const socket = ioClient(h.url, { auth, transports: ['websocket'], reconnection: false });
  h.clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

describe('Socket.IO handshake authentication', () => {
  it('rejects a connection with no initData in telegram mode', async () => {
    const { config } = loadConfig({
      NODE_ENV: 'test',
      AUTH_MODE: 'telegram',
      TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    });
    const h = await startHarness(config);
    await expect(connect(h, {})).rejects.toThrow(/unauthorized/);
  });

  it('accepts a connection with valid initData and attaches the principal', async () => {
    const { config } = loadConfig({
      NODE_ENV: 'test',
      AUTH_MODE: 'telegram',
      TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    });
    const h = await startHarness(config);
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: { id: 77, first_name: 'Reva' } });
    const socket = await connect(h, { initData });
    const reply = await socket.emitWithAck('ping_auth', null);
    expect(reply).toMatchObject({ authenticated: true, principal: { userId: '77' } });
  });

  it('accepts a dev-mode connection from handshake auth.userId', async () => {
    const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
    const h = await startHarness(config);
    const socket = await connect(h, { userId: '300', displayName: 'Dev Tester' });
    const reply = await socket.emitWithAck('ping_auth', null);
    expect(reply).toMatchObject({ authenticated: true, principal: { userId: '300', authSource: 'development' } });
  });
});
