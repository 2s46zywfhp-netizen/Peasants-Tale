import { BUTTONS, type Button, type Input } from '../input/input';
import { HAPTIC_TICK_MS } from '../sim/balance';
import { activationEvent } from './gesture';

const KEYS: Readonly<Record<string, Button>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyX: 'a',
  KeyZ: 'b',
  Enter: 'start',
  ShiftRight: 'select',
  Backspace: 'select',
};

const DPAD_DEADZONE = 0.18; // fraction of the pad's half-width

export function vibrateTick(): void {
  try {
    navigator.vibrate?.(HAPTIC_TICK_MS);
  } catch {
    // iOS and some browsers: no haptics, fail silently.
  }
}

/** Stops the browser treating the page as a document: no zoom, scroll, selection, callout or pull-to-refresh. */
export function lockDownGestures(): void {
  const stop = (e: Event) => e.preventDefault();
  const opts = { passive: false } as const;
  document.addEventListener('touchmove', stop, opts);
  document.addEventListener('gesturestart', stop, opts);
  document.addEventListener('gesturechange', stop, opts);
  document.addEventListener('gestureend', stop, opts);
  document.addEventListener('dblclick', stop, opts);
  document.addEventListener('contextmenu', stop, opts);
  document.addEventListener('selectstart', stop, opts);
  document.addEventListener('dragstart', stop, opts);
  // Multi-finger touches and touches on the controls never become scroll/zoom/callout.
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1 || (e.target as Element | null)?.closest?.('#gb')) e.preventDefault();
    },
    opts,
  );
  document.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), opts);
  document.addEventListener('touchend', () => activationEvent(), opts);
}

function setDown(el: Element | null, down: boolean): void {
  el?.classList.toggle('down', down);
}

/** Wires the on-screen buttons and keyboard to the input layer. Each pointer is tracked independently (multi-touch). */
export function bindControls(root: HTMLElement, input: Input, now: () => number): void {
  // Plain buttons: A, B, START, SELECT.
  for (const el of root.querySelectorAll<HTMLElement>('[data-btn]')) {
    const btn = el.dataset.btn as Button;
    if (!BUTTONS.includes(btn)) continue;
    const pointers = new Set<number>();
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      input.release(btn, `p${e.pointerId}`);
      if (pointers.size === 0) setDown(el, false);
      if (e.pointerType !== 'touch') activationEvent();
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      pointers.add(e.pointerId);
      setDown(el, true);
      input.press(btn, `p${e.pointerId}`, now());
    });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  // D-pad: one surface; a finger can slide between directions.
  const pad = root.querySelector<HTMLElement>('#dpad');
  if (pad) {
    const current = new Map<number, Button | null>();
    const dirAt = (e: PointerEvent): Button | null => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      if (Math.hypot(dx, dy) < DPAD_DEADZONE) return null;
      return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    };
    const set = (id: number, dir: Button | null) => {
      const prev = current.get(id) ?? null;
      if (prev === dir) return;
      if (prev) {
        input.release(prev, `p${id}`);
        if (![...current.entries()].some(([k, d]) => k !== id && d === prev)) setDown(pad.querySelector(`[data-dir=${prev}]`), false);
      }
      current.set(id, dir);
      if (dir) {
        setDown(pad.querySelector(`[data-dir=${dir}]`), true);
        input.press(dir, `p${id}`, now());
      }
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture?.(e.pointerId);
      set(e.pointerId, dirAt(e));
    });
    pad.addEventListener('pointermove', (e) => {
      if (current.has(e.pointerId)) set(e.pointerId, dirAt(e));
    });
    const end = (e: PointerEvent) => {
      if (!current.has(e.pointerId)) return;
      set(e.pointerId, null);
      current.delete(e.pointerId);
      if (e.pointerType !== 'touch') activationEvent();
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  }

  const visual = (b: Button) =>
    ['up', 'down', 'left', 'right'].includes(b) ? root.querySelector(`[data-dir=${b}]`) : root.querySelector(`[data-btn=${b}]`);
  window.addEventListener('keydown', (e) => {
    const b = KEYS[e.code];
    if (!b) return;
    e.preventDefault();
    if (e.repeat) return;
    activationEvent(() => {
      setDown(visual(b), true);
      input.press(b, `k${e.code}`, now());
    });
  });
  window.addEventListener('keyup', (e) => {
    const b = KEYS[e.code];
    if (!b) return;
    input.release(b, `k${e.code}`);
    if (!input.isHeld(b)) setDown(visual(b), false);
  });
  window.addEventListener('blur', () => {
    input.releaseAll();
    root.querySelectorAll('.down').forEach((el) => el.classList.remove('down'));
  });
}
