/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testMatch: ['**/_tests_/**/*.test.ts'],
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
  testTimeout: 10000,
  reporters: [
    'default',
    ['jest-junit', {outputDirectory: 'reports', outputName: 'report.xml'}],
  ],
};