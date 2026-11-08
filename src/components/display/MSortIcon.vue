<script setup>
defineProps({
  direction: {
    type: String,
    default: ''
  }
});
</script>

<template>
  <svg
    class="sort-icon"
    :class="{
      'is-active': direction,
      'is-descending': direction === 'desc'
    }"
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 2 3.5 6.5l1.2 1.2 2.45-2.45V14h1.7V5.25L11.3 7.7l1.2-1.2z" />
  </svg>
</template>

<style scoped>
.sort-icon {
  flex: none;
  color: var(--text-muted);
  opacity: 0.4;
}

.sort-icon.is-active {
  color: var(--accent-primary);
  opacity: 1;
}

.sort-icon.is-descending {
  transform: rotate(180deg);
}
</style>
