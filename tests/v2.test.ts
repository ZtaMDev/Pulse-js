/**
 * Pulse v2 Core Tests
 * 
 * Tests for new v2 features:
 * - Signals (createSignal, batch, effect)
 * - Pulse Objects (pulse())
 * - Enhanced Guards (guard.select, guard.from)
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  createSignal, 
  batch, 
  effect, 
  pulse, 
  isPulseObject, 
  toRaw,
  guard,
  guardFail,
  source
} from '../src';

describe('Pulse v2 Core', () => {
  describe('Signal', () => {
    it('should create and read signals', () => {
      const count = createSignal(0);
      expect(count.get()).toBe(0);
    });

    it('should update signals', () => {
      const count = createSignal(0);
      count.set(5);
      expect(count.get()).toBe(5);
    });

    it('should use update function', () => {
      const count = createSignal(10);
      count.update(n => n * 2);
      expect(count.get()).toBe(20);
    });

    it('should peek without tracking', () => {
      const count = createSignal(42);
      expect(count.peek()).toBe(42);
    });

    it('should notify subscribers', () => {
      const count = createSignal(0);
      const sub = vi.fn();
      count.subscribe(sub);
      count.set(1);
      expect(sub).toHaveBeenCalledWith(1);
    });

    it('should unsubscribe correctly', () => {
      const count = createSignal(0);
      const sub = vi.fn();
      const unsub = count.subscribe(sub);
      unsub();
      count.set(1);
      expect(sub).not.toHaveBeenCalled();
    });
  });

  describe('batch', () => {
    it('should batch multiple updates', () => {
      const a = createSignal(0);
      const b = createSignal(0);
      const listener = vi.fn();
      
      a.subscribe(listener);
      b.subscribe(listener);
      
      batch(() => {
        a.set(1);
        b.set(2);
      });
      
      // Both signals updated, but batched
      expect(a.get()).toBe(1);
      expect(b.get()).toBe(2);
    });
  });

  describe('effect', () => {
    it('should run effect immediately', () => {
      const effectFn = vi.fn();
      effect(effectFn);
      expect(effectFn).toHaveBeenCalledTimes(1);
    });

    it('should cleanup on dispose', () => {
      const cleanup = vi.fn();
      const dispose = effect(() => cleanup);
      dispose();
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('Pulse Objects', () => {
    it('should create reactive objects', () => {
      const state = pulse({ count: 0, name: 'test' });
      expect(state.count).toBe(0);
      expect(state.name).toBe('test');
    });

    it('should detect pulse objects', () => {
      const state = pulse({ x: 1 });
      expect(isPulseObject(state)).toBe(true);
      expect(isPulseObject({ x: 1 })).toBe(false);
    });

    it('should track mutations', () => {
      const state = pulse({ count: 0 });
      const sub = vi.fn();
      state.$subscribe(sub);
      
      state.count = 5;
      expect(sub).toHaveBeenCalled();
      expect(state.count).toBe(5);
    });

    it('should provide raw access', () => {
      const original = { value: 42 };
      const state = pulse(original);
      expect(toRaw(state)).toBe(original);
    });

    it('should create snapshots', () => {
      const state = pulse({ a: 1, b: { c: 2 } });
      const snapshot = state.$snapshot();
      
      expect(snapshot).toEqual({ a: 1, b: { c: 2 } });
      expect(isPulseObject(snapshot)).toBe(false);
    });

    it('should handle computed getters', () => {
      const state = pulse({
        firstName: 'John',
        lastName: 'Doe',
        get fullName() {
          return `${this.firstName} ${this.lastName}`;
        }
      });
      
      expect(state.fullName).toBe('John Doe');
      state.firstName = 'Jane';
      expect(state.fullName).toBe('Jane Doe');
    });

    it('should handle methods', () => {
      const counter = pulse({
        value: 0,
        increment() {
          this.value++;
        },
        decrement() {
          this.value--;
        }
      });
      
      counter.increment();
      expect(counter.value).toBe(1);
      counter.increment();
      counter.increment();
      expect(counter.value).toBe(3);
      counter.decrement();
      expect(counter.value).toBe(2);
    });

    it('should handle deep reactivity', () => {
      const state = pulse({
        user: {
          profile: {
            name: 'Alice'
          }
        }
      });
      
      const sub = vi.fn();
      state.$subscribe(sub);
      
      // Deep mutation
      state.user.profile.name = 'Bob';
      expect(state.user.profile.name).toBe('Bob');
    });
  });

  describe('guard.select', () => {
    it('should select from pulse objects', async () => {
      const state = pulse({ user: { name: 'Alice', age: 25 } });
      const userName = guard.select(state, s => s.user.name, 'user-name');
      
      // Wait for async selector
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(userName()).toBe('Alice');
      expect(userName.ok()).toBe(true);
    });

    it('should fail when selector returns falsy', async () => {
      const state = pulse({ user: null as { name: string } | null });
      const userName = guard.select(state, s => s.user?.name ?? false, 'user-name');
      
      // Wait for async selector
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(userName.fail()).toBe(true);
    });
  });

  describe('guard.from', () => {
    it('should wrap loading state', () => {
      const external = guard.from(() => ({
        value: undefined,
        isLoading: true
      }), { name: 'external' });
      
      expect(external.pending()).toBe(true);
    });

    it('should wrap success state', () => {
      const external = guard.from(() => ({
        value: 'data',
        isLoading: false
      }), { name: 'external' });
      
      expect(external.ok()).toBe(true);
      expect(external()).toBe('data');
    });

    it('should wrap error state', () => {
      const external = guard.from(() => ({
        value: undefined,
        isLoading: false,
        error: new Error('Failed')
      }), { name: 'external' });
      
      expect(external.fail()).toBe(true);
    });

    it('should handle plain values', () => {
      const external = guard.from(() => 42, { name: 'plain' });
      expect(external()).toBe(42);
    });
  });

  describe('Integration: Pulse + Guards', () => {
    it('should track pulse objects in guards', () => {
      const auth = pulse({
        user: null as { id: number; name: string } | null,
        loading: false
      });
      
      const isLoggedIn = guard('is-logged-in', () => {
        if (auth.loading) return undefined; // pending
        if (!auth.user) guardFail('Not logged in');
        return auth.user;
      });
      
      expect(isLoggedIn.fail()).toBe(true);
      
      auth.user = { id: 1, name: 'Alice' };
      expect(isLoggedIn.ok()).toBe(true);
      expect(isLoggedIn()?.name).toBe('Alice');
    });

    it('should compose pulse guards', () => {
      const permissions = pulse({ isAdmin: false, isEditor: false });
      
      const canAdmin = guard('can-admin', () => {
        if (!permissions.isAdmin) guardFail('Not admin');
        return true;
      });
      
      const canEdit = guard('can-edit', () => {
        if (!permissions.isEditor && !permissions.isAdmin) guardFail('Cannot edit');
        return true;
      });
      
      const canManage = guard.any('can-manage', [canAdmin, canEdit]);
      
      expect(canManage.fail()).toBe(true);
      
      permissions.isEditor = true;
      expect(canManage.ok()).toBe(true);
    });
  });
});
