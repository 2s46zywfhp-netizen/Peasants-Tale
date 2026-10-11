// Every character frame: the peasant's animations with body-state and tool layers, and the villagers.
import { figure, pad, tool } from './figure.mjs';
import { diff, Mask, shade } from './shade.mjs';
import { T } from './palette.mjs';

export const PEASANT_LOOK = { tunic: 'r', hose: 'n', hair: 'h', head: 'hair' };

/** People of Ashby (and the town): idle and walk, facing down and to the side. */
export const PEOPLE = {
  wife: { tunic: 'u', hose: 'u', head: 'kerchief', robe: true },
  child: { tunic: 'b', hose: 'n', hair: 'y', size: 'child' },
  elder: { tunic: 'n', hose: 'b', head: 'grey', stoop: 1, prop: 'stick' },
  priest: { tunic: 'k', hose: 'k', head: 'tonsure', robe: true, belt: 'w' },
  reeve: { tunic: 'g', hose: 'b', head: 'hood', prop: 'staff' },
  steward: { tunic: 'r', hose: 'k', head: 'cap', prop: 'ledger' },
  lord: { tunic: 'u', hose: 'k', head: 'lordHat', chain: true, belt: 'y' },
  smith: { tunic: 'n', hose: 'b', head: 'bald', apron: true },
  shepherd: { tunic: 'n', hose: 'b', head: 'hood', prop: 'crook' },
  goodwife: { tunic: 'b', hose: 'b', head: 'wimple', robe: true },
  maid: { tunic: 'g', hose: 'g', head: 'kerchief', robe: true },
  beggar: { tunic: 'n', hose: 'b', hair: 'H', stoop: 1, patches: true },
};

// Pose tables. Side poses face right (the renderer flips them for left).
const WALK_SIDE = [[0, 0, 0, 0], [26, -26, -28, 28], [0, 0, 0, 0], [-26, 26, 28, -28]];
const RUN_SIDE = [[42, -30, -50, 45], [12, -8, -15, 10], [-30, 42, 45, -50], [-8, 12, 10, -15]];
const walkSide = (k, run = false) => {
  const [l0, l1, a0, a1] = (run ? RUN_SIDE : WALK_SIDE)[k];
  return { dir: 'side', legs: [l0, l1], arms: [a0, a1], bob: k % 2 ? -1 : 0, lean: run ? 1 : 0 };
};
const walkFront = (dir, k, run = false) => ({
  dir, legs: k === 1 ? [run ? 3 : 2, 0] : k === 3 ? [0, run ? 3 : 2] : [0, 0], arms: k === 1 ? [1, -1] : k === 3 ? [-1, 1] : [0, 0], bob: k % 2 ? -1 : 0,
});

/** Work: [pose, tool, toolFrame] per frame (side view, in a 32x40 frame). */
const WORK = {
  chop: [[{ arms: [200, 210] }, 'axe'], [{ arms: [150, 160] }, 'axe'], [{ arms: [60, 70], crouch: 1 }, 'axe']],
  split: [[{ arms: [195, 205] }, 'maul'], [{ arms: [150, 160] }, 'maul'], [{ arms: [70, 80], crouch: 2 }, 'maul']],
  hoe: [[{ arms: [170, 180] }, 'hoe'], [{ arms: [120, 130] }, 'hoe'], [{ arms: [80, 95], crouch: 2 }, 'hoe']],
  reap: [[{ arms: [-20, -30], crouch: 2 }, 'sickle'], [{ arms: [40, 50], crouch: 2 }, 'sickle'], [{ arms: [90, 100], crouch: 2 }, 'sickle']],
  flail: [[{ arms: [200, 210] }, 'flail', 0], [{ arms: [150, 160] }, 'flail', 1], [{ arms: [70, 80], crouch: 1 }, 'flail', 2]],
  sow: [[{ ...walkSide(0), arms: [0, 10] }, 'seedbag', 0], [{ ...walkSide(1), arms: [-28, 60] }, 'seedbag', 1], [{ ...walkSide(2), arms: [0, 100] }, 'seedbag', 2], [{ ...walkSide(3), arms: [28, 60] }, 'seedbag', 3]],
  carry: [0, 1, 2, 3].map((k) => [{ ...walkSide(k), arms: [55, 55], lean: 0 }, 'bundle', k]),
  stir: [[{ arms: [50, 55] }, 'ladle'], [{ arms: [55, 70] }, 'ladle'], [{ arms: [50, 80] }, 'ladle']],
  milk: [[{ kneel: true, arms: [40, 45] }, 'bucket'], [{ kneel: true, arms: [45, 60] }, 'bucket']],
};

