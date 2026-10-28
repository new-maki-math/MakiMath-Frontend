<script setup>
import MmBoxIcon from './MmBoxIcon.vue';

defineProps({
  title: { type: String, required: true },
  tone: { type: String, required: true },
  icon: { type: String, required: true },
  hasTitle: { type: Boolean, default: false }
});
</script>

<template>
  <section class="mm-box" :class="`tone-${tone}`">
    <div v-if="title || hasTitle || $slots.actions" class="mm-box-header">
      <div v-if="title || hasTitle" class="mm-box-title"><MmBoxIcon v-if="icon" :name="icon" /><span v-if="title">{{ title }}</span><template v-if="hasTitle"><span v-if="title" class="mm-box-separator"> · </span><slot name="title" /></template></div>
      <slot name="actions" />
    </div>
    <div class="mm-box-content"><slot /></div>
  </section>
</template>

<style scoped>
.mm-box { min-width: 0; margin: 1em 0; padding: 12px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: var(--bg-surface); overflow-wrap: anywhere; }
.mm-box-header { display: flex; align-items: flex-start; gap: 8px; }
.mm-box-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: .4em; flex-wrap: wrap; color: var(--mm-box-color); font-size: 1.1em; font-weight: 600; line-height: 1.5; }
.mm-box-separator { margin-left: -.4em; margin-right: -.4em; color: var(--text-muted); white-space: pre; }
.mm-box-content { min-width: 0; color: var(--text-primary); }
.mm-box-header + .mm-box-content { margin-top: 8px; }
.tone-neutral { --mm-box-color: var(--text-primary); }
.tone-blue { --mm-box-color: var(--tag-blue); }
.tone-purple { --mm-box-color: var(--tag-purple); }
.tone-cyan { --mm-box-color: var(--tag-cyan); }
.tone-amber { --mm-box-color: var(--tag-amber); }
.tone-green { --mm-box-color: var(--tag-green); }
.tone-orange { --mm-box-color: var(--tag-orange); }
.tone-teal { --mm-box-color: var(--tag-teal); }
</style>
