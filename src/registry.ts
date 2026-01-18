
import { type Source } from './source';
import { type Guard } from './guard';

export type PulseUnit = Source<any> | Guard<any>;

/**
 * Root Registry for Pulse.
 * 
 * It tracks all registered Units (Sources and Guards) globally, providing 
 * the data source for DevTools and HMR stability.
 */
class Registry {
  private units = new Map<string, PulseUnit>();
  private listeners = new Set<(unit: PulseUnit) => void>();
  private currentGeneration = 0;
  private cleanupScheduled = false;
  private autoNameCache = new Map<string, string>();

  /**
   * Generates a stable auto-name based on source code location.
   * Uses file path and line number to ensure the same location always gets the same name.
   * Cached to avoid repeated stack trace parsing.
   */
  generateAutoName(type: 'source' | 'guard', offset = 3): string {
    const err = new Error();
    const stack = err.stack?.split('\n') || [];
    
    // Get the call site (where source() or guard() was called)
    let callSite = stack[offset]?.trim() || '';
    
    // Check cache first
    const cacheKey = `${type}:${callSite}`;
    if (this.autoNameCache.has(cacheKey)) {
      return this.autoNameCache.get(cacheKey)!;
    }
    
    // Extract file path and line number
    const match = callSite.match(/([^/\\]+)\.(?:ts|tsx|js|jsx):(\d+):\d+/);
    
    let name: string;
    if (match) {
      const filename = match[1];
      const line = match[2];
      if (filename && line) {
        // Format: "source@filename:line" (e.g., "source@react-example:7")
        name = `${type}@${filename}:${line}`;
      } else {
        name = `${type}#${Math.random().toString(36).substring(2, 7)}`;
      }
    } else {
      // Fallback to simple counter if we can't parse the stack
      name = `${type}#${Math.random().toString(36).substring(2, 7)}`;
    }
    
    // Cache the result
    this.autoNameCache.set(cacheKey, name);
    return name;
  }

  /**
   * Increments generation and schedules cleanup of old units.
   * Called automatically when HMR is detected.
   */
  private scheduleCleanup() {
    if (this.cleanupScheduled) return;
    
    this.cleanupScheduled = true;
    this.currentGeneration++;
    
    // Schedule cleanup after a short delay to allow all new units to register
    setTimeout(() => {
      this.cleanupOldGenerations();
      this.cleanupScheduled = false;
    }, 100);
  }

  /**
   * Removes units from old generations (likely orphaned by HMR).
   */
  private cleanupOldGenerations() {
    const toDelete: string[] = [];
    
    this.units.forEach((unit, key) => {
      const gen = (unit as any)._generation;
      if (gen !== undefined && gen < this.currentGeneration) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => this.units.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`[Pulse] Cleaned up ${toDelete.length} stale units after HMR`);
    }
  }

  /**
   * Registers a new unit (Source or Guard).
   * Auto-assigns stable names to unnamed units for HMR stability.
   */
  register(unit: PulseUnit, offset = 3) {
    const unitWithMetadata = unit as any;
    let name = unitWithMetadata._name;
    
    // Auto-assign name if not provided
    if (!name) {
      const isGuard = 'state' in unit;
      name = this.generateAutoName(isGuard ? 'guard' : 'source', offset);
      unitWithMetadata._name = name;
    }

    // Mark with current generation
    unitWithMetadata._generation = this.currentGeneration;

    // If this is an update (name already exists), it's likely HMR
    if (this.units.has(name)) {
      this.scheduleCleanup();
    }
    
    this.units.set(name, unit);
    this.listeners.forEach(l => l(unit));
  }

  /**
   * Retrieves all registered units.
   */
  getAll(): PulseUnit[] {
    return Array.from(this.units.values());
  }

  /**
   * Subscribes to new unit registrations.
   * 
   * @param listener - Callback receiving the newly registered unit.
   * @returns Unsubscribe function.
   */
  onRegister(listener: (unit: PulseUnit) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * Clears all registered units.
   */
  reset() {
    this.units.clear();
    this.currentGeneration = 0;
    this.autoNameCache.clear();
  }
}

// Global singleton pattern to ensure stability across HMR if the module re-executes
const GLOBAL_KEY = '__PULSE_REGISTRY__';
const globalSymbols = (globalThis as any);

if (!globalSymbols[GLOBAL_KEY]) {
  globalSymbols[GLOBAL_KEY] = new Registry();
}

export const PulseRegistry = globalSymbols[GLOBAL_KEY] as Registry;
