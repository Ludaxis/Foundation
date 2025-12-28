'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createFoundationSDK, type FoundationSDK } from './factory.js';
import type { ClientConfig } from './client.js';

interface FoundationContextValue {
  sdk: FoundationSDK;
}

const FoundationContext = createContext<FoundationContextValue | null>(null);

export function useFoundation(): FoundationContextValue {
  const context = useContext(FoundationContext);
  if (!context) {
    throw new Error('useFoundation must be used within a FoundationProvider');
  }
  return context;
}

export function useSDK(): FoundationSDK {
  return useFoundation().sdk;
}

interface FoundationProviderProps {
  config: ClientConfig;
  children: ReactNode;
  queryClient?: QueryClient;
}

export function FoundationProvider({
  config,
  children,
  queryClient,
}: FoundationProviderProps) {
  const sdk = createFoundationSDK(config);
  const client = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
      },
    },
  });

  return (
    <QueryClientProvider client={client}>
      <FoundationContext.Provider value={{ sdk }}>
        {children}
      </FoundationContext.Provider>
    </QueryClientProvider>
  );
}

// Re-export react-query hooks for convenience
export {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
