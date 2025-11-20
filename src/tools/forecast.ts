/**
 * Forecast Tool
 *
 * MCP Tool that performs time series forecasting using FAIM models.
 *
 * This is the main tool for forecasting. It supports:
 * - Multiple models (Chronos2, TiRex)
 * - Multiple output types (point, quantiles)
 * - Flexible input formats (1D, 2D, 3D arrays)
 * - Custom quantiles for probabilistic forecasting
 *
 * Tool Definition for MCP:
 * - Name: forecast
 * - Input: ForecastRequest (model, x, horizon, output_type, quantiles)
 * - Output: ForecastResponse with predictions and metadata
 *
 * LLM Context: This is Claude's main interface to the FAIM forecasting API.
 * Claude can use this to:
 * 1. Make point forecasts (single value predictions)
 * 2. Generate confidence intervals (quantile forecasting)
 * 3. Perform ensemble forecasting (compare multiple models)
 * 4. Analyze forecast uncertainty
 */

import { ForecastRequest, ForecastResponse, ToolResult } from '../types.js';
import { getClient } from '../utils/client.js';
import { validateForecastRequest, normalizeInput, getArrayShape } from '../utils/validation.js';
import { transformError } from '../utils/errors.js';

/**
 * Implementation of the forecast tool
 *
 * This function:
 * 1. Validates the forecast request
 * 2. Normalizes input arrays to the SDK format
 * 3. Calls the appropriate SDK method (Chronos2 or TiRex)
 * 4. Transforms the response into ForecastResponse format
 * 5. Handles errors and returns them gracefully
 *
 * Never throws - always returns a ToolResult<ForecastResponse> with
 * either successful data or an error object.
 *
 * @param request - The forecast request with model, data, and parameters
 * @returns {Promise<ToolResult<ForecastResponse>>} Either success with predictions or error
 *
 * Example:
 * ```typescript
 * const result = await forecast({
 *   model: 'chronos2',
 *   x: [1, 2, 3, 4, 5],
 *   horizon: 10,
 *   output_type: 'point'
 * });
 *
 * if (result.success) {
 *   console.log(result.data.forecast.point);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export async function forecast(
  request: unknown
): Promise<ToolResult<ForecastResponse>> {
  try {
    // Step 1: Validate the request
    // This checks all inputs before making any API calls
    const validationError = validateForecastRequest(request);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    // Type-safe cast after validation
    const forecastRequest = request as ForecastRequest;

    // Step 2: Normalize input array to 3D format
    // Users can pass 1D or 2D arrays; we convert to SDK's required 3D format
    const normalizedX = normalizeInput(forecastRequest.x);
    const outputShape = getArrayShape(normalizedX);

    // Log the operation for debugging
    console.log(`Forecast request: model=${forecastRequest.model}, horizon=${forecastRequest.horizon}, output_type=${forecastRequest.output_type || 'point'}`);

    // Step 3: Get the FAIM client
    // This is a singleton initialized at server startup
    const client = getClient();

    // Step 4: Call the appropriate SDK method
    const startTime = Date.now();
    let result;

    if (forecastRequest.model === 'chronos2') {
      /**
       * Chronos2 Forecast
       *
       * The SDK method returns a Result<ForecastResponse> type:
       * - success: true, data: ForecastResponsePoint | ForecastResponseQuantiles
       * - success: false, error: APIError
       *
       * We need to check the success field before accessing data.
       */
      result = await client.forecastChronos2({
        x: normalizedX,
        horizon: forecastRequest.horizon,
        output_type: forecastRequest.output_type || 'point',
        quantiles: forecastRequest.quantiles,
      });
    } else if (forecastRequest.model === 'tirex') {
      /**
       * TiRex Forecast
       *
       * Similar structure to Chronos2 but may have different parameter support.
       * We pass quantiles if provided and output_type is 'quantiles'.
       */
      result = await client.forecastTiRex({
        x: normalizedX,
        horizon: forecastRequest.horizon,
        output_type: forecastRequest.output_type || 'point',
        ...(forecastRequest.quantiles ? { quantiles: forecastRequest.quantiles } : {}),
      } as any);
    } else {
      // Should never happen due to validation, but type safety
      return {
        success: false,
        error: {
          error_code: 'INVALID_PARAMETER',
          message: `Unknown model: ${forecastRequest.model}`,
          field: 'model',
        },
      };
    }

    const duration = Date.now() - startTime;

    // Step 5: Check if SDK call was successful
    if (!result.success) {
      // SDK returned an error
      return {
        success: false,
        error: transformError(result.error, {
          operation: `${forecastRequest.model} forecast`,
          field: 'model',
        }),
      };
    }

    // Step 6: Transform SDK response to our format
    // The SDK returns different structures based on output_type
    const sdkResponse = result.data;
    const outputType = forecastRequest.output_type || 'point';

    // Extract forecast data based on output type
    // The SDK response outputs object varies by output_type
    let forecastData: any;
    let outputArrayShape: number[];

    if (outputType === 'point') {
      const point = (sdkResponse.outputs as any).point as number[][][];
      forecastData = { point };
      outputArrayShape = getArrayShape(point);
    } else if (outputType === 'quantiles') {
      const quantiles = (sdkResponse.outputs as any).quantiles as number[][][][];
      forecastData = { quantiles };
      outputArrayShape = getArrayShape(quantiles);
    } else {
      throw new Error(`Unexpected output type: ${outputType}`);
    }

    // Step 7: Build the response
    const response: ForecastResponse = {
      model_name: sdkResponse.metadata.model_name,
      model_version: sdkResponse.metadata.model_version,
      output_type: outputType,
      forecast: forecastData as any,
      metadata: {
        token_count: sdkResponse.metadata.token_count,
        duration_ms: duration,
      },
      shape_info: {
        input_shape: outputShape as [number, number, number],
        output_shape: outputArrayShape,
      },
    };

    // Log successful forecast
    console.log(`Forecast completed successfully: ${duration}ms, tokens=${sdkResponse.metadata.token_count}`);

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    /**
     * Error Handling
     *
     * We catch all errors here and transform them into ErrorResponse format.
     * This ensures Claude always gets a valid response structure, never a thrown error.
     *
     * The transformError function classifies the error and provides helpful suggestions.
     */
    console.error('Forecast tool error:', error);

    return {
      success: false,
      error: transformError(error, { operation: 'forecast' }),
    };
  }
}

