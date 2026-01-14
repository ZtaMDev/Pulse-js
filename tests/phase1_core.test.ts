
import { describe, it, expect, vi } from 'vitest';
import { source, guard, compute } from '../src';

describe('Pulse Core Phase 1', () => {
  describe('compute', () => {
    it('should calculate derived values independently of guards', () => {
      const first = source('John');
      const last = source('Doe');
      const fullName = compute('full-name', [first, last], (f, l) => `${f} ${l}`);
      
      expect(fullName()).toBe('John Doe');
      
      first.set('Jane');
      expect(fullName()).toBe('Jane Doe');
    });

    it('should be available via guard.compute for backward compatibility', () => {
      const a = source(1);
      const b = (guard as any).compute('plus-one', [a], (v: number) => v + 1);
      expect(b()).toBe(2);
    });
  });

  describe('guard.explain()', () => {
    it('should provide structured failure information', () => {
      const isAuth = guard('is-auth', () => false);
      const explanation = isAuth.explain();
      
      expect(explanation.status).toBe('fail');
      expect(explanation.name).toBe('is-auth');
      expect(explanation.reason).toBe('is-auth failed');
    });

    it('should list dependencies', () => {
      const age = source(20, { name: 'user-age' });
      const canDrive = guard('can-drive', () => age() >= 16);
      
      const explanation = canDrive.explain();
      expect(explanation.dependencies).toHaveLength(1);
      expect(explanation.dependencies[0]!.name).toBe('user-age');
      expect(explanation.dependencies[0]!.type).toBe('source');
    });
  });

  describe('async cancellation', () => {
    it('should cancel stale async updates', async () => {
      const trigger = source(0);
      let callCount = 0;
      
      const asyncGuard = guard<string>('async-cancel', async () => {
        const currentTrigger = trigger();
        callCount++;
        // Simulate varying network delays
        await new Promise(resolve => setTimeout(resolve, currentTrigger === 0 ? 100 : 10));
        return `result-${currentTrigger}`;
      });

      expect(asyncGuard.pending()).toBe(true);

      // Trigger second evaluation while first is pending
      trigger.set(1);
      
      // Wait for both to potentially finish
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have been evaluated twice
      expect(callCount).toBe(2);
      // Result should be from the SECOND evaluation (result-1), not the first (result-0)
      expect(asyncGuard()).toBe('result-1');
      expect(asyncGuard.state().value).toBe('result-1');
    });
  });
});
