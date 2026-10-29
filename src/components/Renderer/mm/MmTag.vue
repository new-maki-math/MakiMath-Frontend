<script setup>
import { computed } from 'vue';
import { mmTagPresets } from './tag-config.js';
import { customTagPalette } from './tag-color.js';

const props = defineProps({ color: { type: Object, required: true } });
const colors = computed(() => {
  const palette = props.color.custom ? customTagPalette(props.color.custom) : mmTagPresets[props.color.preset] || mmTagPresets.blue;
  return Object.fromEntries(['dark', 'light'].flatMap((theme) => ['text', 'background', 'border'].map((part, index) => [`--mm-tag-${theme}-${part}`, palette[theme][index]])));
});
</script>

<template><span class="mm-tag" :style="colors"><span><slot /></span></span></template>

<style scoped>
.mm-tag { display: inline-flex; align-items: center; justify-content: center; padding: .08em .4em; border: 1px solid var(--mm-tag-dark-border); border-radius: var(--radius-xs); background: var(--mm-tag-dark-background); color: var(--mm-tag-dark-text); font-size: .88em; line-height: 1.3; vertical-align: middle; }
:global([data-theme="light"] .mm-tag), :global(.theme-light .mm-tag) { border-color: var(--mm-tag-light-border); background: var(--mm-tag-light-background); color: var(--mm-tag-light-text); }
</style>
