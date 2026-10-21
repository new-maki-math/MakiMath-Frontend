<script setup>
import { computed, ref, watch } from 'vue';
import {
  adminApi,
  readTextFile,
  titleFromFilename,
  nextSectionSlugs
} from '../../api/admin.js';
import { useForm, useText } from './useForm.js';
import AdminPanel from './AdminPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';
import MModal from '../../components/MModal.vue';
import MButton from '../../components/MButton.vue';
import MTag from '../../components/MTag.vue';
import { Upload, PagePlus, Xmark } from '@iconoir/vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['changed', 'error', 'saved', 'navigate']);

const { form, fill, dirty, reset, diff, commit } = useForm(['slug', 'tag', 'title', 'summary']);
const intro = useText('');

const record = ref(null);
const sections = ref([]);
const loading = ref(true);
const saving = ref(false);

const fileInput = ref(null);
const dragOver = ref(false);
const importOpen = ref(false);
const importing = ref(false);
const importRows = ref([]);

const dirtyAll = computed(() => dirty.value || intro.dirty.value);
const meta = computed(() => (record.value ? `${sections.value.length} 个小节` : ''));

const load = async () => {
  loading.value = true;
  try {
    const [rec, list] = await Promise.all([
      adminApi.chapters.get(props.node.id),
      adminApi.sections.list(props.node.id)
    ]);
    record.value = rec;
    sections.value = list;
    fill(rec);
    intro.set(rec.intro_source ?? '');
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

const discard = () => {
  reset();
  intro.reset();
};

const save = async () => {
  saving.value = true;
  try {
    const patch = diff();
    if (Object.keys(patch).length > 0) {
      record.value = await adminApi.chapters.update(props.node.id, patch);
      commit();
    }
    if (intro.dirty.value) {
      await adminApi.chapters.setIntro(props.node.id, intro.state.text);
      intro.commit();
    }
    emit('saved', '章节已保存');
    emit('changed', {
      scope: 'chapter',
      courseId: record.value?.course_id,
      chapterId: props.node.id,
      label: form.title
    });
  } catch (err) {
    emit('error', err);
  } finally {
    saving.value = false;
  }
};

// 读取选中的 .typ，按现有 L## 序号预生成 slug
const stageFiles = async (fileList) => {
  const files = Array.from(fileList || []).filter((f) => f.size > 0);
  if (files.length === 0) return;

  try {
    const sources = await Promise.all(files.map((f) => readTextFile(f)));
    const slugs = nextSectionSlugs(
      sections.value.map((s) => s.slug),
      files.length
    );
    importRows.value = files.map((file, i) => ({
      name: file.name,
      title: titleFromFilename(file.name),
      slug: slugs[i],
      source: sources[i],
      size: file.size
    }));
    importOpen.value = true;
  } catch (err) {
    emit('error', err);
  }
};

const onPick = (e) => {
  stageFiles(e.target.files);
  e.target.value = '';
};

const onDrop = (e) => {
  dragOver.value = false;
  stageFiles(e.dataTransfer?.files);
};

const closeImport = () => {
  if (importing.value) return;
  importOpen.value = false;
  importRows.value = [];
};

const removeRow = (index) => {
  importRows.value.splice(index, 1);
  if (importRows.value.length === 0) closeImport();
};

const runImport = async () => {
  const rows = importRows.value.filter((r) => r.slug.trim() && r.title.trim());
  if (rows.length === 0) {
    emit('error', new Error('请至少保留一条有效的导入项'));
    return;
  }

  importing.value = true;
  try {
    for (const row of rows) {
      await adminApi.sections.create({
        chapter_id: props.node.id,
        slug: row.slug.trim(),
        title: row.title.trim(),
        source: row.source
      });
    }
    importOpen.value = false;
    importRows.value = [];
    await load();
    emit('saved', `已导入 ${rows.length} 个小节`);
    emit('changed', { scope: 'chapter', courseId: record.value?.course_id, chapterId: props.node.id });
  } catch (err) {
    emit('error', err);
  } finally {
    importing.value = false;
  }
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

watch(() => props.node.id, load, { immediate: true });
</script>

<template>
  <AdminPanel
    kind="CHAPTER"
    :title="form.title || node.label"
    :meta="meta"
    :dirty="dirtyAll"
    :saving="saving"
    @save="save"
    @reset="discard"
  >
    <template #actions>
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
            label="章节名称"
            placeholder="例如：第一章 函数与极限"
          />
          <MInput
            v-model="form.slug"
            label="slug"
            placeholder="ch01"
            hint="课程内唯一"
          />
          <MInput
            v-model="form.tag"
            label="标签"
            placeholder="第一章"
          />
          <div class="adm-span-2">
            <MTextarea
              v-model="form.summary"
              label="摘要"
              :rows="2"
              placeholder="本章内容概述"
            />
          </div>
        </div>
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">章导读 intro_source</span>
          <span class="adm-block-desc font-mono">Typst 源文</span>
        </div>
        <MCodeEditor
          v-model="intro.state.text"
          height="200px"
          placeholder="本章导读内容"
          @save="save"
        />
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">小节</span>
          <span class="adm-block-desc font-mono">{{ sections.length }} 项 · 一小节对应一个 Typst 文件</span>
        </div>

        <div
          class="adm-dropzone"
          :class="{ 'is-over': dragOver }"
          @click="fileInput?.click()"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <Upload width="18" height="18" />
          <span>点击或拖入 .typ 文件批量导入为小节</span>
          <span class="dropzone-hint font-mono">TITLE 取自文件名，SLUG 按 L## 自动续号</span>
        </div>
        <input
          ref="fileInput"
          class="hidden-input"
          type="file"
          accept=".typ,.txt,text/plain"
          multiple
          @change="onPick"
        />

        <div
          v-if="sections.length === 0"
          class="adm-note"
        >
          本章还没有小节。导入 .typ 文件，或在左侧树中把鼠标移到本章行上点 + 手动新建。
        </div>

        <div
          v-else
          class="adm-list"
        >
          <div
            v-for="(sec, idx) in sections"
            :key="sec.id"
            class="adm-list-item"
            @click="emit('navigate', { type: 'section', id: sec.id, label: sec.title, courseId: record?.course_id, chapterId: node.id })"
          >
            <span class="adm-list-index">{{ String(idx + 1).padStart(2, '0') }}</span>
            <span class="adm-list-label">{{ sec.title }}</span>
            <MTag
              v-if="!sec.has_source"
              variant="amber"
              size="sm"
            >
              空
            </MTag>
            <span class="adm-list-meta">{{ sec.slug }}</span>
            <span class="adm-list-meta">{{ sec.source_len }} 字</span>
          </div>
        </div>
      </div>
    </template>

    <MModal
      :open="importOpen"
      title="导入 Typst 源文件"
      :desc="`将新建 ${importRows.length} 个小节，可在此调整标题与 slug`"
      width="720px"
      confirm-text="确认导入"
      :busy="importing"
      @close="closeImport"
      @confirm="runImport"
    >
      <div class="import-head font-mono">
        <span>序号</span>
        <span>标题</span>
        <span>slug</span>
        <span>大小</span>
        <span></span>
      </div>
      <div
        v-for="(row, idx) in importRows"
        :key="row.name"
        class="import-row"
      >
        <span class="import-index font-mono">{{ String(idx + 1).padStart(2, '0') }}</span>
        <MInput v-model="row.title" />
        <MInput v-model="row.slug" />
        <span class="import-size font-mono">{{ formatSize(row.size) }}</span>
        <button
          class="import-remove"
          type="button"
          title="移除"
          @click="removeRow(idx)"
        >
          <Xmark width="12" height="12" />
        </button>
      </div>
      <p class="import-name font-mono">
        原始文件名：{{ importRows.map((r) => r.name).join(' / ') }}
      </p>
    </MModal>
  </AdminPanel>
</template>

<style scoped>
.hidden-input {
  display: none;
}

.dropzone-hint {
  font-size: var(--font-size-smaller);
  opacity: 0.85;
}

.import-head,
.import-row {
  display: grid;
  grid-template-columns: 34px 1fr 150px 74px 26px;
  align-items: center;
  gap: 10px;
}

.import-head {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  padding-bottom: 4px;
}

.import-index {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.import-size {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.import-remove {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.import-remove:hover {
  background-color: var(--bg-hover);
  color: #e07070;
}

.import-name {
  margin-top: 6px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  word-break: break-all;
  line-height: 1.8;
}
</style>
