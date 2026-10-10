import { describe, expect, it } from 'vitest';
import { INPUT_REPEAT_DELAY_MS, INPUT_REPEAT_INTERVAL_MS } from '../sim/balance';
import { BUTTONS, Input, type ActionEvent } from './input';

function rig() {
  const input = new Input();
  const got: ActionEvent[] = [];
  input.subscribe((e) => got.push(e));
  return { input, got };
}

describe('Input', () => {
  it('maps every button to an action', () => {
    const { input, got } = rig();
    BUTTONS.forEach((b, i) => input.press(b, `p${i}`, 0));
    expect(got.map((e) => e.action)).toEqual(['up', 'down', 'left', 'right', 'confirm', 'cancel', 'start', 'select']);
    // All eight held simultaneously (multi-touch).
    expect(BUTTONS.every((b) => input.isHeld(b))).toBe(true);
  });

  it('repeats held directions after a delay, but not A/B/START/SELECT', () => {
    const { input, got } = rig();
    input.press('left', 't1', 0);
    input.press('a', 't2', 0);
    input.update(INPUT_REPEAT_DELAY_MS - 1);
    expect(got).toHaveLength(2);
    input.update(INPUT_REPEAT_DELAY_MS + INPUT_REPEAT_INTERVAL_MS * 2);
    const repeats = got.filter((e) => e.repeat);
    expect(repeats).toHaveLength(3);
    expect(repeats.every((e) => e.action === 'left')).toBe(true);
    input.release('left', 't1');
    input.update(10_000);
    expect(got.filter((e) => e.repeat)).toHaveLength(3);
  });

  it('holds a button until every source releases it', () => {
    const { input, got } = rig();
    input.press('b', 'touch', 0);
    input.press('b', 'key', 0);
    expect(got).toHaveLength(1);
    input.release('b', 'touch');
    expect(input.isHeld('b')).toBe(true);
    input.release('b', 'key');
    expect(input.isHeld('b')).toBe(false);
  });

  it('unsubscribes', () => {
    const { input, got } = rig();
    const off = input.subscribe(() => got.push({ action: 'start', repeat: true }));
    off();
    input.press('start', 'k', 0);
    expect(got).toHaveLength(1);
  });
});
