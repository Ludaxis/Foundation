// Foundation SDK - Core client

export { FoundationClient, type ClientConfig, type ApiError } from './client.js';
export { createFoundationSDK, type FoundationSDK } from './factory.js';

// Re-export generated types (these will be populated by fd generate)
export * from './__generated__/index.js';
