# FAIM MCP Server

[![npm version](https://badge.fury.io/js/@faim-group%2Fmcp.svg)](https://www.npmjs.com/package/@faim-group/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that integrates the FAIM time series forecasting SDK with any MCP-compatible AI assistant, enabling AI-powered forecasting capabilities.

**NPM Package:** [@faim-group/mcp](https://www.npmjs.com/package/@faim-group/mcp)


## Overview

This MCP server currently exposes two foundation time-series models from the FAIM API for zero-shot forecasting:
- **Chronos2**
- **TiRex**

### Key Features

✅ **Two MCP Tools**:
- `list_models`: Returns available forecasting models and capabilities
- `forecast`: Performs point and probabilistic time series forecasting

✅ **Flexible Input Formats**:
- 1D arrays: Single univariate time series
- 3D arrays: batch/sequence/feature format

✅ **Probabilistic Forecasting**:
- Point forecasts (single value predictions)
- Quantile forecasts (confidence intervals)
- Sample forecasts (distribution samples)
- Custom quantile levels for risk assessment

## Installation

### Prerequisites

- Node.js 20+
- npm 10+
- **FAIM API key**: Register at [https://faim.it.com/](https://faim.it.com/) to get your `FAIM_API_KEY`

### Remote MCP Server — Useful for Workflow Automation Tools like n8n

The MCP server is deployed remotely.

To use the remote MCP server, send requests to the following endpoint:

**https://mcp.faim.it.com**

Provide your FAIM API key using **Bearer authentication**.

### Local MCP server

### Option 1: Install from npm (Recommended)

Configure your client to use it directly with `npx`:

```json
{
  "mcpServers": {
    "faim": {
      "command": "npx",
      "args": ["-y", "@faim-group/mcp"],
      "env": {
        "FAIM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

No installation required - `npx` will automatically download and run the latest version.

Alternatively, if you prefer to install globally first:

```bash
npm install -g @faim-group/mcp
```

Then in config:

```json
{
  "mcpServers": {
    "faim": {
      "command": "faim-mcp",
      "env": {
        "FAIM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Option 2: Clone and Build Locally

```bash
# Clone the repository
git clone <repository-url>
cd faim-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run type checker
npm run lint
```

Then use the local path:

```json
{
  "mcpServers": {
    "faim": {
      "command": "node",
      "args": ["/path/to/faim-mcp/dist/index.js"],
      "env": {
        "FAIM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Required: Your FAIM API key
export FAIM_API_KEY="your-api-key-here"

# Optional: Set to non-production for verbose logging
export NODE_ENV=development
```

## MCP Compatibility

This server implements the **Model Context Protocol (MCP)**, an open protocol for connecting AI assistants to external tools and data sources. It works with any LLM and application that implements an MCP client.

### Using with Any LLM or System

This server implements the standard MCP protocol and works with any application that implements an MCP client:
- Direct MCP client implementation
- AI framework adapters that support MCP
- IDE extensions that expose MCP tools to any LLM
- Custom middleware that translates between MCP and your LLM's tool calling format

## Usage

### Starting the Server

```bash
# Build and start the server
npm run build
node dist/index.js
```

The server will:
1. Read the API key from environment
2. Initialize the FAIM client
3. Listen on stdin for JSON-RPC requests
4. Send responses to stdout

### Tool 1: List Models

Returns available forecasting models and their capabilities.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "list_models",
        "description": "...",
        "inputSchema": { ... }
      },
      {
        "name": "forecast",
        "description": "...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### Tool 2: Forecast

Performs time series forecasting using FAIM models.

**Request (Point Forecast):**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "forecast",
    "arguments": {
      "model": "chronos2",
      "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "horizon": 10,
      "output_type": "point"
    }
  }
}
```

**Request (Quantile Forecast with Confidence Intervals):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "forecast",
    "arguments": {
      "model": "chronos2",
      "x": [[[100, 50], [102, 51], [105, 52]]],
      "horizon": 5,
      "output_type": "quantiles",
      "quantiles": [0.1, 0.5, 0.9]
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "success": true,
    "data": {
      "model_name": "chronos2",
      "model_version": "1.0",
      "output_type": "point",
      "forecast": {
        "point": [[[11], [12], [13], ...]]
      },
      "metadata": {
        "token_count": 150,
        "duration_ms": 245
      },
      "shape_info": {
        "input_shape": [1, 10, 1],
        "output_shape": [1, 10, 1]
      }
    }
  }
}
```

## Project Structure

```
faim-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── tools/
│   │   ├── list-models.ts    # List models tool
│   │   └── forecast.ts       # Forecasting tool
│   └── utils/
│       ├── client.ts         # FAIM client singleton
│       ├── validation.ts     # Input validation
│       └── errors.ts         # Error transformation
├── tests/
│   ├── tools/
│   │   ├── list-models.test.ts
│   │   └── forecast.test.ts
│   └── utils/
│       ├── validation.test.ts
│       └── errors.test.ts
├── dist/                     # Built output
│   ├── index.js             # ESM bundle
│   ├── index.cjs            # CommonJS bundle
│   ├── index.d.ts           # Type declarations
│   └── *.map                # Source maps
└── package.json, tsconfig.json, tsup.config.ts, vitest.config.ts
```

## Testing

The project includes comprehensive tests for:

- **Input Validation**: Valid/invalid inputs, edge cases, boundary values
- **Error Handling**: SDK errors, JavaScript errors, error classification
- **Tool Functionality**: Response structure, model availability
- **Type Safety**: TypeScript compilation, type guards

Run tests:
```bash
npm test                 # Run all tests
npm run test:coverage   # Run with coverage report
npm run test:ui         # Run with UI dashboard
```


### Debugging

Enable verbose logging:
```bash
NODE_ENV=development node dist/index.js
```

Output goes to stderr (not interfering with stdout JSON-RPC).

## Building and Deployment

### Build for Production

```bash
npm run build
```

Outputs:
- `dist/index.js` - ESM module
- `dist/index.cjs` - CommonJS module
- `dist/index.d.ts` - Type declarations
- Source maps for debugging

### Deployment Checklist

- [ ] Set `FAIM_API_KEY` environment variable
- [ ] Run `npm run build`
- [ ] Run `npm test` to verify
- [ ] Deploy `dist/` directory
- [ ] Run `node dist/index.js` as the server process


## Troubleshooting

### "FAIM_API_KEY not set"
```bash
export FAIM_API_KEY="your-key-here"
node dist/index.js
```

### "Module not found" errors
```bash
npm install
npm run build
```


### Server not responding
- Check that stdout/stderr are properly connected
- Verify JSON-RPC format of requests
- Check logs for error messages
- Ensure FAIM API is accessible

## License

MIT
