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
   * Test with moderate horizon value
   */
  it('should forecast with moderate horizon values', async () => {
    const request = {
      model: 'chronos2',
      x: [15, 25, 35, 45, 55],
      horizon: 20,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_type).toBe('point');
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test 1D array input with default model (chronos2)
   */
  it('should forecast with 1D array input and default model', async () => {
    const request = {
      x: [1, 2, 3, 4, 5, 6, 7, 8],
      horizon: 3,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test 1D array with TiRex model
   */
  it('should forecast with 1D array input and TiRex model', async () => {
    const request = {
      model: 'tirex',
      x: [2, 4, 6, 8, 10, 12],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test 2D array with is_multivariate=true (Chronos2)
   * Should treat as (timesteps, features) format
   */
  it('should forecast with 2D array as multivariate (Chronos2)', async () => {
    const request = {
      model: 'chronos2',
      x: [
        [1.0, 2.0],
        [3.0, 4.0],
        [5.0, 6.0],
        [7.0, 8.0],
        [9.0, 10.0],
      ],
      horizon: 2,
      output_type: 'point' as const,
      is_multivariate: true,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.forecast.point).toBeDefined();
      // Input shape should be [1, 5, 2] (1 batch, 5 timesteps, 2 features)
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(5);
      expect(result.data.shape_info.input_shape[2]).toBe(2);
    }
  });

  /**
   * Test 2D array with is_multivariate=false (default, univariate)
   * Should flatten to 1D and treat as single feature
   */
  it('should forecast with 2D array as univariate (is_multivariate=false)', async () => {
    const request = {
      model: 'chronos2',
      x: [
        [1.0, 2.0],
        [3.0, 4.0],
        [5.0, 6.0],
        [7.0, 8.0],
        [9.0, 10.0],
      ],
      horizon: 2,
      output_type: 'point' as const,
      is_multivariate: false,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.forecast.point).toBeDefined();
      // Input shape should be [1, 10, 1] (1 batch, 10 timesteps flattened, 1 feature)
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(10);
      expect(result.data.shape_info.input_shape[2]).toBe(1);
    }
  });

  /**
   * Test 2D array with TiRex (should ignore is_multivariate flag)
   * Should always treat as univariate (flatten)
   */
  it('should forecast with 2D array and TiRex (ignores is_multivariate)', async () => {
    const request = {
      model: 'tirex',
      x: [
        [1.0, 2.0],
        [3.0, 4.0],
        [5.0, 6.0],
      ],
      horizon: 1,
      output_type: 'point' as const,
      is_multivariate: true, // This should be ignored for TiRex
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
      // Input shape should be [1, 6, 1] (1 batch, 6 timesteps flattened, 1 feature)
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(6);
      expect(result.data.shape_info.input_shape[2]).toBe(1);
    }
  });

  /**
   * Test 3D array with Chronos2
   * Should be passed through unchanged
   */
  it('should forecast with 3D array (Chronos2)', async () => {
    const request = {
      model: 'chronos2',
      x: [[[1.0], [2.0], [3.0], [4.0], [5.0]]],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.forecast.point).toBeDefined();
      // Input shape should be [1, 5, 1] (already in correct format)
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(5);
      expect(result.data.shape_info.input_shape[2]).toBe(1);
    }
  });

  /**
   * Test 3D array with multivariate data (Chronos2)
   * Should be passed through unchanged
   */
  it('should forecast with 3D multivariate array (Chronos2)', async () => {
    const request = {
      model: 'chronos2',
      x: [[[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], [7.0, 8.0, 9.0]]],
      horizon: 1,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.forecast.point).toBeDefined();
      // Input shape should be [1, 3, 3] (1 batch, 3 timesteps, 3 features)
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(3);
      expect(result.data.shape_info.input_shape[2]).toBe(3);
    }
  });

  /**
   * Test 3D array with TiRex
   */
  it('should forecast with 3D array (TiRex)', async () => {
    const request = {
      model: 'tirex',
      x: [[[1.0], [2.0], [3.0], [4.0]]],
      horizon: 1,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(4);
    }
  });

  /**
   * Test 1D array with quantiles and default model
   */
  it('should forecast with 1D array and quantiles output (default model)', async () => {
    const request = {
      x: [5, 10, 15, 20, 25, 30],
      horizon: 3,
      output_type: 'quantiles' as const,
      quantiles: [0.1, 0.5, 0.9],
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.output_type).toBe('quantiles');
      expect(result.data.forecast.quantiles).toBeDefined();
    }
  });

  /**
   * Test 2D multivariate with quantiles (Chronos2)
   */
  it('should forecast with 2D multivariate array and quantiles', async () => {
    const request = {
      model: 'chronos2',
      x: [
        [10.0, 20.0],
        [15.0, 25.0],
        [20.0, 30.0],
        [25.0, 35.0],
        [30.0, 40.0],
      ],
      horizon: 2,
      output_type: 'quantiles' as const,
      quantiles: [0.25, 0.75],
      is_multivariate: true,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_type).toBe('quantiles');
      expect(result.data.forecast.quantiles).toBeDefined();
      expect(result.data.shape_info.input_shape[2]).toBe(2); // 2 features
    }
  });

  /**
   * Test large horizon value
   */
  it('should handle large horizon values', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      horizon: 100,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test with very long input sequence
   */
  it('should handle long input sequences', async () => {
    const longSequence = Array.from({ length: 100 }, (_, i) => i + 1);
    const request = {
      model: 'chronos2',
      x: longSequence,
      horizon: 5,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast.point).toBeDefined();
      expect(result.data.shape_info.input_shape[1]).toBe(100);
    }
  });

  /**
   * Test default model behavior when model not specified
   */
  it('should use chronos2 as default when model not specified', async () => {
    const request = {
      x: [1, 2, 3, 4, 5],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
    }
  });

  /**
   * Test TiRex with quantiles output type
   */
  it('should forecast with TiRex using quantiles output', async () => {
    const request = {
      model: 'tirex',
      x: [1, 2, 3, 4, 5, 6],
      horizon: 3,
      output_type: 'quantiles' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.output_type).toBe('quantiles');
      expect(result.data.forecast.quantiles).toBeDefined();
      // TiRex returns fixed quantiles [0.1, 0.2, ..., 0.9]
      expect(Array.isArray(result.data.forecast.quantiles)).toBe(true);
    }
  });

  /**
   * Test TiRex ignores custom quantiles parameter
   * TiRex always uses fixed quantiles [0.1, 0.2, 0.3, ..., 0.9]
   */
  it('should ignore custom quantiles with TiRex model', async () => {
    const request = {
      model: 'tirex',
      x: [10, 15, 20, 25, 30, 35],
      horizon: 2,
      output_type: 'quantiles' as const,
      quantiles: [0.25, 0.75], // Should be ignored by TiRex
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.output_type).toBe('quantiles');
      // TiRex returns fixed quantiles, not custom ones
      expect(result.data.forecast.quantiles).toBeDefined();
      // The output structure should still be valid
      expect(Array.isArray(result.data.forecast.quantiles)).toBe(true);
    }
  });

  /**
   * Test TiRex with multivariate flag (should be ignored)
   * TiRex only supports univariate, so is_multivariate=true should be ignored
   */
  it('should ignore is_multivariate flag with TiRex', async () => {
    const request = {
      model: 'tirex',
      x: [
        [1.0, 2.0],
        [3.0, 4.0],
        [5.0, 6.0],
        [7.0, 8.0],
      ],
      horizon: 1,
      output_type: 'point' as const,
      is_multivariate: true, // Should be ignored for TiRex
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
      // Should flatten to univariate: 1 batch, 8 timesteps, 1 feature
      expect(result.data.shape_info.input_shape[0]).toBe(1); // batch
      expect(result.data.shape_info.input_shape[1]).toBe(8); // sequence length (flattened)
      expect(result.data.shape_info.input_shape[2]).toBe(1); // 1 feature only
    }
  });

  /**
   * Test TiRex with 3D array (univariate)
   */
  it('should forecast with TiRex using 3D array', async () => {
    const request = {
      model: 'tirex',
      x: [[[1.0], [2.0], [3.0], [4.0], [5.0]]],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
      expect(result.data.shape_info.input_shape[0]).toBe(1);
      expect(result.data.shape_info.input_shape[1]).toBe(5);
      expect(result.data.shape_info.input_shape[2]).toBe(1);
    }
  });

  /**
   * Test TiRex with very long sequence
   */
  it('should handle long sequences with TiRex', async () => {
    const longSequence = Array.from({ length: 50 }, (_, i) => (i + 1) * 0.5);
    const request = {
      model: 'tirex',
      x: longSequence,
      horizon: 5,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
      expect(result.data.shape_info.input_shape[1]).toBe(50);
    }
  });

  /**
   * Test TiRex with small horizon
   */
  it('should forecast with TiRex using horizon of 1', async () => {
    const request = {
      model: 'tirex',
      x: [100, 110, 120, 130],
      horizon: 1,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('tirex');
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test error handling: empty array input
   */
  it('should handle empty array input gracefully', async () => {
    const request = {
      model: 'chronos2',
      x: [],
      horizon: 5,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    // Should fail with validation error
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.error_code).toBeDefined();
  });

  /**
   * Test error handling: invalid horizon (negative)
   */
  it('should reject negative horizon values', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: -1,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  /**
   * Test error handling: invalid quantile values (outside 0-1)
   */
  it('should reject quantile values outside [0, 1] range', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 3,
      output_type: 'quantiles' as const,
      quantiles: [0.1, 1.5], // 1.5 is invalid
    };

    const result = await forecast(request);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.field).toBe('quantiles');
  });

  /**
   * Test error handling: invalid quantile value (negative)
   */
  it('should reject negative quantile values', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 3,
      output_type: 'quantiles' as const,
      quantiles: [-0.1, 0.5], // -0.1 is invalid
    };

    const result = await forecast(request);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  /**
   * Test error handling: empty quantiles array
   */
  it('should reject empty quantiles array', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 3,
      output_type: 'quantiles' as const,
      quantiles: [], // Empty array is invalid
    };

    const result = await forecast(request);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  /**
   * Test error handling: inconsistent 2D array (ragged)
   */
  it('should handle inconsistent 2D array structure', async () => {
    const request = {
      model: 'chronos2',
      x: [
        [1, 2, 3],
        [4, 5], // Different length - ragged array
      ],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    // May succeed (if SDK allows it) or fail with validation error
    // Either way, should return valid result structure
    expect(result).toBeDefined();
    expect(result.success !== undefined).toBe(true);
  });

  /**
   * Test Chronos2 with custom quantiles (should accept them)
   */
  it('should accept custom quantiles with Chronos2', async () => {
    const request = {
      model: 'chronos2',
      x: [5, 10, 15, 20, 25],
      horizon: 2,
      output_type: 'quantiles' as const,
      quantiles: [0.05, 0.25, 0.5, 0.75, 0.95], // Custom quantiles
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model_name).toBe('chronos2');
      expect(result.data.output_type).toBe('quantiles');
      expect(result.data.forecast.quantiles).toBeDefined();
    }
  });

  /**
   * Test Chronos2 with single quantile value
   */
  it('should handle single quantile value with Chronos2', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5, 6],
      horizon: 3,
      output_type: 'quantiles' as const,
      quantiles: [0.5], // Just the median
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_type).toBe('quantiles');
      expect(result.data.forecast.quantiles).toBeDefined();
    }
  });

  /**
   * Test Chronos2 2D batch inference (is_multivariate=false)
   */
  it('should correctly flatten 2D array for batch inference', async () => {
    const request = {
      model: 'chronos2',
      x: [[1, 2, 3, 4]],
      horizon: 1,
      output_type: 'point' as const,
      is_multivariate: false, // Batch inference mode
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      // Should flatten to: [1, 2, 3, 4] → 1 batch, 4 timesteps, 1 feature
      expect(result.data.shape_info.input_shape[0]).toBe(1); // batch
      expect(result.data.shape_info.input_shape[1]).toBe(4); // sequence
      expect(result.data.shape_info.input_shape[2]).toBe(1); // features
    }
  });

  /**
   * Test response structure with all metadata fields
   */
  it('should include all required metadata fields in response', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      // Check response structure
      expect(result.data.model_name).toBeDefined();
      expect(result.data.model_version).toBeDefined();
      expect(result.data.output_type).toBeDefined();
      expect(result.data.forecast).toBeDefined();
      expect(result.data.metadata).toBeDefined();
      expect(result.data.shape_info).toBeDefined();

      // Check metadata
      expect(result.data.metadata.token_count).toBeGreaterThan(0);
      expect(result.data.metadata.duration_ms).toBeGreaterThan(0);

      // Check shape_info
      expect(result.data.shape_info.input_shape).toBeDefined();
      expect(result.data.shape_info.input_shape).toHaveLength(3);
      expect(result.data.shape_info.output_shape).toBeDefined();
    }
  });

  /**
   * Test that different quantiles produce different results
   */
  it('should produce consistent results across multiple calls with same input', async () => {
    const request = {
      model: 'chronos2',
      x: [10, 20, 30, 40, 50],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result1 = await forecast(request);
    const result2 = await forecast(request);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    if (result1.success && result2.success) {
      // Results should be identical for same input
      expect(JSON.stringify(result1.data.forecast)).toBe(
        JSON.stringify(result2.data.forecast)
      );
    }
  });

  /**
   * Test zero horizon rejection (edge case)
   */
  it('should reject zero horizon', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 0, // Invalid: must be > 0
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  /**
   * Test mixed positive/negative values in input
   */
  it('should handle negative values in time series', async () => {
    const request = {
      model: 'chronos2',
      x: [-10, -5, 0, 5, 10, 15],
      horizon: 3,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test floating point values
   */
  it('should handle floating point values in time series', async () => {
    const request = {
      model: 'chronos2',
      x: [1.5, 2.7, 3.2, 4.8, 5.1],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test very small floating point values
   */
  it('should handle very small floating point values', async () => {
    const request = {
      model: 'chronos2',
      x: [0.001, 0.002, 0.003, 0.004, 0.005],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast.point).toBeDefined();
    }
  });

  /**
   * Test very large floating point values
   */
  it('should handle very large floating point values', async () => {
    const request = {
      model: 'chronos2',
      x: [1e6, 2e6, 3e6, 4e6, 5e6],
      horizon: 2,
      output_type: 'point' as const,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forecast.point).toBeDefined();
    }
  });
});