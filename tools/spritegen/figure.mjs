// Humanoid figures from poses: one painter makes every character and every frame.
import { Mask, sleeveOf } from './shade.mjs';

const rad = (d) => (d * Math.PI) / 180;

/** Body proportions: adult 16x32, child 16x24. */
const SIZES = {
  adult: { h: 32, head: 2, shoulder: 12, hip: 22, leg: 8 },
  child: { h: 24, head: 2, shoulder: 10, hip: 17, leg: 5 },
};

/**
 * look: { tunic, hose, hair, head, robe, skirt, prop, stoop, apron, patches, size, belt }
 * pose: { dir: 'down'|'up'|'side', bob, legs:[a,b], arms:[a,b], crouch, kneel, lean, breathe, eyes }
 * girth: 0 (thin), 1 (healthy), 2 (stout). Returns { body: Mask, hand: [x, y], handAngle }.
 */
export function figure(look, pose, girth = 1, extra = {}) {
  const S = SIZES[look.size ?? 'adult'];
  const m = new Mask(16, S.h);
  const tunic = look.tunic ?? 'b';
  const hose = look.hose ?? 'n';
  const skin = extra.skin ?? 's';
  const crouch = pose.crouch ?? 0;
  const bob = pose.bob ?? 0;
  const breathe = pose.breathe ?? 0;
  const stoop = look.stoop ?? 0;
  const hipY = S.hip + crouch + (pose.kneel ? 3 : 0);
  const shY = S.shoulder + bob + crouch + (pose.kneel ? 3 : 0) - breathe + stoop;
  const headTop = S.head + bob + crouch + (pose.kneel ? 3 : 0) - breathe + stoop * 2;
  const lean = (pose.lean ?? 0) + stoop;
  const side = pose.dir === 'side';
  let hand = [8, hipY];
  let handAngle = 0;

  const legs = () => {
    if (side) {
      const hipX = 7.5;
      for (const [k, a] of (pose.legs ?? [0, 0]).entries()) {
        if (pose.kneel) {
          if (k === 0) {
            m.line(hipX, hipY, hipX - 4, hipY + 3, hose, 2);
            m.line(hipX - 4, hipY + 4, hipX - 7, hipY + 4, hose, 2);
          } else {
            m.line(hipX + 1, hipY, hipX + 3, hipY + 3, hose, 2);
            m.line(hipX + 3, hipY + 3, hipX + 3, hipY + 6, hose, 2);
            m.rect(hipX + 3, S.h - 2, 3, 2, 'l');
          }
          continue;
        }
        const len = S.leg - (crouch > 0 ? 1 : 0);
        const fx = hipX + Math.sin(rad(a)) * len;
        const fy = Math.min(S.h - 2, hipY + Math.cos(rad(a)) * len);
        m.line(hipX, hipY, fx, fy, hose, 2);
        m.rect(Math.round(fx) - 1, Math.round(fy) + (S.h - 2 - Math.round(fy) > 0 ? 0 : 0), 4, 2, 'l');
      }
    } else {
      const lift = pose.legs ?? [0, 0];
      if (pose.kneel) {
        m.rect(4, hipY + 1, 8, 3, hose);
        m.rect(3, S.h - 2, 4, 2, 'l');
        m.rect(9, S.h - 2, 4, 2, 'l');
        return;
      }
      for (const [k, x] of [5, 9].entries()) {
        const up = lift[k] ?? 0;
        m.rect(x, hipY + 1, 2, S.h - 2 - (hipY + 1) - up, hose);
        m.rect(x - (k === 0 ? 1 : 0), S.h - 2 - up, 3, 2, 'l');
      }
    }
  };

  const torso = () => {
    const x0 = side ? 6 - Math.floor(girth / 2) + lean : 5 - girth;
    const w = side ? 5 + girth : 6 + girth * 2;
    m.rect(x0, shY, w, hipY - shY, tunic);
    if (girth === 2) m.rect(side ? x0 + w : x0 + 1, hipY - 6, side ? 1 : w - 2, 4, tunic); // belly
    // Tunic skirt, or a robe to the feet.
    const hem = look.robe ? S.h - 2 : hipY + (look.size === 'child' ? 2 : 3);
    for (let y = hipY - 1; y < hem; y++) {
      const flare = Math.min(1, Math.floor((y - hipY + 2) / 3));
      m.rect(x0 - flare + (side ? 0 : 0), y, w + flare * 2 - (side ? 1 : 0), 1, look.skirt ?? tunic);
    }
    m.rect(x0, hipY - 2, w, 1, look.belt ?? 'l');
    if (look.apron) m.rect(side ? x0 + w - 2 : x0 + 1, shY + 2, side ? 2 : w - 2, hipY - shY + 2, 'l');
    if (look.chain) {
      m.set(x0 + 1, shY + 1, 'y');
      m.set(x0 + 2, shY + 2, 'y');
      m.set(x0 + w - 2, shY + 1, 'y');
      m.set(x0 + w - 3, shY + 2, 'y');
    }
    if (look.patches) {
      m.set(x0 + 1, shY + 3, 'b');
      m.set(x0 + w - 2, hipY - 4, 'b');
      m.set(x0 + 2, hipY, 'w');
    }
    if (!side) m.rect(7, shY - 1, 2, 1, skin); // neck
  };

  const arm = (k) => {
    const a = (pose.arms ?? [0, 0])[k] ?? 0;
    if (side) {
      const sx = 8 + lean, sy = shY + 1;
      const len = look.size === 'child' ? 5 : 7;
      const hx = sx + Math.sin(rad(a)) * len, hy = sy + Math.cos(rad(a)) * len;
      m.line(sx, sy, hx, hy, sleeveOf(tunic), 2);
      m.rect(Math.round(hx) - 1 + (Math.sin(rad(a)) > 0.3 ? 1 : 0), Math.round(hy) - (Math.cos(rad(a)) < 0 ? 1 : 0), 2, 2, skin);
      if (k === 1) {
        hand = [hx, hy];
        handAngle = a;
      }
    } else {
      const swing = a; // px forward (shorter) or back
      const x = k === 0 ? 3 - girth : 11 + girth;
      const len = (look.size === 'child' ? 5 : 6) - Math.abs(swing);
      if (pose.together) {
        // Hands meeting before the chest (prayer, holding a bowl).
        m.rect(k === 0 ? 4 - girth : 10 + girth, shY, 2, 4, sleeveOf(tunic));
        m.rect(k === 0 ? 6 : 8, shY + 3, 2, 3, sleeveOf(tunic));
        m.rect(7, shY + 2, 2, 2, skin);
        hand = [7.5, shY + 3];
        return;
      }
      m.rect(x, shY, 2, len, sleeveOf(tunic));
      m.rect(x, shY + len, 2, 2, skin);
      if (k === 1) hand = [x + 1, shY + len + 1];
    }
  };

  const head = () => {
    const cx = side ? 9 + lean : 7.5, cy = headTop + 4;
    m.ellipse(cx, cy, side ? 3 : 3.5, 4, skin);
    const H = look.hair ?? 'h';
    const t = look.head ?? 'hair';
    const top = headTop;
    const back = side ? -1 : 0;
    if (pose.dir === 'up') {
      m.ellipse(cx, cy, 3.5, 4, t === 'hood' ? tunic : t === 'kerchief' || t === 'wimple' ? 'w' : t === 'bald' ? skin : H);
    } else {
      if (t === 'hair' || t === 'tonsure') {
        m.rect(cx - 3.5, top, 8, 3, H);
        if (side) m.rect(cx - 3.5, top, 3, 6, H);
        else {
          m.set(cx - 3.5, top + 3, H);
          m.set(cx + 3.5, top + 3, H);
        }
        if (t === 'tonsure') m.rect(cx - 1.5, top, 4, 1, skin);
      } else if (t === 'hood') {
        m.rect(cx - 4, top - 1, 9, 3, tunic);
        m.rect(cx - 4 + (side ? 0 : 0), top + 2, 2, 6, tunic);
        if (!side) m.rect(cx + 3, top + 2, 2, 6, tunic);
      } else if (t === 'kerchief') {
        m.rect(cx - 4, top - 1, 9, 3, 'w');
        m.rect(cx - 4, top + 2, 2, side ? 5 : 3, 'w');
        if (!side) m.rect(cx + 3, top + 2, 2, 3, 'w');
      } else if (t === 'wimple') {
        m.rect(cx - 4, top - 1, 9, 2, 'w');
        m.rect(cx - 4.5, top, 2, 9, 'w');
        if (!side) m.rect(cx + 3.5, top, 2, 9, 'w');
        m.rect(cx - 3, top + 7, 7, 2, 'w');
      } else if (t === 'cap') {
        m.rect(cx - 4, top - 1, 9, 3, 'r');
        m.set(side ? cx - 4 : cx + 4, top - 2, 'r');
      } else if (t === 'lordHat') {
        m.rect(cx - 5, top + 1, 11, 1, 'k');
        m.rect(cx - 3.5, top - 2, 8, 3, 'k');
        m.rect(cx - 3.5, top, 8, 1, 'y');
      } else if (t === 'grey') {
        m.rect(cx - 3.5, top, 8, 2, 'H');
        if (side) m.rect(cx - 3.5, top, 3, 6, 'H');
        m.rect(cx - 2, top + 7 + back, side ? 3 : 5, 2, 'H'); // beard
      }
      // Face.
      const closed = pose.eyes === 'closed';
      if (side) {
        if (!closed) m.set(cx + 1.5, cy, 'e');
        m.set(cx + 3, cy + 1, skin); // nose
        m.set(cx + 1.5, cy + 2.5, 'm');
      } else {
        if (closed) {
          m.set(cx - 1.5, cy + 0.5, 'h');
          m.set(cx + 1.5, cy + 0.5, 'h');
        } else {
          m.set(cx - 1.5, cy, 'e');
          m.set(cx + 1.5, cy, 'e');
        }
        m.set(cx, cy + 2.5, 'm');
      }
    }
  };

  // Painter's order: back arm, legs, torso, head, front arm.
  if (side) arm(0);
  legs();
  torso();
  if (!side) {
    arm(0);
    arm(1);
  }
  head();
  if (side) arm(1);
  if (look.prop && !extra.noProp) prop(m, look.prop, side, shY, S);
  return { body: m, hand, handAngle };
}

