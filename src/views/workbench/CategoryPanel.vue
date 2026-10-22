<script setup>
import { computed, ref, watch } from 'vue';
import { adminApi } from '../../api/admin.js';
import { useForm } from './useForm.js';
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import MTag from '../../components/MTag.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['changed', 'error', 'saved', 'navigate']);

const { form, fill, dirty, reset, diff, commit } = useForm(['slug', 'name']);

const record = ref(null);
const courses = ref([]);
const loading = ref(true);
const saving = ref(false);

// 多选状态
const selectedIds = ref(new Set());
const batchDeleteOpen = ref(false);
const batchDeleting = ref(false);

const isAllSelected = computed(() => {
  if (courses.value.length === 0) return false;
  return selectedIds.value.size === courses.value.length;
});

const isIndeterminate = computed(() => {
  return selectedIds.value.size > 0 && selectedIds.value.size < courses.value.length;
});

const toggleSelect = (id) => {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
};

const handleRowClick = (course) => {
  if (selectedIds.value.size > 0) {
    toggleSelect(course.id);
  } else {
    emit('navigate', {
      type: 'course',
      id: course.id,
      label: course.title,
      categoryId: props.node.id
    });
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(courses.value.map((c) => c.id));
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
    await adminApi.courses.batchRemove(ids);
    selectedIds.value = new Set();
    batchDeleteOpen.value = false;
    await load();
    emit('saved', `已批量删除 ${ids.length} 门课程`);
    emit('changed', {
      scope: 'category',
      categoryId: props.node.id,
      label: form.name
    });
  } catch (err) {
    emit('error', err);
  } finally {
    batchDeleting.value = false;
  }
};

const meta = computed(() => (record.value ? `${courses.value.length} 门课程` : ''));

const load = async () => {
  loading.value = true;
  clearSelection();
  try {
    record.value = await adminApi.categories.get(props.node.id);
    fill(record.value);
    courses.value = await adminApi.courses.list({ category_id: props.node.id });
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  const patch = diff();
  if (Object.keys(patch).length === 0) return;

  saving.value = true;
  try {
    record.value = await adminApi.categories.update(props.node.id, patch);
    commit();
    emit('saved', '分类已保存');
    emit('changed', { scope: 'category', categoryId: props.node.id, label: form.name });
  } catch (err) {
    emit('error', err);
  } finally {
    saving.value = false;
  }
};

watch(() => props.node.id, load, { immediate: true });
</script>

<template>
  <WorkbenchPanel
    kind="CATEGORY"
    :title="form.name || node.label"
    :meta="meta"
    :dirty="dirty"
    :saving="saving"
    @save="save"
    @reset="reset"
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
            v-model="form.name"
            label="分类名称"
            placeholder="例如：考研数学"
          />
          <MInput
            v-model="form.slug"
            label="slug"
            placeholder="kaoyan"
            hint="仅限字母数字与 . _ -"
          />
        </div>
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">下属课程</span>
          <span class="adm-block-desc font-mono">{{ courses.length }} 项</span>
        </div>

        <div
          v-if="courses.length === 0"
          class="adm-note"
        >
          该分类下还没有课程。把鼠标移到左侧树的分类行上，点 + 新建课程。
        </div>

        <template v-else>
          <div
            v-if="selectedIds.size > 0"
            class="adm-batch-bar"
          >
            <div class="adm-batch-info">
              <input
                type="checkbox"
                class="adm-checkbox"
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                title="全选 / 取消全选"
                @change="toggleSelectAll"
              />
              <span>已选择 <span class="adm-batch-count">{{ selectedIds.size }}</span> / {{ courses.length }} 项</span>
            </div>
            <div class="adm-batch-actions">
              <MButton
                variant="secondary"
                size="sm"
                @click="clearSelection"
              >
                取消
              </MButton>
              <MButton
                variant="danger"
                size="sm"
                @click="askBatchDelete"
              >
                批量删除
              </MButton>
            </div>
          </div>

          <div class="adm-list">
            <div
              v-for="(course, idx) in courses"
              :key="course.id"
              class="adm-list-item"
              :class="{ 'is-selected': selectedIds.has(course.id) }"
              @click="handleRowClick(course)"
            >
              <input
                type="checkbox"
                class="adm-checkbox"
                :checked="selectedIds.has(course.id)"
                @click.stop="toggleSelect(course.id)"
              />
              <span class="adm-list-index">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="adm-list-label">{{ course.title }}</span>
              <MTag
                :variant="course.status === 'live' ? 'green' : 'muted'"
                size="sm"
              >
                {{ course.status }}
              </MTag>
              <span class="adm-list-meta">{{ course.section_count }} 节</span>
            </div>
          </div>
        </template>
      </div>
    </template>

    <MModal
      :open="batchDeleteOpen"
      title="批量删除课程"
      :desc="`即将永久删除已选中的 ${selectedIds.size} 门课程`"
      confirm-text="确认批量删除"
      confirm-variant="danger"
      :busy="batchDeleting"
      @close="batchDeleteOpen = false"
      @confirm="runBatchDelete"
    >
      <div class="adm-note" style="color: #e07070; border-color: rgba(224, 112, 112, 0.4);">
        警告：选中的课程下的所有章节、小节与资源会一并彻底级联删除，且不可撤销。
      </div>
    </MModal>
  </WorkbenchPanel>
</template>
