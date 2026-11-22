/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    // Replace the supabase client with the manual mock to avoid import.meta.env
    '^(\\.{1,2}/)*supabase$': '<rootDir>/src/lib/__mocks__/supabase.ts',
  },
};
