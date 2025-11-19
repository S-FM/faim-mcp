/**
 * FAIM Client Singleton Management
 *
 * This module handles the initialization and management of the FaimClient
 * instance used throughout the MCP server.
 *
 * Why a singleton?
 * - The FaimClient maintains state (timeout, retry config, base URL)
 * - We only want one instance to avoid redundant initialization
 * - The API key is expensive to parse - we do it once at startup
 *
 * Error Handling:
 * - If API key is missing, fails fast during startup (not during requests)
 * - Provides clear error messages for configuration issues
 *
 * LLM Context: This module ensures that every tool has access to a properly
 * configured client instance without reimplementing initialization logic.
 */

import { FaimClient } from '@faim-group/sdk-forecasting';

/** Global singleton instance of FaimClient */
let clientInstance: FaimClient | null = null;

/** Flag to track if initialization has been attempted */
let initializationAttempted = false;

/** Stores any initialization error for better error reporting */
let initializationError: Error | null = null;

/**
 * Initialize the FAIM client singleton
 *
 * This function:
 * 1. Reads the API key from environment variables
 * 2. Creates a FaimClient instance with the key
 * 3. Caches it for reuse across multiple tool calls
 *
 * Called once at server startup, before any tools are invoked.
 *
 * Environment Variables:
 * - FAIM_API_KEY: Required. The API key for authenticating with FAIM API
 *
 * Throws: Error if FAIM_API_KEY is not set
 *
 * @throws {Error} When FAIM_API_KEY environment variable is not set
 * @returns {void}
 */
export function initializeClient(): void {
  // Prevent multiple initialization attempts
  if (initializationAttempted) {
    if (initializationError) {
      throw initializationError;
    }
    return;
  }

  initializationAttempted = true;

  try {
    // Read API key from environment
    const apiKey = process.env.FAIM_API_KEY;

    // Fail fast if API key is missing
    if (!apiKey || apiKey.trim().length === 0) {
      initializationError = new Error(
        'FAIM_API_KEY environment variable is not set. ' +
        'Please set it before starting the MCP server.'
      );
      throw initializationError;
    }

    // Initialize the FAIM client with optional configuration
    // The SDK handles timeout and retry configuration internally
    clientInstance = new FaimClient(apiKey, {
      // Timeout for individual requests (30 seconds)
      // This is a reasonable default for most forecasting tasks
      timeout: 30000,

      // Maximum number of retries for transient failures
      // The SDK implements exponential backoff internally
      maxRetries: 2,

      // Optional: custom base URL for different environments
      // Default is the production FAIM API endpoint
      // Users can override via FAIM_API_BASE_URL environment variable
      baseUrl: process.env.FAIM_API_BASE_URL,
    });

    // Log successful initialization (without exposing the API key)
    console.log('FAIM client initialized successfully');
  } catch (error) {
    // Store the error for later retrieval
    initializationError = error instanceof Error ? error : new Error(String(error));
    throw initializationError;
  }
}

/**
 * Get the singleton FAIM client instance
 *
 * This function:
 * 1. Returns the cached client if available
 * 2. Throws an error if initialization hasn't been done or failed
 *
 * Should be called by all tools that need to make API requests.
 *
 * Throws: Error if client hasn't been initialized (indicates server startup failure)
 *
 * @throws {Error} When client hasn't been initialized
 * @returns {FaimClient} The singleton client instance
 *
 * Example:
 * ```typescript
 * const client = getClient(); // Safe after initializeClient() is called
 * const result = await client.forecastChronos2({...});
 * ```
 */
export function getClient(): FaimClient {
  // If initialization failed, re-throw the error
  if (initializationError) {
    throw initializationError;
  }

  // If initialization hasn't been attempted, indicate this is a startup issue
  if (!clientInstance) {
    throw new Error(
      'FAIM client not initialized. Call initializeClient() during server startup.'
    );
  }

  return clientInstance;
}

/**
 * Reset the client singleton (mainly for testing)
 *
 * This allows tests to reinitialize the client with different configurations
 * or simulate initialization errors.
 *
 * Warning: Only use this in test environments!
 *
 * @internal For testing purposes only
 */
export function resetClient(): void {
  clientInstance = null;
  initializationAttempted = false;
  initializationError = null;
}

/**
 * Check if the client has been successfully initialized
 *
 * Useful for health checks or debugging.
 *
 * @returns {boolean} true if client is ready to use
 */
export function isClientReady(): boolean {
  return clientInstance !== null && initializationError === null;
}
