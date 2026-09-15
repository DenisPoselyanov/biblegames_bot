import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPage, Button } from '../ui';
import { EmptyState } from '../EmptyState';
import { trackRedirectExit } from '../../lib/routes/routeAnalytics';
import type { LegacyRedirectId } from '../../lib/routes/legacyRedirects';

interface RouteCompatibilityNoticeProps {
  redirectId: LegacyRedirectId;
  fromPath: string;
  suggestedTo: string;
}

/**
 * Shown instead of a silent redirect when a legacy link (e.g. an old bookmarked
 * theme/lesson) has no exact new-IA equivalent — §5.2: "show an explanatory
 * compatibility route instead of silently sending every user to Home."
 */
export function RouteCompatibilityNotice({ redirectId, fromPath, suggestedTo }: RouteCompatibilityNoticeProps) {
  const navigate = useNavigate();
  const engagedRef = useRef(false);

  useEffect(() => {
    return () => {
      trackRedirectExit({ redirectId, from: fromPath, engaged: engagedRef.current });
    };
  }, [redirectId, fromPath]);

  return (
    <AppPage>
      <EmptyState
        icon="info"
        title="Це посилання застаріло"
        description="Ми оновили структуру навчання, тож точну сторінку за цим посиланням більше не знайти. Спробуйте почати звідси."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              engagedRef.current = true;
              navigate(suggestedTo, { replace: true });
            }}
          >
            Перейти до розділу
          </Button>
        }
      />
    </AppPage>
  );
}
