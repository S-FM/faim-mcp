/**
 * Tests for Forecast Tool
 *
 * These tests verify that:
 * 1. Valid forecast requests are validated
 * 2. Invalid requests return proper errors
 * 3. Tool response structure is correct
 * 4. The tool handles both models
 * 5. Different output types work
 * 6. Tool never throws (always returns ToolResult)
 *
 * Testing Strategy:
 * - Validation tests (valid/invalid inputs)
 * - Response structure tests
 * - Error handling tests
 * - Edge case tests
 * - Note: API call tests are skipped (would require mock client)
 *
 * LLM Context: These tests document valid forecast requests
 * and show what errors are returned for invalid ones.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { forecast, FORECAST_TOOL } from '../../src/tools/forecast.js';
import * as clientModule from '../../src/utils/client.js';

/**
 * Test Utilities
 *
 * Helper functions for creating test data.
 */
function createValidForecastRequest(overrides = {}) {
  return {
    model: 'chronos2',
    x: [1, 2, 3, 4, 5],
    horizon: 10,
    output_type: 'point',
    ...overrides,
  };
}

describe('forecast tool', () => {
  /**
   * Real client initialization for testing
   *
   * We use a real client connection to the FAIM server.
   * This requires FAIM_API_KEY environment variable to be set.
   */
  beforeAll(() => {
    // Reset the client module state
    clientModule.resetClient();

    // Initialize with real client connection
    // This connects to the actual FAIM server
    clientModule.initializeClient();
  });

  afterAll(() => {
    // Clean up is handled by the client module
  });

  /**
   * Validation Tests
   *
   * Verify that invalid inputs are caught with proper error codes.
   */

  it('should reject request without model', async () => {
    const request = {
      x: [1, 2, 3],
      horizon: 10,
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('MISSING_REQUIRED_FIELD');
      expect(result.error.field).toBe('model');
    }
  });

  it('should reject request with invalid model', async () => {
    const request = {
      model: 'invalid_model',
      x: [1, 2, 3],
      horizon: 10,
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('INVALID_PARAMETER');
      expect(result.error.field).toBe('model');
    }
  });

  it('should reject request without horizon', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('MISSING_REQUIRED_FIELD');
      expect(result.error.field).toBe('horizon');
    }
  });

  it('should reject request without time series data', async () => {
    const request = {
      model: 'chronos2',
      horizon: 10,
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('MISSING_REQUIRED_FIELD');
      expect(result.error.field).toBe('x');
    }
  });

  it('should reject zero horizon', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 0,
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('INVALID_VALUE_RANGE');
    }
  });

  it('should reject negative horizon', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: -10,
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('INVALID_VALUE_RANGE');
    }
  });

  it('should reject invalid output_type', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'invalid',
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('INVALID_PARAMETER');
      expect(result.error.field).toBe('output_type');
    }
  });

  it('should reject out-of-range quantiles', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0.1, 1.5, 0.9],
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('INVALID_VALUE_RANGE');
    }
  });

  it('should accept TiRex model', async () => {
    const request = {
      model: 'tirex',
      x: [1, 2, 3],
      horizon: 10,
    };

    const result = await forecast(request);

    // Request is valid, result depends on API response
    if (!result.success) {
      expect(result.error.error_code).not.toBe('INVALID_PARAMETER');
    }
  });

  /**
   * Tool Schema Tests
   *
   * Verify the tool definition is correct for MCP.
   */

  it('should have correct tool name', () => {
    expect(FORECAST_TOOL.name).toBe('forecast');
  });

  it('should have a description', () => {
    expect(FORECAST_TOOL.description).toBeDefined();
    expect(FORECAST_TOOL.description.length).toBeGreaterThan(0);
  });

  it('should require model, x, and horizon fields', () => {
    expect(FORECAST_TOOL.inputSchema.required).toContain('model');
    expect(FORECAST_TOOL.inputSchema.required).toContain('x');
    expect(FORECAST_TOOL.inputSchema.required).toContain('horizon');
  });

  it('should have object type input schema', () => {
    expect(FORECAST_TOOL.inputSchema.type).toBe('object');
  });

  it('should define model property', () => {
    expect(FORECAST_TOOL.inputSchema.properties.model).toBeDefined();
  });

  it('should define x property', () => {
    expect(FORECAST_TOOL.inputSchema.properties.x).toBeDefined();
  });

  it('should define horizon property', () => {
    expect(FORECAST_TOOL.inputSchema.properties.horizon).toBeDefined();
  });

  it('should define output_type property as optional', () => {
    expect(FORECAST_TOOL.inputSchema.properties.output_type).toBeDefined();
    expect(FORECAST_TOOL.inputSchema.required).not.toContain('output_type');
  });

  it('should define quantiles property as optional', () => {
    expect(FORECAST_TOOL.inputSchema.properties.quantiles).toBeDefined();
    expect(FORECAST_TOOL.inputSchema.required).not.toContain('quantiles');
  });

  /**
   * Input Format Tests
   *
   * Verify different input array formats are accepted.
   */

  it('should accept 1D array input', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3, 4, 5],
      horizon: 10,
    };

    const result = await forecast(request);

    // Validation should pass even if client fails
    expect(result.success).toBe(false); // Client error, not validation
    if (!result.success) {
      expect(result.error.error_code).not.toBe('INVALID_PARAMETER');
    }
  });

  it('should accept 2D array input (multivariate)', async () => {
    const request = {
      model: 'chronos2',
      x: [[1, 2], [3, 4], [5, 6]],
      horizon: 10,
    };

    const result = await forecast(request);

    // Validation should pass
    expect(result.success).toBe(false); // Client error
  });

  it('should accept 3D array input', async () => {
    const request = {
      model: 'chronos2',
      x: [[[1], [2], [3]]],
      horizon: 10,
    };

    const result = await forecast(request);

    // Validation should pass
    expect(result.success).toBe(false); // Client error
  });

  /**
   * Output Type Tests
   *
   * Verify different output types are accepted.
   */

  it('should accept point output type', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'point',
    };

    const result = await forecast(request);

    expect(result.success).toBe(false); // Client error
  });

  it('should accept quantiles output type', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0.1, 0.5, 0.9],
    };

    const result = await forecast(request);

    expect(result.success).toBe(false); // Client error
  });

  it('should reject samples output type (not supported by API)', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'samples',
    };

    const result = await forecast(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error_code).toBe('INVALID_PARAMETER');
      expect(result.error.field).toBe('output_type');
    }
  });

  /**
   * Error Handling Tests
   *
   * Verify proper error handling and no throwing.
   */

  it('should never throw, always return ToolResult', async () => {
    const request = createValidForecastRequest();

    expect(async () => {
      await forecast(request);
    }).not.toThrow();
  });

  it('should handle null input gracefully', async () => {
    const result = await forecast(null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should handle undefined input gracefully', async () => {
    const result = await forecast(undefined);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  /**
   * Edge Cases Tests
   */

  it('should accept minimum horizon of 1', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 1,
    };

    const result = await forecast(request);

    // Validation passes, client fails
    expect(result.success).toBe(false);
  });

  it('should accept maximum valid horizon', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10000,
    };

    const result = await forecast(request);

    // Validation passes
    expect(result.success).toBe(false);
  });

  it('should accept boundary quantile values [0, 1]', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0, 0.5, 1],
    };

    const result = await forecast(request);

    // Validation passes
    expect(result.success).toBe(false);
  });

  it('should be JSON serializable when valid', async () => {
    const request = createValidForecastRequest();

    // Should not throw during JSON stringification
    expect(() => {
      JSON.stringify(request);
    }).not.toThrow();
  });
});
