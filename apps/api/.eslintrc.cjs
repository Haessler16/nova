module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    // Guardrails introduced by docs/v5 (F5). Kept as warnings until the
    // front-office split (F2) lands; then promote to error.
    'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 120, skipBlankLines: true, skipComments: true }],
    complexity: ['warn', 15],
    'no-restricted-syntax': [
      'warn',
      {
        selector: "NewExpression[callee.name='Date'][arguments.length=0]",
        message: 'Inject Clock and use clock.now() instead of new Date().',
      },
      {
        selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
        message: 'Inject Clock and use clock.now() instead of Date.now().',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.spec.ts', 'test/**/*.ts', 'src/common/time/clock.ts', 'prisma/**/*.ts'],
      rules: {
        'no-restricted-syntax': 'off',
        'max-lines': 'off',
        'max-lines-per-function': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.js'],
};
