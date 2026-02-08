
import { createSignal, batch, type Signal } from './signal';
import { getCurrentGuard, runInContext, type Trackable, type GuardNode, type Subscriber } from './tracking';
import { PulseRegistry, type PulseUnit } from './registry';

/**
 * Metadata attached to pulse objects for internal tracking.
 */
interface PulseMeta<T> {
  signals: Map<string | symbol, Signal<any>>;
  subscribers: Set<Subscriber<T>>;
  dependents: Set<Trackable>;
  name?: string;
  target: T;
}

const PULSE_META = Symbol('PULSE_META');

/**
 * Represents a reactive Pulse Object.
 */
export type PulseObject<T extends object> = T & {
  /** @internal */
  [PULSE_META]: PulseMeta<T>;
  /** Subscribe to any property change on this object. */
  $subscribe(listener: Subscriber<T>): () => void;
  /** Take a non-reactive snapshot of the current state. */
  $snapshot(): T;
  /** Access the raw target object. */
  $raw: T;
};

/**
 * Configuration options for pulse objects.
 */
export interface PulseOptions {
  /** Optional name for registry and debugging. */
  name?: string;
  /** Whether to recursively wrap nested objects (default: true). */
  deep?: boolean;
}

/**
 * Creates a reactive Pulse Object from a plain JavaScript object.
 * 
 * Pulse Objects use Proxies to automatically track property access and mutations.
 * They are ideal for managing complex state structures without manual source calls.
 */
export function pulse<T extends object>(
  target: T,
  options: PulseOptions = {}
): PulseObject<T> {
  const { name, deep = true } = options;
  
  const signals = new Map<string | symbol, Signal<any>>();
  const subscribers = new Set<Subscriber<T>>();
  const dependents = new Set<Trackable>();
  
  // Cache for nested pulse objects
  const nestedCache = new Map<string | symbol, PulseObject<any>>();

  const meta: PulseMeta<T> = {
    signals,
    subscribers,
    dependents,
    name,
    target
  };

  /**
   * Get or create a signal for a property.
   */
  function getSignal(key: string | symbol): Signal<any> {
    if (!signals.has(key)) {
      const initialValue = (target as any)[key];
      signals.set(key, createSignal(initialValue));
    }
    return signals.get(key)!;
  }

  /**
   * Notify all dependents and subscribers of a change.
   */
  function notify() {
    subscribers.forEach(sub => sub(proxy as any as T));
    const deps = Array.from(dependents);
    dependents.clear();
    deps.forEach(dep => dep.notify());
  }

  /**
   * Helper to track access for guards.
   */
  function trackAccess() {
    const activeGuard = getCurrentGuard();
    if (activeGuard) {
      dependents.add(activeGuard);
      activeGuard.addDependency(proxy);
    }
  }

  const proxy = new Proxy(target, {
    get(obj, prop) {
      // Internal metadata access
      if (prop === PULSE_META) return meta;
      if (prop === '$raw') return target;
      
      // Built-in methods
      if (prop === '$subscribe') {
        return (listener: Subscriber<T>) => {
          subscribers.add(listener);
          return () => subscribers.delete(listener);
        };
      }
      if (prop === '$snapshot') {
        return () => ({ ...target });
      }

      const desc = Object.getOwnPropertyDescriptor(obj, prop);

      // Handle Accessors (Getters)
      if (desc && desc.get) {
         const value = Reflect.get(obj, prop, proxy);
         if (deep && value && typeof value === 'object' && !isPulseObject(value)) {
           return value; 
         }
         return value;
      }

      const value = (obj as any)[prop];

      // Don't track if it's a function (method) - methods will track during Execution
      if (typeof value === 'function') {
        return value.bind(proxy);
      }

      trackAccess();

      const signal = getSignal(prop);
      const currentValue = signal.get();

      // Deep reactivity
      if (deep && currentValue !== null && typeof currentValue === 'object' && !isPulseObject(currentValue)) {
        if (!nestedCache.has(prop)) {
          nestedCache.set(prop, pulse(currentValue, { deep, name: name ? `${name}.${String(prop)}` : undefined }));
        }
        return nestedCache.get(prop);
      }

      return currentValue;
    },

    set(obj, prop, value) {
      const oldValue = (obj as any)[prop];
      if (oldValue === value) return true;

      (obj as any)[prop] = value;
      
      // Update signal
      getSignal(prop).set(value);
      
      notify();
      return true;
    },

    has(obj, prop) {
      if (prop === PULSE_META) return true;
      trackAccess();
      return Reflect.has(obj, prop);
    },

    ownKeys(obj) {
      trackAccess();
      return Reflect.ownKeys(obj);
    }
  }) as PulseObject<T>;

  return PulseRegistry.register(proxy as any) as any;
}

/**
 * Check if a value is a Pulse Object.
 */
export function isPulseObject(value: any): value is PulseObject<any> {
  return value !== null && typeof value === 'object' && PULSE_META in value;
}

/**
 * Get the raw (non-reactive) object from a Pulse Object.
 */
export function toRaw<T extends object>(pulseObj: PulseObject<T>): T {
  return pulseObj.$raw;
}

/**
 * Create a readonly view of a Pulse Object.
 * Attempts to write will throw in development.
 */
export function readonly<T extends object>(pulseObj: PulseObject<T>): Readonly<T> {
  return new Proxy(pulseObj, {
    set() {
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[Pulse] Attempted to mutate a readonly pulse object');
      }
      return false;
    },
    deleteProperty() {
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[Pulse] Attempted to delete from a readonly pulse object');
      }
      return false;
    }
  }) as Readonly<T>;
}
