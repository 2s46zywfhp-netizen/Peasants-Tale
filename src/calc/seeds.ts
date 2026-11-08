import { mmDdToDoy, zoneValue, type Climate } from './climate';
import * as R from './ref';

export type SeedStatus = 'good' | 'marginal' | 'skip';

export interface AnnualResult {
  seed: R.AnnualSeed;
  status: SeedStatus;
  reason: string;
  needsCover: boolean;
  sowing: 'direct' | 'indoors' | 'tuber' | 'set' | 'fall';
  indoorStart?: string; // MM-DD
  plantOut: string; // MM-DD: direct-sow or transplant date
  harvest: string; // MM-DD
  marginDays: number;
  kcalPer10m2: number;
}

export interface PerennialResult {
  plant: R.PerennialPlant;
  status: SeedStatus;
  reason: string;
}

function doyToMmDd(doy: number): string {
  const d = new Date(Date.UTC(2023, 0, 1) + (Math.round(doy) - 1) * 86400000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function evaluateAnnual(seed: R.AnnualSeed, c: Climate, a: R.Assumptions = R.assumptions): AnnualResult {
  const last = mmDdToDoy(c.lastFrost);
  const first = mmDdToDoy(c.firstFrost);
  const lead = seed.frostTolerance === 'hardy' ? -a.hardyLeadDays : seed.frostTolerance === 'half-hardy' ? -a.halfHardyLeadDays : a.tenderLagDays;
  const end = first + (seed.frostTolerance === 'hardy' ? a.hardyFallDays : seed.frostTolerance === 'half-hardy' ? a.halfHardyFallDays : 0);
  const kcal = Math.round(seed.yieldKgPer10m2 * 10 * seed.kcalPer100g);

  if (seed.method === 'fall') {
    const plant = first + 14;
    return {
      seed, status: 'good', reason: 'Planted in fall, overwinters under snow, harvested mid-summer.', needsCover: false, sowing: 'fall',
      plantOut: doyToMmDd(plant), harvest: doyToMmDd(Math.min(last + 60, 213)), marginDays: 99, kcalPer10m2: kcal,
    };
  }

  // Transplant if the crop must be, or if direct sowing would not fit but starting indoors would.
  const plantOut = last + lead;
  const directFits = end - (plantOut + seed.daysToMaturity) >= a.seedSafetyBufferDays;
  const indoors = seed.method === 'transplant' || (seed.method === 'either' && !directFits);
  // Packet days for 'either' crops count from direct sowing; an indoor start gets roughly half its indoor time back.
  const dtm = seed.method === 'either' && indoors ? seed.daysToMaturity - Math.round(seed.weeksIndoors * 7 * 0.5) : seed.daysToMaturity;
  const harvest = plantOut + dtm;
  const margin = end - harvest;
  const sowing: AnnualResult['sowing'] = seed.method === 'tuber' ? 'tuber' : seed.method === 'set' ? 'set' : indoors ? 'indoors' : 'direct';

  let status: SeedStatus;
  let reason: string;
  let needsCover = false;
  if (seed.needsHeat && c.frostFreeDays < a.needsHeatMinFrostFree) {
    status = 'skip';
    reason = `Needs a long hot season; you have ${c.frostFreeDays} frost-free days (needs ${a.needsHeatMinFrostFree}+).`;
    if (c.frostFreeDays >= a.needsHeatMinFrostFree - 25 && margin + a.rowCoverBonusDays >= 0) {
      status = 'marginal';
      reason = 'Only with black plastic mulch, row cover or a greenhouse.';
      needsCover = true;
    }
  } else if (margin >= a.seedSafetyBufferDays) {
    status = 'good';
    reason = `${margin} days to spare before ${seed.frostTolerance === 'tender' ? 'first frost' : 'season end'}.`;
  } else if (margin >= 0) {
    status = 'marginal';
    reason = `Only ${margin} days to spare. Use row cover to be safe.`;
    needsCover = seed.rowCoverHelps || seed.frostTolerance === 'tender';
  } else if (margin + a.rowCoverBonusDays >= 0 && (seed.rowCoverHelps || seed.frostTolerance !== 'hardy')) {
    status = 'marginal';
    reason = `Short by ${-margin} days: needs row cover / low tunnel${indoors ? '' : ' or an indoor start'}.`;
    needsCover = true;
  } else {
    status = 'skip';
    reason = `Needs ${seed.daysToMaturity} days; season too short by ${-margin} days.`;
  }

  return {
    seed, status, reason, needsCover, sowing,
    indoorStart: indoors && seed.weeksIndoors ? doyToMmDd(plantOut - seed.weeksIndoors * 7) : undefined,
    plantOut: doyToMmDd(plantOut), harvest: doyToMmDd(harvest), marginDays: margin, kcalPer10m2: kcal,
  };
}

export function evaluatePerennial(p: R.PerennialPlant, c: Climate, a: R.Assumptions = R.assumptions): PerennialResult {
  const mine = zoneValue(c.zone);
  const need = zoneValue(p.minZone);
  if (Number.isNaN(mine) || Number.isNaN(need)) return { plant: p, status: 'marginal', reason: 'Zone unknown.' };
  if (mine < need) return { plant: p, status: 'skip', reason: `Hardy to zone ${p.minZone}; you are zone ${c.zone}.` };
  if (mine - need < a.marginalZoneMargin) return { plant: p, status: 'marginal', reason: `At its limit (zone ${p.minZone}). Plant in a sheltered, south-facing, well-drained spot with snow cover.` };
  return { plant: p, status: 'good', reason: `Hardy to zone ${p.minZone}.` };
}

export interface SeedPlan {
  annuals: AnnualResult[];
  perennials: PerennialResult[];
  skip: { name: string; reason: string }[];
  coverRecommendations: string[];
}

export function calcSeeds(c: Climate, opts: { includeHybrids?: boolean } = {}, a: R.Assumptions = R.assumptions, seeds = R.seedsAnnual, perennials = R.seedsPerennial): SeedPlan {
  const pool = seeds.filter((s) => opts.includeHybrids || s.openPollinated);
  const all = pool.map((s) => evaluateAnnual(s, c, a));
  const order: Record<SeedStatus, number> = { good: 0, marginal: 1, skip: 2 };
  const annuals = all.filter((r) => r.status !== 'skip').sort((x, y) => order[x.status] - order[y.status] || x.seed.crop.localeCompare(y.seed.crop));
  const pers = perennials.map((p) => evaluatePerennial(p, c, a));
  const skip = [
    ...all.filter((r) => r.status === 'skip').map((r) => ({ name: `${r.seed.crop} '${r.seed.variety}'`, reason: r.reason })),
    ...pers.filter((r) => r.status === 'skip').map((r) => ({ name: r.plant.name, reason: r.reason })),
  ];
  const cover: string[] = [];
  const coverCrops = annuals.filter((r) => r.needsCover).map((r) => r.seed.crop);
  if (coverCrops.length) cover.push(`Floating row cover (17–30 g/m²) for: ${[...new Set(coverCrops)].join(', ')}. Gives about 2–4 °C of frost protection.`);
  cover.push(`Keep row cover or old sheets ready from ${c.firstFrost.replace('-', '/')} onward: one clear, still night can end the season weeks early.`);
  if (c.frostFreeDays < 120) cover.push('Short season: build low tunnels (hoops + 6 mil poly) or a cold frame to gain 2–4 weeks at each end.');
  if (annuals.some((r) => r.seed.family === 'Cucurbitaceae' || r.seed.crop.includes('Tomato'))) cover.push('Black plastic mulch warms soil for squash, cucumbers and melons; wall-o-water cloches let tomatoes go out 2–3 weeks early.');
  if (c.snowMonths.length >= 4) cover.push('Mulch perennials and garlic with 15 cm straw after the ground freezes; snow is the best insulation, so do not plow it away from beds.');
  return { annuals, perennials: pers.sort((x, y) => order[x.status] - order[y.status]), skip, coverRecommendations: cover };
}
