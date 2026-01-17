import { readable, type Readable } from 'svelte/store';
import type { Guard, Source, GuardState } from '@pulse-js/core';

/**
 * Pulse-JS Svelte Integration
 * 
 * This package provides two ways to consume Pulse state:
 * 1. Runes (Svelte 5+): Native, fine-grained reactivity using $state and $effect.
 * 2. Stores (Svelte 4/5): Legacy Svelte stores for backward compatibility.
 */

/**
 * usePulse (Svelte 5 Runes)
 * 
 * Returns a reactive wrapper for a Pulse Unit.
 * 
 * - For Sources: Returns a stable object { value: T } where .value is reactive.
 * - For Guards: Returns a proxy that behaves like the GuardState, but is reactive to updates.
 */
export function usePulse<T>(unit: Source<T>): { value: T };
export function usePulse<T>(unit: Guard<T>): GuardState<T>;
export function usePulse<T>(unit: Guard<T> | Source<T>): any {
  const isGuard = unit !== null && typeof unit === 'function' && 'state' in unit;

  if (isGuard) {
    const g = unit as Guard<T>;
    // In Svelte 5, to keep the identity of the returned object stable while
    // the internal state changes, we use a container and a Proxy.
    const container = $state({ data: g.state() });
    
    $effect(() => {
        return g.subscribe(v => {
            container.data = v;
        });
    });

    return new Proxy({}, {
      get(_, prop) {
        // Accessing container.data[prop] inside the get trap ensures
        // Svelte tracks the dependency on the 'container.data' property.
        return container.data[prop as keyof GuardState<T>];
      },
      // Ensure spread operators and other object features work
      ownKeys() {
        return Reflect.ownKeys(container.data);
      },
      getOwnPropertyDescriptor(_, prop) {
        return Reflect.getOwnPropertyDescriptor(container.data, prop);
      }
    });
  } else {
    const s = unit as Source<T>;
    // For Sources, we return a "box" object. This is a common pattern in Svelte 5
    // for primitive or frequently-swapped values.
    const box = $state({ value: s() });
    
    $effect(() => {
        return s.subscribe(v => {
            box.value = v;
        });
    });

    return box;
  }
}

/**
 * useGuard (Svelte 5 Runes)
 * Alias for usePulse(guard).
 */
export function useGuard<T>(guard: Guard<T>): GuardState<T> {
  return usePulse(guard);
}

/**
 * usePulseStore (Legacy)
 * Returns a Svelte Readable store. Use this in Svelte 4 or if you prefer store syntax.
 */
export function usePulseStore<T>(unit: Source<T>): Readable<T>;
export function usePulseStore<T>(unit: Guard<T>): Readable<GuardState<T>>;
export function usePulseStore<T>(unit: Guard<T> | Source<T>): Readable<any> {
    const isGuard = unit !== null && typeof unit === 'function' && 'state' in unit;
    return readable(isGuard ? (unit as Guard<any>).state() : (unit as Source<any>)(), (set) => {
        return (unit as any).subscribe(set);
    });
}
