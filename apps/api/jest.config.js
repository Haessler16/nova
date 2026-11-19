/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage',
  // Ratchet measured on 2026-11-17 with unit tests only (`test:coverage`).
  // Most modules are exercised by the e2e suites, which run under a separate
  // Jest config, so raise these floors as unit coverage grows.
  coverageThreshold: {
    global: { statements: 14, branches: 15, functions: 13, lines: 14 },
  },
  testEnvironment: 'node',
  clearMocks: true,
};
