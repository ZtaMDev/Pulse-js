<script setup lang="ts">
import SourceTest from './components/SourceTest.vue'
import GuardTest from './components/GuardTest.vue'
import '@pulse-js/tools';
</script>

<template>
  <div>
    <pulse-inspector />
    <h1>Pulse Vue Integration Test</h1>
    <hr />
    <SourceTest />
    <hr />
    <GuardTest />
  </div>
</template>
