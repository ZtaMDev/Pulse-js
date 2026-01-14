
/**
 * Represents an object that can be notified of changes.
 * Primarily implemented by Guards to trigger re-evaluation.
 */
export interface Trackable {
  /** Triggered when a dependency (Source or another Guard) changes. */
  notify(): void;
}

/**
 * Subscriber callback for manual source subscriptions.
 */
export type Subscriber<T> = (value: T) => void;

/**
 * Internal interface for Guard nodes within the dependency graph.
 */
export interface GuardNode extends Trackable {
  /**
   * Registers a dependency for this guard.
   * Internal use only.
   */
  addDependency(trackable: any): void;
}

/** 
 * Global state for reactive context tracking.
 * Used to identify which guard is currently evaluating.
 */
let activeGuard: GuardNode | null = null;

/**
 * Executes a function within the context of a specific Guard.
 * Any Pulse primitives read during this execution will register the guard as a dependent.
 * 
 * @internal
 * @param guard The guard node to set as active.
 * @param fn The function to execute.
 * @returns The result of the function.
 */
export function runInContext<T>(guard: GuardNode, fn: () => T): T {
  const prev = activeGuard;
  activeGuard = guard;
  try {
    return fn();
  } finally {
    activeGuard = prev;
  }
}

/**
 * Retrieves the guard currently being evaluated, if any.
 * Used by Sources and Guards to perform automatic dependency registration.
 * 
 * @internal
 */
export function getCurrentGuard(): GuardNode | null {
  return activeGuard;
}
