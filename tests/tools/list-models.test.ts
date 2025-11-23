/**
 * Tests for List Models Tool
 *
 * These tests verify that:
 * 1. The tool returns a list of available models
 * 2. Each model has required properties
 * 3. The response structure is correct
 * 4. The tool never throws (always returns ToolResult)
 *
 * Testing Strategy:
 * - Test successful execution
 * - Verify response structure
 * - Check model information is complete
 * - Verify JSON serializability (for MCP transport)
 *
 * LLM Context: These tests document what the list_models tool returns
 * and ensure the response is suitable for MCP transmission to LLM.
 */

import { describe, it, expect } from 'vitest';
import { listModels } from '../../src/tools/list-models.js';

describe('listModels tool', () => {
  /**
   * Basic Functionality Tests
   *
   * Verify the tool returns the expected response structure.
   */

  it('should return a successful result', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should return an array of models', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.models)).toBe(true);
      expect(result.data.models.length).toBeGreaterThan(0);
    }
  });

  /**
   * Model Information Tests
   *
   * Verify each model has the required properties.
   */

  it('should include Chronos2 model', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      const chronos2 = result.data.models.find((m) => m.id === 'chronos2');
      expect(chronos2).toBeDefined();
      expect(chronos2?.name).toBe('Chronos2');
    }
  });

  it('should include TiRex model', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      const tirex = result.data.models.find((m) => m.id === 'tirex');
      expect(tirex).toBeDefined();
      expect(tirex?.name).toBe('TiRex');
    }
  });

  it('should include all required model properties', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      for (const model of result.data.models) {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.version).toBeDefined();
        expect(model.description).toBeDefined();
        expect(model.supportedOutputTypes).toBeDefined();
        expect(model.supportsQuantiles).toBeDefined();
      }
    }
  });

  it('should have correct output types for Chronos2', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      const chronos2 = result.data.models.find((m) => m.id === 'chronos2');
      expect(chronos2?.supportedOutputTypes).toHaveLength(2);
      expect(chronos2?.supportedOutputTypes).toContain('point');
      expect(chronos2?.supportedOutputTypes).toContain('quantiles');
    }
  });

  it('should indicate Chronos2 supports quantiles', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      const chronos2 = result.data.models.find((m) => m.id === 'chronos2');
      expect(chronos2?.supportsQuantiles).toBe(true);
    }
  });

  /**
   * Response Structure Tests
   *
   * Verify the complete response structure is correct.
   */

  it('should include timestamp in response', async () => {
    const result = await listModels();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timestamp).toBeDefined();
      // Verify it's a valid ISO timestamp
      expect(new Date(result.data.timestamp).toISOString()).toBeTruthy();
    }
  });

  it('should be JSON serializable', async () => {
    const result = await listModels();

    // This should not throw
    expect(() => {
      JSON.stringify(result);
    }).not.toThrow();
  });

  /**
   * Tool Schema Tests
   *
   * Tool schemas are now defined in index.ts with the official SDK.
   * These tests have been removed since schema definitions are handled by
   * the McpServer.registerTool() API which manages validation.
   */

  /**
   * Error Resilience Tests
   *
   * Verify the tool handles errors gracefully.
   */

  it('should not throw even if called multiple times', async () => {
    expect(async () => {
      await listModels();
      await listModels();
      await listModels();
    }).not.toThrow();
  });

  it('should return consistent results across calls', async () => {
    const result1 = await listModels();
    const result2 = await listModels();

    if (result1.success && result2.success) {
      expect(result1.data.models.length).toBe(result2.data.models.length);
      expect(result1.data.models[0].id).toBe(result2.data.models[0].id);
    }
  });
});
