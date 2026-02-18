/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    // Mock CSS/SCSS imports in tests
    '\\.(scss|css)$': '<rootDir>/src/__tests__/__mocks__/styleMock.js',
    // Mock azure-devops-extension-sdk
    '^azure-devops-extension-sdk$': '<rootDir>/src/__tests__/__mocks__/sdkMock.ts',
    '^azure-devops-extension-api(.*)$': '<rootDir>/src/__tests__/__mocks__/apiMock.ts',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/rules/**/*.ts',
    'src/common/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
  ],
};
