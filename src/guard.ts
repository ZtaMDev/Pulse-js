
import { runInContext, type Trackable, type GuardNode, getCurrentGuard, type Subscriber } from './tracking';
import { registerGuardForHydration } from './ssr';
import { PulseRegistry } from './registry';
import type { Source } from './source';

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
  reason?: GuardReason;
  /** The last known failure reason, persisted even during 'pending'. */
  lastReason?: GuardReason;
  /** The timestamp when the status last changed. */
  updatedAt?: number;
}

/**
 * Detailed explanation of the Guard's current state and its dependencies.
 */
export interface GuardExplanation {
  name: string;
  status: GuardStatus;
  reason?: GuardReason;
  lastReason?: GuardReason;
  value?: any;
  dependencies: Array<{
    name: string;
    type: 'source' | 'guard';
    status?: GuardStatus;
    reason?: GuardReason;
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
   * @returns The error message object or undefined.
   */
  reason(): GuardReason | undefined;

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

export function guard<T = boolean>(nameOrFn?: string | (() => T | Promise<T>), fn?: () => T | Promise<T>): Guard<T> {
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
                  const message = name ? `${name} failed` : 'condition failed';
                  const reason: GuardReason = {
                    code: 'GUARD_FAIL',
                    message,
                    toString: () => message
                  };
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
                
                let reason: GuardReason;
                if (err && err._pulseFail) {
                  reason = err._reason;
                } else {
                  const message = err instanceof Error ? err.message : String(err);
                  reason = err && err.meta 
                    ? { 
                        code: err.code || 'ERROR', 
                        message,
                        meta: err.meta,
                        toString: () => message
                      }
                    : {
                        code: 'ERROR',
                        message,
                        toString: () => message
                      };
                }

                state = { 
                  status: 'fail', 
                  reason,
                  lastReason: (state as any).reason || reason,
                  updatedAt: Date.now() 
                };
                notifyDependents();
              }
            });
        } else {
          persistDependencies();
          if (result === false) {
            const message = name ? `${name} failed` : 'condition failed';
            const reason: GuardReason = {
              code: 'GUARD_FAIL',
              message,
              toString: () => message
            };
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
        const reason: GuardReason = err.meta 
          ? { 
              code: err.code || 'ERROR', 
              message,
              meta: err.meta,
              toString: () => message
            }
          : {
              code: 'ERROR',
              message,
              toString: () => message
            };
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
    const deps: Array<{ 
      name: string; 
      type: 'source' | 'guard'; 
      status?: GuardStatus;
      reason?: string | GuardReason;
    }> = [];
    
    lastDeps.forEach(dep => {
       const depName = (dep as any)._name || 'unnamed';
       const isG = 'state' in dep;
       
       if (isG) {
         const depState = (dep as any).state();
         deps.push({
           name: depName,
           type: 'guard',
           status: depState.status,
           reason: depState.status === 'fail' ? depState.reason : undefined
         });
       } else {
         deps.push({ 
           name: depName, 
           type: 'source' 
         });
       }
    });

    return {
      name: name || 'guard',
      status: state.status,
      reason: state.reason,
      lastReason: state.lastReason,
      value: state.value,
      dependencies: deps as any
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

  // Initial evaluation must happen after g is fully defined
  // to allow cycle detection to work even during initial run.
  evaluate();

  return PulseRegistry.register(g);
}

/**
 * Maps a Source value through a transformation function, returning a Guard.
 * 
 * Useful for deriving business logic from source data with full Guard semantics
 * (status tracking, error handling, async support).
 * 
 * @template T - Source value type
 * @template U - Mapped result type
 * @param source - The source to read from
 * @param mapper - Transformation function (sync or async)
 * @param name - Optional guard name (auto-generated if not provided)
 * 
 * @example
 * ```ts
 * const todos = source([{done: false}, {done: true}]);
 * const doneCount = guard.map(todos, list => list.filter(t => t.done).length);
 * // doneCount is a Guard<number> with full status tracking
 * ```
 */
guard.map = function<T, U>(
  source: Source<T>,
  mapper: (value: T) => U | Promise<U>,
  name?: string
): Guard<U> {
  const guardName = name || `map-${(source as any)._name || 'source'}`;
  
  return guard(guardName, () => {
    const value = source();
    return mapper(value);
  });
};

/**
 * Creates a Guard from a Pulse Object using a selector function.
 * 
 * The selector extracts and transforms data from a Pulse object,
 * creating a reactive computed value with full Guard semantics.
 * 
 * @template T - Pulse object type
 * @template U - Selected result type
 * @param pulseObj - A Pulse object to select from
 * @param selector - Function to extract/transform data
 * @param name - Optional guard name
 * 
 * @example
 * ```ts
 * const auth = pulse({ user: { name: 'Alice', role: 'admin' } });
 * const userName = guard.select(auth, a => a.user?.name, 'user-name');
 * console.log(userName()); // 'Alice'
 * ```
 */
guard.select = function<T extends object, U>(
  pulseObj: T,
  selector: (obj: T) => U | Promise<U>,
  name?: string
): Guard<U> {
  const guardName = name || `select-${(pulseObj as any)._name || 'pulse'}`;
  
  return guard(guardName, () => {
    return selector(pulseObj);
  });
};

/**
 * Creates a Guard from any reactive value or function.
 * 
 * Useful for wrapping external reactive sources (like TanStack Query results)
 * to create Guards that can be composed with other Pulse primitives.
 * 
 * @template T - Value type
 * @param getValue - Function that returns the current value
 * @param options - Configuration (name, pending/fail detection)
 * 
 * @example
 * ```ts
 * // Wrapping a TanStack Query result
 * const userQuery = useQuery(['user'], fetchUser);
 * const userGuard = guard.from(() => ({
 *   value: userQuery.data,
 *   isLoading: userQuery.isLoading,
 *   error: userQuery.error
 * }), { name: 'user-query' });
 * ```
 */
guard.from = function<T>(
  getValue: () => { value?: T; isLoading?: boolean; error?: any } | T,
  options?: { name?: string }
): Guard<T | undefined> {
  const name = options?.name || 'from-external';
  
  return guard(name, () => {
    const result = getValue();
    
    // Check if result is a wrapped value with status info
    if (result && typeof result === 'object' && ('value' in result || 'isLoading' in result || 'error' in result)) {
      const wrapped = result as { value?: T; isLoading?: boolean; error?: any };
      
      if (wrapped.isLoading) {
        return undefined; // Pending
      }
      if (wrapped.error) {
        guardFail(wrapped.error?.message || 'External error');
      }
      return wrapped.value;
    }
    
    // Plain value
    return result as T;
  });
};

