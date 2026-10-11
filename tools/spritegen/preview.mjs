// Dev aid: lay out shaded frames side by side, scaled, as a PNG to look at.
import { writeFileSync } from 'node:fs';
import { encodePng } from './png.mjs';
import { rgbOf, T } from './palette.mjs';

/** frames: [{ w, h, px: Uint8Array of palette indices }] */
export function previewPng(path, frames, scale = 6, bg = [40, 40, 48]) {
  const W = frames.reduce((n, f) => n + f.w + 2, 2);
  const H = Math.max(...frames.map((f) => f.h)) + 4;
  const rgba = new Uint8Array(W * scale * H * scale * 4);
  for (let i = 0; i < W * scale * H * scale; i++) rgba.set([...bg, 255], i * 4);
  let ox = 2;
  for (const f of frames) {
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const v = f.px[y * f.w + x];
        if (v === T) continue;
        const [r, g, b] = rgbOf(v);
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++) {
            const p = (((y + 2) * scale + sy) * W * scale + (ox + x) * scale + sx) * 4;
            rgba.set([r, g, b, 255], p);
          }
      }
    ox += f.w + 2;
  }
  writeFileSync(path, encodePng(W * scale, H * scale, rgba));
}
