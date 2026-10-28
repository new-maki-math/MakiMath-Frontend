<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Journal } from '@iconoir/vue';
import MModal from './MModal.vue';
import MButton from './MButton.vue';
import TypstDoc from './Renderer/TypstDoc.vue';
import { markUpdateRead, readUpdateVersions } from '../utils/update-log-read.js';

const open = ref(false);
const version = ref('');
const readVersions = ref(new Set());
const source = ref('');
const loading = ref(false);
const error = ref('');
const storageError = ref('');
const marking = ref(false);
const base = `${import.meta.env.BASE_URL}updates/`;
let sequence = 0;
let disposed = false;
const hasUnread = computed(() => Boolean(version.value && !readVersions.value.has(version.value)));

async function loadLog() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  source.value = '';
  try {
    const response = await fetch(`${base}index.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('更新日志信息加载失败');
    const data = await response.json();
    if (!data || typeof data.version !== 'string' || !data.version.trim()) throw new Error('更新日志版本信息格式不正确');
    const versions = await readUpdateVersions().catch(() => null);
    if (current !== sequence || disposed) return;
    version.value = data.version;
    if (versions) { readVersions.value = versions; storageError.value = ''; }
    else storageError.value = '无法读取本地已读状态';
    if (!open.value) return;
    const body = await fetch(`${base}changelog.typ`, { cache: 'no-store' });
    if (!body.ok) throw new Error('更新日志正文加载失败');
    const text = await body.text();
    if (current === sequence && !disposed && open.value) source.value = text;
  } catch (failure) {
    if (current === sequence && !disposed) error.value = failure.message || '更新日志加载失败';
  } finally { if (current === sequence && !disposed) loading.value = false; }
}
async function confirmRead() {
  if (!open.value || !version.value || loading.value || error.value || marking.value || readVersions.value.has(version.value)) return;
  const currentVersion = version.value;
  marking.value = true;
  try {
    await markUpdateRead(currentVersion);
    if (!disposed) { readVersions.value = new Set([...readVersions.value, currentVersion]); storageError.value = ''; }
  } catch {
    if (!disposed) storageError.value = '无法保存已读状态，请检查浏览器存储';
  } finally { if (!disposed) marking.value = false; }
}
function show() { open.value = true; loadLog(); }
function close() { open.value = false; sequence++; loading.value = false; }
onMounted(loadLog);
onBeforeUnmount(() => { disposed = true; sequence++; });
</script>

<template>
  <button type="button" class="update-button" :class="{ active: open }" :title="hasUnread ? '更新日志，有未读版本' : '更新日志'" :aria-label="hasUnread ? '更新日志，有未读版本' : '更新日志'" @click="show">
    <Journal width="20" height="20" /><span v-if="hasUnread" class="unread-dot" aria-hidden="true"></span>
  </button>
  <MModal :open="open" title="更新日志" width="640px" hide-footer show-close @close="close">
    <div class="update-content">
      <p v-if="loading" class="update-note">正在加载更新日志…</p>
      <p v-else-if="error" class="update-error" role="alert">{{ error }} <MButton size="sm" @click="loadLog">重试</MButton></p>
      <div v-else class="update-scroll"><TypstDoc :source="source" :allow-knowledge-references="false" /></div>
      <p v-if="storageError" class="update-error" role="status">{{ storageError }}</p>
      <div v-if="version && !loading && !error" class="update-actions"><MButton size="sm" :variant="readVersions.has(version) ? 'secondary' : 'primary'" :disabled="marking || readVersions.has(version)" @click="confirmRead">{{ marking ? '保存中…' : readVersions.has(version) ? '已读' : '标记已读' }}</MButton></div>
    </div>
  </MModal>
</template>

<style scoped>
.update-button { position: relative; display: inline-flex; flex: none; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-secondary); cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
.update-button:hover { background: var(--bg-hover); color: var(--text-primary); }
.update-button.active { color: var(--accent-primary); }
.update-button:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.unread-dot { position: absolute; top: 2px; right: 2px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent-primary); }
.update-content { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.update-scroll { max-height: min(60vh, 560px); min-width: 0; overflow-y: auto; overscroll-behavior: contain; }
.update-actions { display: flex; justify-content: flex-end; }
.update-note { margin: 0; color: var(--text-secondary); }
.update-error { margin: 0; color: var(--tag-red); line-height: 1.6; }
@media (max-width: 760px) { .update-button { width: 40px; height: 40px; } .unread-dot { top: 7px; right: 7px; } }
</style>
