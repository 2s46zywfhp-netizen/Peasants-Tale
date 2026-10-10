import { ANIMALS } from './animals';
import { BODY_VARIANTS, PEASANT_ANIMS, bodyVariant, type PeasantAnim } from './peasant';
import { PEOPLE } from './people';
import { CLOUDS, FOG, GLOWS, SILHOUETTE, TREELINE, moon } from './sky';
import { TILES } from './tiles';
import { CANDLE, FLAMES } from './ui';
import { mirror, type Rows } from './lib';

/** Every sprite frame by id, as palette-indexed strings. */
export const SPRITES: Record<string, Rows> = {};
/** Animations: frame ids and frame duration (ms). */
export const ANIMS: Record<string, { frames: string[]; ms: number }> = {};

const ANIM_MS: Partial<Record<string, number>> = { idle: 700, sleep: 1200, pray: 900, work: 380, eat: 450 };

function addAnim(id: string, frames: readonly Rows[], ms: number): void {
  const ids = frames.map((rows, i) => {
    const fid = `${id}.${i}`;
    SPRITES[fid] = rows;
    return fid;
  });
  ANIMS[id] = { frames: ids, ms };
}

// Peasant: every animation in every body state.
for (const v of BODY_VARIANTS) {
  for (const [anim, frames] of Object.entries(PEASANT_ANIMS)) {
    const a = anim as PeasantAnim;
    addAnim(`peasant.${v}.${a}`, frames.map((f) => bodyVariant(f, v, a)), anim.startsWith('walk') ? 160 : (ANIM_MS[anim] ?? 400));
  }
}

// People: idle and walk, facing down; walking side-on is drawn mirrored.
for (const [who, s] of Object.entries(PEOPLE)) {
  addAnim(`${who}.idle`, s.idle, 800);
  addAnim(`${who}.walk`, s.walk, 200);
}

// Animals face right; the left-facing versions are mirrored.
for (const [what, s] of Object.entries(ANIMALS)) {
  addAnim(`${what}.idle`, s.idle, 650);
  addAnim(`${what}.walk`, s.walk, 220);
  addAnim(`${what}.idle.left`, s.idle.map(mirror), 650);
  addAnim(`${what}.walk.left`, s.walk.map(mirror), 220);
}

for (const [id, rows] of Object.entries(TILES)) SPRITES[`tile.${id}`] = rows;
addAnim('tile.water', [TILES['water.0']!, TILES['water.1']!], 600);
addAnim('tile.hearth', [TILES['hearth.0']!, TILES['hearth.1']!], 220);
addAnim('tile.candle', [TILES['candle.0']!, TILES['candle.1']!], 300);

for (let p = 0; p < 8; p++) SPRITES[`moon.${p}`] = moon(p);
SPRITES['sky.silhouette'] = SILHOUETTE;
SPRITES['sky.treeline'] = TREELINE;
SPRITES['sky.clouds.0'] = CLOUDS[0]!;
SPRITES['sky.clouds.1'] = CLOUDS[1]!;
SPRITES['sky.fog'] = FOG;
SPRITES['ui.candle'] = CANDLE;
FLAMES.forEach((f, i) => (SPRITES[`ui.flame.${i}`] = f));
for (const [k, rows] of Object.entries(GLOWS)) SPRITES[`glow.${k}`] = rows;

export { BODY_VARIANTS, type BodyVariant, type PeasantAnim } from './peasant';
export { VILLAGER_TYPES, type PersonId } from './people';
export type { AnimalId } from './animals';
