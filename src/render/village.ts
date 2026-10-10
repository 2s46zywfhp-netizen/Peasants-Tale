import { reserveTier } from '../sim/body';
import { clock, type SimState } from '../sim/sim';
import { ACTIONS } from '../sim/balance';
import { formatDate } from '../sim/calendar';
import { PLACES, placeOf } from './places';
import { clear, ditherFill, frame, rect, sprite } from './draw';
import { drawText } from './font';
import { C, type Colour } from './palette';

const PEASANT = ['..hhhh..', '.hhhhhh.', '.hssssh.', '..s..s..', '..ssss..', '.tttttt.', '.tttttt.', '..l..l..'];
const PEASANT_KEYS = { h: C.wood, s: C.parchment, t: C.mud, l: C.slate } as const;
const GHOST_KEYS = { h: C.slate, s: C.slate, t: C.slate, l: C.slate } as const;

const SKY_TEXT = { fair: 'FAIR', cloud: 'CLOUD', fog: 'FOG', rain: 'RAIN', storm: 'STORM', snow: 'SNOW' } as const;
const BLOCK_SHORT = { dawn: 'DAWN', morning: 'MORN', midday: 'NOON', afternoon: 'AFTN', dusk: 'DUSK', night: 'NGHT' } as const;
const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

function drawPlace(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, night: boolean): void {
  switch (id) {
    case 'home':
      rect(ctx, x, y + 6, w, h - 6, C.wood);
      rect(ctx, x - 2, y, w + 4, 7, C.mud);
      rect(ctx, x + 11, y + 12, 6, 8, C.black);
      rect(ctx, x + 4, y + 10, 4, 4, night ? C.gold : C.black);
      return;
    case 'church':
      rect(ctx, x, y + 8, w, h - 8, C.slate);
      rect(ctx, x + 10, y, 10, 10, C.slate);
      rect(ctx, x + 14, y - 4, 2, 6, C.gold);
      rect(ctx, x + 12, y - 2, 6, 2, C.gold);
      rect(ctx, x + 12, y + 16, 6, 10, C.black);
      return;
    case 'tavern':
      rect(ctx, x, y + 5, w, h - 5, C.mud);
      rect(ctx, x - 1, y, w + 2, 6, C.wood);
      rect(ctx, x + 4, y + 9, 5, 5, night ? C.ember : C.black);
      rect(ctx, x + w - 2, y + 7, 4, 4, C.gold);
      return;
    case 'strips':
    case 'demesne':
      for (let i = 0; i < h; i += 4) rect(ctx, x, y + i, w, 2, id === 'strips' ? C.wood : C.mud);
      return;
    case 'green':
      ditherFill(ctx, 0.5, C.moss, x, y, w, h);
      return;
    case 'stream':
      rect(ctx, x, y, w, h, C.teal);
      for (let i = 0; i < w; i += 7) rect(ctx, x + i, y + 3 + (i % 3), 3, 1, C.sea);
      return;
    case 'woods':
      for (let i = 0; i < w; i += 8) {
        rect(ctx, x + i + 3, y + 10, 2, 6, C.mud);
        rect(ctx, x + i, y + 2 + (i % 5), 8, 8, C.night);
      }
      return;
  }
}

export interface VillageView {
  px: number;
  py: number;
  here: string | null;
  message: string;
}

/** Placeholder village: reads sim state only. */
export function drawVillage(ctx: CanvasRenderingContext2D, s: SimState, nowMs: number, view: VillageView): void {
  const k = clock(s, nowMs);
  const night = k.bod >= 4 || k.bod === 0;
  clear(ctx, C.night);
  // Ground
  rect(ctx, 0, 18, 160, 100, night ? C.navy : C.moss);
  if (night) ditherFill(ctx, k.bod === 5 ? 0.5 : 0.25, C.night, 0, 18, 160, 100);
  for (const p of PLACES) drawPlace(ctx, p.id, p.x, p.y, p.w, p.h, night);
  // Where the sim says the peasant is (faint), and the walking player.
  const loc = placeOf(s.location);
  sprite(ctx, PEASANT, GHOST_KEYS, loc.x + Math.floor(loc.w / 2) - 4, loc.y + Math.floor(loc.h / 2) - 4);
  sprite(ctx, PEASANT, s.dead ? GHOST_KEYS : PEASANT_KEYS, view.px - 4, view.py - 4);

  // HUD
  rect(ctx, 0, 0, 160, 18, C.black);
  drawText(ctx, formatDate(k.info), 0, 1, C.parchment);
  const mins = k.msToNext / 60_000;
  drawText(ctx, `${BLOCK_SHORT[k.blockName]} ${pad(mins)}:${pad((mins % 1) * 60)}`, 0, 10, C.gold);
  const wx = `${SKY_TEXT[k.weather.sky]} ${Math.round(k.weather.tempC)}C`;
  drawText(ctx, wx, 160 - wx.length * 8, 10, C.mist);

  rect(ctx, 0, 118, 160, 26, C.black);
  const p = s.members[0]!;
  if (s.dead) {
    drawText(ctx, `${p.name} IS DEAD.`, 0, 120, C.blood);
    drawText(ctx, 'START: MENU', 0, 130, C.slate);
    return;
  }
  const plan = s.plan && s.block >= s.plan.from && s.block < s.plan.until ? s.plan : null;
  const top = view.message || (view.here ? `A: ${view.here}` : plan ? `${plan.byPlayer ? '' : '~'}${ACTIONS[plan.action].label}` : 'IDLE');
  drawText(ctx, top.slice(0, 20), 0, 120, view.message ? C.sea : view.here ? C.bone : C.mist);
  bar(ctx, 0, 131, 'H', p.body.hunger, C.ember);
  bar(ctx, 40, 131, 'F', p.body.fatigue, C.mist);
  bar(ctx, 80, 131, 'W', p.body.warmth, C.gold);
  const tier = reserveTier(p.body.reserve).slice(0, 4).toUpperCase();
  drawText(ctx, tier, 124, 131, p.body.reserve < 35 ? C.blood : C.parchment);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, v: number, c: Colour): void {
  drawText(ctx, label, x, y, C.slate);
  frame(ctx, x + 9, y + 1, 28, 6, C.slate, C.black);
  rect(ctx, x + 10, y + 2, Math.round((Math.max(0, Math.min(100, v)) / 100) * 26), 4, c);
}
