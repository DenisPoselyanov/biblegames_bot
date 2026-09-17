import { ArrowLeft, Check, Coins, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SHOP_SECTIONS } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Card, Cover, SectionTitle } from '../ui/kit';
import { cn } from '../ui/cn';

export function Shop() {
  const navigate = useNavigate();
  const { coins } = useProto();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-display flex-1 text-[23px] leading-tight font-semibold">Магазин</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--p-gold)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-gold)_12%,transparent)] px-3 py-1.5 text-[13px] font-extrabold text-gold-ink tabular-nums">
          <Coins size={13} /> {coins}
        </span>
      </header>

      <Card tone="outline" className="flex items-start gap-3 p-4">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-gold-ink" />
        <p className="text-[12px] leading-relaxed text-muted">
          Монети заробляються лише навчанням. Нічого з магазину не дає переваги у
          вивченні чи в рейтингу — тільки вигляд і підказки в іграх.
        </p>
      </Card>

      {SHOP_SECTIONS.map((section) => (
        <section key={section.id}>
          <SectionTitle
            action={<span className="text-[11px] font-semibold text-faint">{section.note}</span>}
          >
            {section.title}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {section.items.map((item) => (
              <button
                key={item.id}
                disabled={item.owned}
                className={cn(
                  'overflow-hidden rounded-tile border border-line bg-surface text-left backdrop-blur-xl',
                  item.owned ? 'opacity-60' : 'active:scale-[0.98]',
                )}
              >
                <Cover hue={item.hue} glyph="rays" className="h-20 w-full" />
                <div className="p-3">
                  <p className="text-[14px] font-bold">{item.title}</p>
                  <p className="text-[11px] text-faint">{item.subtitle}</p>
                  <span
                    className={cn(
                      'mt-2.5 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[12px] font-extrabold tabular-nums',
                      item.owned
                        ? 'border border-line text-faint'
                        : 'bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))] text-white',
                    )}
                  >
                    {item.owned ? (
                      <>
                        <Check size={12} /> придбано
                      </>
                    ) : (
                      <>
                        <Coins size={12} /> {item.price}
                      </>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="pb-2 text-center text-[11px] text-faint">
        Поповнення монет за гроші в прототипі не показано — модель монетизації ще не обрана
      </p>
    </div>
  );
}
