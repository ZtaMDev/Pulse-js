# @pulse-js/vue

The standard Vue 3 integration for Pulse.

[![npm version](https://img.shields.io/npm/v/@pulse-js/vue.svg)](https://www.npmjs.com/package/@pulse-js/vue)

## Features

- **Composable API**: `usePulse` returns standard Vue `Ref` or `ComputedRef` objects.
- **Reactive Unwrapping**: Use `.value` or unwrapping in templates just like native Vue signals.
- **Type Safety**: Full TypeScript support.

## Installation

```bash
npm install @pulse-js/core @pulse-js/vue
```

## Usage

### Using Sources

Map Pulse sources to Vue definitions.

```vue
<script setup lang="ts">
import { source } from "@pulse-js/core";
import { usePulse } from "@pulse-js/vue";

const count = source(0);
// Returns a Ref<number>
const countRef = usePulse(count);

function increment() {
  count.set(count.value + 1);
}
</script>

<template>
  <button @click="increment">Count is {{ countRef }}</button>
</template>
```

### Using Guards

Guards are mapped to DeepReadonly Refs containing the full state.

```vue
<script setup lang="ts">
import { guard } from "@pulse-js/core";
import { usePulse } from "@pulse-js/vue";

const isAdult = guard(() => age.value >= 18);
const state = usePulse(isAdult);
// state is Ref<GuardState<boolean>>
</script>

<template>
  <div v-if="state.status === 'ok'">Allowed: {{ state.value }}</div>
  <div v-else-if="state.status === 'fail'">Blocked: {{ state.reason }}</div>
</template>
```
