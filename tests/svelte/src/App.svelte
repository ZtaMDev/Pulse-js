<script lang="ts">
  import SourceTest from "./components/SourceTest.svelte";
  import GuardTest from "./components/GuardTest.svelte";
  import "@pulse-js/tools";
</script>

<main>
  <pulse-inspector></pulse-inspector>
  <h1>Pulse Svelte Integration Test</h1>
  <hr />
  <SourceTest />
  <hr />
  <GuardTest />
</main>
