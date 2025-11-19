/**
 * Input Validation and Normalization
 *
 * This module handles all input validation for the MCP tools.
 *
 * Key Responsibilities:
 * 1. Validate that inputs are in valid ranges and formats
 * 2. Normalize arrays from user-friendly formats (1D, 2D) to SDK format (3D)
 * 3. Validate quantile values are in [0, 1] range
 * 4. Provide clear error messages for validation failures
 *
 * Why separate validation?
 * - Complex logic is easier to test in isolation
 * - Reusable across multiple tools
 * - Clear separation of concerns
 *
 * LLM Context: This module ensures that by the time data reaches the SDK,
 * it's guaranteed to be in a valid format. This prevents cryptic errors
 * from the SDK and provides better user experience.
 */

import { ErrorResponse } from '../types.js';

/**
 * Validates a forecast request before sending to the SDK
 *
 * This comprehensive validation:
 * - Checks model name is valid
 * - Validates array dimensions and values
 * - Ensures horizon is positive
 * - Validates quantiles are in [0, 1]
 * - Checks for empty or null inputs
 *
 * Returns early with detailed error messages instead of throwing,
 * allowing the caller to return error to Claude without crashing.
 *
 * @param request - The forecast request to validate
 * @returns {null | ErrorResponse} null if valid, error object if invalid
 *
 * Example:
 * ```typescript
 * const error = validateForecastRequest(request);
 * if (error) {
 *   return { success: false, error };
 * }
 * ```
 */
export function validateForecastRequest(request: unknown): ErrorResponse | null {
  // Check if request is even an object
  if (!request || typeof request !== 'object') {
    return {
      error_code: 'INVALID_REQUEST',
      message: 'Request must be a valid object',
      field: 'root',
    };
  }

  const req = request as Record<string, unknown>;

  // Validate model field
  if (!req.model) {
    return {
      error_code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: model',
      field: 'model',
    };
  }

  if (typeof req.model !== 'string' || !['chronos2', 'tirex'].includes(req.model)) {
    return {
      error_code: 'INVALID_PARAMETER',
      message: 'Model must be either "chronos2" or "tirex"',
      field: 'model',
      details: `Got: ${req.model}`,
    };
  }

  // Validate horizon field
  if (req.horizon === undefined || req.horizon === null) {
    return {
      error_code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: horizon',
      field: 'horizon',
    };
  }

  if (typeof req.horizon !== 'number' || !Number.isFinite(req.horizon)) {
    return {
      error_code: 'INVALID_PARAMETER',
      message: 'Horizon must be a finite number',
      field: 'horizon',
      details: `Got: ${req.horizon}`,
    };
  }

  if (req.horizon <= 0) {
    return {
      error_code: 'INVALID_VALUE_RANGE',
      message: 'Horizon must be greater than 0',
      field: 'horizon',
      details: `Got: ${req.horizon}`,
    };
  }

  // Reasonable upper bound for horizon (prevent memory exhaustion)
  if (req.horizon > 10000) {
    return {
      error_code: 'INVALID_VALUE_RANGE',
      message: 'Horizon is too large. Maximum supported is 10000',
      field: 'horizon',
      details: `Got: ${req.horizon}`,
    };
  }

  // Validate x (time series data)
  if (!req.x) {
    return {
      error_code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: x (time series data)',
      field: 'x',
    };
  }

  // Validate x is an array-like structure
  const xError = validateArrayInput(req.x);
  if (xError) {
    return {
      error_code: xError.error_code,
      message: xError.message,
      field: 'x',
      details: xError.details,
    };
  }

  // Validate output_type if provided
  if (req.output_type !== undefined && req.output_type !== null) {
    if (typeof req.output_type !== 'string') {
      return {
        error_code: 'INVALID_PARAMETER',
        message: 'output_type must be a string',
        field: 'output_type',
      };
    }

    if (!['point', 'quantiles', 'samples'].includes(req.output_type)) {
      return {
        error_code: 'INVALID_PARAMETER',
        message: 'output_type must be one of: point, quantiles, samples',
        field: 'output_type',
        details: `Got: ${req.output_type}`,
      };
    }
  }

  // Validate quantiles if provided
  if (req.quantiles !== undefined && req.quantiles !== null) {
    if (!Array.isArray(req.quantiles)) {
      return {
        error_code: 'INVALID_PARAMETER',
        message: 'quantiles must be an array',
        field: 'quantiles',
      };
    }

    if (req.quantiles.length === 0) {
      return {
        error_code: 'INVALID_VALUE_RANGE',
        message: 'quantiles array must not be empty',
        field: 'quantiles',
      };
    }

    // Check each quantile value
    for (let i = 0; i < req.quantiles.length; i++) {
      const q = req.quantiles[i];
      if (typeof q !== 'number' || !Number.isFinite(q)) {
        return {
          error_code: 'INVALID_PARAMETER',
          message: `quantiles[${i}] must be a finite number`,
          field: 'quantiles',
          details: `Got: ${q}`,
        };
      }

      if (q < 0 || q > 1) {
        return {
          error_code: 'INVALID_VALUE_RANGE',
          message: `quantiles[${i}] must be between 0 and 1`,
          field: 'quantiles',
          details: `Got: ${q}`,
        };
      }
    }
  }

  // All validations passed
  return null;
}

/**
 * Validates that input is an array-like structure
 * Accepts 1D, 2D, or 3D arrays of numbers
 *
 * @internal Internal helper for validateForecastRequest
 */
