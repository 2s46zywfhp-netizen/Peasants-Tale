/**
 * Clipboard and audio need "user activation". Touch pointerdown does not grant
 * it, but touchend / mouse pointerup / keydown do. Actions fire on press for
 * responsiveness, so privileged work is queued until the next activating event.
 */
let active = false;
const queue: Array<() => void> = [];
const hooks: Array<() => void> = [];

/** Runs on every activating event, before anything else (e.g. unlocking audio). */
export function onActivation(fn: () => void): void {
  hooks.push(fn);
}

export function withActivation(fn: () => void): void {
  if (active) fn();
  else queue.push(fn);
}

/** Called by the shell from inside activating event handlers. */
export function activationEvent(during?: () => void): void {
  active = true;
  try {
    for (const h of hooks) h();
    during?.();
    while (queue.length) queue.shift()!();
  } finally {
    active = false;
  }
}
