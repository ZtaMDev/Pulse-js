<script lang="ts">
  import { guard, guardFail, source } from "@pulse-js/core";
  import { usePulse, useGuard } from "@pulse-js/svelte";

  const ageSource = source(15);
  const age = usePulse(ageSource);

  const isAdult = guard("is-adult", () => {
    if (ageSource() < 18) guardFail("Not an adult");
    return true;
  });

  const state = useGuard(isAdult);
</script>

<section>
  <h2>Guard Test (Runes)</h2>
  <p>Current Age: {age.value}</p>
  <div>
    <button onclick={() => ageSource.set(15)}>Set 15</button>
    <button onclick={() => ageSource.set(20)}>Set 20</button>
  </div>

  {#if state.status === "ok"}
    <div style="color: green">
      <h3>✅ Allowed</h3>
      <p>Value: {state.value}</p>
    </div>
  {:else if state.status === "fail"}
    <div style="color: red">
      <h3>❌ Blocked</h3>
      <p>Reason: {state.reason}</p>
    </div>
  {/if}
</section>
