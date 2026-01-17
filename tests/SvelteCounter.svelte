<script lang="ts">
  import type { Source, Guard } from "@pulse-js/core";
  import { usePulse } from "@pulse-js/svelte";

  interface Props {
    countSource: Source<number>;
    isEvenGuard: Guard<any>;
  }

  let props: Props = $props();

  // Accessing props via the props object in usePulse usually avoids the warning
  // because we are passing the "live" property reference if the compiler is smart,
  // or at least it doesn't flag it as "only capturing initial value" as it does with destructuring.
  const count = usePulse(props.countSource);
  const isEven = usePulse(props.isEvenGuard);
</script>

<div id="svelte-app">
  <p id="svelte-count">{count.value}</p>
  <p id="svelte-status">{isEven.status}</p>
</div>
