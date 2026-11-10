<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';

import { bookApi } from '../../api/books.js';
import MButton from '../../components/form/MButton.vue';
import MFilePicker from '../../components/form/MFilePicker.vue';
import MInput from '../../components/form/MInput.vue';
import MLectureCover from '../../components/book/MLectureCover.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MSelect from '../../components/form/MSelect.vue';
import MTextarea from '../../components/form/MTextarea.vue';
import WorkbenchPanel from '../../components/workbench/WorkbenchPanel.vue';
import { readAnimationFiles } from '../../utils/animation-package.js';

const revision = defineModel('revision', {
  type: Object,
  required: true
});
const lecture = defineModel('lecture', {
  type: Object,
  required: true
});

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  dirty: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  },
  editable: {
    type: Boolean,
    default: false
  },
  readOnlyMessage: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['save', 'reset', 'cover-change']);
const bookKind = computed(() => lecture.value.kind ?? 'lecture');
const kindLabel = computed(() => (bookKind.value === 'workbook' ? '题目册' : '讲义'));
const selectedCategory = computed({
  get: () => (revision.value.category_id == null ? '' : String(revision.value.category_id)),
  set: (value) => {
    revision.value.category_id = value ? Number(value) : null;
  }
});
const animationBase = computed(() => revision.value.metadata?.animation_base || {});
const animationBaseBusy = ref(false);
const animationBaseError = ref('');
function setAnimationBase(patch) {
  revision.value.metadata = {
    ...(revision.value.metadata || {}),
    animation_base: { ...animationBase.value, ...patch }
  };
}
async function importAnimationBase(event) {
  const files = event.target.files;
  if (!files?.length) return;
  const target = revision.value;
  animationBaseBusy.value = true;
  animationBaseError.value = '';
  try {
    const content = await readAnimationFiles(files);
    if (active && target === revision.value) setAnimationBase({ files: content });
  } catch (error) {
    animationBaseError.value = error.message || '无法读取动画基础包';
  } finally {
    animationBaseBusy.value = false;
    event.target.value = '';
  }
}
const coverInput = ref(null);
const coverLoading = ref(false);
const onlineCover = ref('');
const coverError = ref('');
let active = true;
let coverSequence = 0;
onUnmounted(() => {
  active = false;
  coverSequence++;
});
const cover = computed(() =>
  lecture.value.isLocal
    ? typeof revision.value.metadata?.cover === 'string'
      ? revision.value.metadata.cover
      : ''
    : onlineCover.value
);

async function loadCover() {
  const current = ++coverSequence;
  onlineCover.value = '';
  coverError.value = '';
  coverLoading.value = false;
  if (lecture.value.isLocal || !revision.value.id || !revision.value.has_cover) {
    return;
  }
  coverLoading.value = true;
  try {
    const result = await bookApi.getCover(revision.value.id, revision.value.cover_hash);
    if (current !== coverSequence) {
      return;
    }
    if (
      String(result.revision_id) !== String(revision.value.id) ||
      typeof result.cover !== 'string'
    ) {
      throw new Error('封面数据不完整');
    }
    onlineCover.value = result.cover;
  } catch (error) {
    if (current === coverSequence) {
      coverError.value = error.message || '封面加载失败';
    }
  } finally {
    if (current === coverSequence) {
      coverLoading.value = false;
    }
  }
}
watch(
  () => [
    lecture.value.isLocal,
    revision.value.id,
    revision.value.edit_version,
    revision.value.has_cover,
    revision.value.cover_hash
  ],
  loadCover,
  {
    immediate: true
  }
);

async function changeCover(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || !props.editable || coverLoading.value) {
    return;
  }
  const limit = lecture.value.isLocal ? 5 * 1024 * 1024 : 512 * 1024;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > limit) {
    notify(
      `请选择不超过 ${lecture.value.isLocal ? '5 MB' : '512 KB'} 的 JPG、PNG 或 WebP 图片`,
      'warn'
    );
    return;
  }
  if (!lecture.value.isLocal && props.dirty) {
    notify('请先保存或放弃图书修改，再更换封面', 'warn');
    return;
  }
  const targetRevision = revision.value;
  coverLoading.value = true;
  try {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
    if (!active || targetRevision !== revision.value || !props.editable) {
      return;
    }
    if (lecture.value.isLocal) {
      targetRevision.metadata = {
        ...(targetRevision.metadata || {}),
        cover: data
      };
    } else {
      emit('cover-change', data);
    }
  } catch (error) {
    if (active) {
      notify(error.message || '读取封面失败', 'error');
    }
  } finally {
    if (active) {
      coverLoading.value = false;
    }
  }
}

function removeCover() {
  if (!props.editable || coverLoading.value) {
    return;
  }
  if (!lecture.value.isLocal) {
    if (props.dirty) {
      notify('请先保存或放弃图书修改，再删除封面', 'warn');
      return;
    }
    emit('cover-change', '');
    return;
  }
  const metadata = {
    ...(revision.value.metadata || {})
  };
  delete metadata.cover;
  revision.value.metadata = metadata;
}
</script>

