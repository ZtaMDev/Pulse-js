import { readable, type Readable } from 'svelte/store';
import type { Guard, Source, GuardState } from '@pulse-js/core';

/**
 * Hook to consume a Pulse Unit (Source or Guard) as a Svelte Store.
 */
export function usePulse<T>(unit: Source<T>): Readable<T>;
export function usePulse<T>(unit: Guard<T>): Readable<GuardState<T>>;
export function usePulse<T>(unit: Guard<T> | Source<T>): Readable<T | GuardState<T>> {
  const isGuard = unit !== null && typeof unit === 'function' && 'state' in unit;
  
  return readable(isGuard ? (unit as Guard<T>).state() : (unit as Source<T>)(), (set) => {
    return (unit as any).subscribe(set);
  });
}

/**
 * Explicit hook for Pulse Guards in Svelte.
 */
export function useGuard<T>(guard: Guard<T>): Readable<GuardState<T>> {
  return usePulse(guard);
}
