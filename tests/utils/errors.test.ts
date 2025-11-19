/**
 * Tests for Error Handling Module
 *
 * These tests verify that:
 * 1. SDK errors are transformed to ErrorResponse format
 * 2. JavaScript errors are handled gracefully
 * 3. Error messages are user-friendly
 * 4. Error codes are correctly identified
 * 5. Retryable errors are classified correctly
 *
 * Testing Strategy:
 * - SDK error transformation tests
 * - JavaScript error handling tests
 * - Error type guard tests (isRetryableError, isAuthError)
 * - Edge case tests (unknown errors, null errors)
 *
 * LLM Context: These tests document the error handling strategy
 * and show how different error types are transformed.
 */

import { describe, it, expect } from 'vitest';
import { transformError, isRetryableError, isAuthError } from '../../src/utils/errors.js';

describe('transformError', () => {
  /**
   * SDK Error Transformation Tests
   *
   * These tests verify that errors from the FAIM SDK are properly
   * transformed into our ErrorResponse format.
   */

  it('should transform SDK validation error', () => {
    const sdkError = {
      error_code: 'INVALID_SHAPE',
      message: 'Input shape is incorrect',
      detail: 'Expected 3D array',
    };

    const result = transformError(sdkError);

    expect(result.success).toBeUndefined(); // Not a ToolResult, just ErrorResponse
    expect(result.error_code).toBe('INVALID_SHAPE');
    expect(result.message).toBeDefined();
    expect(result.details).toContain('Expected 3D array');
  });

  it('should transform authentication error', () => {
    const sdkError = {
      error_code: 'INVALID_API_KEY',
      message: 'The API key is invalid',
    };

    const result = transformError(sdkError);

    expect(result.error_code).toBe('INVALID_API_KEY');
    expect(result.message).toBeDefined();
    expect(result.details).toContain('API key');
  });

  it('should provide suggestion for rate limit error', () => {
    const sdkError = {
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
    };

    const result = transformError(sdkError);

    expect(result.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.details).toContain('Suggestion');
  });

  /**
   * JavaScript Error Transformation Tests
   *
   * These tests verify that standard JavaScript errors are
   * properly classified and transformed.
   */

  it('should transform standard Error object', () => {
    const error = new Error('Something went wrong');

    const result = transformError(error);

    expect(result.error_code).toBe('INTERNAL_ERROR');
    expect(result.message).toBeDefined();
    expect(result.details).toContain('Something went wrong');
  });

  it('should identify network errors', () => {
    const error = new Error('ECONNREFUSED: connection refused');

    const result = transformError(error);

    expect(result.error_code).toBe('NETWORK_ERROR');
    expect(result.message).toContain('network');
  });

  it('should identify timeout errors', () => {
    const error = new Error('Request timeout after 30000ms');

    const result = transformError(error);

    expect(result.error_code).toBe('TIMEOUT_ERROR');
  });

  it('should identify type errors', () => {
    const error = new TypeError('Cannot read property of undefined');

    const result = transformError(error);

    expect(result.error_code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should transform string error', () => {
    const result = transformError('Simple error message');

    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toBe('Simple error message');
  });

  it('should transform unknown error type', () => {
    const result = transformError({ custom: 'error object' });

    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toBeDefined();
  });

  it('should include context in error details', () => {
    const error = new Error('Network error');
    const context = { operation: 'forecast', field: 'model' };

    const result = transformError(error, context);

    expect(result.details).toContain('forecast');
    expect(result.field).toBe('model');
  });

  it('should handle null/undefined errors gracefully', () => {
    const result = transformError(null);

    expect(result.error_code).toBe('UNKNOWN_ERROR');
    expect(result.message).toBeDefined();
  });

  /**
   * Edge Case Tests
   */

  it('should handle errors without messages', () => {
    const error = new Error();

    const result = transformError(error);

    expect(result.error_code).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('should handle SDK errors with only error_code', () => {
    const sdkError = { error_code: 'TIMEOUT_ERROR' };

    const result = transformError(sdkError);

    expect(result.error_code).toBe('TIMEOUT_ERROR');
  });
});

describe('isRetryableError', () => {
  /**
   * Retryable Error Classification Tests
   *
   * These tests verify that transient errors are correctly identified
   * as retryable, while permanent errors are not.
   */

  it('should classify timeout error as retryable', () => {
    const error = { error_code: 'TIMEOUT_ERROR', message: 'Timeout' };

    expect(isRetryableError(error)).toBe(true);
  });

  it('should classify out of memory error as retryable', () => {
    const error = { error_code: 'OUT_OF_MEMORY', message: 'OOM' };

    expect(isRetryableError(error)).toBe(true);
  });

  it('should classify resource exhausted error as retryable', () => {
    const error = { error_code: 'RESOURCE_EXHAUSTED', message: 'Too busy' };

    expect(isRetryableError(error)).toBe(true);
  });

  it('should classify connection error as retryable', () => {
    const error = { error_code: 'TRITON_CONNECTION_ERROR', message: 'Connection lost' };

    expect(isRetryableError(error)).toBe(true);
  });

  it('should not classify auth error as retryable', () => {
    const error = { error_code: 'INVALID_API_KEY', message: 'Bad key' };

    expect(isRetryableError(error)).toBe(false);
  });

  it('should not classify validation error as retryable', () => {
    const error = { error_code: 'INVALID_SHAPE', message: 'Wrong shape' };

    expect(isRetryableError(error)).toBe(false);
  });

  it('should not classify non-SDK errors as retryable', () => {
    const error = new Error('Some error');

    expect(isRetryableError(error)).toBe(false);
  });

  it('should not classify null as retryable', () => {
    expect(isRetryableError(null)).toBe(false);
  });
});

describe('isAuthError', () => {
  /**
   * Auth Error Classification Tests
   *
   * These tests verify that authentication/authorization errors
   * are correctly identified.
   */

  it('should classify invalid API key error as auth error', () => {
    const error = { error_code: 'INVALID_API_KEY', message: 'Bad key' };

    expect(isAuthError(error)).toBe(true);
  });

  it('should classify authentication required error as auth error', () => {
    const error = { error_code: 'AUTHENTICATION_REQUIRED', message: 'No auth' };

    expect(isAuthError(error)).toBe(true);
  });

  it('should classify authentication failed error as auth error', () => {
    const error = { error_code: 'AUTHENTICATION_FAILED', message: 'Auth failed' };

    expect(isAuthError(error)).toBe(true);
  });

  it('should classify authorization failed error as auth error', () => {
    const error = { error_code: 'AUTHORIZATION_FAILED', message: 'No permission' };

    expect(isAuthError(error)).toBe(true);
  });

  it('should not classify timeout error as auth error', () => {
    const error = { error_code: 'TIMEOUT_ERROR', message: 'Timeout' };

    expect(isAuthError(error)).toBe(false);
  });

  it('should not classify validation error as auth error', () => {
    const error = { error_code: 'INVALID_PARAMETER', message: 'Bad param' };

    expect(isAuthError(error)).toBe(false);
  });

  it('should not classify non-SDK errors as auth error', () => {
    const error = new Error('Some error');

    expect(isAuthError(error)).toBe(false);
  });

  it('should not classify null as auth error', () => {
    expect(isAuthError(null)).toBe(false);
  });
});