/**
 * MCP Tool Schema for forecast
 *
 * This describes the tool to the MCP server.
 * The server uses this to validate inputs and display help to Claude.
 *
 * The inputSchema follows JSON Schema format and describes:
 * - Required fields: model, x, horizon
 * - Optional fields: output_type, quantiles
 * - Field types and constraints
 */
export const FORECAST_TOOL = {
  name: 'forecast',
  description:
    'Perform time series forecasting using FAIM models. Supports both point forecasting (single value) and probabilistic forecasting (confidence intervals). Can handle univariate and multivariate time series data.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      model: {
        type: 'string',
        enum: ['chronos2', 'tirex'],
        description:
          'The forecasting model to use. Chronos2 is the general-purpose model. TiRex is an alternative with different characteristics.',
      },
      x: {
        description:
          'Time series data to forecast from. Can be a 1D array (single series), 2D array (multiple series or multivariate), or 3D array. 1D example: [1,2,3,4,5]. 2D example: [[1,2],[3,4],[5,6]].',
        oneOf: [
          {
            type: 'array',
            items: { type: 'number' },
            description: '1D array: single univariate time series',
          },
          {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
            },
            description: '2D array: multiple timesteps with features',
          },
          {
            type: 'array',
            items: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'number' },
              },
            },
            description: '3D array: batch of time series',
          },
        ],
      },
      horizon: {
        type: 'number',
        description:
          'Number of time steps to forecast into the future. Must be a positive integer. Example: 10 means predict the next 10 steps.',
      },
      output_type: {
        type: 'string',
        enum: ['point', 'quantiles'],
        default: 'point',
        description:
          'Type of forecast output. "point" = single value per step (fastest). "quantiles" = confidence intervals (use for uncertainty).',
      },
      quantiles: {
        type: 'array',
        items: { type: 'number' },
        description:
          'Quantile levels to compute (only used with output_type="quantiles"). Values between 0 and 1. Example: [0.1, 0.5, 0.9] for 10th, 50th, 90th percentiles.',
      },
    },
    required: ['model', 'x', 'horizon'],
  },
};
