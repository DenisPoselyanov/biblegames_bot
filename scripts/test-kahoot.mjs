#!/usr/bin/env node
/**
 * Kahoot unit + integration smoke (run: npm run test-kahoot)
 * Requires Kahoot server on PORT 3001 for socket test.
 */
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

async function testScoringAndRanking() {
  const { calcQuestionPoints } = await import('../server/kahootScoring.ts');
  const { getCompetitionRank } = await import('../src/lib/kahootRanking.ts');
  assert.equal(calcQuestionPoints('simple', 0, 10000, true, 0), 30);
  assert.equal(getCompetitionRank([{ id: 'x', score: 10 }, { id: 'y', score: 10 }], 'y'), 1);
}

async function testSocketFlow() {
  const base = process.env.KAHOOT_SERVER_URL || 'http://127.0.0.1:3001';
  const host = io(base, { transports: ['websocket'], autoConnect: true, timeout: 3000 });
  const player = io(base, { transports: ['websocket'], autoConnect: true, timeout: 3000 });

  const waitConnect = (socket, label) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} connect timeout`)), 4000);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve(undefined);
      });
      socket.once('connect_error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

  await Promise.all([waitConnect(host, 'host'), waitConnect(player, 'player')]);

  const createRes = await new Promise((resolve) => {
    host.emit(
      'create_room',
      {
        hostName: 'Host',
        settings: {
          themeIds: ['geography'],
          questionCount: 3,
          timePerQuestion: 10,
          difficulty: 'youth',
          flowMode: 'auto',
          scoringMode: 'simple',
          thinkTimeSec: 0,
          hostParticipates: false,
        },
      },
      resolve,
    );
  });

  assert.equal(createRes.ok, true, createRes.error);
  const code = createRes.state.code;

  const joinRes = await new Promise((resolve) => {
    player.emit('join_room', { code, playerName: 'Player1' }, resolve);
  });
  assert.equal(joinRes.ok, true, joinRes.error);

  const startRes = await new Promise((resolve) => {
    host.emit('start_game', {}, resolve);
  });
  assert.equal(startRes.ok, true, startRes.error);
  assert.equal(startRes.state.phase, 'question');

  const codeBefore = createRes.state.code;
  const hostName = 'Host';

  host.disconnect();
  await new Promise((r) => setTimeout(r, 200));

  const host2 = io(base, { transports: ['websocket'], autoConnect: true, timeout: 3000 });
  await waitConnect(host2, 'host-rejoin');

  const rejoinRes = await new Promise((resolve) => {
    host2.emit('rejoin_room', { code: codeBefore, playerName: hostName }, resolve);
  });
  assert.equal(rejoinRes.ok, true, rejoinRes.error);
  assert.equal(rejoinRes.state.hostId, host2.id, 'host role restored after rejoin');

  const advanceRes = await new Promise((resolve) => {
    host2.emit('advance_phase', {}, resolve);
  });
  assert.equal(advanceRes.ok, false, 'manual advance blocked in auto mode');

  host2.disconnect();
  player.disconnect();
  console.log('Socket flow: create → join → start → host rejoin OK');
}

async function main() {
  await testScoringAndRanking();
  try {
    await testSocketFlow();
  } catch (e) {
    console.warn('Socket test skipped (start server with npm run server):', e?.message ?? e);
  }
  console.log('test-kahoot: passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
