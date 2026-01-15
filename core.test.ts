
import { describe, it, expect, vi } from 'vitest';
import { source, guard } from './src';

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
});
