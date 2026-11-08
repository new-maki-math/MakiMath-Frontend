<script setup>
defineProps({
  value: {
    type: Number,
    default: null
  },
  label: {
    type: String,
    required: true
  }
});
</script>

<template>
  <progress
    class="m-progress"
    :value="value === null ? undefined : value"
    max="100"
    :aria-label="label"
  />
</template>

<style scoped>
.m-progress {
  display: block;
  width: 100%;
  height: 4px;
  accent-color: var(--accent-primary);
}
</style>
