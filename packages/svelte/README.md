# @pulse-js/svelte

The standard Svelte integration for Pulse.

[![npm version](https://img.shields.io/npm/v/@pulse-js/svelte.svg)](https://www.npmjs.com/package/@pulse-js/svelte)

## Features

- **Store-based API**: Pulse Units (Sources and Guards) are converted into native Svelte Stores.
- **Auto-Subscription**: Works seamlessly with Svelte's `$` syntax.
- **Type Safety**: Full TypeScript support.

## Installation

```bash
npm install @pulse-js/core @pulse-js/svelte
```

## Usage

### Using Sources

Wrap your sources with `usePulse` to get a writable/readable store.

```svelte
<script lang="ts">
  import { source } from '@pulse-js/core';
  import { usePulse } from '@pulse-js/svelte';

  const count = source(0);
  const $count = usePulse(count);
</script>

<button on:click={() => count.set(count.value + 1)}>
  Count is {$count}
</button>
```

### Using Guards

Wrap guards with `useGuard` to get a readable store containing the status and result.

```svelte
<script lang="ts">
  import { guard } from '@pulse-js/core';
  import { useGuard } from '@pulse-js/svelte';

  const isAdult = guard(() => age.value >= 18);
  const $isAdult = useGuard(isAdult);
</script>

{#if $isAdult.status === 'ok'}
  <p>Result: {$isAdult.value}</p>
{:else if $isAdult.status === 'fail'}
  <p class="error">Error: {$isAdult.reason}</p>
{/if}
```
