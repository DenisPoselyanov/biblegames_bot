import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import styles from './InfoTooltip.module.css';

const VIEWPORT_PAD = 12;
const APP_MAX_WIDTH = 480;
const GAP = 8;

interface PopoverCoords {
  top: number;
  left: number;
  width: number;
  placement: 'above' | 'below';
  arrowLeft: number;
}

interface InfoTooltipProps {
  label: string;
  text: string;
  className?: string;
}

function getAppContentBounds(): { left: number; right: number } {
  const vw = window.innerWidth;
  const contentWidth = Math.min(APP_MAX_WIDTH, vw - VIEWPORT_PAD * 2);
  const left = Math.max(VIEWPORT_PAD, (vw - contentWidth) / 2);
  return { left, right: left + contentWidth };
}

function computePopoverCoords(
  triggerRect: DOMRect,
  tipWidth: number,
  tipHeight: number,
): PopoverCoords {
  const { left: appLeft, right: appRight } = getAppContentBounds();
  const maxWidth = appRight - appLeft;
  const width = Math.min(tipWidth, maxWidth);

  let left = triggerRect.left + triggerRect.width / 2 - width / 2;
  left = Math.max(appLeft, Math.min(left, appRight - width));

  const spaceBelow = window.innerHeight - VIEWPORT_PAD - triggerRect.bottom - GAP;
  const spaceAbove = triggerRect.top - GAP - VIEWPORT_PAD;
  const placement: 'above' | 'below' =
    spaceBelow >= tipHeight || spaceBelow >= spaceAbove ? 'below' : 'above';

  let top =
    placement === 'below'
      ? triggerRect.bottom + GAP
      : triggerRect.top - GAP - tipHeight;
  top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - VIEWPORT_PAD - tipHeight));

  const triggerCenter = triggerRect.left + triggerRect.width / 2;
  const arrowLeft = Math.max(12, Math.min(width - 12, triggerCenter - left));

  return { top, left, width, placement, arrowLeft };
}

export function InfoTooltip({ label, text, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    setCoords(computePopoverCoords(trigger.getBoundingClientRect(), tip.offsetWidth, tip.offsetHeight));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, text, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onViewportChange = () => updatePosition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const popoverStyle: CSSProperties | undefined = coords
    ? {
        top: coords.top,
        left: coords.left,
        width: coords.width,
        visibility: 'visible',
        ['--arrow-left' as string]: `${coords.arrowLeft}px`,
      }
    : { visibility: 'hidden', top: -9999, left: 0, width: 'min(18rem, calc(100vw - 1.5rem))' };

  return (
    <span className={`${styles.wrap} ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerActive : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="info" size={15} />
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              className={styles.backdrop}
              aria-label="Закрити підказку"
              onClick={close}
            />
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className={`${styles.popover} ${coords?.placement === 'above' ? styles.popoverAbove : styles.popoverBelow}`}
              style={popoverStyle}
            >
              <p className={styles.popoverText}>{text}</p>
              <button type="button" className={styles.popoverClose} onClick={close}>
                Зрозуміло
              </button>
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
