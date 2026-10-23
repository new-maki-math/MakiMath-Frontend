<script setup>
import { computed, ref, watch } from 'vue';
import {
  workbenchApi,
  readTextFile,
  titleFromFilename,
  nextSectionSlugs
} from '../../api/workbench.js';
import { useForm } from './useForm.js';
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MModal from '../../components/MModal.vue';
import MButton from '../../components/MButton.vue';
import MSelect from '../../components/MSelect.vue';
import MTag from '../../components/MTag.vue';
import { Upload, Xmark } from '@iconoir/vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['changed', 'error', 'saved', 'navigate']);

const { form, fill, dirty, reset, diff, commit } = useForm(['slug', 'tag', 'title', 'summary']);

const record = ref(null);
const sections = ref([]);
const loading = ref(true);
const saving = ref(false);

// 多选状态
const selectedIds = ref(new Set());
const batchDeleteOpen = ref(false);
const batchDeleting = ref(false);

const isAllSelected = computed(() => {
  if (sections.value.length === 0) return false;
  return selectedIds.value.size === sections.value.length;
});

const isIndeterminate = computed(() => {
  return selectedIds.value.size > 0 && selectedIds.value.size < sections.value.length;
});

const toggleSelect = (id) => {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
};

const handleRowClick = (sec) => {
  if (selectedIds.value.size > 0) {
    toggleSelect(sec.id);
  } else {
    emit('navigate', {
      type: 'section',
      id: sec.id,
      label: sec.title,
      courseId: record.value?.course_id,
      chapterId: props.node.id
    });
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(sections.value.map((s) => s.id));
  }
};

const clearSelection = () => {
  selectedIds.value = new Set();
};

const askBatchDelete = () => {
  if (selectedIds.value.size === 0) return;
  batchDeleteOpen.value = true;
};

const runBatchDelete = async () => {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;

  batchDeleting.value = true;
  try {
    await workbenchApi.sections.batchRemove(ids);
    selectedIds.value = new Set();
    batchDeleteOpen.value = false;
    await load();
    emit('saved', `已批量删除 ${ids.length} 个小节`);
    emit('changed', {
      scope: 'chapter',
      courseId: record.value?.course_id,
      chapterId: props.node.id
    });
  } catch (err) {
    emit('error', err);
  } finally {
    batchDeleting.value = false;
  }
};

// 批量复制生成副本
const copying = ref(false);
const runBatchCopy = async () => {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;

  copying.value = true;
  try {
    const res = await workbenchApi.sections.batchCopy(ids, props.node.id);
    selectedIds.value = new Set();
    await load();
    emit('saved', `已成功创建 ${res.count} 个小节副本`);
    emit('changed', {
      scope: 'chapter',
      courseId: record.value?.course_id,
      chapterId: props.node.id
    });
  } catch (err) {
    emit('error', err);
  } finally {
    copying.value = false;
  }
};

// 批量移动到指定章节
const moveModalOpen = ref(false);
const moving = ref(false);
const targetChapterId = ref('');
const availableChapters = ref([]);

const chapterOptions = computed(() =>
  availableChapters.value.map((ch) => ({
    value: String(ch.id),
    label: `${ch.tag ? ch.tag + ' · ' : ''}${ch.title}`
  }))
);

const openBatchMove = async () => {
  if (selectedIds.value.size === 0) return;
  try {
    const list = await workbenchApi.chapters.list(record.value.course_id);
    availableChapters.value = list.filter((ch) => ch.id !== props.node.id);
    if (availableChapters.value.length === 0) {
      emit('error', new Error('当前课程没有其他可供移动的章节'));
      return;
    }
    targetChapterId.value = String(availableChapters.value[0].id);
    moveModalOpen.value = true;
  } catch (err) {
    emit('error', err);
  }
};

const runBatchMove = async () => {
  if (!targetChapterId.value) return;
  const ids = Array.from(selectedIds.value);

  moving.value = true;
  try {
    await workbenchApi.sections.batchMove(ids, Number(targetChapterId.value));
    selectedIds.value = new Set();
    moveModalOpen.value = false;
    await load();
    emit('saved', `已移动 ${ids.length} 个小节到目标章节`);
    emit('changed', {
      scope: 'chapter',
      courseId: record.value?.course_id,
      chapterId: props.node.id
    });
  } catch (err) {
    emit('error', err);
  } finally {
    moving.value = false;
  }
};

const fileInput = ref(null);
const dragOver = ref(false);
const importOpen = ref(false);
const importing = ref(false);
const importRows = ref([]);

const dirtyAll = computed(() => dirty.value);
const meta = computed(() => (record.value ? `${sections.value.length} 个小节` : ''));