<template>
  <WorkbenchPanel
    :title="revision.title || lecture.slug"
    :dirty="dirty"
    :saving="saving"
    :editable="editable"
    :can-save="dirty"
    :read-only-message="readOnlyMessage"
    :submitted-at="revision.submitted_at || ''"
    :review-status="revision.status || ''"
    :reviewed-at="revision.reviewed_at || ''"
    @save="$emit('save')"
    @reset="$emit('reset')"
  >
    <template #actions><slot name="actions" /></template>
    <div
      class="course-panel-content"
      :inert="!editable"
    >
      <div class="course-layout">
        <div class="cover-field">
          <span class="cover-label">图书封面</span>
          <div class="cover-editor">
            <div
              class="cover-preview"
              aria-hidden="true"
              inert
            >
              <MLectureCover
                :title="revision.title || '图书封面'"
                :image="cover"
                :show-caption="false"
              />
            </div>
            <div class="cover-controls">
              <input
                ref="coverInput"
                class="cover-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="!editable || saving || coverLoading"
                @change="changeCover"
              />
              <MButton
                size="sm"
                :disabled="!editable || saving || coverLoading"
                @click="coverInput?.click()"
                >{{ cover ? '更换封面' : '选择封面' }}</MButton
              >
              <MButton
                v-if="cover"
                size="sm"
                variant="ghost"
                :disabled="!editable || saving || coverLoading"
                @click="removeCover"
                >删除封面</MButton
              >
              <span class="cover-hint">{{
                lecture.isLocal
                  ? '支持 JPG、PNG、WebP，最大 5 MB，选择后请保存图书'
                  : '支持 JPG、PNG、WebP，最大 512 KB，修改后立即保存'
              }}</span>
              <span
                v-if="coverError"
                class="cover-error"
                role="alert"
                >{{ coverError }}
                <button
                  type="button"
                  @click="loadCover"
                >
                  重试
                </button></span
              >
            </div>
          </div>
        </div>
        <div class="course-details wb-form-grid">
          <div class="wb-span-2">
            <MInput
              v-model="revision.title"
              label="图书名称"
              required
            />
          </div>
          <div class="wb-span-2">
            <MInput
              v-model="revision.subtitle"
              label="副标题"
            />
          </div>
          <div class="wb-span-2">
            <MSelect
              :model-value="bookKind"
              label="图书类型"
              hint="图书类型创建后不可修改"
              disabled
              :options="[
                {
                  value: 'lecture',
                  label: '讲义'
                },
                {
                  value: 'workbook',
                  label: '题目册'
                }
              ]"
            />
          </div>
          <MInput
            v-if="lecture.isLocal"
            v-model="lecture.slug"
            :label="`${kindLabel}标识`"
            hint="修改后图书地址会改变"
            required
          />
          <MInput
            v-else
            :model-value="lecture.slug"
            :label="`${kindLabel}标识`"
            disabled
          />
          <MSelect
            v-model="selectedCategory"
            :label="`${kindLabel}分类`"
            :options="[
              {
                value: '',
                label: '未分类'
              },
              ...categories.map((item) => ({
                value: String(item.id),
                label: item.name
              }))
            ]"
          />
          <div class="wb-span-2">
            <MTextarea
              v-model="revision.descr"
              label="简介"
              :rows="3"
            />
          </div>
          <div class="wb-span-2">
            <MTextarea
              v-model="revision.change_note"
              label="修改说明"
              :rows="2"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="wb-block animation-base" :inert="!editable">
      <div class="wb-block-head"><span class="wb-block-title">图书动画基础资源</span></div>
      <p class="animation-base-hint">在这里配置所有小节共用的脚本、字体和图片；播放器和数学公式依赖由平台提供。</p>
      <MFilePicker
        :title="animationBaseBusy ? '正在读取动画基础包…' : '动画基础包'"
        detail="共用脚本、字体与图片，最大 22 MB"
        :action="animationBase.files ? '替换文件夹' : '选择文件夹'"
        directory
        :disabled="!editable || animationBaseBusy"
        @change="importAnimationBase"
      />
      <p v-if="animationBaseError" class="animation-base-error">{{ animationBaseError }}</p>
      <details v-if="animationBase.files" class="animation-base-files">
        <summary>已导入 {{ Object.keys(animationBase.files).length }} 个基础文件</summary>
        <ul><li v-for="path in Object.keys(animationBase.files).sort()" :key="path">{{ path }}</li></ul>
      </details>
      <MButton v-if="animationBase.files" size="sm" variant="ghost" @click="setAnimationBase({ files: null })">移除动画基础资源</MButton>
    </div>
  </WorkbenchPanel>
</template>

<style scoped>
.animation-base-hint { color: var(--text-muted); font-size: var(--font-size-smaller); line-height: 1.5; }
.animation-base-error { color: var(--tag-red); font-size: var(--font-size-smaller); }
.animation-base-files { margin: 8px 0; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.animation-base-files ul { max-height: 180px; overflow: auto; padding-left: 20px; overflow-wrap: anywhere; }
.course-panel-content {
  container-type: inline-size;
}
.course-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  align-items: start;
  gap: clamp(24px, 4vw, 48px);
}
.course-details {
  min-width: 0;
  align-content: start;
}
.cover-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cover-label {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.cover-editor {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.cover-preview {
  width: 100%;
}
.cover-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.cover-input {
  display: none;
}
.cover-hint {
  flex-basis: 100%;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.cover-error {
  flex-basis: 100%;
  color: var(--tag-red);
  font-size: var(--font-size-smaller);
}
.cover-error button {
  color: var(--accent-primary);
}
@container (max-width: 620px) {
  .course-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .cover-editor {
    flex-direction: row;
    align-items: flex-start;
  }
  .cover-preview {
    width: min(150px, 40%);
    flex: none;
  }
  .course-details {
    grid-template-columns: 1fr;
  }
}
</style>
