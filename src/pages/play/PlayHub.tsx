import { Link } from 'react-router-dom';
import { GAME_MODES } from '../../types/gameModes';
import type { GameMode } from '../../types/gameModes';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { MotionStagger, MotionStaggerItem } from '../../components/motion';
import { useMotionEntrance } from '../../hooks/useMotionEntrance';
import { isFeatureEnabled } from '../../lib/flags';
import { Button, CoverArt, HeroCard, Pill, cx } from '../../components/ui';
import styles from './PlayHub.module.css';

type CoverGlyph = 'rays' | 'path' | 'wave';

interface ModeArt {
  icon: IconName;
  artBgClass: string;
  glyph: CoverGlyph;
}

const MODE_ART: Record<string, ModeArt> = {
  study: {
    icon: 'study',
    artBgClass: styles.cardArtBgStudy,
    glyph: 'rays',
  },
  millionaire: {
    icon: 'diamond',
    artBgClass: styles.cardArtBgMillionaire,
    glyph: 'path',
  },
  survival: {
    icon: 'survival',
    artBgClass: styles.cardArtBgSurvival,
    glyph: 'path',
  },
  kahoot: {
    icon: 'kahoot',
    artBgClass: styles.cardArtBgKahoot,
    glyph: 'wave',
  },
};

function badgeClass(badge?: string) {
  if (!badge) return '';
  if (badge === 'NEW') return styles.badgeNew;
  if (badge === 'Мультиплеєр') return styles.badgeMultiplayer;
  return styles.badgeDefault;
}

/** Play Hub card disclosure (§15.1): purpose is `description`; this covers the rest. */
function ModeMeta({ mode }: { mode: GameMode }) {
  return (
    <ul className={styles.cardMeta} aria-label="Деталі режиму">
      <li className={styles.cardMetaItem} title={mode.social === 'solo' ? 'Гра наодинці' : 'Гра з друзями'}>
        <Icon name={mode.social === 'solo' ? 'profile' : 'community'} size={13} />
        <span>{mode.social === 'solo' ? 'Соло' : 'Разом'}</span>
      </li>
      <li className={styles.cardMetaItem} title={mode.duration}>
        <Icon name="clock" size={13} />
        <span>{mode.duration}</span>
      </li>
      <li className={styles.cardMetaItem} title={mode.rewardPolicy}>
        <Icon name="coins" size={13} />
        <span>{mode.rewardShort}</span>
      </li>
      <li
        className={styles.cardMetaItem}
        title={mode.affectsMastery ? 'Впливає на прогрес тем' : 'Не впливає на прогрес тем'}
      >
        <Icon name="brain" size={13} />
        <span>{mode.affectsMastery ? 'Прогрес тем' : 'Без прогресу тем'}</span>
      </li>
      <li className={styles.cardMetaItem} title={mode.availability}>
        <Icon name="info" size={13} />
        <span>{mode.availability.startsWith('Працює офлайн') ? 'Офлайн доступно' : 'Потрібен інтернет'}</span>
      </li>
    </ul>
  );
}

/**
 * Phase 3.5 §6 WS4 re-skin (behind `designSystemV2`): the featured mode
 * becomes the "screen's main object" full-bleed `HeroCard` (§4 locked
 * decision), the rest become `CoverArt`-fronted rows instead of the legacy
 * flat gradient art panel. Same `ModeMeta` disclosure list on every card
 * either way — WS9 already built that accessibility requirement (§15.1) and
 * this pass does not touch it. Does not touch Millionaire/Survival/Kahoot's
 * own screens or reward logic — those were already reskinned by Phase 3 WS9;
 * this only covers the hub/picker screen itself.
 */
