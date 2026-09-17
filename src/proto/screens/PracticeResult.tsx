import { motion } from 'framer-motion';
import { Coins, Home, RotateCcw, Timer, TrendingUp, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MASTERY_BY_THEME } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Button, Card, Meter, Ring } from '../ui/kit';

export function PracticeResult() {
  const navigate = useNavigate();
  const { lastResult, streak } = useProto();

  if (!lastResult) {
    return (
      <div className="grid min-h-full place-items-center text-center">
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

  return (
    <div className="flex min-h-full flex-col pt-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="grid place-items-center text-center"
      >
        <Ring value={accuracy} size={168} stroke={12}>
          <div>
            <p className="font-display text-[44px] leading-none font-semibold tabular-nums">
              {Math.round(accuracy * 100)}%
            </p>
            <p className="mt-1 text-[12px] font-semibold text-faint">
              {lastResult.correct} з {lastResult.total}
            </p>
          </div>
        </Ring>
        <h1 className="font-display mt-5 text-[26px] leading-tight font-semibold">
          {perfect ? 'Бездоганно' : accuracy >= 0.7 ? 'Гарна робота' : 'Є що повторити'}
        </h1>
        <p className="mt-1.5 max-w-[19rem] text-[14px] text-muted">
          {perfect
            ? 'Жодної помилки — ці цілі можна вважати засвоєними.'
            : 'Помилки додано до черги повторення: вони повернуться саме тоді, коли почнуть забуватися.'}
        </p>
      </motion.div>

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        <Stat icon={<Zap size={15} />} value={`+${lastResult.xp}`} label="XP" />
        <Stat icon={<Coins size={15} />} value={`+${lastResult.coins}`} label="монет" />
        <Stat
          icon={<Timer size={15} />}
          value={`${lastResult.durationSec}с`}
          label="часу"
        />
      </div>

      <Card className="mt-3 p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-gold-ink" />
          <p className="text-[14px] font-bold">Майстерність оновлено</p>
        </div>
        <div className="space-y-3">
          {MASTERY_BY_THEME.slice(0, 3).map((item, index) => {
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

      <Card tone="outline" className="mt-3 flex items-center gap-3 p-4">
        <span className="text-[22px]">🔥</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Серія {streak} днів триває</p>
          <p className="text-[12px] text-faint">Завтрашнє повторення вже заплановано</p>
        </div>
      </Card>

      <div className="mt-auto space-y-2 pt-6">
        {lastResult.wrongIds.length > 0 && (
          <Button variant="primary" size="lg" full onClick={() => navigate('/practice')}>
            <RotateCcw size={17} /> Повторити помилки ({lastResult.wrongIds.length})
          </Button>
        )}
        <Button variant="ghost" size="lg" full onClick={() => navigate('/')}>
          <Home size={17} /> На головну
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="grid place-items-center gap-1 px-2 py-3.5 text-center">
      <span className="text-gold-ink">{icon}</span>
      <p className="text-[17px] leading-none font-extrabold tabular-nums">{value}</p>
      <p className="text-[11px] text-faint">{label}</p>
    </Card>
  );
}
