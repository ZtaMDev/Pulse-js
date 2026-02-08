/**
 * Astro Adapter Tests
 * 
 * Tests for @pulse-js/astro integration
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the DOM environment for SSR testing
const originalWindow = global.window;

describe('@pulse-js/astro', () => {
  describe('SSR Utilities', () => {
    it('should evaluate guards for hydration', async () => {
      const { guard, guardFail } = await import('../src');
      const { evaluateForHydration } = await import('../packages/astro/src');
      
      const testGuard = guard('test', () => 'hello');
      const result = await evaluateForHydration([testGuard]);
      
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('test');
    });

    it('should create hydration script', async () => {
      const { guard } = await import('../src');
      const { createHydrationScript } = await import('../packages/astro/src');
      
      const dataGuard = guard('data', () => ({ key: 'value' }));
      const script = await createHydrationScript([dataGuard]);
      
      expect(script).toContain('<script>');
      expect(script).toContain('__PULSE_ASTRO_STATE__');
    });

    it('should read source values with usePulseSSR', async () => {
      const { source } = await import('../src');
      const { usePulseSSR } = await import('../packages/astro/src');
      
      const count = source(42);
      const value = usePulseSSR(count);
      
      expect(value).toBe(42);
    });

    it('should read guard state with usePulseSSR', async () => {
      const { guard } = await import('../src');
      const { usePulseSSR } = await import('../packages/astro/src');
      
      const testGuard = guard('test', () => 'result');
      const state = usePulseSSR(testGuard);
      
      expect(state).toHaveProperty('status');
      expect(state.status).toBe('ok');
      expect(state.value).toBe('result');
    });
  });

  describe('Server Snapshot', () => {
    it('should get server snapshot of guards', async () => {
      const { guard, guardFail } = await import('../src');
      const { getServerSnapshot } = await import('../packages/astro/src');
      
      const okGuard = guard('ok-guard', () => 'success');
      const failGuard = guard('fail-guard', () => {
        guardFail('intentional');
        return null;
      });
      
      const snapshot = await getServerSnapshot([okGuard, failGuard]);
      
      expect(snapshot['ok-guard']).toEqual({
        status: 'ok',
        value: 'success',
        reason: undefined
      });
      
      expect(snapshot['fail-guard']).toEqual({
        status: 'fail',
        value: undefined,
        reason: 'intentional'
      });
    });
  });

  describe('Client Initialization', () => {
    it('should handle client init without window state', async () => {
      // Temporarily remove window
      delete (global as any).window;
      
      const { initPulseClient } = await import('../packages/astro/src');
      
      // Should not throw when window is undefined
      await expect(initPulseClient()).resolves.toBeUndefined();
      
      // Restore
      (global as any).window = originalWindow;
    });
  });
});
