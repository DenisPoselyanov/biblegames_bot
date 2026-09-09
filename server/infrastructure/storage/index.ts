/**
 * Object storage composition (Phase 2 §19).
 */
import type { ServerConfig } from '../../config/env';
import type { ObjectStore } from '../../domains/storage/objectStore';
import { createFilesystemObjectStore } from './filesystemObjectStore';
import { createS3ObjectStore } from './s3ObjectStore';

export type { ObjectStore } from '../../domains/storage/objectStore';
export { createFilesystemObjectStore } from './filesystemObjectStore';
export { createMemoryObjectStore } from './memoryObjectStore';
export { createS3ObjectStore } from './s3ObjectStore';

export function createObjectStore(config: ServerConfig): ObjectStore {
  if (config.objectStorageDriver === 's3' && config.s3) {
    return createS3ObjectStore({ ...config.s3, forcePathStyle: true });
  }
  return createFilesystemObjectStore(config.objectStorageDir);
}
