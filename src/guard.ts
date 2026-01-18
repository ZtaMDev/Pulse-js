
import { runInContext, type Trackable, type GuardNode, getCurrentGuard, type Subscriber } from './tracking';
import { registerGuardForHydration } from './ssr';
import { PulseRegistry } from './registry';

/**
 * Status of a Pulse Guard evaluation.
 * - 'pending': Async evaluation is in progress.
 * - 'ok': Evaluation completed successfully.
 * - 'fail': Evaluation encountered an error or return value was explicitly `false`.
 */
export type GuardStatus = 'ok' | 'fail' | 'pending';

/**
 * Structured reason for a guard failure.
 * Includes toString() so it can be rendered directly in React and other UI frameworks.
 */
export interface GuardReason {
  code: string;
  message: string;
  meta?: any;
  toString(): string;
}

/**
 * The internal state of a Pulse Guard.
 */
export interface GuardState<T> {
  /** Current status of the guard. */
  status: GuardStatus;
  /** The value returned by the evaluator (only if status is 'ok'). */
  value?: T;
  /** The reason why the guard failed. */
  reason?: string | GuardReason;
  /** The last known failure reason, persisted even during 'pending'. */
  lastReason?: string | GuardReason;
  /** The timestamp when the status last changed. */
  updatedAt?: number;
}

/**
 * Detailed explanation of the Guard's current state and its dependencies.
 */
export interface GuardExplanation {
  name: string;
  status: GuardStatus;
  reason?: string | GuardReason;
  lastReason?: string | GuardReason;
  value?: any;
  dependencies: Array<{
    name: string;
    type: 'source' | 'guard';
    status?: GuardStatus;
  }>;
}

/**
 * A Pulse Guard is a reactive semantic condition.
 * It encapsulates a condition (sync or async) and manages its lifecycle,
 * dependencies, and error states.
 * 
 * @template T The type of the value returned by the evaluator.
 */
export interface Guard<T = boolean> {
  /**
   * Returns the current value of the guard if its status is 'ok'.
   * If status is 'fail' or 'pending', returns `undefined`.
   * 
   * When called within another Guard's evaluator, it establishes a reactive dependency.
   * 
   * @returns The successful value or undefined.
   */
  (): T | undefined;

  /**
   * Returns `true` if the guard successfully evaluated and is ready for use.
   * Establishes a reactive dependency.
   */
  ok(): boolean;

  /**
   * Returns `true` if the guard failed its condition or encountered an error.
   * Establishes a reactive dependency.
   */
  fail(): boolean;

  /**
   * Returns `true` if the guard is currently performing an asynchronous evaluation.
   * Establishes a reactive dependency.
   */
  pending(): boolean;

  /**
   * Returns the failure reason message if the guard is in the 'fail' state.
   * Useful for displaying semantic error messages in the UI.
   * 
   * @returns The error message or undefined.
   */
  reason(): string | GuardReason | undefined;

  /**
   * Returns a snapshot of the full internal state of the guard.
   * Useful for adapters (like React) to synchronize with the guard.
   * 
   * @returns {GuardState<T>}
   */
  state(): GuardState<T>;

  /**
   * Manually subscribes to changes in the guard's state.
   * 
   * @param listener - A callback that receives the new GuardState.
   * @returns An unsubscription function.
   */
  subscribe(listener: Subscriber<GuardState<T>>): () => void;

  /**
   * Returns a structured explanation of the guard's state and its direct dependencies.
   */
  explain(): GuardExplanation;

  /**
   * Manually forces a re-evaluation of the guard.
   * @internal
   */
  _evaluate(): void;
}

/**
 * Creates a new Pulse Guard.
 * 
 * Guards represent semantic conditions or asynchronous data dependencies. 
 * They automatically track any Sources or other Guards used during their evaluation.
 * 
 * @template T - The type of value returned by the evaluator (defaults to boolean).
 * @param nameOrFn - Either a unique string name (required for SSR) or the evaluator function.
 * @param fn - The evaluator function if a name was provided as the first argument.
 * @returns A reactive Pulse Guard.
 * 
 * @example
 * ```ts
 * // 1. Synchronous boolean guard
 * const canEnter = guard(() => age() >= 18);
 * 
 * // 2. Asynchronous data guard with a name
 * const profile = guard('user-profile', async () => {
 *   const data = await fetchUser(userId());
 *   return data.json();
 * });
 * ```
 */
/**
 * Signals that a Guard should fail with a specific reason.
 * 
 * @param reason - The reason for failure.
 * @throws An internal signal error caught by the Guard evaluator.
 */
export function guardFail(reason: string | GuardReason): never {
  const guardReason: GuardReason = typeof reason === 'string' 
    ? { 
        code: 'GUARD_FAIL', 
        message: reason,
        toString: () => reason
      }
    : reason;
  const err = new Error(guardReason.message);
  (err as any)._pulseFail = true;
  (err as any)._reason = guardReason;
  throw err;
}

/**
 * Explicitly signals a successful Guard evaluation.
 * Returns the value passed to it.
 */
export function guardOk<T>(value: T): T {
  return value;
}

