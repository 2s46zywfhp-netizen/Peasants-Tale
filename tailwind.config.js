/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        danger: v('danger'),
        ok: v('ok'),
      },
      minHeight: { tap: '3rem' },
      minWidth: { tap: '3rem' },
    },
  },
  plugins: [],
};
