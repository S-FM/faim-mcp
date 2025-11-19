/**
 * List Models Tool
 *
 * MCP Tool that returns the available forecasting models and their capabilities.
 *
 * This is a simple, stateless tool that doesn't require API calls.
 * It provides Claude with information about what models are available
 * and what they can do, helping Claude choose the right model for the task.
 *
 * Tool Definition for MCP:
 * - Name: list_models
 * - Input: None
 * - Output: Array of available models with their capabilities
 *
 * LLM Context: This tool is useful for Claude to:
 * 1. Understand what models are available
 * 2. Choose between Chronos2 and TiRex for different tasks
 * 3. Understand supported output types (point, quantiles, samples)
 * 4. Learn about model limitations and best practices
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
 *
 * Implementation Notes:
 * - No external API calls required
 * - No authentication needed
 * - Always returns the same data (could be cached)
 * - Can be called anytime for introspection
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
        supportedOutputTypes: ['point', 'quantiles', 'samples'],
        supportsQuantiles: true,
      },
      {
        /**
         * TiRex Model
         *
         * An alternative time series forecasting model with different
         * architecture and characteristics from Chronos2.
         *
         * Use TiRex when:
         * - You want to ensemble predictions from multiple models
         * - You're comparing different forecasting approaches
         * - You have specific requirements that favor TiRex's architecture
         *
         * Note: Check API documentation for specific capabilities and differences
         */
        id: 'tirex',
        name: 'TiRex',
        version: '1.0',
        description:
          'Alternative time series forecasting model. Provides a different architectural approach compared to Chronos2. Useful for ensemble forecasting and comparing multiple model perspectives.',
        supportedOutputTypes: ['point', 'quantiles', 'samples'],
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

/**
 * MCP Tool Schema for list_models
 *
 * This describes the tool for the MCP server.
 * MCP uses this to validate inputs and display tool info to Claude.
 *
 * Exported as a constant so the server can register it.
 */
export const LIST_MODELS_TOOL = {
  name: 'list_models',
  description:
    'List all available forecasting models and their capabilities. Returns information about Chronos2, TiRex, and other available models, including supported output types and features.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};
