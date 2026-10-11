import { H, W, present as presentFrame } from './fb';
import { DMG_SHADES, PALETTE } from './palette';

export { H, W };

export interface DisplayOptions {
  scanlines: boolean;
  dmg: boolean;
}

/**
 * Physical-pixel scale: the largest whole number of device pixels per game pixel at which 256x224 fits the
 * available CSS box (width first: the screen spans the phone; height so it never overflows). Never below 1.
 */
export function integerScale(availCssW: number, availCssH: number, dpr: number): number {
  return Math.max(1, Math.min(Math.floor((availCssW * dpr) / W), Math.floor((availCssH * dpr) / H)));
}

/** Backing-store size in device pixels and CSS size for a scale. */
export function canvasSize(scale: number, dpr: number): { backW: number; backH: number; cssW: number; cssH: number } {
  return { backW: W * scale, backH: H * scale, cssW: (W * scale) / dpr, cssH: (H * scale) / dpr };
}

/**
 * The game draws into a 256x224 indexed frame (render/fb); present() turns it to colour on a small canvas
 * and blits that onto the visible canvas at an integer device-pixel scale with smoothing off.
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

  /** Sizes the display canvas so each game pixel is exactly `scale` device pixels; the rest is bezel. */
  resize(availCssW: number, availCssH: number, dpr: number): void {
    const k = integerScale(availCssW, availCssH, dpr);
    this.scale = k;
    const s = canvasSize(k, dpr);
    const d = this.display;
    if (d.width !== s.backW) d.width = s.backW;
    if (d.height !== s.backH) d.height = s.backH;
    // CSS lengths are rounded (to 1/64 px), so backing / dpr (e.g. 1024 / 3) cannot be set exactly as a
    // width: the compositor would resample by a hair and blur rows. Instead the canvas is laid out at its
    // full backing size in CSS px and scaled by 1/dpr with a transform (transforms are not rounded), so each
    // backing pixel lands on exactly one device pixel. A box around it takes the space in the layout.
    const box = d.parentElement;
    if (box) {
      box.style.width = `${s.cssW}px`;
      box.style.height = `${s.cssH}px`;
    }
    d.style.width = `${s.backW}px`;
    d.style.height = `${s.backH}px`;
    // Snap onto the device-pixel grid too: measure where the scaled canvas really lands, then nudge it.
    d.style.transform = `scale(${1 / dpr})`;
    const r = d.getBoundingClientRect();
    const fx = r.left * dpr - Math.round(r.left * dpr);
    const fy = r.top * dpr - Math.round(r.top * dpr);
    if (fx || fy) d.style.transform = `translate(${-fx / dpr}px, ${-fy / dpr}px) scale(${1 / dpr})`;
    this.out = d.getContext('2d', { alpha: false })!;
  }

  /** Puts the indexed frame on screen. DMG is a shade table applied while converting, so no readback. */
  present(opts: DisplayOptions): void {
    presentFrame(this.ctx);
    const k = this.scale;
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(this.fb, 0, 0, W * k, H * k);
    if (opts.scanlines && k >= 3) {
      this.out.fillStyle = PALETTE[opts.dmg ? DMG_SHADES[0] : 0] as string;
      const t = Math.max(1, Math.floor(k / 3));
      for (let y = 0; y < H; y++) this.out.fillRect(0, y * k + k - t, W * k, t);
    }
  }
}
