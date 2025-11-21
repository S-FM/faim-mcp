/**
 * FAIM MCP Server
 *
 * Main entry point for the Model Context Protocol server that provides
 * Claude with access to FAIM's time series forecasting capabilities.
 *
 * This implementation uses the official @modelcontextprotocol/sdk package,
 * which provides production-ready abstractions for MCP protocol handling.
 *
 * Architecture Overview:
 * ┌─────────────────────────────────────────┐
 * │          Claude (via MCP Client)        │
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
 * 7. Waits for Claude to call tools
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
server.registerTool(
  'list_models',
  {
    description:
      'List all available forecasting models and their capabilities. Returns information about Chronos2, TiRex, and other available models, including supported output types and features.',
    inputSchema: {},
  },
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
server.registerTool(
  'forecast',
  {
    description:
      'Perform time series forecasting using FAIM models. Supports both point forecasting (single value) and probabilistic forecasting (confidence intervals). Can handle univariate and multivariate time series data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string' as const,
          enum: ['chronos2', 'tirex'],
          description:
            'The forecasting model to use. Chronos2 is the general-purpose model. TiRex is an alternative with different characteristics.',
        },
        x: {
          description:
            'Time series data to forecast from. Can be a 1D array (single series), 2D array (multiple series or multivariate), or 3D array. 1D example: [1,2,3,4,5]. 2D example: [[1,2],[3,4],[5,6]].',
          oneOf: [
            {
              type: 'array' as const,
              items: { type: 'number' as const },
              description: '1D array: single univariate time series',
            },
            {
              type: 'array' as const,
              items: {
                type: 'array' as const,
                items: { type: 'number' as const },
              },
              description: '2D array: multiple timesteps with features',
            },
            {
              type: 'array' as const,
              items: {
                type: 'array' as const,
                items: {
                  type: 'array' as const,
                  items: { type: 'number' as const },
                },
              },
              description: '3D array: batch of time series',
            },
          ],
        },
        horizon: {
          type: 'number' as const,
          description:
            'Number of time steps to forecast into the future. Must be a positive integer. Example: 10 means predict the next 10 steps.',
        },
        output_type: {
          type: 'string' as const,
          enum: ['point', 'quantiles'],
          default: 'point',
          description:
            'Type of forecast output. "point" = single value per step (fastest). "quantiles" = confidence intervals (use for uncertainty).',
        },
        quantiles: {
          type: 'array' as const,
          items: { type: 'number' as const },
          description:
            'Quantile levels to compute (only used with output_type="quantiles"). Values between 0 and 1. Example: [0.1, 0.5, 0.9] for 10th, 50th, 90th percentiles.',
        },
      },
      required: ['model', 'x', 'horizon'] as const,
    } as any,
  },
  async (args: unknown) => {
    const result = await forecast(args);

    if (!result.success) {
      throw new Error(JSON.stringify(result.error));
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
 * 4. Waits for incoming requests from Claude
 *
 * The server will run until the process is terminated.
 */
async function main(): Promise<void> {
  try {
    // Initialize FAIM client before accepting requests
    initializeClient();
    console.error('[MCP] FAIM client initialized successfully');

    // Create transport for stdio communication
    const transport = new StdioServerTransport();

    // Connect server to transport
    // The transport handles all JSON-RPC protocol details
    await server.connect(transport);

    console.error('[MCP] Server started with official @modelcontextprotocol/sdk');
    console.error('[MCP] Waiting for requests from Claude...');
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