function ModeCardV2({ mode, featured }: { mode: GameMode; featured?: boolean }) {
  const art = MODE_ART[mode.id];

  if (featured) {
    const hero = (
      <HeroCard
        tone="cover"
        coverSeed={mode.id}
        coverGlyph={art.glyph}
        kicker="Рекомендуємо"
        title={mode.title}
        description={mode.description}
        footer={
          mode.available ? (
            <Button variant="onColor" fullWidth>
              Грати
            </Button>
          ) : (
            <Pill tone="onColor">Незабаром</Pill>
          )
        }
      />
    );
    return (
      <div className={styles.featuredWrap}>
        {mode.available ? (
          <Link to={mode.path} className={styles.heroLink} aria-label={mode.title}>
            {hero}
          </Link>
        ) : (
          hero
        )}
        <ModeMeta mode={mode} />
      </div>
    );
  }

  const body = (
    <>
      <span className={styles.modeArt}>
        <CoverArt seed={mode.id} glyph={art.glyph} className={styles.modeArtCover} />
        <Icon name={art.icon} size={40} className={styles.modeArtIcon} />
      </span>
      <span className={styles.modeBody}>
        <span className={styles.modeHeader}>
          <h2>{mode.title}</h2>
          {mode.badge && <Pill tone="accent">{mode.badge}</Pill>}
          {!mode.available && <Pill>Незабаром</Pill>}
        </span>
        <p className={styles.modeDesc}>{mode.description}</p>
        <ModeMeta mode={mode} />
      </span>
    </>
  );

  if (mode.available) {
    return (
      <Link to={mode.path} className={styles.modeRow}>
        {body}
      </Link>
    );
  }
  return <div className={cx(styles.modeRow, styles.disabled)}>{body}</div>;
}

export function PlayHub() {
  const { shouldEnter } = useMotionEntrance('play-hub');
  const designSystemV2 = isFeatureEnabled('designSystemV2');
  const [featured, ...rest] = GAME_MODES;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Режими гри</h1>
        <p>Обери, як хочеш грати сьогодні</p>
      </header>

      {designSystemV2 ? (
        <MotionStagger as="div" className={styles.modesV2} enter={shouldEnter}>
          <MotionStaggerItem as="div">
            <ModeCardV2 mode={featured} featured />
          </MotionStaggerItem>
          {rest.map((mode) => (
            <MotionStaggerItem as="div" key={mode.id}>
              <ModeCardV2 mode={mode} />
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      ) : (
        <MotionStagger as="ul" className={styles.modes} enter={shouldEnter}>
          {GAME_MODES.map((mode) => {
            const art = MODE_ART[mode.id];
            const cardFeatured = mode.id === 'study';

            return (
              <MotionStaggerItem as="li" key={mode.id}>
                {mode.available ? (
                  <Link
                    to={mode.path}
                    className={`${styles.card}${cardFeatured ? ` ${styles.cardFeatured}` : ''}`}
                  >
                    <div className={styles.cardBody}>
                      <div className={styles.cardHeader}>
                        <h2>{mode.title}</h2>
                        {mode.badge && (
                          <span className={`${styles.badge} ${badgeClass(mode.badge)}`}>
                            {mode.badge}
                          </span>
                        )}
                      </div>
                      <p className={styles.cardDesc}>{mode.description}</p>
                      <ModeMeta mode={mode} />
                    </div>
                    <div
                      className={`${styles.cardArt}${cardFeatured ? ` ${styles.cardArtFeatured}` : ''}`}
                    >
                      <div className={`${styles.cardArtBg} ${art.artBgClass}`} />
                      <Icon name={art.icon} size={cardFeatured ? 96 : 72} className={styles.cardArtIcon} />
                    </div>
                  </Link>
                ) : (
                  <div className={`${styles.card} ${styles.disabled}`}>
                    <div className={styles.cardBody}>
                      <div className={styles.cardHeader}>
                        <h2>{mode.title}</h2>
                        <span className={`${styles.badge} ${styles.badgeSoon}`}>Незабаром</span>
                      </div>
                      <p className={styles.cardDesc}>{mode.description}</p>
                      <ModeMeta mode={mode} />
                    </div>
                    <div className={styles.cardArt}>
                      <div className={`${styles.cardArtBg} ${art.artBgClass}`} />
                      <Icon name={art.icon} size={72} className={styles.cardArtIcon} />
                    </div>
                  </div>
                )}
              </MotionStaggerItem>
            );
          })}
        </MotionStagger>
      )}
    </section>
  );
}
