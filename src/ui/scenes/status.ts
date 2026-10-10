import { clear, rect } from '../../render/draw';
import { drawText, drawTextCentered, wrap } from '../../render/font';
import { C } from '../../render/palette';
import { reserveTier } from '../../sim/body';
import { MOON_PHASES, formatDate } from '../../sim/calendar';
import { clock, type SimState } from '../../sim/sim';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { TitleScene } from './title';

const PAGES = ['BODY', 'SOUL', 'WEALTH', 'DUTIES', 'CALENDAR', 'LOG'] as const;
const r0 = (n: number) => String(Math.round(n));
const LINES = 13;

function bodyLines(s: SimState): string[] {
  return s.members.flatMap((m) => {
    const b = m.body;
    if (!m.alive) return [`${m.name} (DEAD)`, ''];
    return [
      `${m.name} ${reserveTier(b.reserve).toUpperCase()}`,
      `HUNGER ${r0(b.hunger)} TIRED ${r0(b.fatigue)}`,
      `WARM ${r0(b.warmth)} FILTH ${r0(b.filth)}`,
      `HEALTH ${r0(b.health)}${b.illness ? ` ${b.illness.kind.toUpperCase().slice(0, 7)}` : ''}${b.injuredDays ? ' HURT' : ''}`,
      '',
    ];
  });
}

function soulLines(s: SimState): string[] {
  return [
    `MORALE      ${r0(s.soul.morale)}`,
    `PRAYER      ${r0(s.soul.privatePiety)}`,
    `SEEN AT MASS${r0(s.soul.publicPiety).padStart(3)}`,
    '',
    `LORD        ${r0(s.standing.lord)}`,
    `PRIEST      ${r0(s.standing.priest)}`,
    `VILLAGE     ${r0(s.standing.village)}`,
    '',
    ...(s.tags.length ? s.tags.map((t) => `* ${t.id.toUpperCase()}`) : ['NO NAME YET']),
  ];
}

function wealthLines(s: SimState): string[] {
  const w = s.wealth;
  return [
    `PENCE ${w.pence}`, `GRAIN ${w.grain.toFixed(1)} BU`, `BREAD ${Math.floor(w.bread)}  POTTAGE ${Math.floor(w.pottage)}`,
    `MEAT ${Math.floor(w.meat)}  EGGS ${Math.floor(w.eggs)}`, `ALE ${Math.floor(w.ale)}  WOOD ${w.firewood.toFixed(1)}`,
    `HENS ${w.hens} PIG ${w.pig}`, `COW ${w.cow} OX ${w.ox}`, `TOOLS ${r0(w.tools)}%`, `ACRES ${w.acres}`,
  ];
}

function dutyLines(s: SimState): string[] {
  const o = s.obligations;
  return [
    ...s.fields.map((f) => `${f.id.toUpperCase()} ${(f.crop ?? '-').toUpperCase()} ${f.stage.toUpperCase()}`.slice(0, 20)),
    '',
    `STRIKES ${o.strikes}${o.evicted ? ' EVICTED' : ''}`,
    `DEBT ${o.debt}D`,
    o.manorCourtDay !== null ? `MANOR COURT DAY ${o.manorCourtDay}` : o.manorCourtHeld ? 'ON LAST WARNING' : '',
    `MISSED MASS ${o.missedMasses.length}`,
    o.churchCourtDay !== null ? `CHURCH COURT DAY ${o.churchCourtDay}` : '',
    o.penanceSundaysLeft ? `PENANCE ${o.penanceSundaysLeft} SUNDAYS` : '',
  ];
}

function calendarLines(s: SimState, now: number): string[] {
  const k = clock(s, now);
  const i = k.info;
  return [
    formatDate(i),
    `DAY ${i.dayIndex + 1} ${k.blockName.toUpperCase()}`,
    i.season.toUpperCase(),
    `MOON: ${MOON_PHASES[i.moon]!.toUpperCase()}`.slice(0, 20),
    `${k.weather.sky.toUpperCase()} ${k.weather.tempC}C`,
    '',
    ...(i.feasts.length ? i.feasts.map((f) => f.replace(/([A-Z])/g, ' $1').toUpperCase()) : ['NO FEAST TODAY']),
    i.isFastDay ? 'FAST DAY: NO MEAT' : '',
  ];
}

function logLines(s: SimState): string[] {
  return s.log.slice(-60).flatMap((e) => [`${e.date.slice(0, 6)} ${e.block.toUpperCase()}`, ...wrap(e.text.toUpperCase(), 20)]);
}

export class StatusScene implements Scene {
  readonly opaque = true;
  private page = 0;
  private scroll = 0;

  constructor(private game: Game) {}

  private lines(): string[] {
    const s = this.game.sim();
    switch (PAGES[this.page]) {
      case 'BODY': return bodyLines(s);
      case 'SOUL': return soulLines(s);
      case 'WEALTH': return wealthLines(s);
      case 'DUTIES': return dutyLines(s);
      case 'CALENDAR': return calendarLines(s, this.game.now());
      default: return logLines(s);
    }
  }

  onAction(e: ActionEvent): void {
    const g = this.game;
    if (e.action === 'left' || e.action === 'right') {
      this.page = (this.page + (e.action === 'left' ? -1 : 1) + PAGES.length) % PAGES.length;
      this.scroll = PAGES[this.page] === 'LOG' ? Number.MAX_SAFE_INTEGER : 0;
      g.sfx('move');
    } else if (e.action === 'up' || e.action === 'down') {
      this.scroll += e.action === 'up' ? -1 : 1;
    } else if (e.action === 'cancel' || e.action === 'start') {
      g.sfx('cancel');
      g.scenes.pop();
    } else if (e.action === 'select' && !e.repeat) {
      g.sfx('cancel');
      g.scenes.pop(false);
      g.scenes.replace(new TitleScene(g));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    clear(ctx, C.night);
    drawTextCentered(ctx, `< ${PAGES[this.page]} >`, 3, C.gold);
    rect(ctx, 4, 13, 152, 1, C.slate);
    const lines = this.lines();
    this.scroll = Math.max(0, Math.min(this.scroll, lines.length - LINES));
    lines.slice(this.scroll, this.scroll + LINES).forEach((l, i) => drawText(ctx, l.slice(0, 20), 0, 17 + i * 9, l.startsWith('*') ? C.ember : C.bone));
    rect(ctx, 4, 134, 152, 1, C.slate);
    drawText(ctx, 'B:BACK  SELECT:TITLE', 0, 136, C.slate);
  }
}
