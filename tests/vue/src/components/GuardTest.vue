<script setup lang="ts">
import { guard, guardFail, source } from '@pulse-js/core';
import { usePulse } from '@pulse-js/vue';

const age = source(15);
const ageRef = usePulse(age);

const isAdult = guard('is-adult', () => {
    if (age() < 18) guardFail('Not an adult');
    return true;
});

const state = usePulse(isAdult);
// state is Ref<GuardState<boolean>>

function setAge(val: number) {
    age.set(val);
}
</script>

<template>
  <div class="guard-test">
    <h2>Guard Test</h2>
    <p>Current Age: {{ ageRef }}</p>
    <div>
        <button @click="setAge(15)">Set 15</button>
        <button @click="setAge(20)">Set 20</button>
    </div>
    
    <div v-if="state.status === 'ok'" style="color: green">
        <h3>✅ Allowed</h3>
        <p>Value: {{ state.value }}</p>
    </div>
    <div v-else-if="state.status === 'fail'" style="color: red">
        <h3>❌ Blocked</h3>
        <p>Reason: {{ state.reason }}</p>
    </div>
  </div>
</template>
