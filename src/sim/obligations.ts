import {
  BOON_MORALE, BOON_WEEKDAY, BOON_WINDOWS, COURT_DELAY_DAYS, DEED, FINE_PENCE, LORD_HIT, MANOR_COURT_FINE, MASS_MISS,
  MASS_MISSES_FOR_COURT, MASS_WINDOW_DAYS, MEAL_VALUE, PENANCE, STRIKE_FORGIVE_DAYS, TAG_DAYS, WEEK_WORK_DAYS,
  WEEK_WORK_MIN_BLOCKS,
} from './balance';
import { inWindow, type DayInfo } from './calendar';
import { log } from './log';
import { addTag, clamp, peasant, removeTag, type SimState } from './state';
import { evict, owesLabour, rentDue } from './station';
import { deed } from './village';

export function isWeekWorkDay(i: DayInfo): boolean {
  return WEEK_WORK_DAYS.includes(i.weekday) && !i.isHolyDay;
}

export function isBoonDay(i: DayInfo): boolean {
  return i.weekday === BOON_WEEKDAY && !i.isHolyDay && BOON_WINDOWS.some((w) => inWindow(i.month, i.day, w.from, w.to));
}

/** Takes pence; whatever cannot be paid becomes debt. */
export function charge(s: SimState, pence: number): number {
  const paid = Math.min(pence, s.wealth.pence);
  s.wealth.pence -= paid;
  const owed = pence - paid;
  if (owed > 0) {
    s.obligations.debt += owed;
    addTag(s, 'debtor', Math.floor(s.block / 6) + TAG_DAYS.debtor);
  }
  return owed;
}

/** A failed obligation climbs the ladder: fine -> suspicion -> manor court -> eviction. */
export function strike(s: SimState, day: number, reason: string): void {
  const o = s.obligations;
  if (o.evicted) return;
  o.strikes += 1;
  o.lastStrikeDay = day;
  s.counters.strikesSince += 1;
  if (o.manorCourtHeld) return evict(s);
  if (o.strikes === 1) {
    const owed = charge(s, FINE_PENCE);
    s.standing.lord = clamp(s.standing.lord + LORD_HIT.fine);
    log(s, 'manor', `Fined ${FINE_PENCE}d for ${reason}${owed ? ` (${owed}d owed)` : ''}.`);
  } else if (o.strikes === 2) {
    addTag(s, 'suspect', day + TAG_DAYS.suspect);
    s.standing.lord = clamp(s.standing.lord + LORD_HIT.suspect);
    log(s, 'manor', `The reeve marks you a shirker after ${reason}.`);
  } else if (o.manorCourtDay === null) {
    o.manorCourtDay = day + COURT_DELAY_DAYS;
    log(s, 'manor', `Summoned to the manor court for ${reason}. It sits in ${COURT_DELAY_DAYS} days.`);
  }
}

export function summonToManorCourt(s: SimState, day: number): void {
  s.obligations.manorCourtDay = day + COURT_DELAY_DAYS;
  log(s, 'manor', `Summoned to the manor court. It sits in ${COURT_DELAY_DAYS} days.`);
}

export function summonToChurchCourt(s: SimState, day: number): void {
  s.obligations.churchCourtDay = day + COURT_DELAY_DAYS;
  log(s, 'church', `Summoned before the church court. It sits in ${COURT_DELAY_DAYS} days.`);
}

