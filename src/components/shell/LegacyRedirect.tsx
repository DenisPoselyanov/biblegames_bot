import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { LEGACY_REDIRECTS, type LegacyRedirectId } from '../../lib/routes/legacyRedirects';
import { trackLegacyRouteVisit, trackRouteRedirect, trackRouteRedirectMappingFailed } from '../../lib/routes/routeAnalytics';
import { RouteCompatibilityNotice } from './RouteCompatibilityNotice';

interface LegacyRedirectProps {
  entryId: LegacyRedirectId;
}

/**
 * Renders one legacy-path compatibility redirect (§5.2), driven by the
 * `legacyRedirects` table. Tracks route analytics (§5.3) on mount.
 */
export function LegacyRedirect({ entryId }: LegacyRedirectProps) {
  const params = useParams();
  const location = useLocation();
  const entry = LEGACY_REDIRECTS[entryId];
  const result = entry.resolve(params, location.search);

  useEffect(() => {
    trackLegacyRouteVisit(location.pathname, entryId);
    if (result.matched) {
      trackRouteRedirect({ redirectId: entryId, from: location.pathname, to: result.to });
    } else {
      trackRouteRedirectMappingFailed({ redirectId: entryId, from: location.pathname, suggestedTo: result.to });
    }
    // Track once per landing on this legacy path, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, entryId]);

  if (!result.matched) {
    return <RouteCompatibilityNotice redirectId={entryId} fromPath={location.pathname} suggestedTo={result.to} />;
  }

  return <Navigate to={result.to} replace />;
}
