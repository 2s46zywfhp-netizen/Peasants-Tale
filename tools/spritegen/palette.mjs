// The 32-colour palette: eight ramps of four, darkest first. Index = ramp * 4 + shade.
export const RAMPS = {
  night: ['#07080d', '#0b0d14', '#141a2e', '#1f2d4a'],
  teal: ['#1d3d47', '#2e5a6b', '#3f8a8c', '#6cb5a8'],
  bone: ['#a89f86', '#c9b99a', '#e8e0c4', '#f7f2df'],
  stone: ['#4a5468', '#6b7689', '#8a9bb0', '#b4c0cf'],
  blood: ['#3a1012', '#5c1a1a', '#8c2a2a', '#b8432f'],
  fire: ['#d4622a', '#ec8f3a', '#f2c14e', '#fbe39a'],
  earth: ['#2e2019', '#4a3326', '#6b4a32', '#8f6a46'],
  moss: ['#1f3324', '#3d5a3a', '#5f7f4a', '#8aa65c'],
};
export const RAMP_NAMES = Object.keys(RAMPS);
export const PALETTE = RAMP_NAMES.flatMap((r) => RAMPS[r]);
export const T = 255; // transparent
export const idx = (ramp, shade) => RAMP_NAMES.indexOf(ramp) * 4 + Math.max(0, Math.min(3, shade));
export const rgbOf = (i) => {
  const h = PALETTE[i];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};
