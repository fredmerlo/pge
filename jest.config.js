/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testMatch: ['**/_tests_/**/*.test.ts'],
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
  reporters: [
    'default',
    ['jest-junit', {outputDirectory: 'reports', outputName: 'report.xml'}],
  ],
};