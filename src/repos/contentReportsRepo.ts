/**
 * Client for `/api/v1/content-reports` (Phase 4 WS9, spec §14) — a player
 * flags a question as wrong. Same shape as `learningRepo.ts`: throws the
 * shared `ApiError` on a non-2xx response.
 */
import type {
  ContentReportCreateRequest,
  ContentReportCreateResponse,
  MyContentReportsResponse,
} from '../../contracts/api/contentReports';
import { apiRequest } from '../lib/apiClient';

export type { ContentReportCategory } from '../../contracts/api/contentReports';

export const contentReportsRepo = {
  create(body: ContentReportCreateRequest): Promise<ContentReportCreateResponse> {
    return apiRequest<ContentReportCreateResponse>('/content-reports', { method: 'POST', body });
  },

  listMine(): Promise<MyContentReportsResponse> {
    return apiRequest<MyContentReportsResponse>('/content-reports/mine');
  },
};