export function guard<T = boolean>(nameOrFn?: string | (() => T | Promise<T>), fn?: () => T | Promise<T>, _internalOffset = 3): Guard<T> {
  const name = typeof nameOrFn === 'string' ? nameOrFn : undefined;
  const evaluator = typeof nameOrFn === 'function' ? nameOrFn : fn;

  if (!evaluator) {
    throw new Error('Guard requires an evaluator function');
  }

  let state: GuardState<T> = { status: 'pending' };
  const dependents = new Set<Trackable>();
  const subscribers = new Set<Subscriber<GuardState<T>>>();
  let evaluationId = 0;

  // Track the dependencies across evaluations
  const currentDeps = new Set<any>();
  let lastDeps = new Set<any>();

  const node: GuardNode = {
    addDependency(trackable: any) {
      currentDeps.add(trackable);
    },
    notify() {
      evaluate();
    }
  };

  const evaluate = () => {
    const currentId = ++evaluationId;
    const oldStatus = state.status;
    const oldValue = state.value;
    // Start fresh tracking
    currentDeps.clear();

    try {
      runInContext(node, () => {
        // 1. Run the evaluator
        node.isEvaluating = true;
        let result: T | Promise<T>;
        try {
          result = _evaluator();
        } finally {
          node.isEvaluating = false;
        }

        // 2. Handle the result
        if (result instanceof Promise) {
          if (state.status !== 'pending') {
            state = { ...state, status: 'pending', updatedAt: Date.now() };
            notifyDependents();
          }
          
          result
            .then(resolved => {
              if (currentId === evaluationId) {
                persistDependencies();
                if (resolved === false) {
                  const reason = name ? `${name} failed` : 'condition failed';
                  state = { status: 'fail', reason, lastReason: reason, updatedAt: Date.now() };
                } else if (resolved === undefined) {
                  state = { ...state, status: 'pending', updatedAt: Date.now() };
                } else {
                  state = { status: 'ok', value: resolved, updatedAt: Date.now() };
                }
                notifyDependents();
              }
            })
            .catch(err => {
              if (currentId === evaluationId) {
                persistDependencies();
                const message = err instanceof Error ? err.message : String(err);
                const reason: string | GuardReason = err.meta 
                  ? { 
                      code: err.code || 'ERROR', 
                      message,
                      meta: err.meta,
                      toString: () => message
                    }
                  : message;
                state = { 
                  status: 'fail', 
                  reason,
                  lastReason: state.reason || reason,
                  updatedAt: Date.now() 
                };
                notifyDependents();
              }
            });
        } else {
          persistDependencies();
          if (result === false) {
            const reason = name ? `${name} failed` : 'condition failed';
            state = { status: 'fail', reason, lastReason: reason, updatedAt: Date.now() };
          } else if (result === undefined) {
            state = { ...state, status: 'pending', updatedAt: Date.now() };
          } else {
            state = { status: 'ok', value: result as T, updatedAt: Date.now() };
          }
          
          if (oldStatus !== state.status || oldValue !== state.value) {
              notifyDependents();
          }
        }
      });
    } catch (err: any) {
      node.isEvaluating = false;
      persistDependencies();
      
      if (err._pulseFail) {
        state = { 
          status: 'fail', 
          reason: err._reason, 
          lastReason: err._reason,
          updatedAt: Date.now() 
        };
      } else {
        const message = err instanceof Error ? err.message : String(err);
        const reason: string | GuardReason = err.meta 
          ? { 
              code: err.code || 'ERROR', 
              message,
              meta: err.meta,
              toString: () => message
            }
          : message;
        state = { 
          status: 'fail', 
          reason,
          lastReason: reason,
          updatedAt: Date.now() 
        };
      }
      // Break cycles by notifying failing state
      notifyDependents();
    }
  };

  // Helper to call the evaluator within correct scope
  const _evaluator = () => evaluator();

  const persistDependencies = () => {
    lastDeps = new Set(currentDeps);
  };

  const notifyDependents = () => {
    const deps = Array.from(dependents);
    dependents.clear();
    deps.forEach(dep => dep.notify());
    subscribers.forEach(sub => sub({ ...state }));
  };


  const track = () => {
    const activeGuard = getCurrentGuard();
    if (activeGuard && activeGuard !== node) {
      dependents.add(activeGuard);
      activeGuard.addDependency(g);
    }
  };

  const g = (() => {
    track();
    return state.status === 'ok' ? state.value : undefined;
  }) as Guard<T>;

  g.ok = () => {
    track();
    return state.status === 'ok';
  };
  
  g.fail = () => {
    track();
    return state.status === 'fail';
  };
  
  g.pending = () => {
    track();
    return state.status === 'pending';
  };

  g.reason = () => {
    track();
    return state.reason || state.lastReason;
  };
  
  g.state = () => {
    track();
    return state;
  };

  g.subscribe = (listener: Subscriber<GuardState<T>>) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  g.explain = (): GuardExplanation => {
    const deps: Array<{ name: string; type: 'source' | 'guard'; status?: GuardStatus }> = [];
    
    lastDeps.forEach(dep => {
       const depName = (dep as any)._name || 'unnamed';
       const isG = 'state' in dep;
       deps.push({
         name: depName,
         type: isG ? 'guard' : 'source',
         status: isG ? (dep as any).state().status : undefined
       });
    });

    return {
      name: name || 'guard',
      status: state.status,
      reason: state.reason,
      lastReason: state.lastReason,
      value: state.value,
      dependencies: deps
    };
  };
  
  g._evaluate = () => evaluate();

  (g as any)._name = name;
  (g as any)._hydrate = (newState: GuardState<T>) => {
    state = newState;
    evaluationId++; 
    notifyDependents();
  };

  if (name) {
    registerGuardForHydration(name, g);
  }

  PulseRegistry.register(g);

  // Initial evaluation must happen after g is fully defined
  // to allow cycle detection to work even during initial run.
  evaluate();

  return g;
}

