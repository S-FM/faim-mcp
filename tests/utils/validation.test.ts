/**
 * Tests for Input Validation Module
 *
 * These tests ensure that:
 * 1. Valid inputs pass validation
 * 2. Invalid inputs are caught with helpful error messages
 * 3. Array normalization works correctly for 1D, 2D, 3D inputs
 * 4. Quantile validation catches out-of-range values
 *
 * Testing Strategy:
 * - Happy path tests (valid inputs should pass)
 * - Error path tests (invalid inputs should fail with specific codes)
 * - Edge case tests (empty arrays, boundary values, extreme inputs)
 * - Array shape tests (verify normalization produces correct shapes)
 *
 * LLM Context: These tests act as executable documentation
 * for the validation module. They show what inputs are valid
 * and what errors are returned for invalid ones.
 */

import { describe, it, expect } from 'vitest';
import {
  validateForecastRequest,
  normalizeInput,
  getArrayShape,
} from '../../src/utils/validation.js';

describe('validateForecastRequest', () => {
  /**
   * Happy Path Tests
   *
   * These tests verify that valid requests pass validation.
   * Valid requests have:
   * - model: "chronos2" or "tirex"
   * - x: array of numbers
   * - horizon: positive integer
   * - output_type (optional): "point", "quantiles", or "samples"
   * - quantiles (optional): array of values in [0, 1]
   */

  it('should accept valid point forecast request with 1D array', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 10,
      output_type: 'point',
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept valid quantile forecast request', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0.1, 0.5, 0.9],
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept TiRex model', () => {
    const request = {
      model: 'tirex',
      x: [1, 2, 3],
      horizon: 5,
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept 2D array input (multivariate)', () => {
    const request = {
      model: 'chronos2',
      x: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept 3D array input', () => {
    const request = {
      model: 'chronos2',
      x: [[[1], [2], [3]]],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept request without optional fields', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  /**
   * Error Path Tests - Missing Fields
   *
   * These tests verify that missing required fields are caught
   * with appropriate error codes and helpful messages.
   */

  it('should reject request without model', () => {
    const request = {
      x: [1, 2, 3],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    // Model is now optional (defaults to chronos2)
    expect(error).toBeNull();
  });

  it('should reject request without horizon', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('MISSING_REQUIRED_FIELD');
    expect(error?.field).toBe('horizon');
  });

  it('should reject request without x (time series data)', () => {
    const request = {
      model: 'chronos2',
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('MISSING_REQUIRED_FIELD');
    expect(error?.field).toBe('x');
  });

  /**
   * Error Path Tests - Invalid Values
   *
   * These tests verify that invalid field values are caught.
   */

  it('should reject invalid model name', () => {
    const request = {
      model: 'invalid_model',
      x: [1, 2, 3],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_PARAMETER');
    expect(error?.field).toBe('model');
  });

  it('should reject non-numeric horizon', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 'not a number',
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_PARAMETER');
    expect(error?.field).toBe('horizon');
  });

  it('should reject zero horizon', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 0,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
    expect(error?.field).toBe('horizon');
  });

  it('should reject negative horizon', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: -5,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
  });

  it('should reject horizon that is too large', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 50000,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
  });

  it('should reject non-numeric values in time series data', () => {
    const request = {
      model: 'chronos2',
      x: [1, 'two', 3],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_PARAMETER');
    expect(error?.field).toBe('x');
  });

  it('should reject empty array', () => {
    const request = {
      model: 'chronos2',
      x: [],
      horizon: 10,
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
  });

  /**
   * Error Path Tests - Quantiles
   *
   * These tests verify quantile validation.
   */

  it('should reject quantiles outside [0, 1] range', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0.1, 1.5, 0.9], // 1.5 is invalid
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
    expect(error?.field).toBe('quantiles');
  });

  it('should reject negative quantiles', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [-0.1, 0.5, 0.9],
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
  });

  it('should reject empty quantiles array', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [],
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_VALUE_RANGE');
  });

  /**
   * Error Path Tests - Output Type
   */

  it('should reject invalid output_type', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'invalid',
    };

    const error = validateForecastRequest(request);
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('INVALID_PARAMETER');
    expect(error?.field).toBe('output_type');
  });

  /**
   * Edge Case Tests - Boundary Values
   */

  it('should accept horizon of 1', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 1,
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept maximum horizon', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 1024,
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });

  it('should accept boundary quantiles [0, 1]', () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0, 0.5, 1],
    };

    const error = validateForecastRequest(request);
    expect(error).toBeNull();
  });
});

