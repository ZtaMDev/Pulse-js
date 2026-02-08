import type { Guard } from './guard';

/**
 * Extracts the result type T from a Guard<T>.
 * 
 * @example
 * ```ts
 * const authGuard = guard('auth', async () => fetchUser());
 * type AuthUser = InferGuardType<typeof authGuard>; // User
 * ```
 */
export type InferGuardType<T> = T extends Guard<infer U> ? U : never;