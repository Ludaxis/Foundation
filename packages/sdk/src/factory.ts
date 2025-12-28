import { FoundationClient, type ClientConfig } from './client.js';

export interface FoundationSDK {
  client: FoundationClient;
  // Action methods will be added here by generator
  [key: string]: unknown;
}

export function createFoundationSDK(config: ClientConfig): FoundationSDK {
  const client = new FoundationClient(config);

  // Base SDK with client
  const sdk: FoundationSDK = {
    client,
  };

  // Generated action methods will be added by fd generate
  // They follow the pattern: sdk.actionName(input)

  return sdk;
}
