/**
 * @pulse-js/tanstack - TanStack Query Integration for Pulse-js
 * 
 * Bridge between TanStack Query's server state management and
 * Pulse's reactive Guards system. Allows using Query results
 * as Guards for composition with other Pulse primitives.
 * 
 * @module @pulse-js/tanstack
 */

import { guard, guardFail, type Guard, type GuardState } from '@pulse-js/core';
import type { QueryObserverResult, QueryClient, QueryKey } from '@tanstack/query-core';

/**
 * Result type from a TanStack Query hook (useQuery, useSuspenseQuery, etc.)
 */
export interface QueryResult<TData = unknown, TError = Error> {
  data?: TData;
  error?: TError | null;
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  isFetching?: boolean;
  status?: 'pending' | 'error' | 'success';
  fetchStatus?: 'fetching' | 'paused' | 'idle';
}

/**
 * Options for creating a Guard from a Query.
 */
export interface GuardFromQueryOptions {
  /**
   * Name for the Guard (used in DevTools).
   */
  name?: string;
  
  /**
   * Treat `isPending` as pending state.
   * @default true
   */
  pendingOnLoading?: boolean;
  
  /**
   * Custom error message transformer.
   */
  errorMessage?: (error: any) => string;
}

/**
 * Creates a Pulse Guard from a TanStack Query result.
 * 
 * The Guard will reflect the query's loading, error, and success states:
 * - `pending`: When the query is loading/fetching
 * - `fail`: When the query has an error
 * - `ok`: When the query has data
 * 
 * @template TData Query data type
 * @template TError Query error type
 * @param getQuery Function that returns the query result (from useQuery, etc.)
 * @param options Configuration options
 * @returns A Pulse Guard that wraps the query state
 * 
 * @example
 * ```tsx
 * // In a React component
 * import { useQuery } from '@tanstack/react-query';
 * import { guardFromQuery } from '@pulse-js/tanstack';
 * 
 * function UserProfile() {
 *   const query = useQuery({ queryKey: ['user'], queryFn: fetchUser });
 *   const userGuard = guardFromQuery(() => query, { name: 'user-profile' });
 *   
 *   // userGuard can now be composed with other guards
 *   const canEditProfile = guard.all([isAuthenticated, userGuard]);
 * }
 * ```
 */
export function guardFromQuery<TData, TError = Error>(
  getQuery: () => QueryResult<TData, TError>,
  options: GuardFromQueryOptions = {}
): Guard<TData | undefined> {
  const {
    name = 'query-guard',
    pendingOnLoading = true,
    errorMessage = (e) => e?.message || 'Query failed'
  } = options;
  
  return guard(name, () => {
    const result = getQuery();
    
    // Determine pending state
    const isPending = pendingOnLoading && (
      result.isLoading || 
      result.isPending || 
      result.status === 'pending' ||
      result.fetchStatus === 'fetching'
    );
    
    if (isPending) {
      return undefined; // Guard pending
    }
    
    // Check for errors
    if (result.isError || result.error) {
      guardFail(errorMessage(result.error));
    }
    
    // Success - return data
    return result.data;
  });
}

/**
 * Options for creating a Query-like interface from a Guard.
 */
export interface QueryFromGuardOptions {
  /**
   * Query key for cache identification.
   */
  queryKey?: QueryKey;
}

/**
 * Result type that mimics TanStack Query's result shape.
 */
export interface QueryLikeResult<TData> {
  data?: TData;
  error?: string;
  isLoading: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  status: 'pending' | 'error' | 'success';
  
  /** Access the underlying Guard for full Pulse integration */
  $guard: Guard<TData>;
}

/**
 * Creates a TanStack Query-like interface from a Pulse Guard.
 * 
 * Useful for migrating from TanStack Query to Pulse Guards
 * or for interoperability with code expecting Query-shaped results.
 * 
 * @template TData Guard value type
 * @param g The Pulse Guard to wrap
 * @returns A Query-like result object
 * 
 * @example
 * ```ts
 * const userGuard = guard('user', async () => fetchUser());
 * const queryLike = queryFromGuard(userGuard);
 * 
 * if (queryLike.isLoading) return <Loading />;
 * if (queryLike.isError) return <Error message={queryLike.error} />;
 * return <UserProfile data={queryLike.data} />;
 * ```
 */
export function queryFromGuard<TData>(g: Guard<TData>): QueryLikeResult<TData> {
  const state = g.state();
  
  return {
    data: state.value,
    error: state.reason ? (typeof state.reason === 'string' ? state.reason : state.reason.message) : undefined,
    isLoading: state.status === 'pending',
    isPending: state.status === 'pending',
    isError: state.status === 'fail',
    isSuccess: state.status === 'ok',
    status: state.status === 'pending' ? 'pending' : 
            state.status === 'fail' ? 'error' : 'success',
    $guard: g
  };
}

/**
 * Subscribes a Guard to a TanStack Query's cache for reactive updates.
 * 
 * When the query's cache entry updates, the Guard will automatically
 * re-evaluate and reflect the new state.
 * 
 * @param queryClient The TanStack QueryClient instance
 * @param queryKey The query key to subscribe to
 * @param options Guard options
 * @returns A Guard that stays synchronized with the query cache
 * 
 * @example
 * ```ts
 * import { QueryClient } from '@tanstack/query-core';
 * import { guardFromQueryCache } from '@pulse-js/tanstack';
 * 
 * const queryClient = new QueryClient();
 * const userGuard = guardFromQueryCache(queryClient, ['user'], {
 *   name: 'user-cache-guard'
 * });
 * 
 * // Guard updates when cache updates
 * queryClient.setQueryData(['user'], { name: 'Alice' });
 * ```
 */
export function guardFromQueryCache<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  options: GuardFromQueryOptions = {}
): Guard<TData | undefined> {
  const { name = 'cache-guard' } = options;
  
  return guard(name, () => {
    const state = queryClient.getQueryState<TData>(queryKey);
    
    if (!state) {
      return undefined; // Not in cache yet
    }
    
    if (state.status === 'pending' || state.fetchStatus === 'fetching') {
      return undefined;
    }
    
    if (state.status === 'error') {
      guardFail(state.error?.message || 'Query cache error');
    }
    
    return state.data;
  });
}

/**
 * Utility to sync a Guard's value back to TanStack Query cache.
 * 
 * @param queryClient The TanStack QueryClient instance
 * @param queryKey The query key to update
 * @param g The Guard whose value to sync
 */
export function syncGuardToCache<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  g: Guard<TData>
): () => void {
  return g.subscribe((state) => {
    if (state.status === 'ok' && state.value !== undefined) {
      queryClient.setQueryData(queryKey, state.value);
    }
  });
}

// Re-export core types
export type { Guard, GuardState };