function validateArrayInput(x: unknown): { error_code: string; message: string; details?: string } | null {
  if (!Array.isArray(x)) {
    return {
      error_code: 'INVALID_PARAMETER',
      message: 'Time series data must be an array',
      details: `Got: ${typeof x}`,
    };
  }

  if (x.length === 0) {
    return {
      error_code: 'INVALID_VALUE_RANGE',
      message: 'Time series data array cannot be empty',
    };
  }

  // Check first element to determine array depth
  const first = x[0];

  // 1D array: [1, 2, 3]
  if (typeof first === 'number') {
    // All elements should be numbers
    for (let i = 0; i < x.length; i++) {
      if (typeof x[i] !== 'number' || !Number.isFinite(x[i])) {
        return {
          error_code: 'INVALID_PARAMETER',
          message: `x[${i}] must be a finite number`,
          details: `Got: ${x[i]}`,
        };
      }
    }
    return null;
  }

  // 2D or 3D array
  if (Array.isArray(first)) {
    // Check each row/batch
    for (let i = 0; i < x.length; i++) {
      const row = (x as unknown[])[i];
      if (!Array.isArray(row)) {
        return {
          error_code: 'INVALID_PARAMETER',
          message: `x[${i}] must be an array`,
          details: `Got: ${typeof row}`,
        };
      }

      if (row.length === 0) {
        return {
          error_code: 'INVALID_VALUE_RANGE',
          message: `x[${i}] cannot be an empty array`,
        };
      }

      // Check if this is 2D or 3D
      const firstInRow = row[0];
      if (typeof firstInRow === 'number') {
        // 2D array: validate all are numbers
        for (let j = 0; j < row.length; j++) {
          if (typeof row[j] !== 'number' || !Number.isFinite(row[j])) {
            return {
              error_code: 'INVALID_PARAMETER',
              message: `x[${i}][${j}] must be a finite number`,
              details: `Got: ${row[j]}`,
            };
          }
        }
      } else if (Array.isArray(firstInRow)) {
        // 3D array: validate structure
        for (let j = 0; j < row.length; j++) {
          const innerRow = row[j];
          if (!Array.isArray(innerRow)) {
            return {
              error_code: 'INVALID_PARAMETER',
              message: `x[${i}][${j}] must be an array`,
              details: `Got: ${typeof innerRow}`,
            };
          }

          for (let k = 0; k < innerRow.length; k++) {
            if (typeof innerRow[k] !== 'number' || !Number.isFinite(innerRow[k])) {
              return {
                error_code: 'INVALID_PARAMETER',
                message: `x[${i}][${j}][${k}] must be a finite number`,
                details: `Got: ${innerRow[k]}`,
              };
            }
          }
        }
      } else {
        return {
          error_code: 'INVALID_PARAMETER',
          message: `x[${i}][0] must be either a number or an array`,
          details: `Got: ${typeof firstInRow}`,
        };
      }
    }
    return null;
  }

  return {
    error_code: 'INVALID_PARAMETER',
    message: 'Time series data must be an array of numbers or nested arrays',
    details: `First element is: ${typeof first}`,
  };
}

/**
 * Normalizes user input arrays to 3D format required by SDK
 *
 * The FAIM SDK expects data in shape [batch, sequence_length, num_features]:
 * - batch: Multiple independent time series (typically 1 for single forecast)
 * - sequence_length: Number of historical steps
 * - num_features: Number of variables (1 for univariate, >1 for multivariate)
 *
 * This function accepts user-friendly formats:
 * - 1D [1, 2, 3] → [[[1], [2], [3]]]
 * - 2D [[1, 2], [3, 4]] → [[[1, 2], [3, 4]]] (multivariate)
 * - 3D (already correct) → unchanged
 *
 * @param input - Raw input from user (1D, 2D, or 3D array)
 * @returns {number[][][]} Normalized 3D array
 *
 * Example:
 * ```typescript
 * normalizeInput([1, 2, 3, 4, 5]) // → [[[1], [2], [3], [4], [5]]]
 * ```
 */
export function normalizeInput(input: number[] | number[][] | number[][][]): number[][][] {
  // Already 3D? Return as-is
  if (Array.isArray(input[0]) && Array.isArray(input[0][0])) {
    return input as number[][][];
  }

  // 1D array [1, 2, 3]
  if (typeof input[0] === 'number') {
    // Convert each scalar to a 1-element array [n] → [[n]]
    // Then wrap in batch dimension [[[1], [2], [3]]]
    return [(input as number[]).map((val) => [val])];
  }

  // 2D array [[1, 2], [3, 4]] - each row is a timestep with features
  // Wrap in batch dimension: [[[1, 2], [3, 4]]]
  return [input as number[][]];
}

/**
 * Gets the shape of an array (similar to numpy/PyTorch shape)
 *
 * Useful for debugging and logging to understand data structure.
 *
 * @param array - The array to get shape of
 * @returns {number[]} Array of dimensions
 *
 * Example:
 * ```typescript
 * getArrayShape([[[1, 2], [3, 4]]]) // → [1, 2, 2]
 * ```
 */
export function getArrayShape(array: unknown[]): number[] {
  const shape: number[] = [];
  let current: unknown = array;

  while (Array.isArray(current) && current.length > 0) {
    shape.push(current.length);
    current = current[0];
  }

  return shape;
}
