import { blit, spriteId } from './atlas';
import { INK, parchment, rect } from './draw';
import { H, W } from './fb';
import { drawText, drawTextCentered } from './font';
import { C } from './palette';

export const PARCHMENT_LINES = 17;
export const PARCHMENT_COLS = 28;

let iconCache: Map<string, number> | null = null;
const iconId = (name: string): number => {
  iconCache ??= new Map();
  let id = iconCache.get(name);
  if (id === undefined) iconCache.set(name, (id = spriteId(`icon.${name}`)));
  return id;
};

/**
 * A parchment page filling the screen: an icon and heading, then up to PARCHMENT_LINES lines of ink from
 * `scroll`, arrows when there is more, and a footer.
 */
export function drawParchment(title: string, lines: readonly string[], scroll: number, footer: string, icon = ''): void {
  rect(0, 0, W, H, C.black);
  parchment(2, 2, W - 4, H - 4);
  if (icon) {
    blit(iconId(icon), 12, 8);
    drawText(title, 32, 12, INK.title);
  } else drawTextCentered(title, 12, INK.title);
  rect(14, 26, W - 28, 1, C.wood);
  const n = Math.min(PARCHMENT_LINES, lines.length - scroll);
  for (let i = 0; i < n; i++) drawText(lines[scroll + i]!, 14, 32 + i * 10, INK.text);
  if (scroll > 0) drawText('^', W - 22, 32, INK.title);
  if (scroll + PARCHMENT_LINES < lines.length) drawText('v', W - 22, 32 + (PARCHMENT_LINES - 1) * 10, INK.title);
  rect(14, H - 26, W - 28, 1, C.wood);
  drawTextCentered(footer, H - 19, INK.dim);
}
