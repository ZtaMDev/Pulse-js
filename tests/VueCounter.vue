<script setup lang="ts">
import { source, guard } from "@pulse-js/core";
import { usePulse } from "@pulse-js/vue";

const props = defineProps<{
  countSource: ReturnType<typeof source<number>>;
  isEvenGuard: ReturnType<typeof guard<boolean>>;
}>();

const count = usePulse(props.countSource);
const isEven = usePulse(props.isEvenGuard);
</script>

<template>
  <div id="vue-app">
    <p id="vue-count">{{ count }}</p>
    <p id="vue-status">{{ isEven.status }}</p>
  </div>
</template>
