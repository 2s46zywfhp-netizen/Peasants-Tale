import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts/sw-template.js', 'e2e'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded mulberry32 PRNG.' },
      ],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/**/*.test.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded mulberry32 PRNG.' },
        { object: 'Date', property: 'now', message: 'Sim time must be passed in.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'indexedDB', 'performance'],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
);
