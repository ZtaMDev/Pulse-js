/**
 * TanStack Query Integration Tests
 * 
 * Tests for @pulse-js/tanstack bridge package
 */

import { describe, it, expect, vi } from 'vitest';
import { guard, source } from '../src';

// Mock TanStack Query result structure
interface MockQueryResult<T> {
  data?: T;
  error?: Error | null;
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  status?: 'pending' | 'error' | 'success';
}

describe('@pulse-js/tanstack', () => {
  describe('guardFromQuery', () => {
    it('should create guard from loading query', async () => {
      const { guardFromQuery } = await import('../packages/tanstack/src');
      
      const mockQuery: MockQueryResult<string> = {
        data: undefined,
        isLoading: true,
        isPending: true,
        status: 'pending'
      };
      
      const g = guardFromQuery(() => mockQuery, { name: 'loading-query' });
      
      expect(g.pending()).toBe(true);
    });

    it('should create guard from success query', async () => {
      const { guardFromQuery } = await import('../packages/tanstack/src');
      
      const mockQuery: MockQueryResult<string> = {
        data: 'user-data',
        isLoading: false,
        isPending: false,
        isSuccess: true,
        status: 'success'
      };
      
      const g = guardFromQuery(() => mockQuery, { name: 'success-query' });
      
      expect(g.ok()).toBe(true);
      expect(g()).toBe('user-data');
    });

    it('should create guard from error query', async () => {
      const { guardFromQuery } = await import('../packages/tanstack/src');
      
      const mockQuery: MockQueryResult<string> = {
        data: undefined,
        error: new Error('Network error'),
        isLoading: false,
        isError: true,
        status: 'error'
      };
      
      const g = guardFromQuery(() => mockQuery, { name: 'error-query' });
      
      expect(g.fail()).toBe(true);
      expect(g.reason()?.message).toBe('Network error');
    });

    it('should use custom error message transformer', async () => {
      const { guardFromQuery } = await import('../packages/tanstack/src');
      
      const mockQuery: MockQueryResult<string> = {
        error: { code: 'ERR_401', details: 'Unauthorized' } as any,
        isError: true
      };
      
      const g = guardFromQuery(() => mockQuery, {
        name: 'custom-error',
        errorMessage: (e) => `Custom: ${e.code}`
      });
      
      expect(g.fail()).toBe(true);
      expect(g.reason()?.message).toBe('Custom: ERR_401');
    });
  });

  describe('queryFromGuard', () => {
    it('should create query-like from ok guard', async () => {
      const { queryFromGuard } = await import('../packages/tanstack/src');
      
      const g = guard('ok-guard', () => ({ id: 1, name: 'Test' }));
      const queryLike = queryFromGuard(g);
      
      expect(queryLike.isSuccess).toBe(true);
      expect(queryLike.isLoading).toBe(false);
      expect(queryLike.isError).toBe(false);
      expect(queryLike.status).toBe('success');
      expect(queryLike.data).toEqual({ id: 1, name: 'Test' });
      expect(queryLike.$guard).toBe(g);
    });

    it('should create query-like from pending guard', async () => {
      const { queryFromGuard } = await import('../packages/tanstack/src');
      
      // Create async guard that stays pending
      const g = guard('async-guard', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'done';
      });
      
      const queryLike = queryFromGuard(g);
      
      expect(queryLike.isPending).toBe(true);
      expect(queryLike.isLoading).toBe(true);
      expect(queryLike.status).toBe('pending');
    });

    it('should create query-like from failed guard', async () => {
      const { queryFromGuard } = await import('../packages/tanstack/src');
      const { guardFail } = await import('../src');
      
      const g = guard('fail-guard', () => {
        guardFail('Validation error');
        return null;
      });
      
      const queryLike = queryFromGuard(g);
      
      expect(queryLike.isError).toBe(true);
      expect(queryLike.status).toBe('error');
      expect(queryLike.error).toBe('Validation error');
    });
  });

  describe('Integration: Query + Guard Composition', () => {
    it('should compose query guards with other guards', async () => {
      const { guardFromQuery } = await import('../packages/tanstack/src');
      
      const isAuthenticated = source(true);
      
      // Simulated query result
      const userQuery: MockQueryResult<{ id: number; role: string }> = {
        data: { id: 1, role: 'admin' },
        isSuccess: true,
        isLoading: false
      };
      
      const userGuard = guardFromQuery(() => userQuery, { name: 'user' });
      
      const isAdmin = guard('is-admin', () => {
        if (!isAuthenticated()) return false;
        const user = userGuard();
        return user?.role === 'admin';
      });
      
      expect(isAdmin.ok()).toBe(true);
      expect(isAdmin()).toBe(true);
      
      // Change auth state
      isAuthenticated.set(false);
      expect(isAdmin()).toBe(undefined);
      expect(isAdmin.fail()).toBe(true);
    });

    it('should handle query transitions', async () => {
      const { guardFromQuery } = await import('../packages/tanstack/src');
      
      let queryState: MockQueryResult<string> = {
        isLoading: true,
        status: 'pending'
      };
      
      const dataGuard = guardFromQuery(() => queryState, { name: 'data' });
      
      expect(dataGuard.pending()).toBe(true);
      
      // Simulate query success
      queryState = {
        data: 'loaded',
        isLoading: false,
        isSuccess: true,
        status: 'success'
      };
      
      // Force re-evaluation
      dataGuard._evaluate();
      
      expect(dataGuard.ok()).toBe(true);
      expect(dataGuard()).toBe('loaded');
    });
  });
});
