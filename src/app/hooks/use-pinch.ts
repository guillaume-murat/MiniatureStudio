import { useEffect, useRef, type RefObject } from 'react';

export interface PinchHandlers {
  /** Zoom by `factor` (>1 = in) around the point (clientX, clientY). */
  onZoom: (factor: number, clientX: number, clientY: number) => void;
  /** Two-finger scroll (no pinch), in pixels. Return false to let the page scroll instead. */
  onPan?: (dx: number, dy: number) => boolean;
}

type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };

/**
 * Trackpad pinch on an element. Chromium and Firefox report it as wheel events
 * with ctrlKey; Safari and WKWebView (the macOS app) as non-standard gesture
 * events with a cumulative scale. Both are cancelled so the page itself never zooms.
 */
export function usePinch(ref: RefObject<HTMLElement | null>, handlers: PinchHandlers, enabled = true): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let lastScale = 1;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        latest.current.onZoom(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      } else if (latest.current.onPan?.(e.deltaX, e.deltaY)) {
        e.preventDefault();
      }
    };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      latest.current.onZoom(g.scale / lastScale, g.clientX, g.clientY);
      lastScale = g.scale;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureStart);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureStart);
    };
  }, [ref, enabled]);
}
