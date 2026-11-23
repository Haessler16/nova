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
    // Guardrails introduced by docs/v5 (F5). Promoted to error once the F2
    // extraction and the warning cleanup left `eslint src` clean.
    'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    complexity: ['error', 15],
    'no-restricted-syntax': [
      'error',
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
