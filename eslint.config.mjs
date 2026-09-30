import { flatConfig } from '@next/eslint-plugin-next';

export default [
  flatConfig.recommended,
  flatConfig.coreWebVitals,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];
