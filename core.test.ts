import { describe, it, expect, vi } from 'vitest';
import { source, guard, guardFail, guardOk, compute } from './src';

describe('Pulse Core', () => {
  describe('source', () => {
    it('should store and return value', () => {
      const count = source(0);
      expect(count()).toBe(0);
      count.set(5);
      expect(count()).toBe(5);
    });

    it('should track updates', () => {
      const count = source(0);
      count.update(n => n + 1);
      expect(count()).toBe(1);
    });

    it('should notify subscribers', () => {
      const count = source(0);
      const sub = vi.fn();
      count.subscribe(sub);
      count.set(1);
      expect(sub).toHaveBeenCalledWith(1);
    });
  });

  describe('guard', () => {
    it('should reflect sync status', () => {
      const isOk = guard(() => true);
      expect(isOk.ok()).toBe(true);
      expect(isOk()).toBe(true);
    });

    it('should react to source changes', () => {
      const count = source(0);
      const isEven = guard('is-even', () => count() % 2 === 0);
      
      expect(isEven.ok()).toBe(true);
      expect(isEven()).toBe(true);

      count.set(1);
      // Now is-even returns false, so it should be 'fail'
      expect(isEven.ok()).toBe(false);
      expect(isEven.fail()).toBe(true);
      expect(isEven()).toBe(undefined);
    });

    it('should handle async evaluators', async () => {
      const data = guard(async () => {
        return 'loaded';
      });

      expect(data.pending()).toBe(true);
      
      // Wait for promise
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(data.ok()).toBe(true);
      expect(data()).toBe('loaded');
    });

    it('should handle errors', () => {
      const failing = guard(() => {
        throw new Error('boom');
      });

      expect(failing.fail()).toBe(true);
      expect(failing.reason()).toBe('boom');
    });

    it('should detect cyclic dependencies', () => {
      const toggle = source(false);
      const a: any = guard('A', () => {
        if (toggle()) return !b(); // Force value change to trigger notification loop
        return true;
      });
      const b: any = guard('B', () => a());
      
      // Initially OK
      expect(a()).toBe(true);

      // Trigger cycle - this will now loop because A depends on !B and B depends on A
      toggle.set(true);
      expect(a.fail()).toBe(true);
      expect(a.reason()).toMatch(/Cyclic guard dependency detected/);
    });

    it('should persist dependencies even on failure', () => {
      const s = source(1, { name: 'S' });
      const g = guard('G', () => {
        const val = s();
        if (val > 0) throw new Error('fail early');
        return true;
      });

      expect(g.fail()).toBe(true);
      const explanation = g.explain();
      expect(explanation.dependencies.some(d => d.name === 'S')).toBe(true);
    });

    it('should support structured reason metadata', () => {
      const failing = guard(() => {
        const err: any = new Error('structured');
        err.code = 'ERR_AUTH';
        err.meta = { user: 'guest' };
        throw err;
      });

      expect(failing.fail()).toBe(true);
      const reason: any = failing.reason();
      expect(reason.code).toBe('ERR_AUTH');
      expect(reason.meta.user).toBe('guest');
    });

    it('should distinguish undefined (pending) from false (fail)', () => {
      const g = guard(() => undefined);
      expect(g.pending()).toBe(true);
      expect(g.fail()).toBe(false);

      const f = guard(() => false);
      expect(f.fail()).toBe(true);
      expect(f.pending()).toBe(false);
    });
  });

  describe('composition', () => {
    it('guard.all should work', () => {
      const a = source(true, { name: 'A' });
      const b = source(true, { name: 'B' });
      const gA = guard('gA', () => a());
      const gB = guard('gB', () => b());
      
      const all = guard.all('all-ok', [gA, gB]);
      expect(all.ok()).toBe(true);

      a.set(false);
      expect(all.ok()).toBe(false);
      expect(all.reason()).toBe('gA failed');
    });

    it('guard.any should work', () => {
      const a = source(false);
      const b = source(false);
      const gA = guard('gA', () => a());
      const gB = guard('gB', () => b());
      
      const any = guard.any('any-ok', [gA, gB]);
      expect(any.ok()).toBe(false);

      a.set(true);
      expect(any.ok()).toBe(true);
    });

    it('guard.not should work', () => {
      const a = source(true);
      const notA = guard.not('not-a', () => a());
      
      expect(notA.ok()).toBe(false);
      a.set(false);
      expect(notA.ok()).toBe(true);
    });
  });

  describe('Business Rules Simulation', () => {
    it('should explain why an order cannot be placed', () => {
      const cartItems = source([] as string[]);
      const userBalance = source(10);
      
      const hasItems = guard('has-items', () => cartItems().length > 0);
      const sufficientBalance = guard('sufficient-balance', () => userBalance() >= 20);
      
      const canPlaceOrder = guard.all('can-place-order', [hasItems, sufficientBalance]);
      
      expect(canPlaceOrder.fail()).toBe(true);
      expect(canPlaceOrder.reason()).toBe('has-items failed');
      
      cartItems.set(['apple']);
      expect(canPlaceOrder.fail()).toBe(true);
      expect(canPlaceOrder.reason()).toBe('sufficient-balance failed');
      
      const explanation = canPlaceOrder.explain();
      expect(explanation.dependencies).toHaveLength(2);
      expect(explanation.dependencies.find(d => d.name === 'sufficient-balance')?.status).toBe('fail');
      
      userBalance.set(25);
      expect(canPlaceOrder.ok()).toBe(true);
    });

    it('should handle complex nested business logic', () => {
      const isAdmin = source(false);
      const isOwner = source(false);
      const isDeleted = source(false);

      const canEdit = guard('can-edit', () => {
        if (isDeleted()) return false;
        return isAdmin() || isOwner();
      });

      expect(canEdit.fail()).toBe(true);
      
      isAdmin.set(true);
      expect(canEdit.ok()).toBe(true);

      isDeleted.set(true);
      expect(canEdit.fail()).toBe(true);
      expect(canEdit.reason()).toBe('can-edit failed');
    });
  });

  describe('Guard Signals', () => {
    it('should support guardFail with custom reasons', () => {
      const g = guard(() => {
        guardFail({ code: 'CUSTOM', message: 'Something went wrong' });
        return true;
      });
      expect(g.fail()).toBe(true);
      expect(g.reason()).toEqual({ code: 'CUSTOM', message: 'Something went wrong' });
    });

    it('should support guardOk to return value early', () => {
      const g = guard(() => {
        return guardOk('immediate success');
      });
      expect(g.ok()).toBe(true);
      expect(g()).toBe('immediate success');
    });
  });

  describe('Advanced Reliability Tests', () => {
    it('should handle 10k sources without leaking', () => {
      const arr: any[] = Array.from({ length: 10000 }, (_, i) => source(i));
      // Manual sum to avoid too much overhead in dependencies tracking if we do it inside a guard
      // But let's test a compute with all of them
      const total = compute('sum', arr, (...vals) => vals.reduce((a, b) => a + b, 0));
      expect(total()).toBe(49995000);
      
      // Update one source
      arr[0].set(100);
      expect(total()).toBe(49995100);
    });

    it('cancels stale async evaluations (Race Condition)', async () => {
      const id = source(1);
      let executions = 0;
      const slow = guard('slow', async () => {
        executions++;
        const currentId = id();
        await new Promise(resolve => setTimeout(resolve, 20));
        return currentId;
      });

      expect(slow.pending()).toBe(true);
      
      id.set(2); 
      id.set(3); // before previous finishes

      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(slow.ok()).toBe(true);
      expect(slow()).toBe(3); // final value should be the last one
      expect(executions).toBe(3); // it should have started 3 evaluations
    });

    it('should hydrate without re-executing async guards (SSR)', async () => {
      const { evaluate, hydrate } = await import('./src/ssr');
      const isOnline = guard('is-online', async () => {
        return true;
      });

      // Simulation of server-side evaluation
      const serverState = await evaluate([isOnline]);
      const json = JSON.stringify(serverState);

      // Reset guard to pending (simulating client start)
      // Actually we need a NEW guard with same name to test hydration
      const clientGuard = guard('is-online', async () => {
        throw new Error('should not execute'); // It shouldn't run if hydrated
      });

      hydrate(JSON.parse(json));
      expect(clientGuard.ok()).toBe(true);
      expect(clientGuard()).toBe(true);
    });
  });
});
