import { useSyncExternalStore } from 'react';
import type { Guard, Source, GuardState } from '@pulse-js/core';
import type { PulseObject } from '@pulse-js/core';

const isServer = typeof window === 'undefined';

// Cache for Guard promises to support React Suspense
const promiseCache = new WeakMap<Guard<any>, Promise<any>>();

function getGuardPromise(g: Guard<any>): Promise<any> {
    if (promiseCache.has(g)) return promiseCache.get(g)!;

    const promise = new Promise((resolve) => {
        const check = () => {
            const state = g.state();
            if (state.status !== 'pending') {
                unsub();
                resolve(state);
            }
        };
        const unsub = g.subscribe(check);
        check();
    });

    promiseCache.set(g, promise);
    return promise;
}

/**
 * Hook to consume a Pulse Unit (Source or Guard) in a React component.
 * 
 * - If passed a **Source**, it returns the current value and triggers a re-render when the value changes.
 * - If passed a **Guard**, it returns the current `GuardState` (ok, fail, pending, reason, value) 
 *   and triggers a re-render when the status or value changes.
 * 
 * @template T The underlying type of the reactive unit.
 * @param unit The Pulse Source or Guard to observe.
 * @returns The current value or guard state.
 * 
 * @example
 * ```tsx
 * // Using a Source
 * const count = usePulse(countSource);
 * 
 * // Using a Guard
 * const { status, reason, value } = usePulse(authGuard);
 * 
 * if (status === 'pending') return <Loading />;
 * if (status === 'fail') return <ErrorMessage message={reason} />;
 * return <Dashboard user={value} />;
 * ```
 */
export function usePulse<T>(unit: Source<T>): T;
export function usePulse<T>(unit: Guard<T>): GuardState<T>;
export function usePulse<T>(unit: Guard<T> | Source<T>): T | GuardState<T> {
  const isGuard = unit !== null && typeof unit === 'function' && 'state' in unit;

  // SSR / Server Components support:
  // If we're on the server, we just return the current snapshot without subscribing.
  if (isServer) {
    return isGuard ? (unit as Guard<T>).state() : (unit as Source<T>)();
  }

  // useSyncExternalStore will handle hydration and client-side subscriptions.
  if (isGuard) {
    const g = unit as Guard<T>;
    return useSyncExternalStore(
      g.subscribe,
      () => g.state(),
      () => g.state()
    );
  } else {
    const s = unit as Source<T>;
    return useSyncExternalStore(
      s.subscribe,
      () => s(),
      () => s()
    );
  }
}

/**
 * Options for useGuard hook.
 */
export interface UseGuardOptions {
  /**
   * If true, the hook will throw a promise when the guard is in 'pending' state,
   * triggering the nearest React Suspense boundary.
   */
  suspend?: boolean;
}

/**
 * Explicit hook for Pulse Guards.
 * Returns the current GuardState and updates on changes.
 * 
 * @example
 * const { ok, value, reason } = useGuard(authGuard, { suspend: true });
 */
export function useGuard<T>(guard: Guard<T>, options?: UseGuardOptions): GuardState<T> {
  const state = usePulse(guard);
  
  if (options?.suspend && state.status === 'pending') {
    throw getGuardPromise(guard);
  }
  
  return state;
}

/**
 * Hook for Pulse Objects (v2 Proxy-based reactive objects).
 * 
 * Returns a snapshot of the reactive object that triggers re-renders
 * when any property changes.
 * 
 * @template T The type of the Pulse object.
 * @param pulseObj A Pulse object created with pulse().
 * @returns The current state of the object.
 * 
 * @example
 * ```tsx
 * const auth = pulse({ user: null, loading: false });
 * 
 * function Profile() {
 *   const state = usePulseObject(auth);
 *   if (state.loading) return <Spinner />;
 *   return <div>{state.user?.name}</div>;
 * }
 * ```
 */
export function usePulseObject<T extends object>(pulseObj: PulseObject<T>): T {
  if (isServer) {
    return pulseObj.$snapshot();
  }
  
  return useSyncExternalStore(
    pulseObj.$subscribe,
    () => pulseObj as T,
    () => pulseObj.$snapshot()
  );
}

/**
 * Formats a guard reason for display in React components.
 * Handles both string reasons and GuardReason objects.
 * 
 * @param reason - The reason from a guard state
 * @returns A string suitable for rendering in React
 * 
 * @example
 * ```tsx
 * const { status, reason } = usePulse(myGuard);
 * return <p>Error: {formatReason(reason)}</p>;
 * ```
 */
export function formatReason(reason: string | { toString(): string } | undefined): string {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  return reason.toString();
}