/** Dawn: courts sit, rent falls due at Michaelmas, debts are paid down, old strikes are forgiven. */
export function dawnObligations(s: SimState, i: DayInfo): void {
  const o = s.obligations;
  const day = i.dayIndex;
  if (o.manorCourtDay !== null && day >= o.manorCourtDay) {
    o.manorCourtDay = null;
    o.manorCourtHeld = true;
    const owed = charge(s, MANOR_COURT_FINE);
    s.standing.lord = clamp(s.standing.lord + LORD_HIT.court);
    log(s, 'manor', `Manor court: amerced ${MANOR_COURT_FINE}d${owed ? ` (${owed}d owed)` : ''}. One more failing means eviction.`);
  }
  if (o.churchCourtDay !== null && day >= o.churchCourtDay) {
    o.churchCourtDay = null;
    o.missedMasses = [];
    o.penanceSundaysLeft = PENANCE.sundays;
    s.soul.morale = clamp(s.soul.morale + PENANCE.morale);
    s.standing.village = clamp(s.standing.village + PENANCE.village);
    s.standing.priest = clamp(s.standing.priest + PENANCE.priest);
    addTag(s, 'penitent', day + PENANCE.sundays * 7 + 7);
    deed(s, DEED.penance, `${peasant(s).name} ${s.familyName} stood barefoot in a sheet before the whole parish.`, s.village.map((_, k) => k));
    log(s, 'church', `Church court: public penance. Barefoot in a white sheet for ${PENANCE.sundays} Sundays.`);
  }
  const rent = rentDue(s);
  if (i.feasts.includes('michaelmas') && rent > 0) {
    const owed = charge(s, rent);
    if (owed) {
      log(s, 'manor', `Michaelmas rent of ${rent}d is due. You are ${owed}d short.`);
      strike(s, day, 'unpaid rent');
    } else {
      s.standing.lord = clamp(s.standing.lord + LORD_HIT.rentPaid);
      log(s, 'manor', `Michaelmas: rent of ${rent}d paid to the steward.`);
    }
  }
  if (o.debt > 0 && s.wealth.pence > 0) {
    const pay = Math.min(o.debt, s.wealth.pence);
    o.debt -= pay;
    s.wealth.pence -= pay;
    if (o.debt === 0) {
      removeTag(s, 'debtor');
      log(s, 'manor', 'Your debt to the manor is paid.');
    }
  }
  if (o.strikes > 0 && day - o.lastStrikeDay >= STRIKE_FORGIVE_DAYS) {
    o.strikes -= 1;
    o.lastStrikeDay = day;
    if (o.strikes === 0) o.manorCourtHeld = false;
  }
}

/** A block of labour on the demesne. */
export function creditWeekWork(s: SimState, i: DayInfo): void {
  const o = s.obligations;
  o.weekWorkToday += 1;
  if (isBoonDay(i) && o.weekWorkToday === WEEK_WORK_MIN_BLOCKS && !o.boonMealToday) {
    o.boonMealToday = true;
    const b = peasant(s).body;
    b.hunger = clamp(b.hunger - MEAL_VALUE.boon);
    s.soul.morale = clamp(s.soul.morale + BOON_MORALE);
    s.standing.lord = clamp(s.standing.lord + LORD_HIT.boon);
    log(s, 'manor', 'Boon day: the lord feeds his workers. Bread, ale and a little cheese.');
  }
}

export function recordMass(s: SimState): void {
  s.obligations.massToday = true;
}

/** End of the day (after the night block): were the lord and the Church served? */
export function endOfDayObligations(s: SimState, i: DayInfo): void {
  const o = s.obligations;
  const day = i.dayIndex;
  if (owesLabour(s) && (isWeekWorkDay(i) || isBoonDay(i)) && o.weekWorkToday < WEEK_WORK_MIN_BLOCKS) {
    strike(s, day, isBoonDay(i) ? 'missing boon work' : 'missing week-work');
  }
  if (i.isSunday && !s.station.outlaw) {
    if (o.massToday) {
      if (o.penanceSundaysLeft > 0) {
        o.penanceSundaysLeft -= 1;
        if (o.penanceSundaysLeft === 0) {
          s.standing.priest = clamp(s.standing.priest + PENANCE.restorePriest);
          s.standing.village = clamp(s.standing.village + PENANCE.restoreVillage);
          removeTag(s, 'penitent');
          log(s, 'church', 'Penance complete. The priest absolves you before the parish.');
        }
      }
    } else {
      s.standing.priest = clamp(s.standing.priest + MASS_MISS.priest);
      s.soul.publicPiety = clamp(s.soul.publicPiety + MASS_MISS.publicPiety);
      addTag(s, 'heathen', day + TAG_DAYS.heathen);
      if (s.station.residence === 'village') deed(s, DEED.missedMass, `The ${s.familyName} pew was empty again.`);
      o.missedMasses = [...o.missedMasses.filter((d) => day - d < MASS_WINDOW_DAYS), day];
      log(s, 'church', `Absent from mass. Missed ${o.missedMasses.length} in ${MASS_WINDOW_DAYS / 7} weeks.`);
      if (o.missedMasses.length >= MASS_MISSES_FOR_COURT && o.churchCourtDay === null && o.penanceSundaysLeft === 0) {
        summonToChurchCourt(s, day);
      }
    }
  }
  o.weekWorkToday = 0;
  o.boonMealToday = false;
  o.massToday = false;
}
