
/**
 * Pulse Core: A semantic reactive system for modern applications.
 * 
 * Provides primitives for managing state (Sources), semantic conditions (Guards),
 * logical composition, and SSR/Hydration.
 */

export * from './tracking';
export * from './source';
export * from './guard';
export * from './compute';
export * from './ssr';
export * from './registry';

import { guard, guardFail, guardOk } from './guard';
import { guardExtensions } from './composition';

/**
 * Pulse Guard with integrated Composition Helpers.
 * 
 * This is the primary entry point for creating reactive conditions.
 * It includes static methods like `.all()`, `.any()`, and `.not()`.
 * 
 * @example
 * ```ts
 * const isReady = guard(() => true);
 * const allReady = guard.all([isReady, isLoaded]);
 * ```
 */
const extendedGuard = Object.assign(guard, guardExtensions);

export { extendedGuard as guard, guardFail, guardOk };