const load = async () => {
  loading.value = true;
  clearSelection();
  try {
    const [rec, list] = await Promise.all([
      workbenchApi.chapters.get(props.node.id),
      workbenchApi.sections.list(props.node.id)
    ]);
    record.value = rec;
    sections.value = list;
    fill(rec);
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

const discard = () => {
  reset();
};

const save = async () => {
  saving.value = true;
  try {
    const patch = diff();
    if (Object.keys(patch).length > 0) {
      record.value = await workbenchApi.chapters.update(props.node.id, patch);
      commit();
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

// 读取文件并预生成标识
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
      await workbenchApi.sections.create({
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
  <WorkbenchPanel
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
      class="wb-empty font-mono"
    >
      加载中...
    </div>

    <template v-else>
      <div class="wb-block">
        <div class="wb-form-grid">
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
          <div class="wb-span-2">
            <MTextarea
              v-model="form.summary"
              label="摘要"
              :rows="2"
              placeholder="本章内容概述"
            />
          </div>
        </div>
      </div>

      <div class="wb-block">
        <div class="wb-block-head">
          <span class="wb-block-title">小节</span>
          <span class="wb-block-desc font-mono">{{ sections.length }} 项 · 一小节对应一个 Typst 文件</span>
        </div>

        <div
          class="wb-dropzone"
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
          class="wb-note"
        >
          本章还没有小节。导入 .typ 文件，或在左侧树中把鼠标移到本章行上点 + 手动新建。
        </div>

        <template v-else>
          <div
            v-if="selectedIds.size > 0"
            class="wb-batch-bar"
          >
            <div class="wb-batch-info">
              <input
                type="checkbox"
                class="wb-checkbox"
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                title="全选 / 取消全选"
                @change="toggleSelectAll"
              />
              <span>已选择 <span class="wb-batch-count">{{ selectedIds.size }}</span> / {{ sections.length }} 项</span>
            </div>
            <div class="wb-batch-actions">
              <MButton
                variant="secondary"
                size="sm"
                :busy="copying"
                title="在当前章快速建立选中项的副本"
                @click="runBatchCopy"
              >
                批量复制
              </MButton>
              <MButton
                variant="secondary"
                size="sm"
                title="移动选中项到当前课程的其他章节"
                @click="openBatchMove"
              >
                批量移动
              </MButton>
              <MButton
                variant="danger"
                size="sm"
                @click="askBatchDelete"
              >
                批量删除
              </MButton>
              <MButton
                variant="secondary"
                size="sm"
                @click="clearSelection"
              >
                取消
              </MButton>
            </div>
          </div>

          <div class="wb-list">
            <div
              v-for="(sec, idx) in sections"
              :key="sec.id"
              class="wb-list-item"
              :class="{ 'is-selected': selectedIds.has(sec.id) }"
              @click="handleRowClick(sec)"
            >
              <input
                type="checkbox"
                class="wb-checkbox"
                :checked="selectedIds.has(sec.id)"
                @click.stop="toggleSelect(sec.id)"
              />
              <span class="wb-list-index">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="wb-list-label">{{ sec.title }}</span>
              <MTag
                v-if="!sec.has_source"
                variant="amber"
                size="sm"
              >
                空
              </MTag>
              <span class="wb-list-meta">{{ sec.slug }}</span>
              <span class="wb-list-meta">{{ sec.source_len }} 字</span>
            </div>
          </div>
        </template>
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

    <MModal
      :open="batchDeleteOpen"
      title="批量删除小节"
      :desc="`即将永久删除已选中的 ${selectedIds.size} 个小节`"
      confirm-text="确认批量删除"
      confirm-variant="danger"
      :busy="batchDeleting"
      @close="batchDeleteOpen = false"
      @confirm="runBatchDelete"
    >
      <div class="wb-note" style="color: #e07070; border-color: rgba(224, 112, 112, 0.4);">
        警告：选中的小节及其对应的 Typst 源码会一并彻底删除，且不可撤销。
      </div>
    </MModal>

    <MModal
      :open="moveModalOpen"
      title="批量移动小节"
      :desc="`将选中的 ${selectedIds.size} 个小节移动至其他章节`"
      confirm-text="确认移动"
      :busy="moving"
      @close="moveModalOpen = false"
      @confirm="runBatchMove"
    >
      <div class="wb-block">
        <MSelect
          v-model="targetChapterId"
          label="目标章节"
          :options="chapterOptions"
          placeholder="请选择目标章节"
        />
        <div class="wb-note" style="margin-top: 10px;">
          选中的小节将被追加至目标章节末尾。若目标章节已存在相同 slug，系统会自动平滑重命名避免键位冲突。
        </div>
      </div>
    </MModal>
  </WorkbenchPanel>
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
