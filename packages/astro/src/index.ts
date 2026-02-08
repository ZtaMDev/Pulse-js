/**
 * @pulse-js/astro - Astro Integration for Pulse-js
 * 
 * Provides seamless SSR support and client hydration for Pulse state.
 * Works with Astro Islands for partial hydration.
 * 
 * @module @pulse-js/astro
 */

import type { Guard, Source, GuardState, HydrationState } from '@pulse-js/core';

// Re-export core types for convenience
export type { Guard, Source, GuardState, HydrationState };

/**
 * Client-side state container.
 * Populated by the integration's hydration script.
 */
declare global {
  interface Window {
    __PULSE_ASTRO_STATE__?: HydrationState;
  }
}

/**
 * Initializes Pulse on the client side.
 * Call this in your client-side entry point or island component.
 * 
 * @example
 * ```ts
 * // In an Astro island component
 * import { initPulseClient } from '@pulse-js/astro';
 * initPulseClient();
 * ```
 */
export async function initPulseClient(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const state = window.__PULSE_ASTRO_STATE__;
  if (!state) return;
  
  // Dynamically import hydrate to avoid SSR issues
  const { hydrate } = await import('@pulse-js/core');
  hydrate(state);
}

/**
 * Server-side: Evaluates guards and returns serialized state for hydration.
 * 
 * @param guards Guards to evaluate on the server.
 * @returns Serialized state as JSON string.
 * 
 * @example
 * ```astro
 * ---
 * import { evaluateForHydration } from '@pulse-js/astro';
 * import { userGuard } from '../state/auth';
 * 
 * const pulseState = await evaluateForHydration([userGuard]);
 * ---
 * <script is:inline set:html={`window.__PULSE_ASTRO_STATE__ = ${pulseState}`} />
 * ```
 */
export async function evaluateForHydration(guards: Guard<any>[]): Promise<string> {
  const { evaluate } = await import('@pulse-js/core');
  const state = await evaluate(guards);
  return JSON.stringify(state);
}

/**
 * Creates a hydration script tag for Astro pages.
 * 
 * @param guards Guards to hydrate on the client.
 * @returns HTML string to inject into the page.
 * 
 * @example
 * ```astro
 * ---
 * import { createHydrationScript } from '@pulse-js/astro';
 * import { authGuard } from '../state/auth';
 * 
 * const script = await createHydrationScript([authGuard]);
 * ---
 * <Fragment set:html={script} />
 * ```
 */
export async function createHydrationScript(guards: Guard<any>[]): Promise<string> {
  const state = await evaluateForHydration(guards);
  return `<script>window.__PULSE_ASTRO_STATE__=${state}</script>`;
}

/**
 * Hook for use in Astro framework components (React, Vue, Svelte islands).
 * Returns the raw value or state, handling SSR appropriately.
 * 
 * @template T The value type.
 * @param unit A Source or Guard to read.
 * @returns Current value (Source) or GuardState (Guard).
 */
export function usePulseSSR<T>(unit: Source<T>): T;
export function usePulseSSR<T>(unit: Guard<T>): GuardState<T>;
export function usePulseSSR<T>(unit: Source<T> | Guard<T>): T | GuardState<T> {
  const isGuard = unit !== null && typeof unit === 'function' && 'state' in unit;
  
  if (isGuard) {
    return (unit as Guard<T>).state();
  }
  return (unit as Source<T>)();
}

/**
 * Utility to get a snapshot of all reactive state for debugging.
 * Only works on the server during SSR.
 */
export async function getServerSnapshot(guards: Guard<any>[]): Promise<Record<string, any>> {
  const snapshot: Record<string, any> = {};
  
  for (const g of guards) {
    const name = (g as any)._name || 'unnamed';
    const state = g.state();
    snapshot[name] = {
      status: state.status,
      value: state.value,
      reason: state.reason?.message
    };
  }
  
  return snapshot;
}
