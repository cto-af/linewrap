import base from '@cto.af/eslint-config';
import cjs from '@cto.af/eslint-config/cjs.js';
import mod from '@cto.af/eslint-config/module.js';

export default [
  {
    ignores: [
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
    ],
  },
  ...base,
  ...mod,
  ...cjs,
  {
    files: [
      'lib/widths.js',
    ],
    rules: {
      '@stylistic/object-curly-spacing': 'off',
    },
  },
];
