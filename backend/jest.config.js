module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/migrations/**',
    '!src/index.js'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  setupFiles: ['<rootDir>/src/__tests__/setup.js']
};