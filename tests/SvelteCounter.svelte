<script lang="ts" module>
  import { usePulse } from "@pulse-js/svelte";
  import type { Readable } from "svelte/store";
</script>

<script lang="ts">
  let { countSource, isEvenGuard } = $props();
  const count = $derived(usePulse(countSource));
  const isEven: Readable<any> = $derived(usePulse(isEvenGuard));
</script>

<div id="svelte-app">
  <p id="svelte-count">{$count}</p>
  <p id="svelte-status">{$isEven.status}</p>
</div>
