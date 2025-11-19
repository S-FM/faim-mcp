/**
 * Type Definitions for FAIM MCP Server
 *
 * This file defines the core TypeScript interfaces used throughout the MCP server.
 * These types ensure type safety and provide clear contracts for:
 * - MCP tool inputs and outputs
 * - Internal data structures
 * - Error handling
 *
 * LLM Context: These types act as a specification for what data flows through
 * the system and help ensure consistency between tools.
 */

/**
 * Represents a single forecasting model available in the FAIM API
 *
 * Each model has different capabilities and performance characteristics:
 * - Chronos2: General purpose, supports both point and quantile forecasting
 * - TiRex: Alternative model with different accuracy/speed tradeoffs
 */
export interface ModelInfo {
  /** Unique identifier for the model (e.g., "chronos2", "tirex") */
  id: string;

  /** Display name of the model */
  name: string;

  /** Current version of the model deployment */
  version: string;

  /** Description of what this model does */
  description: string;

  /** List of supported output types for this model */
  supportedOutputTypes: OutputType[];

  /** Whether this model supports custom quantiles */
  supportsQuantiles: boolean;
}

/**
 * Type of output the forecasting model should produce
 *
 * - "point": Single scalar point estimate for each forecast step
 * - "quantiles": Multiple quantile levels (e.g., 0.1, 0.5, 0.9 for confidence intervals)
 * - "samples": Multiple sample draws from the forecast distribution
 */
export type OutputType = 'point' | 'quantiles' | 'samples';

/**
 * Input parameters for the unified forecast tool
 *
 * This represents the complete set of options users can pass to perform
 * a forecast. The tool validates these inputs before passing to the SDK.
 *
 * LLM Context: When Claude calls the forecast tool, it will structure
 * the request according to these fields.
 */
export interface ForecastRequest {
  /**
   * Which forecasting model to use
   * - "chronos2": General purpose time series forecasting
   * - "tirex": Alternative model
   */
  model: 'chronos2' | 'tirex';

  /**
   * Time series data to forecast from
   *
   * Can be provided in multiple formats:
   * - 1D array: [1, 2, 3, 4, 5] (single univariate series)
   * - 2D array: [[1, 2, 3], [4, 5, 6]] (multiple series or multivariate)
   * - 3D array: [[[1], [2], [3]]] (explicit batch/sequence/feature format)
   *
   * The tool automatically normalizes input to the required 3D format.
   * See src/utils/validation.ts for normalization details.
   */
  x: number[] | number[][] | number[][][];

  /**
   * Number of steps to forecast into the future
   *
   * Example: horizon: 10 means predict the next 10 time steps
   * Constraints:
   * - Must be positive (> 0)
   * - Should be reasonable (typically 1-365 for daily data)
   * - Larger horizons may have lower accuracy
   */
  horizon: number;

  /**
   * Type of output to generate
   *
   * - "point": Single best estimate (fastest, smallest output)
   * - "quantiles": Multiple confidence levels for uncertainty quantification
   * - "samples": Multiple draws from distribution (for uncertainty analysis)
   *
   * Default: "point"
   */
  output_type?: OutputType;

  /**
   * Custom quantile levels to compute (only used when output_type is "quantiles")
   *
   * Values must be between 0 and 1. Examples:
   * - [0.1, 0.5, 0.9]: 10th, 50th (median), 90th percentiles
   * - [0.025, 0.975]: 95% confidence interval
   * - [0.5]: Just the median
   *
   * Default if not provided: [0.1, 0.5, 0.9]
   */
  quantiles?: number[];
}

/**
 * Individual output element from a single forecast
 *
 * For point forecasts: { point: number[] }
 * For quantile forecasts: { quantiles: number[][] }
 * For sample forecasts: { samples: number[][] }
 */
export type ForecastOutput =
  | { point: number[][][] }
  | { quantiles: number[][][][] }
  | { samples: number[][][][] };

/**
 * Complete response from a successful forecast operation
 *
 * This is what the forecast tool returns to Claude after successful prediction
 *
 * LLM Context: This structure is what Claude receives and can interpret.
 * The arrays are structured to be easy to understand and convert back
 * to the original data format if needed.
 */
export interface ForecastResponse {
  /** The model that performed the forecast */
  model_name: string;

  /** Version of the model used */
  model_version: string;

  /** Type of output that was generated */
  output_type: OutputType;

  /** The actual forecast predictions (structure depends on output_type) */
  forecast: ForecastOutput;

  /** Metadata about the forecasting operation */
  metadata: {
    /** Number of tokens consumed by this request (billing metric) */
    token_count: number;

    /** Time taken to complete the request in milliseconds */
    duration_ms: number;
  };

  /** Information about input/output array shapes for debugging */
  shape_info: {
    /** Shape of input: [batch, sequence_length, num_features] */
    input_shape: [number, number, number];

    /** Shape of output: [batch, horizon, num_features] (or with quantiles/samples dimension) */
    output_shape: number[];
  };
}

/**
 * Error response when something goes wrong
 *
 * All tools can return errors. This interface normalizes errors
 * from the FAIM SDK into a consistent format.
 */
export interface ErrorResponse {
  /** Error code identifying the type of error */
  error_code: string;

  /** Human-readable error message */
  message: string;

  /** Additional details that might help debug the issue */
  details?: string;

  /** Which field or parameter caused the error (if applicable) */
  field?: string;
}

/**
 * Generic result type for MCP tool responses
 *
 * All tools return either success or failure, never throwing.
 * This allows Claude to handle errors gracefully without crashes.
 *
 * LLM Context: MCP tools should never throw errors - they should
 * always return a Result with either data or an error object.
 */
export type ToolResult<T> = Success<T> | Failure;

interface Success<T> {
  success: true;
  data: T;
}

interface Failure {
  success: false;
  error: ErrorResponse;
}

/**
 * Response from the list_models tool
 *
 * Simple tool that doesn't require API calls - just returns
 * what models are currently available and their capabilities.
 */
export interface ListModelsResponse {
  /** Array of available models */
  models: ModelInfo[];

  /** When this list was last updated */
  timestamp: string;
}
