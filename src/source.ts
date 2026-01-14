
import { getCurrentGuard, type Trackable, type Subscriber } from './tracking';
import { PulseRegistry } from './registry';

/**
 * Options for configuring a Pulse Source.
 * 
 * @template T - The type of value stored in the source.
 */
export interface SourceOptions<T> {
  /** 
   * A descriptive name for the source.
   * Required for SSR hydration and highly recommended for debugging in DevTools.
   */
  name?: string;

  /**
   * Custom equality function to determine if a value has changed.
   * By default, Pulse uses strict equality (`===`).
   * 
   * @param a - The current value.
   * @param b - The new value.
   * @returns `true` if the values are considered equal, `false` otherwise.
   * 
   * @example
   * ```ts
   * const list = source([1], { 
   *   equals: (a, b) => a.length === b.length 
   * });
   * ```
   */
  equals?: (a: T, b: T) => boolean;
}

/**
 * A Pulse Source is a reactive container for a value.
 * It tracks which Guards read its value and notifies them when it changes.
 * 
 * @template T The type of the value held by the source.
 */
export interface Source<T> {
  /**
   * Returns the current value of the source.
   * If called within a Guard evaluation, it automatically registers that Guard as a dependent.
   * 
   * @example
   * ```ts
   * const count = source(0);
   * console.log(count()); // 0
   * ```
   */
  (): T;

  /**
   * Updates the source with a new value.
   * If the value is different (based on strict equality or `options.equals`), 
   * all dependent Guards and subscribers will be notified.
   * 
   * @param value The new value to set.
   * 
   * @example
   * ```ts
   * const count = source(0);
   * count.set(1); // Triggers re-evaluation of dependents
   * ```
   * 
   * @error
   * Common error: Mutating an object property without setting a new object reference.
   * Pulse uses reference equality by default. If you mutate a property, Pulse won't know it changed.
   * Solution: Always provide a new object or implement a custom `equals`.
   */
  set(value: T): void;

  /**
   * Updates the source value using a transformer function based on the current value.
   * Useful for increments or toggles.
   * 
   * @param updater A function that receives the current value and returns the new value.
   * 
   * @example
   * ```ts
   * const count = source(0);
   * count.update(n => n + 1);
   * ```
   */
  update(updater: (current: T) => T): void;

  /**
   * Manually subscribes to changes in the source value.
   * 
   * @param listener A callback that receives the new value.
   * @returns An unsubscription function.
   * 
   * @note Most users should use `guard()` or `usePulse()` instead of manual subscriptions.
   */
  subscribe(listener: Subscriber<T>): () => void;
}

/**
 * Creates a new Pulse Source.
 * 
 * Sources are the fundamental building blocks of state in Pulse. They hold a value
 * and track which Guards depend on them.
 * 
 * @template T - The type of value to store.
 * @param initialValue - The initial state.
 * @param options - Configuration options (name, equality).
 * @returns A reactive Pulse Source.
 * 
 * @example
 * ```ts
 * const user = source({ name: 'Alice' }, { name: 'user_state' });
 * 
 * // Read value (auto-tracks if inside a guard)
 * console.log(user());
 * 
 * // Update value
 * user.set({ name: 'Bob' });
 * ```
 */
export function source<T>(initialValue: T, options: SourceOptions<T> = {}): Source<T> {
  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();
  const dependents = new Set<Trackable>();

  const s = (() => {
    const activeGuard = getCurrentGuard();
    if (activeGuard) {
      dependents.add(activeGuard);
      activeGuard.addDependency(s);
    }
    return value;
  }) as Source<T>;

  s.set = (newValue: T) => {
    const equals = options.equals || ((a, b) => a === b);
    if (!equals(value, newValue)) {
      value = newValue;
      subscribers.forEach(sub => sub(value));
      
      const deps = Array.from(dependents);
      // We clear dependents because guards will re-register during their re-evaluation
      dependents.clear();
      deps.forEach(dep => dep.notify());
    }
  };

  s.update = (updater: (current: T) => T) => {
    s.set(updater(value));
  };

  s.subscribe = (listener: Subscriber<T>) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  (s as any)._name = options.name;

  PulseRegistry.register(s);

  return s;
}
