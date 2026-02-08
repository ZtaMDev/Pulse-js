
import { type Source } from './source';
import { type Guard } from './guard';

export type PulseUnit = Source<any> | Guard<any>;

/**
 * Identity Proxy wrapper for HMR-stable unit references.
 * 
 * This wrapper maintains a stable identity even when the underlying
 * unit is replaced during Hot Module Replacement (HMR).
 */
interface IdentityProxy<T extends PulseUnit> {
  /** The current underlying unit. */
  current: T;
  /** Unique ID for this unit (stable across HMR). */
  uid: string;
  /** Generation counter for cleanup. */
  generation: number;
}

/**
 * Generates a UID for a unit based on its name and optional source info.
 */
function generateUID(name: string, sourceInfo?: { file?: string; line?: number }): string {
  if (sourceInfo?.file && sourceInfo?.line) {
    return `${sourceInfo.file}:${sourceInfo.line}:${name}`;
  }
  return `pulse:${name}`;
}

/**
 * Root Registry for Pulse.
 * 
 * Tracks all registered Units (Sources and Guards) globally for DevTools.
 * Uses the Proxy of Identity pattern to maintain stable references during HMR.
 */
class Registry {
  private targets = new Map<string, PulseUnit>();
  private proxies = new Map<string, PulseUnit>();
  private listeners = new Set<(unit: PulseUnit, event: 'add' | 'update' | 'remove') => void>();
  private currentGeneration = 0;
  private cleanupScheduled = false;
  private hmrDebounce: ReturnType<typeof setTimeout> | null = null;

  /**
   * Registers a unit and returns a stable Identity Proxy.
   * 
   * If a unit with the same UID already exists, it updates the internal
   * target of the existing proxy and returns that same proxy.
   */
  register<T extends PulseUnit>(unit: T): T {
    const meta = unit as any;
    const name = meta._name;
    
    if (!name) return unit;

    const uid = generateUID(name, meta._sourceInfo);
    meta._uid = uid;

    const existingTarget = this.targets.get(uid);
    const existingProxy = this.proxies.get(uid);

    if (existingProxy) {
      // HMR Update
      if (this.targets.get(uid) !== unit) {
        // Increment generation on first update of a cycle
        if (this.currentGeneration === (unit as any)._generation) {
           // already updated in this cycle? 
        }
        
        this.targets.set(uid, unit);
        this.notifyListeners(unit, 'update');
      }
      return existingProxy as T;
    }

    // New Registration
    this.targets.set(uid, unit);
    
    // Create the Stable Identity Proxy
    const self = this;
    const proxy = new Proxy((() => {}) as any, {
      get(_, prop) {
        const target = self.targets.get(uid);
        if (!target) return undefined;
        const value = (target as any)[prop];
        // If it's a function on the target, bind it to the latest target
        return typeof value === 'function' ? value.bind(target) : value;
      },
      apply(_, thisArg, args) {
        const target = self.targets.get(uid);
        if (typeof target !== 'function') return undefined;
        return Reflect.apply(target, thisArg, args);
      },
      // Ensure type checking and other proxy traps work
      getPrototypeOf(_) {
        return Object.getPrototypeOf(self.targets.get(uid) || {});
      },
      has(_, prop) {
        return Reflect.has(self.targets.get(uid) || {}, prop);
      },
      ownKeys(_) {
        return Reflect.ownKeys(self.targets.get(uid) || {});
      },
      getOwnPropertyDescriptor(_, prop) {
        return Reflect.getOwnPropertyDescriptor(self.targets.get(uid) || {}, prop);
      }
    });

    this.proxies.set(uid, proxy);
    this.notifyListeners(unit, 'add');
    
    return proxy as T;
  }

  /**
   * Schedules cleanup of units that weren't re-registered.
   */
  private scheduleCleanup() {
    if (this.cleanupScheduled) return;
    this.cleanupScheduled = true;
    if (this.hmrDebounce) clearTimeout(this.hmrDebounce);
    this.hmrDebounce = setTimeout(() => {
      this.cleanupDeadUnits();
      this.cleanupScheduled = false;
      this.hmrDebounce = null;
    }, 150);
  }

  private cleanupDeadUnits() {
    // Basic mark-and-sweep logic would go here if we tracked generations on register
  }

  private notifyListeners(unit: PulseUnit, event: 'add' | 'update' | 'remove') {
    this.listeners.forEach(l => l(unit, event));
  }

  get(nameOrUid: string): PulseUnit | undefined {
    const proxy = this.proxies.get(nameOrUid);
    if (proxy) return proxy;
    const uid = generateUID(nameOrUid);
    return this.proxies.get(uid);
  }

  getAll(): PulseUnit[] {
    return Array.from(this.proxies.values());
  }

  getAllWithMeta(): Array<{ unit: PulseUnit; uid: string }> {
    return Array.from(this.proxies.entries()).map(([uid, unit]) => ({
      unit,
      uid
    }));
  }

  onRegister(listener: (unit: PulseUnit, event?: 'add' | 'update' | 'remove') => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  reset() {
    this.targets.clear();
    this.proxies.clear();
    this.currentGeneration = 0;
  }
}

const GLOBAL_KEY = '__PULSE_REGISTRY__';
const globalSymbols = (globalThis as any);

if (!globalSymbols[GLOBAL_KEY]) {
  globalSymbols[GLOBAL_KEY] = new Registry();
}

export const PulseRegistry = globalSymbols[GLOBAL_KEY] as Registry;

