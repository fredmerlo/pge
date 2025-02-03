module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/_tests_/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};