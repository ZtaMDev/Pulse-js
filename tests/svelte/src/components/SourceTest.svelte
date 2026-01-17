<script lang="ts">
  import { source } from "@pulse-js/core";
  import { usePulse } from "@pulse-js/svelte";

  const countSource = source(0);
  const count = usePulse(countSource);
</script>

<section>
  <h2>Source Test (Runes)</h2>
  <p>Value: {count.value}</p>
  <button onclick={() => countSource.update((n) => n + 1)}>Increment</button>
</section>