/** One finished frame: indices (T = transparent). */
const frameOf = (name, w, h, px) => ({ name, w, h, px });

function shadeMask(m) {
  return shade(m.str(), m.w, m.h);
}

/** The body-state variants of a figure, as masks to diff against the thin base. */
function variants(pose, wrap, scale = 1) {
  const base = wrap(figure(PEASANT_LOOK, pose, 0, { scale }).body);
  const g1 = wrap(figure(PEASANT_LOOK, pose, 1, { scale }).body);
  const g2 = wrap(figure(PEASANT_LOOK, pose, 2, { scale }).body);
  const face = (skin, marks) => {
    const f = wrap(figure(PEASANT_LOOK, pose, 0, { skin, scale }).body);
    if (marks) marks(f, pose);
    return f;
  };
  const eyeRow = (m) => {
    // Find the eye pixels and darken around them (sunken eyes, hollow cheeks).
    const out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === 'e') out.push([x, y]);
    return out;
  };
  const gaunt = face('s', (m) => {
    for (const [x, y] of eyeRow(m)) m.set(x, y + 1, 'j');
  });
  const skeletal = face('P', (m) => {
    for (const [x, y] of eyeRow(m)) {
      m.set(x, y + 1, 'j');
      m.set(x - 1, y + 2, 'j');
      m.set(x + 1, y + 2, 'j');
    }
  });
  const sick = face('X', (m) => {
    const e = eyeRow(m)[0];
    if (e) m.set(e[0] - 1, e[1] - 2, 'q'); // a bead of sweat
  });
  const cold = face('Y', (m) => {
    // Breath on the air in front of the mouth.
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++)
        if (m.get(x, y) === 'm' && pose.dir !== 'up') {
          m.set(x + (pose.dir === 'side' ? 3 : 0), y + (pose.dir === 'side' ? 0 : 2), 'w');
          m.set(x + (pose.dir === 'side' ? 4 : 1), y + (pose.dir === 'side' ? -1 : 3), 'w');
        }
  });
  return { base, g1, g2, gaunt, skeletal, sick, cold };
}

/** All layers of one peasant frame. */
function peasantFrame(name, pose, toolName, toolFrame, work, scale = 1) {
  const wrap = work ? (m) => pad(m, 32, 40, 8, 8) : (m) => m;
  const v = variants(pose, wrap, scale);
  const S = {};
  for (const k of Object.keys(v)) S[k] = shadeMask(v[k]);
  const out = [frameOf(name, v.base.w, v.base.h, S.base)];
  out.push(frameOf(`${name}@girth1`, v.base.w, v.base.h, diff(S.base, S.g1)));
  out.push(frameOf(`${name}@girth2`, v.base.w, v.base.h, diff(S.g1, S.g2)));
  for (const k of ['gaunt', 'skeletal', 'sick', 'cold']) out.push(frameOf(`${name}@${k}`, v.base.w, v.base.h, diff(S.base, S[k])));
  if (toolName) {
    const f = figure(PEASANT_LOOK, pose, 1, { scale });
    const hand = work ? [f.hand[0] + 8, f.hand[1] + 8] : f.hand;
    const t = tool(toolName, hand, f.handAngle, v.base.w / scale, v.base.h / scale, toolFrame ?? 0, scale);
    out.push(frameOf(`${name}@tool`, v.base.w, v.base.h, shadeMask(t)));
  }
  return out;
}

/** A lying figure (sleep): the standing idle pose turned on its side into 32x16, eyes shut. */
function lying(look, breath, scale = 1) {
  const m = figure(look, { dir: 'down', eyes: 'closed', breathe: breath }, 1, { scale }).body;
  const out = new Mask(m.h, m.w);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) !== '.') out.set(y, m.w - 1 - x, m.get(x, y));
  return out;
}

