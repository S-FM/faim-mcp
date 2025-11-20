# FAIM MCP Server

A production-ready Model Context Protocol (MCP) server that integrates the FAIM time series forecasting SDK with any MCP-compatible AI assistant, enabling AI-powered forecasting capabilities.

## Overview

This MCP server exposes two forecasting models from the FAIM API:
- **Chronos2**: General-purpose time series forecasting model
- **TiRex**: Alternative forecasting model with different characteristics

### Key Features

✅ **Two MCP Tools**:
- `list_models`: Returns available forecasting models and capabilities
- `forecast`: Performs point and probabilistic time series forecasting

✅ **Production-Ready**:
- Comprehensive error handling with helpful error messages
- Input validation with detailed feedback
- JSON-RPC stdio communication (MCP protocol)
- Full TypeScript type safety
- Extensive test coverage

✅ **Flexible Input Formats**:
- 1D arrays: Single univariate time series
- 2D arrays: Multivariate or batch time series
- 3D arrays: Explicit batch/sequence/feature format

✅ **Probabilistic Forecasting**:
- Point forecasts (single value predictions)
- Quantile forecasts (confidence intervals)
- Sample forecasts (distribution samples)
- Custom quantile levels for risk assessment

## Installation

### Prerequisites

- Node.js 20+
- npm 10+
- FAIM API key (set as `FAIM_API_KEY` environment variable)

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run type checker
npm run lint
```

## Configuration

### Environment Variables

```bash
# Required: Your FAIM API key
export FAIM_API_KEY="your-api-key-here"

# Optional: Custom API base URL (defaults to production)
export FAIM_API_BASE_URL="https://api.faim.it.com"

# Optional: Set to non-production for verbose logging
export NODE_ENV=development
```

## MCP Compatibility

This server implements the **Model Context Protocol (MCP)**, an open protocol for connecting AI assistants to external tools and data sources. MCP is not limited to Claude - it works with any application that implements an MCP client.

### Supported Clients & Platforms

- **Claude Desktop** - Native MCP integration
- **Claude.ai Web** - Via MCP support
- **IDE Extensions** - VS Code (Cline), Zed, Continue.dev, and others
- **AI Agent Frameworks** - LangChain, AutoGPT, CrewAI, etc.
- **Custom MCP Clients** - JSON-RPC 2.0 over stdio
- **Any LLM** - Via MCP client implementation

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
      "x": [[1, 2], [3, 4], [5, 6]],
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

## Architecture

### Client Management (`src/utils/client.ts`)

- **Singleton Pattern**: Single FAIM client instance across all requests
- **Lazy Initialization**: Client created when first needed
- **Error Handling**: Fails fast if API key is missing at startup

### Input Validation (`src/utils/validation.ts`)

- **Format Normalization**: Converts 1D/2D arrays to required 3D format
- **Comprehensive Checks**: Validates all parameters before API calls
- **Helpful Errors**: Clear, actionable error messages
- **Type Safety**: Full TypeScript support

### Error Handling (`src/utils/errors.ts`)

- **Error Classification**: Identifies error types (auth, validation, network, etc.)
- **User-Friendly Messages**: Transforms technical errors to helpful guidance
- **Retryable Detection**: Identifies transient vs permanent failures
- **Structured Logging**: Production-ready error reporting

### Tools Implementation

#### `list_models` Tool
- Stateless operation (no API calls)
- Returns hardcoded model information
- Used for discovery and capability checking
- Fast and reliable

#### `forecast` Tool
- Validates input comprehensively
- Normalizes arrays to SDK format
- Routes to appropriate model (Chronos2 or TiRex)
- Transforms SDK responses
- Comprehensive error handling

## Error Handling

The server uses a `ToolResult<T>` pattern where all tools return either success or failure:

```typescript
// Success response
{
  success: true,
  data: { /* tool-specific response */ }
}

// Error response
{
  success: false,
  error: {
    error_code: "VALIDATION_ERROR",
    message: "Human-readable error message",
    details: "Additional context",
    field: "x"  // If field-specific
  }
}
```

### Error Codes

- **Validation**: `INVALID_PARAMETER`, `MISSING_REQUIRED_FIELD`, `INVALID_VALUE_RANGE`
- **Authentication**: `INVALID_API_KEY`, `AUTHENTICATION_FAILED`
- **Network**: `NETWORK_ERROR`, `TIMEOUT_ERROR`
- **Server**: `INTERNAL_SERVER_ERROR`, `RESOURCE_EXHAUSTED`

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

## Development

### Adding New Tools

1. Create a new file in `src/tools/`
2. Implement the tool handler function
3. Export `TOOL_DEFINITION` constant
4. Add to server's tool handlers
5. Add tests in `tests/tools/`

### Adding New Utilities

1. Create in `src/utils/`
2. Keep single responsibility
3. Add comprehensive comments
4. Export for use by tools
5. Add unit tests

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

## Performance Considerations

- **Client Initialization**: Done once at startup, not per-request
- **Array Normalization**: Minimal overhead, done in-memory
- **Error Messages**: Only detailed on actual errors, no overhead on success
- **Logging**: Disabled in production mode
- **Type Safety**: Zero runtime cost, compile-time only

## Security

- **API Key Management**: Environment variable, never logged
- **Input Validation**: All inputs validated before API calls
- **Error Messages**: Don't expose internal system details
- **Timeout Handling**: Configurable per-request timeouts
- **Type Safety**: Full TypeScript ensures type safety

## Documentation Comments

All source files include comprehensive LLM-friendly comments explaining:
- **What** each component does
- **Why** it's designed that way
- **How** it integrates with other parts
- **Edge cases** and important considerations

This helps both humans and LLMs understand the codebase.

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

### Tests failing
```bash
npm run lint     # Check TypeScript errors
npm test         # Run tests with detailed output
```

### Server not responding
- Check that stdout/stderr are properly connected
- Verify JSON-RPC format of requests
- Check logs for error messages
- Ensure FAIM API is accessible

## License

MIT

## Support

For issues or questions:
1. Check the comprehensive code comments
2. Review test files for usage examples
3. Check error messages for helpful suggestions
4. Review architecture documentation above
