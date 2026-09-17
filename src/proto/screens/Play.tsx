import { Crown, Lock, Play as PlayIcon, Swords, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GAMES } from '../lib/mock';
import { Button, Card, Cover, Pill, SectionTitle } from '../ui/kit';
import { cn } from '../ui/cn';

export function Play() {
  const navigate = useNavigate();
  const [featured, ...rest] = GAMES;

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-semibold">Грати</h1>
        <p className="mt-1 text-[13px] text-muted">
          Ті самі запитання, що й у практиці, — лише з більшою ставкою
        </p>
      </header>

      <Card className="relative overflow-hidden p-0">
        <Cover
          hue={featured.hue}
          glyph="rays"
          fade={false}
          scrim
          className="absolute inset-0 h-full w-full"
        />
        <div className="relative flex min-h-[276px] flex-col justify-end p-4">
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
            <Crown size={12} /> Гра тижня
          </span>

          <h2 className="font-display text-[24px] leading-tight font-semibold text-white">
            {featured.title}
          </h2>
          <p className="mt-1 text-[13px] text-white/72">{featured.tagline}</p>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[12px] font-semibold text-white/85 backdrop-blur-md">
              <Users size={12} /> {featured.players}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[12px] font-semibold text-white/85 backdrop-blur-md">
              Рекорд: 11 питань
            </span>
          </div>
          <Button variant="onColor" size="lg" full className="mt-4" onClick={() => navigate('/practice')}>
            <PlayIcon size={17} /> Почати гру
          </Button>
        </div>
      </Card>

      <section>
        <SectionTitle>Усі режими</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {rest.map((game) => (
            <button
              key={game.id}
              disabled={!game.ready}
              onClick={() => navigate('/practice')}
              className={cn(
                'overflow-hidden rounded-tile border border-line bg-surface text-left backdrop-blur-xl transition-transform',
                game.ready ? 'active:scale-[0.98]' : 'opacity-60',
              )}
            >
              <Cover hue={game.hue} glyph={game.id === 'kahoot' ? 'wave' : 'path'} className="h-20 w-full" />
              <div className="p-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-bold">{game.title}</p>
                  {!game.ready && <Lock size={12} className="text-faint" />}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-faint">{game.tagline}</p>
                <p className="mt-2 text-[10px] font-semibold tracking-[0.1em] text-faint uppercase">
                  {game.ready ? game.players : 'скоро'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <Card tone="outline" className="flex items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--p-indigo)_18%,transparent)]">
          <Swords size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Виклик у спільноті</p>
          <p className="text-[12px] text-faint">Створіть поєдинок для своєї групи</p>
        </div>
        <Pill>Фаза 5</Pill>
      </Card>
    </div>
  );
}