/** Room scale: the cottage and the church are drawn at twice the size of the outdoors. */
const ROOM = 2;
/** Room work, side view: [pose, tool, toolFrame]. Logical 32x40 frames, padded; drawn at ROOM scale. */
const ROOM_WORK = {
  stir: WORK.stir,
  carry: WORK.carry,
  stoke: [[{ arms: [60, 70], crouch: 1 }, 'logs'], [{ arms: [85, 95], crouch: 2 }, 'logs'], [{ arms: [110, 115], crouch: 3 }, 'logs']],
  split: WORK.split,
};
/** People who are seen indoors, at room scale. */
const ROOM_PEOPLE = ['wife', 'child', 'elder', 'goodwife', 'shepherd', 'maid', 'priest', 'lord'];

function roomSets(frames, anim) {
  const add = (name, list, ms) => anim(name, list, ms);
  // The peasant: walk, run, idle (with body-state layers).
  for (const dir of ['side', 'down', 'up']) {
    const walk = [0, 1, 2, 3].map((k) => {
      const n = `peasant.room.walk.${dir}.${k}`;
      frames.push(...peasantFrame(n, dir === 'side' ? walkSide(k) : walkFront(dir, k), null, 0, false, ROOM));
      return n;
    });
    add(`peasant.room.walk.${dir}`, walk, 140);
    const idle = [0, 1].map((k) => {
      const n = `peasant.room.idle.${dir}.${k}`;
      frames.push(...peasantFrame(n, { dir, breathe: k }, null, 0, false, ROOM));
      return n;
    });
    add(`peasant.room.idle.${dir}`, idle, 700);
  }
  const run = [0, 1, 2, 3].map((k) => {
    const n = `peasant.room.run.side.${k}`;
    frames.push(...peasantFrame(n, walkSide(k, true), null, 0, false, ROOM));
    return n;
  });
  add('peasant.room.run.side', run, 90);
  for (const [name, steps] of Object.entries(ROOM_WORK)) {
    const list = steps.map(([pose, t, tf], k) => {
      const n = `peasant.room.${name}.${k}`;
      frames.push(...peasantFrame(n, { dir: 'side', ...pose }, t, tf ?? k, true, ROOM));
      return n;
    });
    add(`peasant.room.${name}`, list, name === 'carry' ? 160 : name === 'stoke' ? 320 : 260);
  }
  // Kneeling in prayer at the bedside, hands raised before the face; seated (rest); eating at the table.
  const still = (name, poses, ms, toolName) =>
    add(`peasant.room.${name}`, poses.map((pose, k) => {
      const n = `peasant.room.${name}.${k}`;
      frames.push(...peasantFrame(n, { dir: 'side', ...pose }, toolName ?? null, k, false, ROOM));
      return n;
    }), ms);
  still('pray', [{ kneel: true, arms: [118, 128] }, { kneel: true, arms: [124, 132], breathe: 1 }], 1100);
  still('sit', [{ sit: true, arms: [20, 35] }, { sit: true, arms: [20, 35], breathe: 1 }], 900);
  still('eat', [{ sit: true, arms: [40, 60] }, { sit: true, arms: [40, 150] }], 520, 'spoon');
  add('peasant.room.sleep', [0, 1].map((k) => {
    const n = `peasant.room.sleep.${k}`;
    const m = lying(PEASANT_LOOK, k, ROOM);
    frames.push(frameOf(n, m.w, m.h, shadeMask(m)));
    return n;
  }), 1400);
  // Household and churchgoers: idle (down, side), walk (side), seated.
  for (const who of ROOM_PEOPLE) {
    const look = PEOPLE[who];
    const set = (name, poses, ms) =>
      add(`${who}.room.${name}`, poses.map((pose, k) => {
        const n = `${who}.room.${name}.${k}`;
        const f = figure(look, pose, 1, { scale: ROOM, noProp: !!pose.sit }).body;
        frames.push(frameOf(n, f.w, f.h, shadeMask(f)));
        return n;
      }), ms);
    set('idle.down', [{ dir: 'down' }, { dir: 'down', breathe: 1 }], 750);
    set('idle.side', [{ dir: 'side' }, { dir: 'side', breathe: 1 }], 750);
    set('walk.side', [0, 1, 2, 3].map((k) => walkSide(k)), 150);
    set('sit', [{ dir: 'side', sit: true, arms: [30, 45] }, { dir: 'side', sit: true, arms: [35, 50], breathe: 1 }], 900);
  }
  add('wife.room.sleep', [0, 1].map((k) => {
    const n = `wife.room.sleep.${k}`;
    const m = lying(PEOPLE.wife, k, ROOM);
    frames.push(frameOf(n, m.w, m.h, shadeMask(m)));
    return n;
  }), 1500);
}

