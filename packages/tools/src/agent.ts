
import { PulseRegistry, type PulseUnit } from '@pulse-js/core';

/**
 * Pulse Agent
 * 
 * Responsible for observing the Pulse Registry and communicating with the UI.
 * It serializes reactive state and handles remote actions.
 */
export class PulseAgent {
  private static instance: PulseAgent;
  private listeners = new Set<(payload: any) => void>();
  private registryUnsubscribe: (() => void) | null = null;
  private unsubs = new Map<string, () => void>();
  private broadcastTimer: any = null;

  private constructor() {
    this.setupRegistryObserver();
  }

  static getInstance(): PulseAgent {
    if (!this.instance) {
      this.instance = new PulseAgent();
    }
    return this.instance;
  }

  private setupRegistryObserver() {
    // Initial sync
    this.syncSubscriptions();

    this.registryUnsubscribe = PulseRegistry.onRegister(() => {
      this.syncSubscriptions();
      this.broadcastStateDebounced();
    });
  }

  /**
   * Synchronizes subscriptions with the registry.
   */
  private syncSubscriptions() {
    const units = PulseRegistry.getAllWithMeta();
    units.forEach(({ unit, uid }) => {
      if (!this.unsubs.has(uid)) {
        // Handle both Pulse Units (subscribe) and Pulse Objects ($subscribe)
        const subscribeFn = (unit as any).subscribe || (unit as any).$subscribe;
        if (typeof subscribeFn === 'function') {
          const unsub = subscribeFn.call(unit, () => {
             this.broadcastStateDebounced();
          });
          this.unsubs.set(uid, unsub);
        }
      }
    });
  }

  /**
   * Debounced broadcast to avoid rapid-fire messages.
   */
  private broadcastStateDebounced() {
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
    this.broadcastTimer = setTimeout(() => {
      this.broadcastState();
      this.broadcastTimer = null;
    }, 50);
  }

  /**
   * Broadcasts the current state of all registered units.
   */
  broadcastState() {
    const units = PulseRegistry.getAllWithMeta();
    const payload = units.map(({ unit, uid }) => {
      const isGuard = (unit as any).state;
      const state = isGuard ? (unit as any).explain() : { value: (unit as any)() };
      
      return this.serialize({
        uid,
        name: (unit as any)._name || (unit as any).name || 'unnamed',
        type: isGuard ? 'guard' : 'source',
        ...state
      });
    });

    this.emit({ 
      type: 'STATE_UPDATE', 
      payload
    });
  }

  /**
   * Recursively strips non-cloneable values (functions) from an object.
   */
  private serialize(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return typeof obj === 'function' ? undefined : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.serialize(item));
    }

    const cleaned: any = {};
    for (const key in obj) {
      const val = this.serialize(obj[key]);
      if (val !== undefined) {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }

  /**
   * Emits an event to any connected clients.
   */
  private emit(event: { type: string; payload: any }) {
    // For now, use window.postMessage for cross-context communication
    if (typeof window !== 'undefined') {
      try {
        window.postMessage({ source: 'pulse-agent', ...event }, '*');
      } catch (e) {
        console.error('[Pulse Agent] Failed to emit state update:', e);
      }
    }
    this.listeners.forEach(l => l(event));
  }

  /**
   * Connect a local listener (useful for the same-page UI).
   */
  onEvent(listener: (event: any) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Handles an action from the DevTools UI.
   */
  handleAction(action: { type: string; uid?: string; payload?: any }) {
    const unit = action.uid ? PulseRegistry.get(action.uid) : null;
    if (!unit) return;

    switch (action.type) {
      case 'RESET_GUARD':
        if ((unit as any)._evaluate) (unit as any)._evaluate();
        break;
      case 'SET_SOURCE_VALUE':
        if ((unit as any).set) (unit as any).set(action.payload);
        break;
    }
  }

  dispose() {
    if (this.registryUnsubscribe) this.registryUnsubscribe();
    this.unsubs.forEach(unsub => unsub());
    this.unsubs.clear();
    this.listeners.clear();
  }
}

// Auto-initialize if in development/browser
if (typeof window !== 'undefined' && (window as any).process?.env?.NODE_ENV !== 'production') {
  PulseAgent.getInstance();
  
  // Listen for actions from the UI
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'pulse-ui') {
      PulseAgent.getInstance().handleAction(event.data.action);
    }
  });
}
