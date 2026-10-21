<script setup>
import { computed, ref, watch } from 'vue';
import { adminApi } from '../../api/admin.js';
import { useForm } from './useForm.js';
import AdminPanel from './AdminPanel.vue';
import MInput from '../../components/MInput.vue';
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

const meta = computed(() => (record.value ? `${courses.value.length} 门课程` : ''));

const load = async () => {
  loading.value = true;
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
  <AdminPanel
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

        <div
          v-else
          class="adm-list"
        >
          <div
            v-for="(course, idx) in courses"
            :key="course.id"
            class="adm-list-item"
            @click="emit('navigate', { type: 'course', id: course.id, label: course.title, categoryId: node.id })"
          >
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
      </div>
    </template>
  </AdminPanel>
</template>
