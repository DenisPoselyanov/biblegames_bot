import { ArrowLeft, Crown, Plus, Swords, Trophy, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHALLENGES, COMMUNITIES, LEADERBOARD } from '../lib/mock';
import { Button, Card, Cover, Pill, SectionTitle, Segmented } from '../ui/kit';
import { cn } from '../ui/cn';

type Tab = 'challenges' | 'communities';

const STATE_LABEL = {
  'your-turn': { text: 'Ваш хід', tone: 'gold' as const },
  waiting: { text: 'Чекаємо суперника', tone: 'neutral' as const },
  won: { text: 'Перемога', tone: 'success' as const },
};

export function Social() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('challenges');

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
          <h1 className="font-display text-[23px] leading-tight font-semibold">Спільнота</h1>
          <p className="text-[12px] text-faint">Разом вивчати легше, ніж самому</p>
        </div>
      </header>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'challenges', label: 'Виклики' },
          { value: 'communities', label: 'Групи' },
        ]}
      />

      {tab === 'challenges' ? (
        <>
          <Card className="relative overflow-hidden p-0">
            <Cover hue={38} glyph="path" fade={false} scrim className="absolute inset-0 h-full w-full" />
            <div className="relative flex min-h-[152px] flex-col justify-end p-4">
              <h2 className="font-display text-[20px] font-semibold text-white">Новий виклик</h2>
              <p className="mt-1 text-[13px] text-white/72">
                10 питань на вибрану тему, двом гравцям по 48 годин
              </p>
              <Button variant="onColor" full className="mt-4" onClick={() => navigate('/practice')}>
                <Swords size={16} /> Кинути виклик
              </Button>
            </div>
          </Card>

          <section>
            <SectionTitle>Активні</SectionTitle>
            <div className="space-y-2.5">
              {CHALLENGES.map((challenge) => {
                const label = STATE_LABEL[challenge.state];
                return (
                  <button
                    key={challenge.id}
                    onClick={() => navigate('/practice')}
                    className="w-full rounded-tile border border-line bg-surface p-3.5 text-left backdrop-blur-xl active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[16px] font-semibold">
                        {challenge.opponent[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold">{challenge.opponent}</p>
                        <p className="text-[12px] text-faint">
                          {challenge.topic} · {challenge.endsIn}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[17px] leading-none font-extrabold tabular-nums">
                          <span
                            className={cn(
                              challenge.myScore > challenge.theirScore && 'text-success',
                              challenge.myScore < challenge.theirScore && 'text-danger',
                            )}
                          >
                            {challenge.myScore}
                          </span>
                          <span className="text-faint"> : </span>
                          <span className="text-muted">{challenge.theirScore}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <Pill tone={label.tone} className="!px-2.5 !py-0.5 !text-[11px]">
                        {label.text}
                      </Pill>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="space-y-2.5">
            {COMMUNITIES.map((community) => (
              <button
                key={community.id}
                onClick={() => navigate('/play/kahoot')}
                className="flex w-full items-center gap-3 rounded-tile border border-line bg-surface p-3 text-left backdrop-blur-xl active:scale-[0.99]"
              >
                <Cover hue={community.hue} glyph="rays" className="size-12 shrink-0 rounded-[14px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{community.title}</p>
                  <p className="text-[12px] text-faint">
                    {community.members} учасників · {community.weekly} XP за тиждень
                  </p>
                </div>
                {community.role === 'Лідер' ? (
                  <Crown size={15} className="text-gold-ink" />
                ) : (
                  <Users size={15} className="text-faint" />
                )}
              </button>
            ))}
            <button className="flex w-full items-center justify-center gap-2 rounded-tile border border-dashed border-line-strong px-4 py-3.5 text-[13px] font-semibold text-muted">
              <Plus size={15} /> Створити групу
            </button>
          </div>

          <section>
            <SectionTitle
              action={<span className="text-[11px] font-semibold text-faint">цей тиждень</span>}
            >
              Рейтинг групи
            </SectionTitle>
            <Card className="divide-y divide-[var(--p-line)] p-0">
              {LEADERBOARD.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    entry.you && 'bg-[color-mix(in_srgb,var(--p-violet)_10%,transparent)]',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold tabular-nums',
                      index === 0
                        ? 'bg-[color-mix(in_srgb,var(--p-gold)_24%,transparent)] text-gold-ink'
                        : 'text-faint',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {entry.name}
                    {entry.you && <span className="ml-1.5 text-[11px] text-faint">ви</span>}
                  </span>
                  <span className="text-[13px] font-bold tabular-nums">{entry.xp}</span>
                </div>
              ))}
            </Card>
          </section>

          <button className="flex w-full items-center justify-center gap-2 py-1 text-[13px] font-semibold text-faint">
            <UserPlus size={14} /> Запросити друга
          </button>

          <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[11px] text-faint">
            <Trophy size={12} /> Рейтинг рахує лише навчання, не покупки
          </p>
        </>
      )}
    </div>
  );
}
