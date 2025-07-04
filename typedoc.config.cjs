'use strict';

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: [
    './lib/*.js',
  ],
  out: 'docs',
  cleanOutputDir: true,
  includeVersion: true,
  sidebarLinks: {
    GitHub: 'https://github.com/cto-af/linewrap',
    Documentation: 'http://cto-af.github.io/linewrap/',
    Spec: 'https://www.unicode.org/reports/tr14/',
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ['static-first', 'alphabetical'],
};
