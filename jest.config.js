module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/_tests_/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  reporters: [
    'default',
    ['jest-junit', {outputDirectory: 'reports', outputName: 'report.xml'}],
  ],
};