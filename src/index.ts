#!/usr/bin/env node

/**
 * FAIM MCP Server
 *
 * Main entry point for the Model Context Protocol server that provides
 * LLM with access to FAIM's time series forecasting capabilities.
 *
 * This implementation uses the official @modelcontextprotocol/sdk package,
 * which provides production-ready abstractions for MCP protocol handling.
 *
 * Architecture Overview:
 * ┌─────────────────────────────────────────┐
 * │          LLM (via MCP Client)        │
 * └──────────────────┬──────────────────────┘
 *                    │
 *                    │ MCP Protocol (JSON-RPC 2.0)
 *                    ▼
 * ┌─────────────────────────────────────────────────────┐
 * │     FAIM MCP Server (@modelcontextprotocol/sdk)    │
 * │  ┌──────────────────────────────────────────────┐  │
 * │  │  McpServer Instance                          │  │
 * │  │  ├─ Registered Tools:                        │  │
 * │  │  │  ├─ list_models                          │  │
 * │  │  │  └─ forecast                             │  │
 * │  │  └─ StdioServerTransport (stdin/stdout)     │  │
 * │  └──────────────────────────────────────────────┘  │
 * └──────────────┬──────────────────────────────────────┘
 *                │
 *                │ SDK Calls
 *                ▼
 * ┌─────────────────────────────────────────┐
 * │     FAIM SDK (@faim-group/sdk)          │
 * │     └─ FaimClient                       │
 * └──────────────┬──────────────────────────┘
 *                │
 *                │ HTTP API
 *                ▼
 * ┌─────────────────────────────────────────┐
 * │        FAIM API Endpoint                │
 * │     (api.faim.it.com)                   │
 * └─────────────────────────────────────────┘
 *
 * Initialization Flow:
 * 1. Server starts
 * 2. initializeClient() reads FAIM_API_KEY from env
 * 3. Creates FaimClient singleton
 * 4. Creates McpServer instance with capabilities
 * 5. Registers tools with their handlers
 * 6. Connects to StdioServerTransport
 * 7. Waits for LLM to call tools
 *
 * Error Handling:
 * - Startup errors: Fail fast if API key is missing
 * - Tool errors: SDK handles error response formatting
 * - Validation errors: Zod schemas validate inputs automatically
 *
 * LLM Context: This module sets up the official MCP server.
 * All protocol handling is delegated to the SDK, reducing complexity
 * and ensuring compatibility with the MCP specification.
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initializeClient } from './utils/client.js';
import { listModels } from './tools/list-models.js';
import { forecast } from './tools/forecast.js';

/**
 * Create and configure the MCP server
 *
 * The McpServer handles:
 * - Protocol initialization handshake
 * - Tool registration and listing
 * - Request routing to tool handlers
 * - Error response formatting
 * - All JSON-RPC protocol details
 */
const server = new McpServer({
  name: 'faim-mcp',
  version: '1.0.0',
});

/**
 * Register the list_models tool
 *
 * This tool returns available forecasting models and their capabilities.
 * No input required - stateless operation.
 */
server.tool(
  'list_models',
  'List all available forecasting models and their capabilities. Returns information about Chronos2, TiRex, and other available models, including supported output types and features.',
  {},
  async () => {
    const result = await listModels();

    if (!result.success) {
      throw new Error(result.error.message);
    }

    // Format response for MCP
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result.data),
        },
      ],
    };
  }
);

/**
 * Register the forecast tool
 *
 * This is the main tool for time series forecasting.
 * Validates inputs and handles forecasting operations.
 */
(server.tool as any)(
  'forecast',
  'Perform time series forecasting using FAIM platform. Supports both point forecasting (single value) and probabilistic forecasting (confidence intervals). Can handle univariate and multivariate time series data. Currently supported models: Chronos2 (default, recommended for multivariate) and TiRex (fast, univariate only).',
  {
    model: z
      .enum(['chronos2', 'tirex'])
      .describe(
        'The forecasting model to use. Chronos2: State-of-the-art, supports univariate/multivariate, custom quantiles. TiRex: Fast alternative for univariate only, uses fixed quantiles [0.1,0.2,...,0.9], custom quantiles parameter ignored.'
      ),
    x: z
      .any()
      .describe(
        'Time series data to forecast from. Can be a 1D array (single series), 2D array (multiple series/batch or multivariate per model), or 3D array (batch, sequence, features).'
      ),
    horizon: z
      .number()
      .describe(
        'Number of time steps to forecast into the future. Must be a positive integer. Example: 10 means predict the next 10 steps.'
      ),
    output_type: z
      .enum(['point', 'quantiles'])
      .optional()
      .describe(
        'Type of forecast output. "point" = single value per step (fastest). "quantiles" = confidence intervals (use for uncertainty estimation). Default: "point".'
      ),
    quantiles: z
      .array(z.number())
      .optional()
      .describe(
        'Custom quantile levels to compute (only used with output_type="quantiles" and Chronos2 model). For TiRex, this parameter is ignored and fixed quantiles [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9] are always returned. Values must be between 0 and 1. Example: [0.1, 0.5, 0.9] for 10th, 50th, 90th percentiles.'
      ),
    is_multivariate: z
      .boolean()
      .optional()
      .describe(
        'For 2D input arrays only with Chronos2: interpret as multivariate time series (true) or batch of univariate series (false, default). Ignored for 1D arrays, 3D arrays, and TiRex model.'
      ),
  },
  async ({ model, x, horizon, output_type, quantiles, is_multivariate }: any) => {
    const result = await forecast({
      model,
      x,
      horizon,
      output_type: output_type || 'point',
      quantiles,
      is_multivariate,
    });

    if (!result.success) {
      throw new Error(result.error.message);
    }

    // Format response for MCP
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result.data),
        },
      ],
    };
  }
);

/**
 * Start the MCP server
 *
 * This function:
 * 1. Initializes the FAIM client (ensures API key is available)
 * 2. Creates a StdioServerTransport for stdin/stdout communication
 * 3. Connects the server to the transport
 * 4. Waits for incoming requests from LLM
 *
 * The server will run until the process is terminated.
 */
async function main(): Promise<void> {
  try {
    // Initialize FAIM client before accepting requests
    initializeClient();

    // Create transport for stdio communication
    const transport = new StdioServerTransport();

    // Connect server to transport
    // The transport handles all JSON-RPC protocol details
    await server.connect(transport);
  } catch (error) {
    console.error('[MCP] Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('[MCP] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP] Terminated');
  process.exit(0);
});
