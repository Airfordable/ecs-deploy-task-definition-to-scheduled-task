module.exports = {
  env: {
    es6: true,
    'jest/globals': true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    // 'plugin:jest/all',
    'plugin:prettier/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  plugins: ['jest', 'prettier'],
  root: true,
  rules: {
    // 'import/order': [
    //   'error',
    //   {
    //     alphabetize: {
    //       caseInsensitive: false,
    //       order: 'asc',
    //     },
    //     groups: [
    //       'builtin',
    //       'external',
    //       ['internal', 'parent', 'sibling', 'index'],
    //     ],
    //     'newlines-between': 'always',
    //   },
    // ],
    'max-params': ['error', 5],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-param-reassign': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
    'sort-keys': 'error',
  },
};
