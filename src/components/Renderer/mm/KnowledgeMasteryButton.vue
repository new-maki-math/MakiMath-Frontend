<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getMasteredIds, subscribeMasteryChanges, toggleMastered } from '../../../utils/knowledge-mastery.js';
import { notify } from '../../MNotice.vue';

const props = defineProps({ knowledgeSlug: { type: String, required: true } });
const mastered = ref(false);
const loading = ref(true);
const saving = ref(false);
let sequence = 0;
let unsubscribe;
async function refresh() {
  const current = ++sequence;
  try {
    const ids = await getMasteredIds();
    if (current === sequence) { mastered.value = ids.has(props.knowledgeSlug); loading.value = false; }
  } catch {
    if (current === sequence) { loading.value = true; notify('掌握状态读取失败', 'error'); }
  }
}
async function toggle() {
  if (loading.value || saving.value) return;
  saving.value = true;
  try { await toggleMastered(props.knowledgeSlug); }
  catch { notify('掌握状态保存失败，请重试', 'error'); }
  finally { saving.value = false; }
}
onMounted(() => { unsubscribe = subscribeMasteryChanges(refresh); refresh(); });
watch(() => props.knowledgeSlug, () => { loading.value = true; refresh(); });
onBeforeUnmount(() => { sequence++; unsubscribe?.(); });
</script>

<template>
  <button class="mastery-button" :class="{ 'is-mastered': mastered }" type="button" :disabled="loading || saving" :title="mastered ? '取消掌握' : '标记为已掌握'" :aria-label="mastered ? '取消掌握此知识点' : '标记此知识点为已掌握'" :aria-pressed="mastered" @click.stop="toggle">
    <svg class="mastery-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="mastery-circle" cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" />
      <path class="mastery-check" d="m8 12 2.7 2.7L16.5 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<style scoped>
.mastery-button { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-muted); cursor: pointer; transition: color 120ms ease; }
.mastery-button.is-mastered { color: var(--tag-green); }
.mastery-button:hover:not(:disabled) { color: var(--text-primary); }
.mastery-button.is-mastered:hover:not(:disabled) { color: var(--tag-green); }
.mastery-button:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.mastery-button:disabled { opacity: .65; cursor: wait; }
.mastery-check { stroke-dasharray: 14; stroke-dashoffset: 14; opacity: 0; transition: stroke-dashoffset 160ms ease-out, opacity 100ms ease-out; }
.is-mastered .mastery-check { stroke-dashoffset: 0; opacity: 1; }
@media (prefers-reduced-motion: reduce) { .mastery-button, .mastery-check { transition: none; } }
</style>
