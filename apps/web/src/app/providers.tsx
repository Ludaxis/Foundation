'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { FoundationProvider } from '@foundation/sdk/react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <FoundationProvider
      config={{
        baseUrl: apiUrl,
        getAuthToken: () => {
          // Demo auth - replace with real auth provider
          return localStorage.getItem('auth_token') || '';
        },
      }}
      queryClient={queryClient}
    >
      {children}
    </FoundationProvider>
  );
}
