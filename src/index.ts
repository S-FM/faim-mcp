/**
 * FAIM MCP Server
 *
 * Main entry point for the Model Context Protocol server that provides
 * Claude with access to FAIM's time series forecasting capabilities.
 *
 * Architecture Overview:
 * ┌─────────────────────────────────────────┐
 * │          Claude (via MCP Client)        │
 * └──────────────────┬──────────────────────┘
 *                    │
 *                    │ MCP Protocol
 *                    ▼
 * ┌─────────────────────────────────────────┐
 * │     FAIM MCP Server (this file)         │
 * │  ┌─────────────────────────────────┐   │
 * │  │  Tool Handlers                  │   │
 * │  │  - list_models()                │   │
 * │  │  - forecast()                   │   │
 * │  └─────────────────────────────────┘   │
 * └──────────────┬──────────────────────────┘
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
 * 4. Registers MCP tools
 * 5. Waits for Claude to call tools
 *
 * Error Handling:
 * - Startup errors: Fail fast if API key is missing
 * - Tool errors: Always return ToolResult, never throw
 * - SDK errors: Transform to user-friendly format
 *
 * LLM Context: This module orchestrates the MCP server.
 * When Claude makes a request, it comes through here, gets routed
 * to the appropriate tool handler, and returns a response.
 */

// MCP Server implementation using Node.js stdio
// This provides a JSON-RPC interface compatible with MCP protocol
// Documentation: https://github.com/anthropics/mcp-sdk-python

import * as readline from 'readline';
import { initializeClient } from './utils/client.js';
import { listModels, LIST_MODELS_TOOL } from './tools/list-models.js';
import { forecast, FORECAST_TOOL } from './tools/forecast.js';
import { transformError } from './utils/errors.js';

/**
 * MCP Server Implementation using stdio JSON-RPC
 *
 * This is a minimal MCP server implementation that communicates via stdin/stdout.
 * It follows the Model Context Protocol specification:
 * - Receives JSON-RPC requests from Claude on stdin
 * - Sends JSON-RPC responses on stdout
 * - Each message ends with a newline
 *
 * The MCP protocol defines the following request types:
 * - "tools/list": Get available tools
 * - "tools/call": Execute a tool with arguments
 */
class FaimMCPServer {
  private requestId = 0;

  /**
   * Send a response back to Claude
   * Uses JSON-RPC format with newline delimiter
   */
  private sendResponse(response: unknown): void {
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  /**
   * Handle a list_models request
   * Returns available forecasting models and their capabilities
   */
  private async handleListModels(): Promise<unknown> {
    const result = await listModels();
    return {
      tools: [
        LIST_MODELS_TOOL,
        FORECAST_TOOL,
      ],
    };
  }

  /**
   * Handle a forecast request
   * Performs time series forecasting using FAIM models
   */
  private async handleForecast(args: unknown): Promise<unknown> {
    return forecast(args);
  }

  /**
   * Route and handle incoming JSON-RPC requests
   * Dispatches to appropriate tool handler
   */
  private async handleRequest(request: unknown): Promise<unknown> {
    const req = request as Record<string, unknown>;
    const method = req.method as string;
    const params = req.params as Record<string, unknown>;

    console.error(`[MCP] Received request: ${method}`);

    try {
      // Route based on method
      if (method === 'tools/list') {
        // Client asking what tools are available
        return {
          result: await this.handleListModels(),
        };
      } else if (method === 'tools/call') {
        // Client calling a specific tool
        const toolName = params.name as string;
        const toolArgs = params.arguments;

        console.error(`[MCP] Calling tool: ${toolName}`);

        if (toolName === 'list_models') {
          return {
            result: await this.listModels(),
          };
        } else if (toolName === 'forecast') {
          return {
            result: await this.handleForecast(toolArgs),
          };
        } else {
          return {
            error: {
              code: -32601,
              message: `Tool not found: ${toolName}`,
            },
          };
        }
      } else {
        return {
          error: {
            code: -32601,
            message: `Unknown method: ${method}`,
          },
        };
      }
    } catch (error) {
      console.error(`[MCP] Error handling request:`, error);
      return {
        error: {
          code: -32603,
          message: 'Internal server error',
          data: {
            error: transformError(error, { operation: method }),
          },
        },
      };
    }
  }

  /**
   * Wrapper for listModels tool - returns just the models array
   */
  private async listModels(): Promise<unknown> {
    const result = await listModels();
    if (result.success) {
      return result.data.models;
    } else {
      throw new Error(result.error.message);
    }
  }

  /**
   * Start the MCP server
   * Reads from stdin, processes requests, writes to stdout
   */
  async start(): Promise<void> {
    try {
      // Initialize the FAIM client before accepting requests
      initializeClient();
      console.error('[MCP] FAIM client initialized successfully');

      // Create readline interface for stdin
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });

      // Process each line as a JSON-RPC request
      rl.on('line', async (line: string) => {
        try {
          const request = JSON.parse(line);
          const id = request.id;

          // Handle the request and send response
          const result = await this.handleRequest(request);
          const response = {
            jsonrpc: '2.0',
            id,
            ...(result as Record<string, unknown>),
          };
          this.sendResponse(response);
        } catch (error) {
          console.error('[MCP] Failed to process line:', error);
          // Send error response if we have an id
          try {
            const request = JSON.parse(line);
            this.sendResponse({
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32700,
                message: 'Parse error',
              },
            });
          } catch {
            // Can't parse request, just continue
          }
        }
      });

      rl.on('close', () => {
        console.error('[MCP] Connection closed');
        process.exit(0);
      });

      rl.on('error', (error: Error) => {
        console.error('[MCP] Readline error:', error);
        process.exit(1);
      });

      console.error('[MCP] Server started, waiting for requests...');
    } catch (error) {
      console.error('[MCP] Failed to start server:', error);
      process.exit(1);
    }
  }
}

/**
 * Entry point
 * Create and start the server
 */
async function main(): Promise<void> {
  const server = new FaimMCPServer();
  await server.start();
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

export { FaimMCPServer };
