/**
 * `@contracts` barrel — the single import surface for canonical runtime contracts
 * (Phase 2 §7, §8). See ./README.md for the rules.
 */
export { CONTRACT_VERSION, CONTRACT_VERSION_HEADER } from './version';

export * from './enums/index';
export * from './schemas/primitives';
export * from './schemas/error';
export * from './schemas/snapshots';
export * from './schemas/content';

export * as adminContract from './api/admin';
export * as meContract from './api/me';
export * as progressionContract from './api/progression';
export * as shopContract from './api/shop';

export * as realtimeContract from './events/realtime';
