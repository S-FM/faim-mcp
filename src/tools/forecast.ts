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
 * Note: Input validation is handled by Zod schemas in index.ts.
 * This function receives pre-validated arguments.
 */

import { ForecastRequest, ForecastResponse, ToolResult } from '../types.js';
import { getClient } from '../utils/client.js';
import { normalizeInput, getArrayShape } from '../utils/validation.js';
import { transformError } from '../utils/errors.js';

/**
 * Implementation of the forecast tool
 *
 * This function:
 * 1. Normalizes input arrays to the SDK format
 * 2. Calls the appropriate SDK method (Chronos2 or TiRex)
 * 3. Transforms the response into ForecastResponse format
 * 4. Handles errors gracefully
 *
 * Note: Input validation is performed by Zod at the SDK layer.
 * This function can assume all inputs are valid.
 *
 * @param request - Pre-validated forecast request
 * @returns {Promise<ToolResult<ForecastResponse>>} Either success with predictions or error
 */
export async function forecast(
  request: unknown
): Promise<ToolResult<ForecastResponse>> {
  try {
    // Cast to typed request (already validated by Zod at SDK layer)
    const forecastRequest = request as ForecastRequest;

    // Handle case where x might be passed as a JSON string (e.g., from Claude XML)
    let xData = forecastRequest.x;
    if (typeof xData === 'string') {
      try {
        xData = JSON.parse(xData);
      } catch (e) {
        throw new Error(`Failed to parse x parameter as JSON: ${(e as Error).message}`);
      }
    }

    // Normalize input array to 3D format
    // Users can pass 1D or 2D arrays; we convert to SDK's required 3D format
    const normalizedX = normalizeInput(xData as number[] | number[][] | number[][][]);
    const outputShape = getArrayShape(normalizedX);


    // Get the FAIM client (singleton initialized at server startup)
    const client = getClient();

    // Call the appropriate SDK method
    const startTime = Date.now();
    let result;

    if (forecastRequest.model === 'chronos2') {
      result = await client.forecastChronos2({
        x: normalizedX,
        horizon: forecastRequest.horizon,
        output_type: forecastRequest.output_type || 'point',
        quantiles: forecastRequest.quantiles,
      });
    } else if (forecastRequest.model === 'tirex') {
      result = await client.forecastTiRex({
        x: normalizedX,
        horizon: forecastRequest.horizon,
        output_type: forecastRequest.output_type || 'point',
        ...(forecastRequest.quantiles ? { quantiles: forecastRequest.quantiles } : {}),
      } as any);
    } else {
      // Should never happen due to Zod validation
      throw new Error(`Unknown model: ${forecastRequest.model}`);
    }

    const duration = Date.now() - startTime;

    // Check if SDK call was successful
    if (!result.success) {
      return {
        success: false,
        error: transformError(result.error, {
          operation: `${forecastRequest.model} forecast`,
        }),
      };
    }

    // Transform SDK response to our format
    const sdkResponse = result.data;
    const outputType = forecastRequest.output_type || 'point';

    // Extract forecast data based on output type
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

    // Build the response
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


    return {
      success: true,
      data: response,
    };
  } catch (error) {
    // Catch all errors and transform to user-friendly format
    return {
      success: false,
      error: transformError(error, { operation: 'forecast' }),
    };
  }
}
