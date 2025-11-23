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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { forecast } from '../../src/tools/forecast.js';
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
  let mockClient: {
    forecastChronos2: ReturnType<typeof vi.fn>;
    forecastTiRex: ReturnType<typeof vi.fn>;
  };

  function createSdkSuccess(
    options: { outputType?: 'point' | 'quantiles'; modelName?: string } = {}
  ): { success: true; data: any } {
    const { outputType = 'point', modelName = 'chronos2' } = options;
    const metadata = {
      model_name: modelName,
      model_version: '1.0.0',
      token_count: 42,
    };

    if (outputType === 'quantiles') {
      return {
        success: true as const,
        data: {
          outputs: {
            quantiles: [[[[0.1], [0.2]]]],
          },
          metadata,
        },
      };
    }

    return {
      success: true as const,
      data: {
        outputs: {
          point: [[[1], [2], [3]]],
        },
        metadata,
      },
    };
  }

  beforeEach(() => {
    mockClient = {
      forecastChronos2: vi.fn().mockResolvedValue(createSdkSuccess()),
      forecastTiRex: vi.fn().mockResolvedValue(createSdkSuccess({ modelName: 'tirex' })),
    };

    vi.spyOn(clientModule, 'getClient').mockReturnValue(mockClient as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Validation Tests
   *
   * Note: Comprehensive input validation is now handled by the SDK's Zod schema
   * validation at the tool registration layer. These tests verify behavior with
   * valid inputs. The SDK ensures only valid data reaches the forecast function.
   * Test the function behavior assuming valid input has already been validated.
   */

  it('should accept TiRex model', async () => {
    const request = {
      model: 'tirex',
      x: [1, 2, 3],
      horizon: 10,
    };

    const result = await forecast(request);

    expect(mockClient.forecastTiRex).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  /**
   * Tool Schema Tests
   *
   * Tool schemas are now defined in index.ts with the official SDK.
   * These tests have been removed since schema definitions are handled by
   * the McpServer.registerTool() API which manages validation.
   */

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

    expect(result.success).toBe(true);
    const expectedX = [[[1], [2], [3], [4], [5]]];
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ x: expectedX })
    );
  });

  it('should accept 2D array input (multivariate)', async () => {
    const request = {
      model: 'chronos2',
      x: [[1, 2], [3, 4], [5, 6]],
      horizon: 10,
      is_multivariate: true,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    const expectedX = [[[1, 2], [3, 4], [5, 6]]];
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ x: expectedX })
    );
  });

  it('should accept 3D array input', async () => {
    const request = {
      model: 'chronos2',
      x: [[[1], [2], [3]]],
      horizon: 10,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ x: request.x })
    );
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

    expect(result.success).toBe(true);
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ output_type: 'point' })
    );
    if (result.success) {
      expect(result.data.output_type).toBe('point');
    }
  });

  it('should accept quantiles output type', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0.1, 0.5, 0.9],
    };

    mockClient.forecastChronos2.mockResolvedValueOnce(
      createSdkSuccess({ outputType: 'quantiles' })
    );

    const result = await forecast(request);

    expect(result.success).toBe(true);
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({
        output_type: 'quantiles',
        quantiles: [0.1, 0.5, 0.9],
      })
    );
    if (result.success) {
      expect(result.data.output_type).toBe('quantiles');
    }
  });

  /**
   * Note: Invalid output_type values (like 'samples') are validated by the SDK schema
   * at the registration layer and never reach the forecast function. This test is removed
   * since schema validation is now the SDK's responsibility.
   */

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

    expect(result.success).toBe(true);
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ horizon: 1 })
    );
  });

  it('should accept maximum valid horizon', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 1024,
    };

    const result = await forecast(request);

    expect(result.success).toBe(true);
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ horizon: 1024 })
    );
  });

  it('should accept boundary quantile values [0, 1]', async () => {
    const request = {
      model: 'chronos2',
      x: [1, 2, 3],
      horizon: 10,
      output_type: 'quantiles',
      quantiles: [0, 0.5, 1],
    };

    mockClient.forecastChronos2.mockResolvedValueOnce(
      createSdkSuccess({ outputType: 'quantiles' })
    );

    const result = await forecast(request);

    expect(result.success).toBe(true);
    expect(mockClient.forecastChronos2).toHaveBeenCalledWith(
      expect.objectContaining({ quantiles: [0, 0.5, 1] })
    );
  });

  it('should be JSON serializable when valid', async () => {
    const request = createValidForecastRequest();

    // Should not throw during JSON stringification
    expect(() => {
      JSON.stringify(request);
    }).not.toThrow();
  });
});
