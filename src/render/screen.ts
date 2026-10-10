import { DMG_SHADES, PALETTE } from './palette';

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
  private out: CanvasRenderingContext2D;
  scale = 1;

  constructor(private display: HTMLCanvasElement) {
    this.fb = document.createElement('canvas');
    this.fb.width = W;
    this.fb.height = H;
    this.ctx = this.fb.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
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

  /** Blits the framebuffer at integer scale. DMG mode is a palette remap applied while drawing, so no readback. */
  present(opts: DisplayOptions): void {
    const k = this.scale;
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(this.fb, 0, 0, W * k, H * k);
    if (opts.scanlines && k >= 2) {
      this.out.fillStyle = PALETTE[opts.dmg ? DMG_SHADES[0] : 0];
      const t = Math.max(1, Math.floor(k / 3));
      for (let y = 0; y < H; y++) this.out.fillRect(0, y * k + k - t, W * k, t);
    }
  }
}
