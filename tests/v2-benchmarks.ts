/**
 * Pulse v2 Benchmarks and Intensive Tests
 * 
 * Performance comparison between v1 (Source) and v2 (Pulse/Signal)
 * plus Astro SSR integration simulation.
 */

import { source, guard, pulse, createSignal, batch } from '../src';
import { evaluateForHydration as astroEvaluate } from '../packages/astro/src';

/**
 * Simple benchmark helper
 */
async function benchmark(name: string, fn: () => void | Promise<void>, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();
  console.log(`⏱️ ${name}: ${(end - start).toFixed(4)}ms (${((end - start) / iterations).toFixed(4)}ms/iter)`);
}

async function runBenchmarks() {
  console.log('\n📊 Pulse v2 Performance Benchmarks\n');

  // --- 1. Source (v1) ---
  const s = source(0);
  await benchmark('Source updates (v1)', () => {
    s.set(s() + 1);
  });

  // --- 2. Signal (v2) ---
  const sig = createSignal(0);
  await benchmark('Signal updates (v2)', () => {
    sig.set(sig.get() + 1);
  });

  // --- 3. Pulse Object (v2) ---
  const obj = pulse({ count: 0 });
  await benchmark('Pulse Object changes (v2)', () => {
    obj.count++;
  });

  // --- 4. Batched Signals (v2) ---
  const sigA = createSignal(0);
  const sigB = createSignal(0);
  await benchmark('Batched Signal updates (v2)', () => {
    batch(() => {
      sigA.set(sigA.get() + 1);
      sigB.set(sigB.get() + 1);
    });
  }, 500);

  // --- 5. Astro SSR Simulation ---
  console.log('\n🌌 Astro SSR Integration Test\n');
  
  const auth = pulse({ user: { name: 'Zonda', role: 'admin' }, loading: false }, { name: 'auth' });
  const theme = source('dark', { name: 'theme' });
  
  const userGuard = guard('user-profile', () => {
    if (auth.loading) return undefined;
    return auth.user;
  });

  await benchmark('Astro evaluateForHydration', async () => {
    await astroEvaluate([userGuard]);
  }, 100);

  const script = await astroEvaluate([userGuard]);
  console.log('✅ Astro Hydration Script generated:', script.length, 'bytes');
  console.log('📄 Script Sample:', script.substring(0, 100) + '...');

  console.log('\n✨ All benchmarks and v2 tests completed!\n');
}

runBenchmarks().catch(console.error);
