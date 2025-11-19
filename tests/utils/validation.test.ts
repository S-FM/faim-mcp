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
      x: [[1, 2], [3, 4], [5, 6]],
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
    expect(error).not.toBeNull();
    expect(error?.error_code).toBe('MISSING_REQUIRED_FIELD');
    expect(error?.field).toBe('model');
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
      horizon: 10000,
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

  it('should normalize 2D array (multivariate) to 3D', () => {
    const input = [[1, 2], [3, 4], [5, 6]];
    const normalized = normalizeInput(input);

    expect(normalized).toHaveLength(1); // batch size 1
    expect(normalized[0]).toHaveLength(3); // 3 time steps
    expect(normalized[0][0]).toHaveLength(2); // 2 features
    expect(normalized[0][0]).toEqual([1, 2]);
  });

  it('should pass through already 3D array', () => {
    const input = [[[1], [2], [3]]];
    const normalized = normalizeInput(input);

    expect(normalized).toEqual(input);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toHaveLength(3);
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
    const shape = getArrayShape([[1, 2], [3, 4], [5, 6]]);
    expect(shape).toEqual([3, 2]);
  });

  it('should get shape of 3D array', () => {
    const shape = getArrayShape([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]);
    expect(shape).toEqual([2, 2, 2]);
  });

  it('should get shape of normalized input', () => {
    const input = [1, 2, 3, 4, 5];
    const normalized = normalizeInput(input);
    const shape = getArrayShape(normalized);

    expect(shape).toEqual([1, 5, 1]); // [batch, sequence, features]
  });
});
