<script setup>
import { computed, ref, watch } from 'vue';
import { adminApi, readTextFile, titleFromFilename } from '../../api/admin.js';
import { useForm, useText } from './useForm.js';
import AdminPanel from './AdminPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';
import MModal from '../../components/MModal.vue';
import MButton from '../../components/MButton.vue';
import PrereqPicker from './PrereqPicker.vue';
import { Upload, Download } from '@iconoir/vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['changed', 'error', 'saved']);

const { form, fill, dirty, reset, diff, commit } = useForm(['slug', 'tag', 'title', 'summary']);
const source = useText('');

const SOURCE_PLACEHOLDER = [
  '#set page(paper: "a4", margin: 2cm)',
  '#import "@preview/cetz:0.3.1": canvas',
  '',
  '= 小节标题',
  '正文内容'
].join('\n');

const record = ref(null);
const candidates = ref([]);
const prereqs = ref([]);
const prereqBaseline = ref([]);
const loading = ref(true);
const saving = ref(false);

const fileInput = ref(null);
const pendingFile = ref(null);
const importOpen = ref(false);
const renameOnImport = ref(true);

const prereqsDirty = computed(
  () => [...prereqs.value].sort().join(',') !== [...prereqBaseline.value].sort().join(',')
);

const dirtyAll = computed(() => dirty.value || source.dirty.value || prereqsDirty.value);

const meta = computed(() => {
  if (!record.value) return '';
  const parts = [
    record.value.course_title,
    record.value.chapter_title,
    `hash ${String(record.value.source_hash || '').slice(0, 8) || '--------'}`
  ];
  if (record.value.updated_at) parts.push(formatTime(record.value.updated_at));
  return parts.filter(Boolean).join(' · ');
});

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const load = async () => {
  loading.value = true;
  try {
    const rec = await adminApi.sections.get(props.node.id);
    record.value = rec;
    fill(rec);
    source.set(rec.source ?? '');
    prereqs.value = (rec.prereqs ?? []).map(Number);
    prereqBaseline.value = [...prereqs.value];

    const tree = await adminApi.courses.tree(rec.course_id);
    const list = [];
    for (const ch of tree.chapters || []) {
      for (const sec of ch.sections || []) {
        if (sec.id !== props.node.id) {
          list.push({
            id: sec.id,
            label: sec.title,
            meta: `${ch.tag || ch.title} · ${sec.slug}`
          });
        }
      }
    }
    candidates.value = list;
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

const discard = () => {
  reset();
  source.reset();
  prereqs.value = [...prereqBaseline.value];
};

const save = async () => {
  saving.value = true;
  // PATCH /sections/:id 的返回体不含 course_id，先存下来，
  // 否则下面 record.value 被覆盖后拿不到，父级就无法刷新左侧树
  const courseId = record.value?.course_id;
  try {
    const patch = diff();
    if (Object.keys(patch).length > 0) {
      record.value = await adminApi.sections.update(props.node.id, patch);
      commit();
    }
    if (source.dirty.value) {
      const res = await adminApi.sections.setSource(props.node.id, source.state.text);
      record.value = { ...record.value, ...res };
      source.commit();
    }
    if (prereqsDirty.value) {
      await adminApi.sections.setPrereqs(props.node.id, prereqs.value);
      prereqBaseline.value = [...prereqs.value];
    }
    emit('saved', '小节已保存');
    emit('changed', { scope: 'section', courseId, sectionId: props.node.id, label: form.title });
  } catch (err) {
    emit('error', err);
  } finally {
    saving.value = false;
  }
};

const onPick = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await readTextFile(file);
    pendingFile.value = { name: file.name, size: file.size, text };
    importOpen.value = true;
  } catch (err) {
    emit('error', err);
  }
};

const closeImport = () => {
  importOpen.value = false;
  pendingFile.value = null;
};

const runImport = () => {
  if (!pendingFile.value) return;
  source.state.text = pendingFile.value.text;
  if (renameOnImport.value) {
    const next = titleFromFilename(pendingFile.value.name);
    if (next) form.title = next;
  }
  closeImport();
  save();
};

const exportSource = () => {
  const blob = new Blob([source.state.text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${form.slug || 'section'}.typ`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

watch(() => props.node.id, load, { immediate: true });
</script>

<template>
  <AdminPanel
    kind="SECTION"
    :title="form.title || node.label"
    :meta="meta"
    :dirty="dirtyAll"
    :saving="saving"
    @save="save"
    @reset="discard"
  >
    <template #actions>
      <MButton
        variant="ghost"
        size="sm"
        :mono="true"
        @click="exportSource"
      >
        <template #icon>
          <Download width="13" height="13" />
        </template>
        导出
      </MButton>
      <MButton
        variant="secondary"
        size="sm"
        :mono="true"
        @click="fileInput?.click()"
      >
        <template #icon>
          <Upload width="13" height="13" />
        </template>
        导入 .typ
      </MButton>
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept=".typ,.txt,text/plain"
        @change="onPick"
      />
      <slot name="actions" />
    </template>

    <div
      v-if="loading"
      class="adm-empty font-mono"
    >
      加载中...
    </div>

    <template v-else>
      <div class="adm-block">
        <div class="adm-form-grid">
          <MInput
            v-model="form.title"
            label="小节标题"
            placeholder="例如：极限的定义"
          />
          <MInput
            v-model="form.slug"
            label="slug"
            placeholder="L01"
            hint="章节内唯一"
          />
          <MInput
            v-model="form.tag"
            label="标签"
            placeholder="选填"
          />
          <div class="adm-span-2">
            <MTextarea
              v-model="form.summary"
              label="摘要"
              :rows="2"
              placeholder="本小节内容概述"
            />
          </div>
        </div>
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">Typst 源文</span>
          <span class="adm-block-desc font-mono">Ctrl / Cmd + S 保存</span>
        </div>
        <MCodeEditor
          v-model="source.state.text"
          height="56vh"
          :placeholder="SOURCE_PLACEHOLDER"
          @save="save"
        />
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">前置小节</span>
          <span class="adm-block-desc font-mono">建议先学完这些小节</span>
        </div>
        <PrereqPicker
          v-model="prereqs"
          :candidates="candidates"
          placeholder="按小节标题筛选"
        />
      </div>
    </template>

    <MModal
      :open="importOpen"
      title="导入 .typ 覆盖当前源文"
      :desc="pendingFile ? `${pendingFile.name} · ${formatSize(pendingFile.size)}` : ''"
      width="520px"
      confirm-text="覆盖并保存"
      @close="closeImport"
      @confirm="runImport"
    >
      <div class="adm-note">
        当前源文将被文件内容整体替换，保存后写入数据库并刷新 source_hash。
      </div>
      <label class="rename-toggle">
        <input
          v-model="renameOnImport"
          type="checkbox"
        />
        <span>同时用文件名更新小节标题</span>
      </label>
      <pre class="preview">{{ (pendingFile?.text || '').slice(0, 600) }}</pre>
    </MModal>
  </AdminPanel>
</template>

<style scoped>
.hidden-input {
  display: none;
}

.rename-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size);
  color: var(--text-secondary);
  cursor: pointer;
}

.rename-toggle input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-primary);
  cursor: pointer;
}

.preview {
  max-height: 220px;
  overflow: auto;
  padding: 12px 14px;
  /* 框体比页面背景（bg-app）浅一级 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--font-size-smaller);
  line-height: 1.8;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}
</style>
