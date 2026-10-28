<script setup>
import { inject, onBeforeUnmount, ref, watch } from 'vue';
import TypstDoc from '../TypstDoc.vue';
import KnowledgeMasteryButton from './KnowledgeMasteryButton.vue';
import { getReferencedKnowledge } from './knowledge-reference.js';

const props = defineProps({ knowledgeSlug: { type: String, required: true } });
const allowed = inject('typstKnowledgeReferencesAllowed', ref(true));
const detail = ref(null);
const loading = ref(false);
const error = ref('');
let sequence = 0;
async function load() {
  const current = ++sequence;
  detail.value = null;
  error.value = '';
  if (!allowed.value) { error.value = '知识点正文中的嵌套引用暂不展开'; return; }
  loading.value = true;
  try {
    const value = await getReferencedKnowledge(props.knowledgeSlug);
    if (current !== sequence) return;
    if (value?.slug !== props.knowledgeSlug || !Number.isSafeInteger(value.id) || value.id < 1 || typeof value.source !== 'string') throw new Error('知识点内容不完整');
    detail.value = value;
  } catch (failure) {
    if (current === sequence) error.value = failure.status === 404 ? '知识点不存在或已不可用，请核对引用标识' : '知识点加载失败';
  } finally {
    if (current === sequence) loading.value = false;
  }
}
watch(() => [props.knowledgeSlug, allowed.value], load, { immediate: true });
onBeforeUnmount(() => { sequence++; });
</script>

<template>
  <div v-if="loading" class="reference-state">正在加载知识点…</div>
  <div v-else-if="error" class="reference-state" role="status">{{ error }}<button v-if="allowed && error === '知识点加载失败'" type="button" @click="load">重试</button></div>
  <TypstDoc v-else-if="detail" :source="detail.source" :box-title="detail.title || ''" :allow-knowledge-references="false"><template #boxActions><KnowledgeMasteryButton :knowledge-id="detail.id" /></template></TypstDoc>
</template>

<style scoped>
.reference-state { margin: 1em 0; padding: 12px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); color: var(--text-secondary); font-size: var(--font-size-smaller); }
.reference-state button { margin-left: 8px; color: var(--accent-primary); cursor: pointer; }
</style>
