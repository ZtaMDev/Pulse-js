<script setup lang="ts">
import { source } from '@pulse-js/core';
import { usePulse } from '@pulse-js/vue';

const count = source(0);
// Returns a Ref<number>
const countRef = usePulse(count);

function increment() {
  count.update(n => n + 1);
}
</script>

<template>
  <div class="source-test">
    <h2>Source Test</h2>
    <p>Value: {{ countRef }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>