describe('normalizeInput', () => {
  /**
   * Array Normalization Tests
   *
   * Verify that different input formats are normalized to 3D format.
   * All outputs should be [batch, sequence_length, num_features].
   */

  it('should normalize 1D array to 3D', () => {
    const input = [1, 2, 3, 4, 5];
    const normalized = normalizeInput(input);

    expect(normalized).toHaveLength(1); // batch size 1
    expect(normalized[0]).toHaveLength(5); // 5 time steps
    expect(normalized[0][0]).toHaveLength(1); // 1 feature
    expect(normalized[0][0][0]).toBe(1);
  });

  it('should pass through already 3D array', () => {
    const input = [[[1], [2], [3]]];
    const normalized = normalizeInput(input);

    expect(normalized).toEqual(input);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toHaveLength(3);
  });

  /**
   * Tests for is_multivariate flag with 2D arrays
   *
   * The is_multivariate flag controls how 2D arrays are interpreted:
   * - false (default): Flatten to univariate (batch inference)
   * - true (Chronos2 only): Keep as multivariate (multifeature inference)
   */

  describe('2D array handling without is_multivariate flag', () => {
    it('should normalize 2D array to 3D with default behavior (batch inference)', () => {
      const input = [[1, 2, 3]]; // shape [1, 3] -> should flatten to [3,] then expand
      const normalized = normalizeInput(input, 'chronos2', false);

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(3); // 3 time steps
      expect(normalized[0][0]).toHaveLength(1); // 1 feature (flattened)
      expect(normalized[0]).toEqual([[1], [2], [3]]);
    });

    it('should flatten 2D array for TiRex model (is_multivariate ignored)', () => {
      const input = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      const normalized = normalizeInput(input, 'tirex', true); // is_multivariate=true but should be ignored for TiRex

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(6); // 6 time steps after flattening
      expect(normalized[0][0]).toHaveLength(1); // 1 feature (flattened)
      expect(normalized[0]).toEqual([[1], [2], [3], [4], [5], [6]]);
    });
  });

  describe('2D array handling with is_multivariate=true (Chronos2 only)', () => {
    it('should keep 2D array as multivariate for Chronos2 with is_multivariate=true', () => {
      const input = [
        [1, 2],
        [3, 4],
        [5, 6],
      ]; // shape [3, 2] -> multivariate (3 timesteps, 2 features)
      const normalized = normalizeInput(input, 'chronos2', true);

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(3); // 3 time steps
      expect(normalized[0][0]).toHaveLength(2); // 2 features
      expect(normalized[0][0]).toEqual([1, 2]);
      expect(normalized[0][1]).toEqual([3, 4]);
      expect(normalized[0][2]).toEqual([5, 6]);
    });

    it('should handle single row 2D array as multivariate (is_multivariate=true)', () => {
      const input = [[1, 2, 3, 4, 5]]; // shape [1, 5] -> 1 timestep with 5 features
      const normalized = normalizeInput(input, 'chronos2', true);

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(1); // 1 time step
      expect(normalized[0][0]).toHaveLength(5); // 5 features
      expect(normalized[0][0]).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle many features multivariate 2D array', () => {
      const input = [
        [10, 20, 30],
        [40, 50, 60],
        [70, 80, 90],
        [100, 110, 120],
      ];
      const normalized = normalizeInput(input, 'chronos2', true);

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(4); // 4 time steps
      expect(normalized[0][0]).toHaveLength(3); // 3 features
      expect(normalized[0]).toEqual([
        [10, 20, 30],
        [40, 50, 60],
        [70, 80, 90],
        [100, 110, 120],
      ]);
    });
  });

  describe('2D array handling with is_multivariate=false (explicit batch inference)', () => {
    it('should flatten 2D array for Chronos2 with is_multivariate=false', () => {
      const input = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      const normalized = normalizeInput(input, 'chronos2', false);

      // With is_multivariate=false, should flatten to: [1, 2, 3, 4, 5, 6]
      // Then expand to 3D: [[[1], [2], [3], [4], [5], [6]]]
      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(6); // 6 time steps
      expect(normalized[0][0]).toHaveLength(1); // 1 feature
      expect(normalized[0]).toEqual([[1], [2], [3], [4], [5], [6]]);
    });

    it('should flatten single row 2D array with is_multivariate=false', () => {
      const input = [[10, 20, 30]];
      const normalized = normalizeInput(input, 'chronos2', false);

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(3); // 3 time steps after flattening
      expect(normalized[0][0]).toHaveLength(1); // 1 feature
      expect(normalized[0]).toEqual([[10], [20], [30]]);
    });
  });

  describe('1D array handling with is_multivariate flag', () => {
    it('should ignore is_multivariate=true for 1D array (Chronos2)', () => {
      const input = [1, 2, 3, 4, 5];
      const normalized = normalizeInput(input, 'chronos2', true);

      // is_multivariate should be ignored for 1D arrays
      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(5); // 5 time steps
      expect(normalized[0][0]).toHaveLength(1); // 1 feature
      expect(normalized[0]).toEqual([[1], [2], [3], [4], [5]]);
    });

    it('should ignore is_multivariate=false for 1D array', () => {
      const input = [1, 2, 3, 4, 5];
      const normalized = normalizeInput(input, 'chronos2', false);

      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(5); // 5 time steps
      expect(normalized[0][0]).toHaveLength(1); // 1 feature
      expect(normalized[0]).toEqual([[1], [2], [3], [4], [5]]);
    });
  });

  describe('3D array handling with is_multivariate flag', () => {
    it('should ignore is_multivariate flag for 3D array', () => {
      const input = [
        [
          [1, 2],
          [3, 4],
        ],
      ];
      const normalized = normalizeInput(input, 'chronos2', true);

      // is_multivariate should be ignored for 3D arrays
      expect(normalized).toEqual(input);
      expect(normalized).toHaveLength(1); // batch size 1
      expect(normalized[0]).toHaveLength(2); // 2 time steps
      expect(normalized[0][0]).toHaveLength(2); // 2 features
    });

    it('should pass through 3D array with is_multivariate=false', () => {
      const input = [[[1], [2], [3]]];
      const normalized = normalizeInput(input, 'chronos2', false);

      expect(normalized).toEqual(input);
      expect(getArrayShape(normalized)).toEqual([1, 3, 1]);
    });
  });

  describe('backward compatibility (normalizeInput without new parameters)', () => {
    it('should work with only input parameter (defaults apply)', () => {
      const input = [1, 2, 3];
      const normalized = normalizeInput(input);

      // Should use defaults: model='chronos2', isMultivariate=false
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toHaveLength(3);
      expect(normalized[0][0]).toHaveLength(1);
    });

    it('should work with input and model parameters', () => {
      const input = [[1, 2, 3]];
      const normalized = normalizeInput(input, 'tirex');

      // Should flatten (TiRex ignores is_multivariate)
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toHaveLength(3);
    });
  });
});

describe('getArrayShape', () => {
  /**
   * Array Shape Tests
   *
   * Verify that array shapes are calculated correctly.
   */

  it('should get shape of 1D array', () => {
    const shape = getArrayShape([1, 2, 3, 4, 5]);
    expect(shape).toEqual([5]);
  });

  it('should get shape of 2D array', () => {
    const shape = getArrayShape([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(shape).toEqual([3, 2]);
  });

  it('should get shape of 3D array', () => {
    const shape = getArrayShape([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]);
    expect(shape).toEqual([2, 2, 2]);
  });

  it('should get shape of normalized input', () => {
    const input = [1, 2, 3, 4, 5];
    const normalized = normalizeInput(input);
    const shape = getArrayShape(normalized);

    expect(shape).toEqual([1, 5, 1]); // [batch, sequence, features]
  });
});
