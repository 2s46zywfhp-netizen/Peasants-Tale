import { describe, expect, it } from 'vitest';
import { Input } from '../input/input';
import { FADE_MS } from '../sim/balance';
import { SceneManager, type Scene } from './scene';

function scene(name: string, log: string[], opaque = true): Scene {
  return {
    opaque,
    enter: () => log.push(`enter ${name}`),
    exit: () => log.push(`exit ${name}`),
    onAction: (e) => log.push(`${name}:${e.action}`),
    draw: () => log.push(`draw ${name}`),
  };
}

describe('SceneManager', () => {
  it('push / pop / replace with fades, swapping at the midpoint', () => {
    const input = new Input();
    const sm = new SceneManager(input);
    const log: string[] = [];
    sm.push(scene('a', log)); // first scene: immediate
    expect(log).toEqual(['enter a']);
    sm.push(scene('b', log));
    sm.update(FADE_MS / 2 - 1, 0);
    expect(sm.top).not.toBeUndefined();
    expect(log).toEqual(['enter a']);
    input.press('a', 'k', 0); // swallowed mid-fade
    input.release('a', 'k');
    sm.update(1, 0);
    expect(log).toEqual(['enter a', 'enter b']);
    expect(sm.fadeAmount()).toBeCloseTo(1, 1);
    sm.update(FADE_MS, 0);
    expect(sm.transitioning).toBe(false);
    input.press('a', 'k', 0);
    expect(log.at(-1)).toBe('b:confirm');
    sm.replace(scene('c', log), false);
    expect(sm.depth).toBe(2);
    sm.pop(false);
    expect(log.slice(-3)).toEqual(['exit b', 'enter c', 'exit c']);
    expect(sm.depth).toBe(1);
  });

  it('draws overlays on top of the scene below', () => {
    const sm = new SceneManager(new Input());
    const log: string[] = [];
    sm.push(scene('base', log), false);
    sm.push(scene('dialog', log, false), false);
    log.length = 0;
    const ctx = { fillRect() {}, fillStyle: '' } as unknown as CanvasRenderingContext2D;
    sm.draw(ctx, 0);
    expect(log).toEqual(['draw base', 'draw dialog']);
  });
});
