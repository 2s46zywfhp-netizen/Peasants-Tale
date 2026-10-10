import { DMG_SHADES, buildDmgMap, hexToRgb } from './palette';
import { C } from './palette';

export const W = 160;
export const H = 144;

export interface DisplayOptions {
  scanlines: boolean;
  dmg: boolean;
}

/** Largest integer scale (in device pixels) at which a 160x144 screen fits the given CSS box. */
export function integerScale(availCssW: number, availCssH: number, dpr: number): number {
  return Math.max(1, Math.floor(Math.min((availCssW * dpr) / W, (availCssH * dpr) / H)));
}

/**
 * The game draws into a 160x144 framebuffer; present() blits it to the visible
 * canvas at an integer device-pixel scale with smoothing off.
 */
export class Screen {
  readonly fb: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private post: HTMLCanvasElement;
  private postCtx: CanvasRenderingContext2D;
  private out: CanvasRenderingContext2D;
  private dmgMap = buildDmgMap();
  private dmgRgb = DMG_SHADES.map(hexToRgb);
  scale = 1;

  constructor(private display: HTMLCanvasElement) {
    this.fb = document.createElement('canvas');
    this.fb.width = W;
    this.fb.height = H;
    this.ctx = this.fb.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
    this.post = document.createElement('canvas');
    this.post.width = W;
    this.post.height = H;
    this.postCtx = this.post.getContext('2d')!;
    this.out = display.getContext('2d', { alpha: false })!;
  }

  /** Sizes the display canvas so each game pixel is exactly `scale` device pixels. */
  resize(availCssW: number, availCssH: number, dpr: number): void {
    const k = integerScale(availCssW, availCssH, dpr);
    this.scale = k;
    const d = this.display;
    d.width = W * k;
    d.height = H * k;
    d.style.width = `${(W * k) / dpr}px`;
    d.style.height = `${(H * k) / dpr}px`;
    // Snap the canvas onto the device-pixel grid so the compositor copies it 1:1.
    d.style.transform = '';
    const r = d.getBoundingClientRect();
    const fx = r.left * dpr - Math.round(r.left * dpr);
    const fy = r.top * dpr - Math.round(r.top * dpr);
    if (fx || fy) d.style.transform = `translate(${-fx / dpr}px, ${-fy / dpr}px)`;
  }

  present(opts: DisplayOptions): void {
    let src: HTMLCanvasElement = this.fb;
    if (opts.dmg) {
      const img = this.ctx.getImageData(0, 0, W, H);
      const p = img.data;
      for (let i = 0; i < p.length; i += 4) {
        const key = ((p[i] ?? 0) << 16) | ((p[i + 1] ?? 0) << 8) | (p[i + 2] ?? 0);
        const rgb = this.dmgRgb[this.dmgMap.get(key) ?? 0]!;
        p[i] = rgb[0];
        p[i + 1] = rgb[1];
        p[i + 2] = rgb[2];
        p[i + 3] = 255;
      }
      this.postCtx.putImageData(img, 0, 0);
      src = this.post;
    }
    const k = this.scale;
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(src, 0, 0, W * k, H * k);
    if (opts.scanlines && k >= 2) {
      this.out.fillStyle = opts.dmg ? DMG_SHADES[0] : C.black;
      const t = Math.max(1, Math.floor(k / 3));
      for (let y = 0; y < H; y++) this.out.fillRect(0, y * k + k - t, W * k, t);
    }
  }
}
