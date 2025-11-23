/**
 * List Models Tool
 *
 * MCP Tool that returns the available forecasting models and their capabilities.
 *
 * This is a simple, stateless tool that doesn't require API calls.
 * It provides Claude with information about what models are available
 * and what they can do, helping Claude choose the right model for the task.
 *
 * Implementation Notes:
 * - No external API calls required
 * - No authentication needed
 * - Always returns the same data (could be cached)
 * - Can be called anytime for introspection
 */

import { ListModelsResponse, ModelInfo, ToolResult } from '../types.js';

/**
 * Implementation of the list_models tool
 *
 * Returns information about all available forecasting models.
 * Currently supported models:
 * - Chronos2: General-purpose forecasting, supports all output types
 * - TiRex: Alternative model (specifications depend on API)
 *
 * This function is synchronous and doesn't require API calls,
 * making it very fast and reliable.
 *
 * @returns {ToolResult<ListModelsResponse>} A successful result containing model list
 */
export async function listModels(): Promise<ToolResult<ListModelsResponse>> {
  try {
    // Define available models and their capabilities
    // These are based on the FAIM API's actual capabilities
    const models: ModelInfo[] = [
      {
        /**
         * Chronos2 Model
         *
         * A state-of-the-art time series forecasting model that handles:
         * - Univariate (single variable) and multivariate (multiple variables) data
         * - Both point forecasting and probabilistic (quantile) forecasting
         * - Flexible forecast horizons from short-term to long-term
         *
         * Best for:
         * - General-purpose time series forecasting
         * - When you need confidence intervals (quantile forecasting)
         * - Both univariate and multivariate time series
         *
         * Characteristics:
         * - Trained on diverse time series data
         * - Handles various seasonal and trend patterns
         * - Supports custom quantiles for risk assessment
         */
        id: 'chronos2',
        name: 'Chronos2',
        version: '1.0',
        description:
          'State-of-the-art general-purpose time series forecasting model. Supports both point and probabilistic (quantile) forecasting. Best for univariate and multivariate time series with various seasonal and trend patterns.',
        supportedOutputTypes: ['point', 'quantiles'],
        supportsQuantiles: true,
      },
      {
        /**
         * TiRex Model
         *
         * An alternative time series forecasting model optimized for speed
         * with different architecture and characteristics from Chronos2.
         *
         * Best for:
         * - Fast inference on univariate time series
         * - Ensemble forecasting with multiple models
         * - Comparing different forecasting approaches
         *
         * Capabilities:
         * - Univariate time series only (single variable)
         * - Point and quantile forecasting
         * - Supports default quantiles [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
         * - Does not support custom quantiles
         *
         * Note: TiRex is faster but less flexible than Chronos2
         */
        id: 'tirex',
        name: 'TiRex',
        version: '1.0',
        description:
          'Fast alternative time series forecasting model optimized for univariate series. Supports point and quantile forecasting with default quantiles. Useful for ensemble forecasting and rapid inference on single-variable time series.',
        supportedOutputTypes: ['point', 'quantiles'],
        supportsQuantiles: true,
      },
    ];

    // Create the response
    const response: ListModelsResponse = {
      models,
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    // Should never happen since this is stateless, but handle gracefully
    console.error('Unexpected error in listModels:', error);

    return {
      success: false,
      error: {
        error_code: 'INTERNAL_ERROR',
        message: 'Failed to list available models',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
