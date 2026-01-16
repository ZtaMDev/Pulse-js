import { expectTypeOf, describe, it } from 'vitest';
import { guard, source, type Guard, type Source, type GuardState } from './src';

describe('Pulse Type Inferences', () => {
  it('should infer Source type correctly', () => {
    const s = source(42);
    expectTypeOf(s).toEqualTypeOf<Source<number>>();
    expectTypeOf(s()).toBeNumber();
  });

  it('should infer Guard type correctly (sync)', () => {
    const g = guard(() => "hello");
    expectTypeOf(g).toEqualTypeOf<Guard<string>>();
    expectTypeOf(g()).toEqualTypeOf<string | undefined>();
  });

  it('should infer Guard type correctly (async)', () => {
    const g = guard(async () => ({ id: 1 }));
    expectTypeOf(g).toEqualTypeOf<Guard<{ id: number }>>();
  });

  it('should infer GuardState type correctly', () => {
    const g = guard(() => true);
    expectTypeOf(g.state()).toEqualTypeOf<GuardState<boolean>>();
  });
});
