
import { runInContext, type Trackable, type GuardNode, getCurrentGuard, type Subscriber } from './tracking';
import { registerGuardForHydration } from './ssr';
import { PulseRegistry } from './registry';

/**
 * Status of a Pulse Guard evaluation.
 * - 'pending': Async evaluation is in progress.
 * - 'ok': Evaluation completed successfully (return value was not `false`).
 * - 'fail': Evaluation encountered an error or return value was `false`.
 */
export type GuardStatus = 'ok' | 'fail' | 'pending';

/**
 * The internal state of a Pulse Guard.
 */
export interface GuardState<T> {
  /** Current status of the guard. */
  status: GuardStatus;
  /** The value returned by the evaluator (only if status is 'ok'). */
  value?: T;
  /** The message explaining why the guard failed (only if status is 'fail'). */
  reason?: string;
  /** The timestamp when the status last changed. */
  updatedAt?: number;
}

/**
 * Detailed explanation of the Guard's current state and its dependencies.
 */
export interface GuardExplanation {
  name: string;
  status: GuardStatus;
  reason?: string;
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
  reason(): string | undefined;

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
   * Useful for DevTools and sophisticated error reporting.
   */
  explain(): GuardExplanation;

  /**
   * Manually forces a re-evaluation of the guard.
   * Typically used internally by Pulse or for debugging.
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

  const dependencies = new Set<any>();

  const node: GuardNode = {
    addDependency(trackable: any) {
      dependencies.add(trackable);
    },
    notify() {
      evaluate();
    }
  };

  const evaluate = () => {
    const currentId = ++evaluationId;
    const oldStatus = state.status;
    const oldValue = state.value;
    
    // Clear dependencies before re-evaluation
    dependencies.clear();

    try {
      const result = runInContext(node, () => evaluator());

      if (result instanceof Promise) {
        if (state.status !== 'pending') {
          state = { ...state, status: 'pending', updatedAt: Date.now() };
          notifyDependents();
        }
        
        result
          .then(resolved => {
            if (currentId === evaluationId) {
              if (resolved === false) {
                state = { status: 'fail', reason: name ? `${name} failed` : 'condition failed', updatedAt: Date.now() };
              } else {
                state = { status: 'ok', value: resolved, updatedAt: Date.now() };
              }
              notifyDependents();
            }
          })
          .catch(err => {
            if (currentId === evaluationId) {
              state = { status: 'fail', reason: err instanceof Error ? err.message : String(err), updatedAt: Date.now() };
              notifyDependents();
            }
          });
      } else {
        if (result === false) {
          state = { status: 'fail', reason: name ? `${name} failed` : 'condition failed', updatedAt: Date.now() };
        } else {
          state = { status: 'ok', value: result as T, updatedAt: Date.now() };
        }
        
        if (oldStatus !== state.status || oldValue !== state.value) {
            notifyDependents();
        }
      }
    } catch (err) {
      state = { status: 'fail', reason: err instanceof Error ? err.message : String(err), updatedAt: Date.now() };
      notifyDependents();
    }
  };

  const notifyDependents = () => {
    const deps = Array.from(dependents);
    dependents.clear();
    deps.forEach(dep => dep.notify());
    subscribers.forEach(sub => sub({ ...state }));
  };

  // Initial evaluation
  evaluate();

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
    return state.reason;
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
    
    dependencies.forEach(dep => {
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
      value: state.value,
      dependencies: deps
    };
  };
  
  g._evaluate = () => evaluate();

  // SSR internal hooks
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

  return g;
}
