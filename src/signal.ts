/**
 * Pulse Signal - Low-level reactive primitive
 * 
 * Internal building block for fine-grained reactivity.
 * Signals are the foundation for both `source()` and `pulse()` APIs.
 * 
 * @internal
 */

import { getCurrentGuard, type Trackable, type Subscriber } from './tracking';

/**
 * A reactive signal holding a value.
 * @template T The type of value held by the signal.
 */
export interface Signal<T> {
  /** Get the current value, auto-tracking if inside a Guard. */
  get(): T;
  /** Set a new value, notifying all dependents. */
  set(value: T): void;
  /** Update value using a transformer function. */
  update(fn: (current: T) => T): void;
  /** Subscribe to value changes. */
  subscribe(listener: Subscriber<T>): () => void;
  /** Get value without tracking (break dependency). */
  peek(): T;
}

/** Batched updates queue */
let batchQueue: Set<() => void> | null = null;
let batchDepth = 0;

/**
 * Batch multiple reactive updates into a single notification cycle.
 * Reduces unnecessary re-evaluations when updating multiple signals.
 * 
 * @param fn Function containing multiple signal updates.
 * 
 * @example
 * ```ts
 * batch(() => {
 *   count.set(1);
 *   name.set('Alice');
 *   // Dependents notified only once after both updates
 * });
 * ```
 */
export function batch(fn: () => void): void {
  batchDepth++;
  if (!batchQueue) {
    batchQueue = new Set();
  }
  
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && batchQueue) {
      const queue = batchQueue;
      batchQueue = null;
      queue.forEach(notify => notify());
    }
  }
}

/**
 * Schedule a notification, batching if inside a batch() call.
 * @internal
 */
function scheduleNotification(notify: () => void): void {
  if (batchQueue) {
    batchQueue.add(notify);
  } else {
    notify();
  }
}

/**
 * Creates a low-level reactive signal.
 * 
 * Signals automatically track dependencies when read inside a Guard context.
 * When the signal value changes, all dependent Guards are re-evaluated.
 * 
 * @template T The type of value to store.
 * @param initialValue The initial value.
 * @param equals Optional equality function (defaults to ===).
 * @returns A reactive Signal.
 * 
 * @example
 * ```ts
 * const count = createSignal(0);
 * count.get(); // 0
 * count.set(5);
 * count.get(); // 5
 * ```
 */
export function createSignal<T>(
  initialValue: T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();
  const dependents = new Set<Trackable>();

  const notify = () => {
    // Notify subscribers
    subscribers.forEach(sub => sub(value));
    
    // Notify dependent guards - copy to avoid mutation during iteration
    const deps = Array.from(dependents);
    dependents.clear();
    deps.forEach(dep => dep.notify());
  };

  const signal: Signal<T> = {
    get() {
      const activeGuard = getCurrentGuard();
      if (activeGuard) {
        dependents.add(activeGuard);
        activeGuard.addDependency(signal);
      }
      return value;
    },

    peek() {
      return value;
    },

    set(newValue: T) {
      if (!equals(value, newValue)) {
        value = newValue;
        scheduleNotification(notify);
      }
    },

    update(fn: (current: T) => T) {
      signal.set(fn(value));
    },

    subscribe(listener: Subscriber<T>) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    }
  };

  return signal;
}

/**
 * Effect tracking - run a function when its dependencies change.
 * Similar to Solid's createEffect or Vue's watchEffect.
 * 
 * @param fn The effect function to run.
 * @returns Cleanup function to stop the effect.
 * 
 * @example
 * ```ts
 * const count = createSignal(0);
 * const cleanup = effect(() => {
 *   console.log('Count changed:', count.get());
 * });
 * // Later: cleanup() to stop
 * ```
 */
export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: (() => void) | void;
  let disposed = false;

  const run = () => {
    if (disposed) return;
    
    // Run previous cleanup if exists
    if (cleanup) cleanup();
    
    // Run effect
    cleanup = fn();
  };

  // Initial run
  run();

  return () => {
    disposed = true;
    if (cleanup) cleanup();
  };
}
