<script lang="ts">
  import { guard, guardFail, source } from "@pulse-js/core";
  import { usePulse } from "@pulse-js/svelte";

  const age = source(15);
  const ageStore = usePulse(age);

  const isAdult = guard("is-adult", () => {
    if (age() < 18) guardFail("Not an adult");
    return true;
  });

  const stateStore = usePulse(isAdult);
</script>

<section>
  <h2>Guard Test</h2>
  <p>Current Age: {$ageStore}</p>
  <div>
    <button onclick={() => age.set(15)}>Set 15</button>
    <button onclick={() => age.set(20)}>Set 20</button>
  </div>

  {#if $stateStore.status === "ok"}
    <div style="color: green">
      <h3>✅ Allowed</h3>
      <p>Value: {$stateStore.value}</p>
    </div>
  {:else if $stateStore.status === "fail"}
    <div style="color: red">
      <h3>❌ Blocked</h3>
      <p>Reason: {$stateStore.reason}</p>
    </div>
  {/if}
</section>
