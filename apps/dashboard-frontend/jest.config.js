module.exports = {
  preset: 'jest-preset-angular',
  setupFiles: ['<rootDir>/setup-fetch.js'],
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'html', 'js', 'json'],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.d.ts',
    '!src/environments/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['html', 'text-summary', 'json-summary', 'lcov'],
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@firebase|firebase)'],
  moduleNameMapper: {
    '^@rebecca/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
};
