'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSDK } from './use-foundation';

export function useAction<TInput = void, TOutput = void>(actionName: string) {
  const sdk = useSDK();
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: TInput) => {
      const action = (sdk as Record<string, unknown>)[actionName];
      if (typeof action !== 'function') {
        throw new Error(`Action ${actionName} not found in SDK`);
      }
      return action(input) as Promise<TOutput>;
    },
    onError: (err) => {
      setError(err as Error);
    },
    onSuccess: () => {
      setError(null);
      // Invalidate related queries
      queryClient.invalidateQueries();
    },
  });

  const execute = useCallback(
    async (input: TInput) => {
      return mutation.mutateAsync(input);
    },
    [mutation]
  );

  return {
    execute,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: error || mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
