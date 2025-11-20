/**
 * Error Handling and Transformation
 *
 * This module transforms errors from the FAIM SDK into consistent,
 * user-friendly error responses for the MCP tools.
 *
 * Key Responsibilities:
 * 1. Catch errors from SDK and external operations
 * 2. Classify errors (client error, server error, auth error, etc.)
 * 3. Transform SDK errors into ErrorResponse format
 * 4. Provide helpful error messages and suggestions
 * 5. Log errors for debugging and monitoring
 *
 * Error Flow:
 * SDK throws error → caught → analyzed → transformed → returned to Claude
 *
 * LLM Context: This module ensures errors are meaningful to Claude and humans
 * without exposing internal implementation details.
 */

import { ErrorResponse } from '../types.js';

/**
 * Represents the FAIM SDK error structure
 * This is what the SDK throws when something goes wrong
 */
interface FaimSDKError {
  error_code?: string;
  message?: string;
  detail?: string;
  request_id?: string;
  status?: number;
  [key: string]: unknown;
}

/**
 * Transforms any error into a consistent ErrorResponse format
 *
 * Handles:
 * - FAIM SDK errors (with error_code)
 * - Standard JavaScript errors
 * - Unknown error types
 * - Network errors
 * - Timeout errors
 *
 * This function never throws - it always returns an ErrorResponse.
 *
 * @param error - Any error object from the SDK or other sources
 * @param context - Additional context about where the error occurred
 * @returns {ErrorResponse} A normalized error response
 *
 * Example:
 * ```typescript
 * try {
 *   await client.forecastChronos2({...});
 * } catch (error) {
 *   const errorResponse = transformError(error, { operation: 'forecast' });
 *   return { success: false, error: errorResponse };
 * }
 * ```
 */
export function transformError(
  error: unknown,
  context?: { operation?: string; field?: string }
): ErrorResponse {
  // Handle FAIM SDK errors (they have error_code)
  if (isSDKError(error)) {
    return transformSDKError(error as FaimSDKError, context);
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    return transformJavaScriptError(error, context);
  }

  // Handle string errors (rare but possible)
  if (typeof error === 'string') {
    return {
      error_code: 'UNKNOWN_ERROR',
      message: error,
      details: context ? `Context: ${JSON.stringify(context)}` : undefined,
    };
  }

  // Unknown error type
  return {
    error_code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: `Error type: ${typeof error}, ${String(error)}`,
  };
}

/**
 * Transforms FAIM SDK errors into ErrorResponse format
 *
 * The SDK returns structured errors with:
 * - error_code: Machine-readable error type
 * - message: User-readable description
 * - detail: Additional information
 *
 * This function maps SDK error codes to helpful messages and
 * provides recovery suggestions where applicable.
 *
 * @internal Internal helper for transformError
 */
function transformSDKError(
  error: FaimSDKError,
  context?: { operation?: string; field?: string }
): ErrorResponse {
  const code = error.error_code || 'UNKNOWN_SDK_ERROR';
  const message = error.message || 'An error occurred in the FAIM SDK';

  // Build detailed error information
  const details: string[] = [];

  if (error.detail) {
    details.push(`Details: ${error.detail}`);
  }

  // Add recovery suggestions based on error code
  const suggestion = getSuggestionForErrorCode(code);
  if (suggestion) {
    details.push(`Suggestion: ${suggestion}`);
  }

  if (context?.operation) {
    details.push(`Operation: ${context.operation}`);
  }

  // Log the error for debugging
  logError(code, message, error);

  return {
    error_code: code,
    message: makeMessageFriendly(message, code),
    details: details.length > 0 ? details.join(' | ') : undefined,
    field: context?.field,
  };
}

/**
 * Transforms standard JavaScript errors
 *
 * Handles:
 * - Network errors (ECONNREFUSED, etc.)
 * - Timeout errors
 * - Type errors (programming bugs)
 * - Other standard errors
 *
 * @internal Internal helper for transformError
 */
function transformJavaScriptError(
  error: Error,
  context?: { operation?: string; field?: string }
): ErrorResponse {
  const message = error.message || 'Unknown error';

  // Build details with message and optional context
  const detailParts = [message];
  if (context?.operation) {
    detailParts.push(`Operation: ${context.operation}`);
  }
  const detailsString = detailParts.join(' | ');

  // Check for specific error types by message patterns
  if (isNetworkError(message)) {
    logError('NETWORK_ERROR', message, error);
    return {
      error_code: 'NETWORK_ERROR',
      message: 'Failed to connect to FAIM API. Please check your network connection.',
      details: detailsString,
      field: context?.field,
    };
  }

  if (isTimeoutError(message)) {
    logError('TIMEOUT_ERROR', message, error);
    return {
      error_code: 'TIMEOUT_ERROR',
      message: 'Request to FAIM API timed out. Try a smaller forecast or longer timeout.',
      details: detailsString,
      field: context?.field,
    };
  }

  // Programming error (shouldn't happen in production)
  if (error instanceof TypeError) {
    logError('TYPE_ERROR', message, error);
    return {
      error_code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal error occurred (type error). Please contact support.',
      details: detailsString,
      field: context?.field,
    };
  }

  // Generic JavaScript error
  logError('JAVASCRIPT_ERROR', message, error);
  return {
    error_code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: `${error.name}: ${detailsString}`,
    field: context?.field,
  };
}

