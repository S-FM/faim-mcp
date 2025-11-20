/**
 * Integration Tests for Forecast Tool
 *
 * These tests make actual API calls to the FAIM service to verify
 * end-to-end functionality with real forecasting models.
 *
 * Prerequisites:
 * - FAIM_API_KEY environment variable must be set
 * - Network connectivity to FAIM API
 *
 * Run with: npm run test:integration
 * (Only run in CI with valid API credentials or for manual testing)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeClient } from '../../src/utils/client.js';
import { forecast } from '../../src/tools/forecast.js';

describe('Forecast Integration Tests', () => {
  /**
   * Initialize client before running integration tests
   */
  beforeAll(() => {
    if (!process.env.FAIM_API_KEY) {
      throw new Error('FAIM_API_KEY environment variable is required for integration tests');
    }
    initializeClient();
  });

  /**
   * Test basic point forecast with Chronos2 model
   */
  it('should forecast with chronos2 model (point output)', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      horizon: 5,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.output_type).toBe('point');
      expect(result.data.forecast).toBeDefined();
      expect(result.data.forecast.point).toBeDefined();
      // Should return 3D array: [batch, horizon, features]
      expect(Array.isArray(result.data.forecast.point)).toBe(true);
    }
  });

  /**
   * Test quantile forecast with Chronos2 model
   */
  it('should forecast with chronos2 model (quantiles output)', async () => {
    const request = {
      model: 'chronos2',
      x: [10, 20, 30, 40, 50],
      horizon: 3,
      output_type: 'quantiles' as const,
      quantiles: [0.1, 0.5, 0.9],
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.output_type).toBe('quantiles');
      expect(result.data.forecast).toBeDefined();
      expect(result.data.forecast.quantiles).toBeDefined();
      expect(Array.isArray(result.data.forecast.quantiles)).toBe(true);
    }
  });

  /**
   * Test with 2D array input (multivariate)
   */
  it('should handle 2D array input', async () => {
    const request = {
      model: 'chronos2',
      x: [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        [9, 10],
      ],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast).toBeDefined();
      expect(result.data.shape_info).toBeDefined();
      expect(result.data.shape_info.input_shape).toBeDefined();
    }
  });

  /**
   * Test metadata is returned correctly
   */
  it('should return metadata with forecast', async () => {
    const request = {
      model: 'chronos2',
      x: [5, 10, 15, 20, 25],
      horizon: 4,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toBeDefined();
      expect(result.data.metadata.duration_ms).toBeGreaterThan(0);
      expect(result.data.metadata.token_count).toBeGreaterThan(0);
    }
  });

  /**
   * Test error handling with invalid input
   */
  it('should handle invalid horizon gracefully', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 100000, // Unreasonably large horizon
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    // Should either succeed or return a proper error
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error.error_code).toBeDefined();
    }
  });

  /**
   * Test with minimum valid horizon
   */
  it('should handle minimum horizon of 1', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 1,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast).toBeDefined();
    }
  });

  /**
   * Test samples output type
   */
  it('should forecast with samples output type', async () => {
    const request = {
      model: 'chronos2',
      x: [15, 25, 35, 45, 55],
      horizon: 3,
      output_type: 'samples' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_type).toBe('samples');
      expect(result.data.forecast.samples).toBeDefined();
    }
  });
});