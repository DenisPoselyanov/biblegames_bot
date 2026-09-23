/**
 * `ValidationFindingRepository` (Phase 4 WS3) — interface only; implementations
 * live in `server/infrastructure/database/repositories/validationFindings.ts`
 * (SQL) and `./inMemoryValidationFindings.ts` (dev/test parity peer). Both pass
 * `__tests__/validationFindingsRepositoryContract.ts`.
 */
import type { Transaction } from './context';
import type {
  NewValidationFinding,
  ValidationFinding,
  ValidationFindingSummary,
  ValidationRevisionType,
} from './validationFindings';

export interface ValidationFindingRepository {
  /** Replace the stored finding set for one revision with the latest check run. */
  record(
    revisionType: ValidationRevisionType,
    revisionId: string,
    findings: NewValidationFinding[],
    tx?: Transaction,
  ): Promise<ValidationFinding[]>;
  listFor(
    revisionType: ValidationRevisionType,
    revisionId: string,
    tx?: Transaction,
  ): Promise<ValidationFinding[]>;
  /** True when any stored finding for the revision is `severity: 'blocking'`. */
  hasBlocking(
    revisionType: ValidationRevisionType,
    revisionId: string,
    tx?: Transaction,
  ): Promise<boolean>;
  /** Stored findings grouped by (type, kind, severity) — see `ValidationFindingSummary`. */
  summarize(tx?: Transaction): Promise<ValidationFindingSummary[]>;
}
