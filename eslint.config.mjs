import nextPlugin from '@next/eslint-plugin-next';

const { flatConfig } = nextPlugin;

export default [
  flatConfig.recommended,
  flatConfig.coreWebVitals,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];
