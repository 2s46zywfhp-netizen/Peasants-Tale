/** Simple stroke icons, editable inline SVG. */
const base = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconHome = () => (<svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>);
export const IconList = () => (<svg {...base}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>);
export const IconBox = () => (<svg {...base}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></svg>);
export const IconBook = () => (<svg {...base}><path d="M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4z" /><path d="M20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z" /></svg>);
export const IconPen = () => (<svg {...base}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></svg>);
export const IconGear = () => (<svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>);
export const IconSun = () => (<svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IconMoon = () => (<svg {...base}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg>);
export const IconEye = () => (<svg {...base}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IconPrint = () => (<svg {...base}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="1" /><path d="M6 14h12v7H6z" /></svg>);
