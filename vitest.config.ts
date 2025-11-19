/**
 * Vitest Configuration
 *
 * Configuration for the test suite. Vitest is a unit testing framework
 * that's optimized for Vite projects and TypeScript.
 *
 * This config sets up:
 * - TypeScript support
 * - Test file patterns
 * - Coverage reporting
 * - Mock utilities
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Environment for running tests
    // Node environment simulates a server environment
    environment: 'node',

    // Test file patterns to discover
    // Includes both .test.ts and .spec.ts files
    include: ['tests/**/*.{test,spec}.ts'],

    // TypeScript support for test files
    // Automatically transpiles .ts test files
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
      ],
      // Thresholds for coverage requirements
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