/**
 * Checks if an unknown value is a FAIM SDK error object
 *
 * The SDK returns errors with at least an error_code
 * (or a plain object with error_code and message, but NOT an Error instance)
 *
 * @internal Type guard for SDK errors
 */
function isSDKError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // Don't treat JavaScript Error instances as SDK errors
  if (error instanceof Error) {
    return false;
  }

  const obj = error as Record<string, unknown>;
  // Must have error_code to be an SDK error
  return typeof obj.error_code === 'string';
}

/**
 * Checks if an error message indicates a network problem
 *
 * @internal Helper for error classification
 */
function isNetworkError(message: string): boolean {
  const networkPatterns = [
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'getaddrinfo',
    'connect',
  ];

  return networkPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Checks if an error message indicates a timeout
 *
 * @internal Helper for error classification
 */
function isTimeoutError(message: string): boolean {
  const timeoutPatterns = [
    'timeout',
    'timed out',
    'deadline exceeded',
  ];

  return timeoutPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Returns helpful suggestions for specific FAIM error codes
 *
 * Maps error codes to actionable recovery suggestions.
 *
 * @internal Helper to provide recovery guidance
 */
function getSuggestionForErrorCode(code: string): string | null {
  const suggestions: Record<string, string> = {
    INVALID_API_KEY: 'Make sure your FAIM_API_KEY environment variable is set correctly.',
    AUTHENTICATION_FAILED: 'Your API key is invalid or has expired. Please update it.',
    INSUFFICIENT_FUNDS: 'Your account has insufficient funds. Please add credits.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
    INVALID_SHAPE: 'The time series data has incorrect dimensions. Check the array structure.',
    INVALID_PARAMETER: 'One or more parameters is invalid. Check the error details.',
    TIMEOUT_ERROR: 'The request took too long. Try with less data or a shorter horizon.',
    OUT_OF_MEMORY: 'The request is too large for the model. Try smaller batches.',
    MODEL_NOT_FOUND: 'The specified model is not available. Check the model name.',
    RESOURCE_EXHAUSTED: 'The service is temporarily unavailable. Please try again later.',
  };

  return suggestions[code] || null;
}

/**
 * Makes error messages more friendly for end users
 *
 * Takes technical error messages and rewrites them to be clearer
 * and less scary while preserving the key information.
 *
 * @internal Helper to improve user experience
 */
function makeMessageFriendly(message: string, code: string): string {
  // Some error codes have standard friendly messages
  const friendlyMessages: Record<string, string> = {
    INVALID_API_KEY: 'Invalid API key provided',
    AUTHENTICATION_REQUIRED: 'Authentication required',
    VALIDATION_ERROR: 'Input validation failed',
    TIMEOUT_ERROR: 'Request timeout',
  };

  return friendlyMessages[code] || message;
}

/**
 * Logs errors for debugging and monitoring
 *
 * In production, this would send to a logging service.
 * For now, logs to console with context.
 *
 * @internal Internal logging helper
 */
function logError(code: string, message: string, originalError: unknown): void {
  // In development, always log
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${code}] ${message}`, originalError);
    return;
  }

  // In production, log only important errors
  const importantCodes = [
    'AUTHENTICATION_FAILED',
    'INTERNAL_SERVER_ERROR',
    'RESOURCE_EXHAUSTED',
  ];

  if (importantCodes.includes(code)) {
    console.error(`[${code}] ${message}`);
  }
}

/**
 * Type guard to check if an error is retryable
 *
 * Some errors are transient and might succeed on retry.
 * Others are permanent and retrying won't help.
 *
 * Used to decide whether to suggest retry behavior.
 *
 * @param error - The error to check
 * @returns {boolean} true if the operation should be retried
 *
 * Example:
 * ```typescript
 * if (isRetryableError(error)) {
 *   // Try again with exponential backoff
 * } else {
 *   // Return error to user immediately
 * }
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  if (!isSDKError(error)) {
    return false;
  }

  const sdkError = error as FaimSDKError;
  const code = sdkError.error_code || '';

  // These error codes indicate transient issues
  const retryableCodes = [
    'TIMEOUT_ERROR',
    'OUT_OF_MEMORY',
    'RESOURCE_EXHAUSTED',
    'TRITON_CONNECTION_ERROR',
    'BILLING_TRANSACTION_FAILED',
    'DATABASE_ERROR',
  ];

  return retryableCodes.includes(code);
}

/**
 * Type guard to check if an error is an auth error
 *
 * Auth errors (API key issues, permissions) can't be recovered
 * and should fail fast.
 *
 * @param error - The error to check
 * @returns {boolean} true if this is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (!isSDKError(error)) {
    return false;
  }

  const sdkError = error as FaimSDKError;
  const code = sdkError.error_code || '';

  const authCodes = [
    'AUTHENTICATION_REQUIRED',
    'AUTHENTICATION_FAILED',
    'INVALID_API_KEY',
    'AUTHORIZATION_FAILED',
  ];

  return authCodes.includes(code);
}
