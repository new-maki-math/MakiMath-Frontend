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

<template><span class="mm-tag" :style="colors"><slot /></span></template>

<style scoped>
.mm-tag { display: inline; padding: .08em .4em; border: 1px solid var(--mm-tag-dark-border); border-radius: var(--radius-xs); background: var(--mm-tag-dark-background); color: var(--mm-tag-dark-text); font-size: .88em; line-height: 1.5; vertical-align: baseline; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
:global([data-theme="light"]) .mm-tag, :global(.theme-light) .mm-tag { border-color: var(--mm-tag-light-border); background: var(--mm-tag-light-background); color: var(--mm-tag-light-text); }
</style>