/** NPC hand props, drawn with the body. */
function prop(m, p, side, shY, S) {
  const x = side ? 13 : 13;
  if (p === 'stick') m.line(x, shY + 6, x, S.h - 1, 'o', 1);
  if (p === 'staff') m.line(x, shY - 4, x, S.h - 1, 'o', 1);
  if (p === 'crook') {
    m.line(x, shY - 2, x, S.h - 1, 'o', 1);
    m.stamp(x - 2, shY - 5, ['.oo', 'o..', '...'].map((r) => r));
    m.set(x, shY - 4, 'o');
  }
  if (p === 'ledger') m.rect(x - 1, shY + 4, 3, 4, 'r');
}

/* ── tools held by the peasant: their own layer ── */

/** Draw `tool` into a fresh mask of the frame's size, held at `hand` pointing `angle` (degrees, 0 = down). */
export function tool(name, hand, angle, w = 16, h = 32, frame = 0) {
  const m = new Mask(w, h);
  if (!name) return m;
  const [hx, hy] = hand;
  const d = [Math.sin(rad(angle)), Math.cos(rad(angle))];
  const along = (k) => [hx + d[0] * k, hy + d[1] * k];
  const perp = [d[1], -d[0]]; // to the front of the blade
  const shaft = (a, b) => {
    const [x0, y0] = along(a), [x1, y1] = along(b);
    m.line(x0, y0, x1, y1, 'o', 1);
  };
  switch (name) {
    case 'axe': {
      shaft(-2, 8);
      const [ex, ey] = along(8);
      for (let i = 0; i < 3; i++) for (let j = -1; j < 2; j++) m.set(ex + perp[0] * i + d[0] * j, ey + perp[1] * i + d[1] * j, 'i');
      break;
    }
    case 'maul': {
      shaft(-2, 7);
      const [ex, ey] = along(7);
      for (let i = -2; i < 3; i++) for (let j = -1; j < 2; j++) m.set(ex + perp[0] * i + d[0] * j, ey + perp[1] * i + d[1] * j, 'i');
      m.rect(11, h - 5, 5, 5, 'o'); // the chopping block
      m.rect(12, h - 8, 3, 3, 't'); // a log on it
      break;
    }
    case 'hoe': {
      shaft(-3, 9);
      const [ex, ey] = along(9);
      for (let i = 0; i < 4; i++) m.set(ex + perp[0] * i, ey + perp[1] * i, 'i');
      break;
    }
    case 'sickle': {
      shaft(-1, 2);
      const [ex, ey] = along(2);
      for (let t = 0; t <= 6; t++) {
        const a = rad(angle) - Math.PI / 2 + (t / 6) * Math.PI * 0.9;
        m.set(ex + Math.sin(a) * 3.5 + d[0] * 2, ey + Math.cos(a) * 3.5 + d[1] * 2, 'i');
      }
      break;
    }
    case 'flail': {
      shaft(-2, 7);
      const [ex, ey] = along(7);
      const a2 = rad(angle + 50 + frame * 20);
      m.line(ex, ey, ex + Math.sin(a2) * 5, ey + Math.cos(a2) * 5, 'o', 1);
      break;
    }
    case 'ladle':
      m.line(hx, hy, hx + 1, hy + 6, 'o', 1);
      m.rect(10, h - 7, 6, 5, 'k'); // the pot
      m.rect(9, h - 8, 8, 1, 'i');
      m.rect(11, h - 2, 1, 2, 'i');
      m.rect(14, h - 2, 1, 2, 'i');
      break;
    case 'bucket':
      m.rect(10, h - 6, 5, 5, 'o');
      m.rect(10, h - 5, 5, 1, 'i');
      m.rect(10, h - 3, 5, 1, 'i');
      m.rect(11, h - 6, 3, 1, 'w'); // milk
      break;
    case 'seedbag':
      m.rect(4, 19, 4, 5, 'b');
      m.line(5, 12, 8, 19, 'l', 1);
      if (frame === 2) for (const [x, y] of [[hx + 2, hy + 1], [hx + 3, hy + 3], [hx + 1, hy + 4]]) m.set(x, y, 'y');
      break;
    case 'bundle':
      for (let r = 0; r < 3; r++) m.rect(8, 14 + r * 2 + (frame % 2), 7, 2, r % 2 ? 'o' : 't');
      break;
    case 'bowl':
      m.rect(6, hy - 1, 4, 2, 'o');
      m.rect(6, hy - 2, 4, 1, 'w');
      break;
    default:
      throw new Error(`unknown tool ${name}`);
  }
  return m;
}

/** Paste a mask into a larger frame at (ox, oy). */
export function pad(src, w, h, ox, oy) {
  const m = new Mask(w, h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.d[y * src.w + x] !== '.') m.set(x + ox, y + oy, src.d[y * src.w + x]);
  return m;
}
