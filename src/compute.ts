import { guard, type Guard } from './guard';

/**
 * Utility to transform reactive dependencies into a new derived value.
 * 
 * Works like a memoized computation that automatically re-evaluates when 
 * any of its dependencies change. Unlike a Guard, compute is intended for 
 * pure transformations and does not have a failure reason by default.
 * 
 * @template T - The type of input values.
 * @template R - The type of the computed result.
 * @param name - A unique name for the computation (required for SSR).
 * @param dependencies - An array of sources or guards to observe.
 * @param processor - A function that derives the new value.
 * @returns A Pulse Guard holding the computed result.
 * 
 * @example
 * ```ts
 * const fullName = compute('full-name', [firstName, lastName], (f, l) => `${f} ${l}`);
 * ```
 */
export function compute<R>(
  name: string,
  dependencies: any[],
  processor: (...args: any[]) => R
): Guard<R> {
  return guard(name, () => {
    const values = dependencies.map(dep => (typeof dep === 'function' ? dep() : dep));
    return processor(...values);
  }, 4);
}
