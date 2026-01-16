import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import { render as renderSvelte } from '@testing-library/svelte';
import { source, guard } from '@pulse-js/core';
import VueCounter from './VueCounter.vue';
//@ts-expect-error
import SvelteCounter from './SvelteCounter.svelte';

describe('Pulse Framework Integration', () => {
  it('should work with Vue', async () => {
    const countSource = source(0);
    const isEvenGuard = guard(() => countSource() % 2 === 0);
    
    const { getByText, rerender } = render(VueCounter, {
      props: { countSource, isEvenGuard }
    });

    expect(document.getElementById('vue-count')?.textContent).toBe('0');
    expect(document.getElementById('vue-status')?.textContent).toBe('ok');

    countSource.set(1);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(document.getElementById('vue-count')?.textContent).toBe('1');
    expect(document.getElementById('vue-status')?.textContent).toBe('fail');
  });

  it('should work with Svelte', async () => {
    const countSource = source(10);
    const isEvenGuard = guard(() => countSource() % 2 === 0);
    
    const { container } = renderSvelte(SvelteCounter, {
      props: { countSource, isEvenGuard }
    });

    expect(document.getElementById('svelte-count')?.textContent).toBe('10');
    expect(document.getElementById('svelte-status')?.textContent).toBe('ok');

    countSource.set(11);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(document.getElementById('svelte-count')?.textContent).toBe('11');
    expect(document.getElementById('svelte-status')?.textContent).toBe('fail');
  });
});
