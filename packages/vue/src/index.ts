import { shallowRef, onUnmounted, type Ref } from 'vue';
import type { Guard, Source, GuardState } from '@pulse-js/core';

/**
 * Hook to consume a Pulse Unit (Source or Guard) in a Vue component.
 */
export function usePulse<T>(unit: Source<T>): Ref<T>;
export function usePulse<T>(unit: Guard<T>): Ref<GuardState<T>>;
export function usePulse<T>(unit: Guard<T> | Source<T>): Ref<T | GuardState<T>> {
  const isGuard = unit !== null && typeof unit === 'function' && 'state' in unit;
  
  const state = shallowRef(isGuard ? (unit as Guard<T>).state() : (unit as Source<T>)());
  
  const unsub = (unit as any).subscribe((newVal: any) => {
    state.value = newVal;
  });
  
  onUnmounted(unsub);
  
  return state;
}

/**
 * Explicit hook for Pulse Guards in Vue.
 */
export function useGuard<T>(guard: Guard<T>): Ref<GuardState<T>> {
  return usePulse(guard);
}
