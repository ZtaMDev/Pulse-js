
/**
 * Pulse Core: A semantic reactive system for modern applications.
 * 
 * Provides primitives for managing state (Sources), semantic conditions (Guards),
 * logical composition, and SSR/Hydration.
 * 
 * v2: Adds Proxy-based reactive objects (pulse), Signals, and batch updates.
 */

// Core tracking system
export * from './tracking';

// v1 API - Sources (backwards compatible)
export * from './source';

// v2 API - Signals and Pulse Objects
export * from './signal';
export * from './pulse';

// Guard system (enhanced for v2)
export * from './guard';
export * from './compute';

// SSR support
export * from './ssr';

// Registry and types
export * from './registry';
export * from './types';

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

