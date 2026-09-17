import { motion } from 'framer-motion';
import { Coins, Flame, Home, RotateCcw, Timer, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MASTERY_BY_THEME } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Button, Card, Meter, Ring } from '../ui/kit';

/**
 * The result never scrolls: everything scales off the viewport height so the
 * actions stay reachable on short phones.
 */
function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 812 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
}

export function PracticeResult() {
  const navigate = useNavigate();
  const { lastResult, streak } = useProto();
  const height = useViewportHeight();

  if (!lastResult) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <p className="text-[15px] font-semibold">Ще немає завершених сесій</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/practice')}>
            Пройти практику
          </Button>
        </div>
      </div>
    );
  }

  const accuracy = lastResult.correct / lastResult.total;
  const perfect = lastResult.correct === lastResult.total;
  const tight = height < 720;
  const ring = Math.round(Math.min(168, Math.max(96, height * 0.2)));
  const score = Math.round(ring * 0.26);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="grid shrink-0 place-items-center pt-[2vh] text-center"
      >
        <Ring value={accuracy} size={ring} stroke={Math.round(ring / 14)}>
          <div>
            <p
              className="font-display leading-none font-semibold tabular-nums"
              style={{ fontSize: score }}
            >
              {Math.round(accuracy * 100)}%
            </p>
            <p className="mt-1 text-[11px] font-semibold text-faint">
              {lastResult.correct} з {lastResult.total}
            </p>
          </div>
        </Ring>
        <h1
          className="font-display mt-[1.6vh] leading-tight font-semibold"
          style={{ fontSize: tight ? 21 : 25 }}
        >
          {perfect ? 'Бездоганно' : accuracy >= 0.7 ? 'Гарна робота' : 'Є що повторити'}
        </h1>
        <p className="mt-1 max-w-[19rem] text-[13px] leading-snug text-muted">
          {perfect
            ? 'Жодної помилки — ці цілі можна вважати засвоєними.'
            : 'Помилки додано до черги повторення: вони повернуться саме тоді, коли почнуть забуватися.'}
        </p>
      </motion.div>

      <div className="mt-[2vh] grid shrink-0 grid-cols-4 gap-2">
        <Stat icon={<Zap size={14} />} value={`+${lastResult.xp}`} label="XP" />
        <Stat icon={<Coins size={14} />} value={`+${lastResult.coins}`} label="монет" />
        <Stat icon={<Timer size={14} />} value={`${lastResult.durationSec}с`} label="часу" />
        <Stat icon={<Flame size={14} />} value={String(streak)} label="серія" />
      </div>

      <Card className="mt-[1.6vh] flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="mb-2.5 flex shrink-0 items-center gap-2">
          <TrendingUp size={15} className="text-gold-ink" />
          <p className="text-[13px] font-bold">Майстерність оновлено</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
          {/* Short screens drop the third row on purpose rather than clipping it. */}
          {MASTERY_BY_THEME.slice(0, tight ? 2 : 3).map((item, index) => {
            const delta = index === 0 ? 0.06 : index === 1 ? 0.03 : 0.01;
            return (
              <div key={item.theme}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-muted">{item.theme}</span>
                  <span className="font-bold text-success">+{Math.round(delta * 100)}%</span>
                </div>
                <Meter value={item.value + delta} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-[1.6vh] shrink-0 space-y-2 pb-1">
        {lastResult.wrongIds.length > 0 && (
          <Button variant="primary" size={tight ? 'md' : 'lg'} full onClick={() => navigate('/practice')}>
            <RotateCcw size={16} /> Повторити помилки ({lastResult.wrongIds.length})
          </Button>
        )}
        <Button variant="ghost" size={tight ? 'md' : 'lg'} full onClick={() => navigate('/')}>
          <Home size={16} /> На головну
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="grid place-items-center gap-0.5 px-1 py-2.5 text-center">
      <span className="text-gold-ink">{icon}</span>
      <p className="text-[15px] leading-none font-extrabold tabular-nums">{value}</p>
      <p className="text-[10px] text-faint">{label}</p>
    </Card>
  );
}
