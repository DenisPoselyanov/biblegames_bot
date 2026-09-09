import { describe, expect, it, vi } from 'vitest';
import { roomEventEnvelope } from '../../../contracts/events/realtime';
import { createFixedClock } from '../clock';
import { createRoomEventGateway } from '../roomEventGateway';

function fakeIo() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { io: { to } as never, to, emit };
}

describe('createRoomEventGateway (§15, acc. #11)', () => {
  it('emits a contract-valid envelope with a monotonic per-room sequence', () => {
    const clock = createFixedClock(1_000);
    const { io, to, emit } = fakeIo();
    const gw = createRoomEventGateway(io, clock);

    const e0 = gw.emit('ROOM1', 'room_state', { phase: 'lobby' });
    clock.advance(500);
    const e1 = gw.emit('ROOM1', 'room_state', { phase: 'question' });
    const other = gw.emit('ROOM2', 'room_state', { phase: 'lobby' });

    expect(e0.sequence).toBe(0);
    expect(e1.sequence).toBe(1);
    expect(other.sequence).toBe(0); // per-room
    expect(e1.serverTime).toBe(new Date(1_500).toISOString());
    expect(() => roomEventEnvelope.parse(e1)).not.toThrow();
    expect(to).toHaveBeenCalledWith('ROOM1');
    expect(emit).toHaveBeenCalledWith('room_event', e1);
  });

  it('latest() / sequenceOf() back the resync path; drop() forgets the room', () => {
    const { io } = fakeIo();
    const gw = createRoomEventGateway(io, createFixedClock());

    expect(gw.latest('R')).toBeNull();
    expect(gw.sequenceOf('R')).toBe(-1);

    gw.emit('R', 'room_state', {});
    gw.emit('R', 'room_state', {});
    expect(gw.sequenceOf('R')).toBe(1);
    expect(gw.latest('R')?.sequence).toBe(1);

    gw.drop('R');
    expect(gw.latest('R')).toBeNull();
    expect(gw.sequenceOf('R')).toBe(-1);
  });
});
