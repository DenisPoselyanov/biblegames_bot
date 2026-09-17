import {
  Bell,
  ChevronRight,
  Coins,
  Download,
  Globe,
  Palette,
  RotateCcw,
  ShieldCheck,
  Store,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { levelProgress, useProto } from '../lib/useProto';
import type { ProtoTheme } from '../lib/protoContext';
import { Card, Cover, Ring, SectionTitle, Segmented } from '../ui/kit';
import { cn } from '../ui/cn';

const COSMETIC_THEMES = [
  { id: 'night', label: 'Ніч', hue: 258, owned: true },
  { id: 'dawn', label: 'Світанок', hue: 28, owned: true },
  { id: 'sea', label: 'Море', hue: 198, owned: false },
  { id: 'olive', label: 'Олива', hue: 96, owned: false },
];

export function Profile() {
  const navigate = useNavigate();
  const { theme, setTheme, xp, coins, streak, reset } = useProto();
  const level = levelProgress(xp);

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-semibold">Профіль</h1>
      </header>

      <Card className="overflow-hidden p-0">
        <Cover hue={258} glyph="wave" className="h-20 w-full" />
        <div className="-mt-9 px-4 pb-4">
          <div className="flex items-end gap-3">
            <div className="rounded-full border-[3px] border-canvas bg-canvas">
              <Ring value={level.pct} size={72} stroke={5}>
                <span className="font-display text-[24px] font-semibold">Д</span>
              </Ring>
            </div>
            <div className="min-w-0 flex-1 pb-1.5">
              <p className="text-[17px] leading-tight font-extrabold">Денис</p>
              <p className="text-[12px] text-faint">
                Рівень {level.level} · ще {level.toNext} XP
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat icon={<Zap size={14} />} value={String(xp)} label="XP" />
            <button onClick={() => navigate('/shop')} className="block w-full text-left">
              <MiniStat icon={<Coins size={14} />} value={String(coins)} label="монет" />
            </button>
            <MiniStat icon={<span className="text-[13px]">🔥</span>} value={String(streak)} label="днів" />
          </div>
        </div>
      </Card>

      <section>
        <SectionTitle>Вигляд</SectionTitle>
        <Card className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-[12px] font-semibold text-muted">Режим</p>
            <Segmented<ProtoTheme>
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: '🌙  Темний' },
                { value: 'light', label: '☀️  Світлий' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-semibold text-muted">Кольорова тема</p>
            <div className="grid grid-cols-4 gap-2">
              {COSMETIC_THEMES.map((item, index) => (
                <button
                  key={item.id}
                  className={cn(
                    'overflow-hidden rounded-[14px] border text-left',
                    index === 0 ? 'border-[color-mix(in_srgb,var(--p-gold)_60%,transparent)]' : 'border-line',
                    !item.owned && 'opacity-55',
                  )}
                >
                  <Cover hue={item.hue} glyph="rays" className="h-11 w-full" />
                  <p className="px-1.5 py-1.5 text-center text-[10px] font-semibold">
                    {item.owned ? item.label : `${item.label} · 150`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Налаштування</SectionTitle>
        <Card className="divide-y divide-[var(--p-line)] p-0">
          <SettingRow icon={<Bell size={17} />} label="Нагадування" value="09:00" />
          <SettingRow icon={<Globe size={17} />} label="Мова" value="Українська" />
          <SettingRow icon={<Palette size={17} />} label="Розмір тексту" value="Стандартний" />
          <SettingRow icon={<Download size={17} />} label="Офлайн-уроки" value="Увімкнено" />
          <SettingRow icon={<ShieldCheck size={17} />} label="Приватність" value="" />
          <SettingRow
            icon={<Store size={17} />}
            label="Магазин"
            value={`${coins} монет`}
            onClick={() => navigate('/shop')}
          />
        </Card>
      </section>

      <button
        onClick={reset}
        className="flex w-full items-center justify-center gap-2 rounded-tile border border-line px-4 py-3 text-[13px] font-semibold text-faint"
      >
        <RotateCcw size={14} /> Скинути стан прототипу
      </button>

      <p className="pb-2 text-center text-[11px] text-faint">
        Bible Games · прототип дизайну v2 · тема «{theme === 'dark' ? 'Ніч' : 'Світло'}»
      </p>
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-2 py-2.5 text-center">
      <span className="grid place-items-center text-gold-ink">{icon}</span>
      <p className="mt-1 text-[15px] leading-none font-extrabold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-faint">{label}</p>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <span className="text-faint">{icon}</span>
      <span className="flex-1 text-[14px] font-semibold">{label}</span>
      {value && <span className="text-[13px] text-faint">{value}</span>}
      <ChevronRight size={16} className="text-faint" />
    </button>
  );
}
