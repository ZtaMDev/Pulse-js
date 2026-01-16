import { guard, type Guard } from './guard';
import { compute } from './compute';

/**
 * Type guard to check if a target is a Pulse Guard.
 * Useful for building custom meta-guards or conditional logic in adapters.
 */
export function isGuard(target: any): target is Guard<any> {
  return typeof target === 'function' && 'ok' in target;
}

/**
 * Creates a composite guard that is 'ok' only if ALL provided guards are 'ok'.
 * If any guard fails, this guard also fails and adopts the reason of the FIRST failing guard.
 * 
 * @param nameOrGuards Optional name for the guard or the array of guards.
 * @param maybeGuards The array of guards (if name was provided).
 * 
 * @example
 * ```ts
 * const canPost = guard.all('can-post', [isLoggedIn, hasPostPermission, emailVerified]);
 * 
 * // If isLoggedIn fails with reason "Unauthorized",
 * // canPost.reason() will also be "Unauthorized".
 * ```
 */
export function guardAll(nameOrGuards: string | Guard<any>[], maybeGuards?: Guard<any>[]): Guard<boolean> {
  const name = typeof nameOrGuards === 'string' ? nameOrGuards : undefined;
  const guards = Array.isArray(nameOrGuards) ? nameOrGuards : maybeGuards!;

  return guard(name, () => {
    let firstFail: Guard<any> | null = null;
    for (const g of guards) {
      if (!g.ok()) {
        if (!firstFail) firstFail = g;
      }
    }
    if (firstFail) {
      // Propagate reason via throw so the parent guard adopts it
      const reason = firstFail.reason();
      const message = typeof reason === 'string' ? reason : (reason?.toString() || 'condition failed');
      throw new Error(message);
    }
    return true;
  });
}

/**
 * Creates a composite guard that is 'ok' if AT LEAST ONE provided guard is 'ok'.
 * If all guards fail, this guard fails and concatenates their reasons.
 * 
 * @param nameOrGuards Optional name for the guard or the array of guards.
 * @param maybeGuards The array of guards (if name was provided).
 * 
 * @example
 * ```ts
 * const isStaff = guard.any('is-staff', [isAdmin, isEditor, isModerator]);
 * ```
 */
export function guardAny(nameOrGuards: string | Guard<any>[], maybeGuards?: Guard<any>[]): Guard<boolean> {
  const name = typeof nameOrGuards === 'string' ? nameOrGuards : undefined;
  const guards = Array.isArray(nameOrGuards) ? nameOrGuards : maybeGuards!;

  return guard(name, () => {
    let allFails: string[] = [];
    for (const g of guards) {
      if (g.ok()) return true;
      const reason = g.reason();
      const message = typeof reason === 'string' ? reason : (reason?.toString() || 'failed');
      allFails.push(message);
    }
    throw new Error(allFails.length > 0 ? allFails.join(' and ') : 'no conditions met');
  });
}

/**
 * Negates a Pulse Guard, Source, or boolean-returning function.
 * 
 * @param nameOrTarget Optional name or the target to negate.
 * @param maybeTarget The target to negate (if name was provided).
 * 
 * @example
 * ```ts
 * const isGuest = guard.not('is-guest', isLoggedIn);
 * ```
 */
export function guardNot(nameOrTarget: string | Guard<any> | (() => any), maybeTarget?: Guard<any> | (() => any)): Guard<boolean> {
  const name = typeof nameOrTarget === 'string' ? nameOrTarget : undefined;
  const target = typeof nameOrTarget === 'string' ? maybeTarget! : nameOrTarget;

  return guard(name, () => {
    if (isGuard(target)) {
      return !target.ok();
    }
    return !target();
  });
}

/**
 * Utility to transform reactive dependencies into a new derived value.
 * 
 * Works like a memoized computation that automatically re-evaluates when 
 * any of its dependencies change.
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
 * const fullName = guard.compute('full-name', [firstName, lastName], (f, l) => `${f} ${l}`);
 * ```
 */


/**
 * Internal extensions object for the `guard` function.
 * @internal
 */
export const guardExtensions = {
  all: guardAll,
  any: guardAny,
  not: guardNot,
  compute: compute
};
