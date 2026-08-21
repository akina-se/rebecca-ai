/* eslint-env node */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],

  // Collect coverage only from source code, excluding config and type declarations.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],

  // Specify coverage reporters needed for GitHub Actions
  coverageReporters: ['text', 'json-summary', 'lcov'],

  // Coverage thresholds based on industry best practice (80% "Goldilocks zone").
  // Jest will exit with a non-zero code if any threshold is not met,
  // which blocks PR merges when enforced as a required CI check.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
