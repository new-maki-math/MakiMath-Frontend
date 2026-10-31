<script setup>
defineProps({
  columns: {
    type: Number,
    default: null
  }
});
</script>

<template>
  <div class="mm-options-container">
    <div
      class="mm-options"
      :class="columns ? `columns-${columns}` : 'columns-auto'"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.mm-options-container {
  container-type: inline-size;
  min-width: 0;
  width: 100%;
  margin: 0.65em 0;
}
.mm-options {
  display: grid;
  gap: 0.55em 1em;
  min-width: 0;
}
.columns-auto {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
}
.columns-1 {
  grid-template-columns: minmax(0, 1fr);
}
.columns-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.columns-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
@container (max-width: 650px) {
  .columns-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 360px) {
  .columns-2,
  .columns-4 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
