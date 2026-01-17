<script lang="ts">
  import { source } from "@pulse-js/core";
  import { usePulse } from "@pulse-js/svelte";

  const count = source(0);
  const countStore = usePulse(count);
</script>

<section>
  <h2>Source Test</h2>
  <p>Value: {$countStore}</p>
  <button onclick={() => count.update((n) => n + 1)}>Increment</button>
</section>