export function characters() {
  const frames = [];
  const anims = {};
  const anim = (name, list, ms) => (anims[name] = { frames: list, ms });

  // The peasant: walk, run, idle in four directions (side faces right).
  for (const dir of ['down', 'up', 'side']) {
    const walk = [], run = [], idle = [];
    for (let k = 0; k < 4; k++) {
      const pw = dir === 'side' ? walkSide(k) : walkFront(dir, k);
      frames.push(...peasantFrame(`peasant.walk.${dir}.${k}`, pw));
      walk.push(`peasant.walk.${dir}.${k}`);
      const pr = dir === 'side' ? walkSide(k, true) : walkFront(dir, k, true);
      frames.push(...peasantFrame(`peasant.run.${dir}.${k}`, pr));
      run.push(`peasant.run.${dir}.${k}`);
    }
    for (let k = 0; k < 2; k++) {
      frames.push(...peasantFrame(`peasant.idle.${dir}.${k}`, { dir, breathe: k }));
      idle.push(`peasant.idle.${dir}.${k}`);
    }
    anim(`peasant.walk.${dir}`, walk, 140);
    anim(`peasant.run.${dir}`, run, 90);
    anim(`peasant.idle.${dir}`, idle, 700);
  }
  // Work (side, 32x40).
  for (const [name, steps] of Object.entries(WORK)) {
    const list = steps.map(([pose, t, tf], k) => {
      const n = `peasant.${name}.${k}`;
      frames.push(...peasantFrame(n, { dir: 'side', ...pose }, t, tf ?? k, true));
      return n;
    });
    anim(`peasant.${name}`, list, name === 'carry' || name === 'sow' ? 160 : 260);
  }
  // Pray (kneeling, facing the altar) and eat (bowl, spoon to mouth): front view.
  const pray = [0, 1].map((k) => {
    const n = `peasant.pray.${k}`;
    frames.push(...peasantFrame(n, { dir: 'up', kneel: true, together: true, breathe: k }));
    return n;
  });
  anim('peasant.pray', pray, 900);
  const eat = [0, 1].map((k) => {
    const n = `peasant.eat.${k}`;
    frames.push(...peasantFrame(n, k === 0 ? { dir: 'down', together: true } : { dir: 'down', arms: [0, 3] }, 'bowl', k));
    return n;
  });
  anim('peasant.eat', eat, 450);
  const sleep = [0, 1].map((k) => {
    const n = `peasant.sleep.${k}`;
    frames.push(frameOf(n, 32, 16, shadeMask(lying(PEASANT_LOOK, k))));
    return n;
  });
  anim('peasant.sleep', sleep, 1400);

  // The village: idle (2) and walk (4), facing down and to the side.
  for (const [who, look] of Object.entries(PEOPLE)) {
    for (const dir of ['down', 'side']) {
      const idle = [0, 1].map((k) => {
        const n = `${who}.idle.${dir}.${k}`;
        const f = figure(look, { dir, breathe: k }, 1).body;
        frames.push(frameOf(n, f.w, f.h, shadeMask(f)));
        return n;
      });
      const walk = [0, 1, 2, 3].map((k) => {
        const n = `${who}.walk.${dir}.${k}`;
        const f = figure(look, dir === 'side' ? walkSide(k) : walkFront('down', k), 1).body;
        frames.push(frameOf(n, f.w, f.h, shadeMask(f)));
        return n;
      });
      anim(`${who}.idle.${dir}`, idle, 750);
      anim(`${who}.walk.${dir}`, walk, 150);
    }
  }
  // The spouse asleep in bed, too.
  const wifeSleep = [0, 1].map((k) => {
    const n = `wife.sleep.${k}`;
    frames.push(frameOf(n, 32, 16, shadeMask(lying(PEOPLE.wife, k))));
    return n;
  });
  anim('wife.sleep', wifeSleep, 1500);
  roomSets(frames, anim);
  return { frames, anims };
}

export const isTransparent = (v) => v === T;
