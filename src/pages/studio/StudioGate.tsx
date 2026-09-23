import { ShieldAlert } from 'lucide-react';
import './styles/tokens.css';
import './styles/studio.css';
import { StudioStoreProvider } from './lib/studioStore';
import { useStudio } from './lib/useStudio';
import { isStudioRole } from './lib/rbac';
import { StudioApp } from './StudioApp';
import { Button } from './ui/kit';

function Denied() {
  return (
    <div className="studio-root proto-root grid h-[100dvh] place-items-center px-6" data-proto-theme="dark">
      <div className="max-w-[38ch] text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-line bg-[var(--s-panel-2)] text-danger">
          <ShieldAlert size={18} />
        </div>
        <p className="font-display text-[18px] font-semibold">Немає доступу до студії</p>
        <p className="mt-2 text-[13px] text-faint">
          Потрібна роль «Рецензент контенту» або «Публікатор контенту». Якщо це помилка,
          зверніться до адміністратора.
        </p>
        <a href="../" className="mt-4 inline-block">
          <Button variant="ghost">← До застосунку</Button>
        </a>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="studio-root proto-root grid h-[100dvh] place-items-center" data-proto-theme="dark">
      <p className="text-[13px] text-faint">Завантаження…</p>
    </div>
  );
}

function StudioGateInner() {
  const { identity, identityStatus } = useStudio();

  if (identityStatus === 'loading') return <Loading />;
  if (identityStatus === 'error' || !identity || !isStudioRole(identity.roles)) return <Denied />;

  return <StudioApp />;
}

/**
 * Entry point mounted at `/studio/*` (Phase 4 WS8a). Fail-closed client-side
 * gate: renders nothing of the studio until the server has confirmed the
 * signed-in principal holds a content role. This is UX only — the real
 * enforcement is every `/api/v1/studio/*` and future content endpoint's own
 * `requirePermission` check, which runs regardless of this component.
 */
export function StudioGate() {
  return (
    <StudioStoreProvider>
      <StudioGateInner />
    </StudioStoreProvider>
  );
}
