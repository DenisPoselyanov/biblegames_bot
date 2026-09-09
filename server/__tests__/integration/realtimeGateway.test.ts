import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { roomEventEnvelope } from '../../../contracts/events/realtime';
import { loadConfig } from '../../config/env';
import { createHttpServer, type HttpServerBundle } from '../../app/createHttpServer';
import { createMemoryStore } from '../helpers/memoryStore';

interface Harness {
  bundle: HttpServerBundle;
  url: string;
  clients: ClientSocket[];
}
const harnesses: Harness[] = [];

afterEach(async () => {
  for (const h of harnesses.splice(0)) {
    for (const c of h.clients) c.close();
    await h.bundle.close();
  }
});

async function start(env: Record<string, string>): Promise<Harness> {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...env });
  const bundle = createHttpServer({ config, dbStore: createMemoryStore() });
  await new Promise<void>((resolve) => bundle.httpServer.listen(0, resolve));
  const port = (bundle.httpServer.address() as { port: number }).port;
  const h: Harness = { bundle, url: `http://localhost:${port}`, clients: [] };
  harnesses.push(h);
  return h;
}

function connect(h: Harness, userId: string): Promise<ClientSocket> {
  const socket = ioClient(h.url, {
    auth: { userId, displayName: `U${userId}` },
    transports: ['websocket'],
    reconnection: false,
  });
  h.clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

const settings = {
  themeIds: ['genesis'],
  questionCount: 3,
  timePerQuestion: 20,
  difficulty: 'youth' as const,
  flowMode: 'manual' as const,
  scoringMode: 'classic' as const,
  thinkTimeSec: 0,
  hostParticipates: false,
};

describe('realtime gateway v2 (Phase 2 §15)', () => {
  it('broadcasts a typed RealtimeEvent envelope and answers resync_room', async () => {
    const h = await start({ REALTIME_GATEWAY_V2: 'true' });
    const host = await connect(h, '1');

    const events: unknown[] = [];
    host.on('room_event', (e) => events.push(e));

    const created = (await host.emitWithAck('create_room', {
      hostName: 'Host',
      settings,
    })) as { ok: true; state: { code: string } };
    expect(created.ok).toBe(true);
    const code = created.state.code;

    // The socket joins the room inside the create handler, so it may miss the
    // very first envelope (the ack carries that state). A subsequent state
    // change is delivered as an envelope.
    await host.emitWithAck('update_settings', { questionCount: 5 });
    await new Promise((r) => setTimeout(r, 50));
    expect(events.length).toBeGreaterThan(0);
    const envelope = roomEventEnvelope.parse(events[events.length - 1]);
    expect(envelope.type).toBe('room_state');
    expect(envelope.sequence).toBeGreaterThanOrEqual(1);
    expect(envelope.roomId).toBe(code);

    // A client that is fully caught up is told it missed nothing.
    const caughtUp = await host.emitWithAck('resync_room', {
      code,
      lastSequence: envelope.sequence,
    });
    expect(caughtUp).toMatchObject({ ok: true, missed: false });

    // A client that fell behind gets missed:true plus the current envelope.
    const behind = (await host.emitWithAck('resync_room', { code, lastSequence: -1 })) as {
      ok: true;
      missed: boolean;
      event: { sequence: number } | null;
    };
    expect(behind.missed).toBe(true);
    expect(behind.event?.sequence).toBe(envelope.sequence);
  });

  it('does not emit room_event when the flag is off', async () => {
    const h = await start({});
    const host = await connect(h, '1');
    const events: unknown[] = [];
    host.on('room_event', (e) => events.push(e));

    await host.emitWithAck('create_room', { hostName: 'Host', settings });
    await new Promise((r) => setTimeout(r, 50));
    expect(events).toEqual([]);

    const resync = await host.emitWithAck('resync_room', { code: 'ABCDEF', lastSequence: -1 });
    expect(resync).toMatchObject({ ok: true, event: null, missed: false });
  });
});
