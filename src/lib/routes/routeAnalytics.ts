import { trackEvent } from '../telemetry';
import type { LegacyRedirectId } from './legacyRedirects';

/** A legacy path was visited (redirected or shown a compatibility notice). */
export function trackLegacyRouteVisit(fromPath: string, redirectId: LegacyRedirectId): void {
  trackEvent('legacy_route_visited', { fromPath, redirectId });
}

/** The redirect destination that was resolved for a legacy path hit. */
export function trackRouteRedirect(params: {
  redirectId: LegacyRedirectId;
  from: string;
  to: string;
}): void {
  trackEvent('route_redirect_issued', params);
}

/** A legacy path had no resolvable new-IA destination (shown a compatibility notice instead). */
export function trackRouteRedirectMappingFailed(params: {
  redirectId: LegacyRedirectId;
  from: string;
  suggestedTo: string;
}): void {
  trackEvent('route_redirect_mapping_failed', params);
}

/**
 * The user left a compatibility-notice screen without engaging its CTA — an
 * approximation of "exit after redirect" for the one case WS5 can measure
 * directly (§5.2's explanatory route). Silent `matched: true` redirects have no
 * interactive screen of their own to measure engagement on; that belongs to the
 * destination page once WS6+ builds it.
 */
export function trackRedirectExit(params: { redirectId: LegacyRedirectId; from: string; engaged: boolean }): void {
  if (params.engaged) return;
  trackEvent('route_redirect_exit', params);
}

/**
 * Marks completion of a new-IA flow reached via redirect or direct navigation
 * (§5.3 "completion of the new flow"). Plumbing for WS6-9 to call once the real
 * flows (lesson, practice session, review) exist — no call sites yet in WS5.
 */
export function trackNewFlowCompletion(flowId: string, payload?: Record<string, unknown>): void {
  trackEvent('route_new_flow_completed', { flowId, ...payload });
}
