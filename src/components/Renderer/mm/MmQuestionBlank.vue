<script setup>
defineProps({ width: { type: String, default: '4em' } });
</script>

<template><span class="mm-question-blank" :style="{ width }" aria-label="填空" /></template>

<style scoped>
.mm-question-blank { display: inline-block; max-width: 100%; height: 1em; border-bottom: 1px solid currentColor; vertical-align: baseline; }
</style>
