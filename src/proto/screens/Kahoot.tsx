import { ArrowLeft, Check, Clock, Copy, ListMusic, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KAHOOT_PLAYLISTS, KAHOOT_ROOM } from '../lib/mock';
import { Button, Card, Cover, Pill, SectionTitle, Segmented } from '../ui/kit';
import { cn } from '../ui/cn';

type Mode = 'host' | 'join';

export function KahootHub() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('host');
  const [code, setCode] = useState('');

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate('/play')}
          aria-label="Назад"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display text-[23px] leading-tight font-semibold">Жива вікторина</h1>
          <p className="text-[12px] text-faint">Одна кімната — до 40 гравців</p>
        </div>
      </header>

      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'host', label: 'Створити' },
          { value: 'join', label: 'Приєднатися' },
        ]}
      />

      {mode === 'join' ? (
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-muted">Код кімнати</p>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            className="font-display mt-3 w-full rounded-tile border border-line bg-surface-2 py-4 text-center text-[30px] font-semibold tracking-[0.35em] tabular-nums placeholder:text-faint"
          />
          <Button
            variant="primary"
            size="lg"
            full
            className="mt-4"
            disabled={code.length < 6}
            onClick={() => navigate('/play/kahoot/room')}
          >
            Увійти в кімнату
          </Button>
          <p className="mt-3 text-center text-[12px] text-faint">
            Код показує ведучий на спільному екрані
          </p>
        </Card>
      ) : (
        <>
          <Card className="relative overflow-hidden p-0">
            <Cover hue={168} glyph="wave" fade={false} scrim className="absolute inset-0 h-full w-full" />
            <div className="relative flex min-h-[184px] flex-col justify-end p-4">
              <h2 className="font-display text-[21px] font-semibold text-white">Новий добір</h2>
              <p className="mt-1 text-[13px] text-white/72">
                Зберіть питання з банку або з власного списку
              </p>
              <Button
                variant="onColor"
                size="lg"
                full
                className="mt-4"
                onClick={() => navigate('/play/kahoot/room')}
              >
                <Plus size={17} /> Створити кімнату
              </Button>
            </div>
          </Card>

          <section>
            <SectionTitle
              action={<span className="text-[11px] font-semibold text-faint">{KAHOOT_PLAYLISTS.length} набори</span>}
            >
              Мої набори
            </SectionTitle>
            <div className="space-y-2.5">
              {KAHOOT_PLAYLISTS.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => navigate('/play/kahoot/room')}
                  className="flex w-full items-center gap-3 rounded-tile border border-line bg-surface p-3 text-left backdrop-blur-xl active:scale-[0.99]"
                >
                  <Cover hue={playlist.hue} glyph="path" className="size-12 shrink-0 rounded-[14px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{playlist.title}</p>
                    <p className="text-[12px] text-faint">
                      {playlist.questions} питань · {playlist.plays} запусків
                    </p>
                  </div>
                  <ListMusic size={16} className="text-faint" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function KahootRoom() {
  const navigate = useNavigate();
  const ready = KAHOOT_ROOM.players.filter((player) => player.ready).length;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate('/play/kahoot')}
          aria-label="Назад"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={16} />
        </button>
        <p className="text-[13px] font-bold">{KAHOOT_ROOM.playlist}</p>
      </header>

      <Card className="relative mt-4 overflow-hidden p-0">
        <Cover hue={168} glyph="rays" fade={false} scrim className="absolute inset-0 h-full w-full" />
        <div className="relative grid place-items-center px-5 py-6 text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">
            Код кімнати
          </p>
          <p className="font-display mt-1.5 text-[38px] leading-none font-semibold text-white tabular-nums">
            {KAHOOT_ROOM.code}
          </p>
          <button className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-3.5 py-1.5 text-[12px] font-semibold text-white">
            <Copy size={13} /> Скопіювати запрошення
          </button>
        </div>
      </Card>

      <div className="mt-5 mb-3 flex items-end justify-between">
        <h2 className="font-display text-[18px] font-semibold">
          Гравці <span className="text-faint">{KAHOOT_ROOM.players.length}</span>
        </h2>
        <Pill tone="success">
          <Check size={12} /> готові {ready}
        </Pill>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {KAHOOT_ROOM.players.map((player) => (
          <div
            key={player.id}
            className={cn(
              'flex items-center gap-2.5 rounded-tile border px-3 py-2.5',
              player.ready
                ? 'border-[color-mix(in_srgb,var(--p-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_10%,transparent)]'
                : 'border-line bg-surface',
            )}
          >
            <span className="font-display grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[14px] font-semibold">
              {player.name[0]}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{player.name}</span>
            {player.ready ? (
              <Check size={14} className="text-success" strokeWidth={3} />
            ) : (
              <Clock size={13} className="text-faint" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6 pb-1">
        <Button variant="primary" size="lg" full onClick={() => navigate('/play/survival')}>
          <Users size={17} /> Почати для {KAHOOT_ROOM.players.length} гравців
        </Button>
        <p className="mt-2 text-center text-[12px] text-faint">
          Хто не встиг — приєднається до наступного питання
        </p>
      </div>
    </div>
  );
}
