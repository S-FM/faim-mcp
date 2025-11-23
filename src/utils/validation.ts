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
 * allowing the caller to return error to LLM without crashing.
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

  // Validate model field (optional, defaults to chronos2)
  if (req.model !== undefined && req.model !== null) {
    if (typeof req.model !== 'string' || !['chronos2', 'tirex'].includes(req.model)) {
      return {
        error_code: 'INVALID_PARAMETER',
        message: 'Model must be either "chronos2" or "tirex"',
        field: 'model',
        details: `Got: ${req.model}`,
      };
    }
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

  // Reasonable upper bound for horizon (API limit is 1024)
  if (req.horizon > 1024) {
    return {
      error_code: 'INVALID_VALUE_RANGE',
      message: 'Horizon is too large. Maximum supported is 1024',
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

  // Handle case where x is passed as a JSON string (e.g., from Claude Desktop)
  let xData = req.x;
  if (typeof xData === 'string') {
    try {
      xData = JSON.parse(xData);
    } catch (e) {
      return {
        error_code: 'INVALID_PARAMETER',
        message: 'x parameter must be an array. If passing as string, it must be valid JSON.',
        field: 'x',
        details: `Failed to parse x: ${(e as Error).message}`,
      };
    }
  }

  // Validate x is an array-like structure
  const xError = validateArrayInput(xData);
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

    if (!['point', 'quantiles'].includes(req.output_type)) {
      return {
        error_code: 'INVALID_PARAMETER',
        message: 'output_type must be one of: point, quantiles',
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
function validateArrayInput(
  x: unknown
): { error_code: string; message: string; details?: string } | null {
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
 * The FAIM SDK expects data in shape [batch, sequence_length, num_features] where:
 * - b (batch): Multiple independent time series (typically 1 for single forecast)
 * - c (sequence_length): Number of historical timesteps
 * - f (num_features): Number of variables (1 for univariate, >1 for multivariate)
 *
 * INPUT FORMATS ACCEPTED (all automatically converted to 3D):
 *
 * 1. 1D ARRAY - Univariate time series with shape (c,):
 *    Input:  [1, 2, 3, 4, 5]
 *    Meaning: 5 univariate timesteps
 *    Output: [[[1], [2], [3], [4], [5]]]  (shape: [1, 5, 1] = [b=1, c=5, f=1])
 *    Note: is_multivariate flag is ignored for 1D arrays
 *
 * 2D ARRAY HANDLING (Chronos2 model):
 *    With is_multivariate: false (default - batch inference):
 *    Input:  [[1, 2, 3, 4, 5]] (shape: [5, 1])
 *    Output: [[[1], [2], [3], [4], [5]]] (shape: [b=1, c=5, f=1])
 *    Interpretation: 5 timesteps, 1 feature (univariate)
 *
 *    With is_multivariate: true (multifeature inference):
 *    Input:  [[1, 2], [3, 4], [5, 6]] (shape: [3, 2])
 *    Output: [[[1, 2], [3, 4], [5, 6]]] (shape: [b=1, c=3, f=2])
 *    Interpretation: 3 timesteps, 2 features (multivariate)
 *
 *    For other models (TiRex): is_multivariate flag is ignored, defaults to batch inference
 *
 * 3. 3D ARRAY - Already in correct format with shape (b, c, f):
 *    Input:  [[[1], [2], [3]]]
 *    Meaning: 1 batch, 3 timesteps, 1 feature (univariate)
 *    Output: [[[1], [2], [3]]]  (unchanged, shape: [1, 3, 1])
 *    Note: is_multivariate flag is ignored for 3D arrays
 *
 *    Input:  [[[100, 50, 200], [102, 51, 205]]]
 *    Meaning: 1 batch, 2 timesteps, 3 features (multivariate)
 *    Output: [[[100, 50, 200], [102, 51, 205]]]  (unchanged, shape: [1, 2, 3])
 *
 * @param input - Raw input from user (1D, 2D, or 3D array)
 * @param model - The forecasting model (chronos2 or tirex)
 * @param isMultivariate - For 2D arrays with Chronos2: treat as multivariate (true) or batch (false, default)
 * @returns {number[][][]} Normalized 3D array with shape [b, c, f]
 *
 * Example (for LLMs):
 * ```typescript
 * // 1D input: Single univariate time series
 * normalizeInput([1, 2, 3, 4, 5], 'chronos2', false)
 * // Returns: [[[1], [2], [3], [4], [5]]]
 * // Shape: [b=1, c=5, f=1]
 *
 * // 2D input: Batch inference (default for 2D)
 * normalizeInput([[1, 2, 3]], 'chronos2', false)
 * // Returns: [[[1], [2], [3]]]
 * // Shape: [b=1, c=3, f=1] - treat as single sequence with 3 timesteps
 *
 * // 2D input: Multifeature inference (with is_multivariate=true)
 * normalizeInput([[1, 2], [3, 4]], 'chronos2', true)
 * // Returns: [[[1, 2], [3, 4]]]
 * // Shape: [b=1, c=2, f=2] - treat as 2 timesteps with 2 features each
 *
 * // 3D input: Already correct format (multivariate, single batch)
 * normalizeInput([[[100, 50], [102, 51], [105, 52]]], 'chronos2', false)
 * // Returns: [[[100, 50], [102, 51], [105, 52]]]  (unchanged)
 * // Shape: [b=1, c=3, f=2]
 * ```
 */
export function normalizeInput(
  input: number[] | number[][] | number[][][],
  model: string = 'chronos2',
  isMultivariate: boolean = false
): number[][][] {
  // Handle empty array edge case
  if (input.length === 0) {
    throw new Error('Time series data cannot be empty. Provide at least one value.');
  }

  // Already 3D? Return as-is (shape: [b, c, f])
  // is_multivariate flag is ignored for 3D arrays
  if (Array.isArray(input[0]) && Array.isArray(input[0][0])) {
    return input as number[][][];
  }

  // 1D array (shape: c,) - Univariate time series
  // Example: [1, 2, 3, 4, 5]
  // Transform to 3D: [[[1], [2], [3], [4], [5]]] (shape: [b=1, c=5, f=1])
  // is_multivariate flag is ignored for 1D arrays
  if (typeof input[0] === 'number') {
    // Convert each scalar to a 1-element array [n] → [[n]]
    // Then wrap in batch dimension [[[1], [2], [3]]]
    return [(input as number[]).map((val) => [val])];
  }

  // 2D array (shape: c, f or f, c) - Handling depends on model and is_multivariate flag
  // is_multivariate flag only applies to Chronos2 model
  if (Array.isArray(input[0])) {
    // For Chronos2 with is_multivariate=true: treat as multifeature inference
    // Input shape (c, f): timesteps × features
    // Output shape [b=1, c, f]: single batch with timesteps and features
    if (model === 'chronos2' && isMultivariate) {
      // Treat as multivariate: [[[feature1_t1, feature2_t1, ...], [feature1_t2, feature2_t2, ...], ...]]
      // Wrap in batch dimension
      return [input as number[][]];
    }

    // Default behavior (Chronos2 with is_multivariate=false, or TiRex, or any other model):
    // Treat as batch inference
    // Input shape (c,) or (n,): sequence of values
    // Output shape [b=1, c, f=1]: batch with timesteps and 1 feature
    // Flatten the 2D array to 1D and apply 1D transformation
    const flattened = (input as number[][]).flat();
    return [flattened.map((val) => [val])];
  }

  // Shouldn't reach here due to earlier checks
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
