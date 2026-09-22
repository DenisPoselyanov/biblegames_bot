import { useState } from 'react';
import { COSMETIC_THEMES } from '../../data/cosmetics';
import { applyCosmeticThemeById } from '../../lib/cosmeticTheme';
import {
  AchievementBadge,
  AnimatedNumber,
  AnswerFeedback,
  AnswerOption,
  type AnswerOptionVisualState,
  AppPage,
  BottomSheet,
  Button,
  CelebrationLayer,
  ContentCard,
  CoverArt,
  Dialog,
  ErrorState,
  HeroCard,
  IconButton,
  ListRow,
  MetricTile,
  MetricTileGrid,
  OfflineState,
  PageHeader,
  Pill,
  ProgressBar,
  ProgressRing,
  SearchField,
  SectionHeader,
  SegmentedControl,
  ThemePreview,
} from '../../components/ui';
import { Icon } from '../../components/Icon';

/**
 * Dev-only visual QA harness for Phase 3 WS3 (DESIGN_RULES §20.3/§25 —
 * "story/fixture coverage"). Not part of the production route tree: App.tsx
 * only registers it behind `import.meta.env.DEV`, so it's tree-shaken out
 * of production builds entirely.
 */
export function DesignSystemFixture() {
  const [activeThemeId, setActiveThemeId] = useState('classic');
  const [answerState, setAnswerState] = useState<AnswerOptionVisualState>('idle');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'day' | 'week' | 'month'>('week');
  const [numberValue, setNumberValue] = useState(1240);

  function selectTheme(id: string) {
    setActiveThemeId(id);
    applyCosmeticThemeById(id);
  }

  return (
    <AppPage noBottomNav>
      <PageHeader kicker="WS3 — Design system" title="Фікстура компонентів" description="Візуальна перевірка семантичних токенів і primitives поза продуктовими сторінками." />

      <ContentCard>
        <SectionHeader title="Тема" />
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
          {COSMETIC_THEMES.map((theme) => (
            <ThemePreview
              key={theme.id}
              theme={theme}
              active={theme.id === activeThemeId}
              onSelect={() => selectTheme(theme.id)}
            />
          ))}
        </div>
      </ContentCard>

      <HeroCard
        kicker="Сьогодні"
        title="Псалом 23 — Господь мій Пастир"
        description="5 хвилин · 3 уроки залишилось"
        footer={<ProgressBar value={62} showValue />}
      />

      <HeroCard
        tone="cover"
        coverSeed="fixture-hero"
        coverGlyph="rays"
        badges={
          <Pill tone="onColor" icon={<Icon name="crown" size={12} />}>
            Урок дня
          </Pill>
        }
        kicker="Продовжити"
        title="Псалом 23 — Господь мій Пастир"
        footer={
          <Button variant="onColor" fullWidth>
            Продовжити урок
          </Button>
        }
      />

      <ContentCard>
        <SectionHeader title="Pills / CoverArt (WS3)" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
          <Pill>Новий Завіт</Pill>
          <Pill tone="accent">4 модулі</Pill>
          <Pill tone="onColor" icon={<Icon name="refresh" size={12} />}>
            Повторення
          </Pill>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <CoverArt seed="psalms" glyph="wave" style={{ width: 96, height: 96, borderRadius: 'var(--radius-lg)' }} />
          <CoverArt seed="genesis" glyph="path" style={{ width: 96, height: 96, borderRadius: 'var(--radius-lg)' }} />
          <CoverArt seed="luke" glyph="rays" style={{ width: 96, height: 96, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Кнопки" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="gold">Gold</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <IconButton icon="settings" label="Налаштування" variant="surface" />
        </div>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Прогрес" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginTop: 'var(--space-sm)' }}>
          <ProgressRing value={74} />
          <div style={{ flex: 1 }}>
            <ProgressBar value={40} label="Мастерство теми" showValue />
          </div>
        </div>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Метрики" />
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <MetricTileGrid>
            <MetricTile value={<AnimatedNumber value={numberValue} />} label="XP" />
            <MetricTile value="12" label="Streak" />
            <MetricTile value="87%" label="Точність" />
          </MetricTileGrid>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setNumberValue((v) => v + 250)} style={{ marginTop: 'var(--space-sm)' }}>
          +250 XP
        </Button>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Досягнення" />
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <AchievementBadge icon="🕊️" label="Перший урок" />
          <AchievementBadge icon="🔥" label="7-денний streak" />
          <AchievementBadge icon="📖" label="Знавець Псалмів" locked />
        </div>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Відповіді" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
          <AnswerOption visualState={answerState === 'idle' ? 'selected' : answerState} onClick={() => setAnswerState('idle')}>
            Господь — Пастир мій
          </AnswerOption>
          <AnswerOption visualState="idle" disabled={answerState !== 'idle'} onClick={() => setAnswerState('correct')}>
            Я нічого не потребуватиму
          </AnswerOption>
          <AnswerOption visualState="idle" disabled={answerState !== 'idle'} onClick={() => setAnswerState('wrong')}>
            Він мене впокоює
          </AnswerOption>
          {answerState !== 'idle' && (
            <>
              <AnswerFeedback
                correct={answerState === 'correct'}
                explanation="«Я нічого не потребуватиму» — другий вірш псалма 22 (23)."
                reference="Псалом 22:1-2"
              />
              <Button variant="secondary" size="sm" onClick={() => setAnswerState('idle')}>
                Скинути
              </Button>
            </>
          )}
        </div>
      </ContentCard>

      <ContentCard flush>
        <div style={{ padding: 'var(--space-lg) var(--space-lg) 0' }}>
          <SectionHeader title="Список" />
        </div>
        <ListRow leading="📖" title="Буття" subtitle="50 розділів" navigates onClick={() => {}} />
        <ListRow leading="🐑" title="Псалом 22" subtitle="Вивчено" trailing="100%" />
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Пошук і сегменти" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <SearchField value={search} onChange={setSearch} placeholder="Пошук уроків" />
          <SegmentedControl
            options={[
              { value: 'day', label: 'День' },
              { value: 'week', label: 'Тиждень' },
              { value: 'month', label: 'Місяць' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </div>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Sheet / Dialog / Celebration" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', position: 'relative' }}>
          <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
            Відкрити sheet
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDialogOpen(true)}>
            Відкрити dialog
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setCelebrate(true);
              window.setTimeout(() => setCelebrate(false), 700);
            }}
          >
            Celebration
          </Button>
          <CelebrationLayer active={celebrate} />
        </div>
      </ContentCard>

      <ContentCard>
        <SectionHeader title="Стани" />
        <ErrorState onRetry={() => {}} />
        <OfflineState onRetry={() => {}} />
      </ContentCard>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Приклад sheet">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Вміст bottom sheet на семантичних токенах.</p>
      </BottomSheet>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Приклад dialog"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Скасувати
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Підтвердити
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Вміст centered dialog.</p>
      </Dialog>
    </AppPage>
  );
}
