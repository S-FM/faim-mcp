/**
 * tsup Build Configuration
 *
 * This configuration handles the bundling of the FAIM MCP server.
 * It generates both ESM and CommonJS outputs with full TypeScript support.
 *
 * Output files:
 * - dist/index.js (ESM)
 * - dist/index.cjs (CommonJS)
 * - dist/index.d.ts (TypeScript declarations)
 * - dist/index.d.cts (CommonJS declarations)
 * - Source maps for debugging in production
 */

import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry point: src/index.ts is the main server file
  entry: ['src/index.ts'],

  // Generate both ESM and CommonJS formats
  // ESM is for modern tools and direct imports
  // CJS is for CommonJS-based projects
  format: ['esm', 'cjs'],

  // Enable TypeScript declaration files
  // Allows consumers to have full type support
  dts: true,

  // Clean output directory before build
  // Ensures no stale files from previous builds
  clean: true,

  // Generate source maps for debugging
  // Points back to original TypeScript files in production
  sourcemap: true,

  // Shim module exports for ESM-only packages
  // Helps with compatibility between ESM and CJS
  shims: true,

  // Target modern JavaScript (Node 20)
  // All modern features are available
  target: 'es2020',

  // Preserve import/export statements
  // Allows tree-shaking by consumers
  splitting: false,

  // Don't bundle dependencies
  // Consumers will install them separately
  external: ['@anthropic-ai/sdk', '@faim-group/sdk-forecasting'],
});
