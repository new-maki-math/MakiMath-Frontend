<script setup>
import { computed, ref, watch } from 'vue';
import { adminApi, COURSE_STATUSES } from '../../api/admin.js';
import { useForm, useText } from './useForm.js';
import AdminPanel from './AdminPanel.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';
import MTextarea from '../../components/MTextarea.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';
import PrereqPicker from './PrereqPicker.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['changed', 'error', 'saved']);

const { form, fill, dirty, reset, diff, commit } = useForm([
  'slug',
  'title',
  'subtitle',
  'descr',
  'status',
  'typst_version'
]);
const preamble = useText('');

const record = ref(null);
const allCourses = ref([]);
const prereqs = ref([]);
const prereqBaseline = ref([]);
const loading = ref(true);
const saving = ref(false);

const prereqsDirty = computed(
  () => [...prereqs.value].sort().join(',') !== [...prereqBaseline.value].sort().join(',')
);

const dirtyAll = computed(() => dirty.value || preamble.dirty.value || prereqsDirty.value);

const meta = computed(() => {
  if (!record.value) return '';
  return `${record.value.chapter_count ?? 0} 章 · 宏 ${record.value.preamble_len ?? 0} 字符`;
});

const candidates = computed(() =>
  allCourses.value
    .filter((c) => c.id !== props.node.id)
    .map((c) => ({ id: c.id, label: c.title, meta: c.slug }))
);

const load = async () => {
  loading.value = true;
  try {
    const [rec, list] = await Promise.all([
      adminApi.courses.get(props.node.id),
      adminApi.courses.list()
    ]);
    record.value = rec;
    allCourses.value = list;
    fill(rec);
    preamble.set(rec.preamble ?? '');
    prereqs.value = (rec.prereqs ?? []).map(Number);
    prereqBaseline.value = [...prereqs.value];
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

const discard = () => {
  reset();
  preamble.reset();
  prereqs.value = [...prereqBaseline.value];
};

const save = async () => {
  saving.value = true;
  try {
    const patch = diff();
    if (Object.keys(patch).length > 0) {
      record.value = await adminApi.courses.update(props.node.id, patch);
      commit();
    }
    if (preamble.dirty.value) {
      await adminApi.courses.setPreamble(props.node.id, preamble.state.text);
      preamble.commit();
    }
    if (prereqsDirty.value) {
      await adminApi.courses.setPrereqs(props.node.id, prereqs.value);
      prereqBaseline.value = [...prereqs.value];
    }
    emit('saved', '课程已保存');
    emit('changed', { scope: 'course', courseId: props.node.id, label: form.title });
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
    kind="COURSE"
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
            label="课程名称"
            placeholder="例如：考研数学"
          />
          <MInput
            v-model="form.slug"
            label="slug"
            placeholder="kaoyan"
            hint="仅限字母数字与 . _ -"
          />
          <MInput
            v-model="form.subtitle"
            label="副标题"
            placeholder="选填"
          />
          <MSelect
            v-model="form.status"
            label="状态"
            :options="COURSE_STATUSES"
          />
          <MInput
            v-model="form.typst_version"
            label="Typst 版本"
            placeholder="0.15.1"
            hint="编译该课程小节时使用"
          />
          <div class="adm-span-2">
            <MTextarea
              v-model="form.descr"
              label="简介"
              :rows="3"
              placeholder="课程介绍"
            />
          </div>
        </div>
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">课程宏 preamble</span>
          <span class="adm-block-desc font-mono">编译本课任一 小节 时前置拼接</span>
        </div>
        <MCodeEditor
          v-model="preamble.state.text"
          height="300px"
          placeholder="#let 定义本课程共用的宏、字体与包引入"
          @save="save"
        />
      </div>

      <div class="adm-block">
        <div class="adm-block-head">
          <span class="adm-block-title">前置课程</span>
          <span class="adm-block-desc font-mono">建议先学完这些课程</span>
        </div>
        <PrereqPicker
          v-model="prereqs"
          :candidates="candidates"
          placeholder="按课程名称筛选"
        />
      </div>
    </template>
  </AdminPanel>
</template>
