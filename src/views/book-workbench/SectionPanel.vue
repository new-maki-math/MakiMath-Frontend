<script setup>
import { computed, ref } from 'vue';

import MFilePicker from '../../components/form/MFilePicker.vue';
import MInput from '../../components/form/MInput.vue';
import MTextarea from '../../components/form/MTextarea.vue';
import TypstEditorPreview from '../../components/typst/TypstEditorPreview.vue';
import WorkbenchPanel from '../../components/workbench/WorkbenchPanel.vue';
import { t } from '../../i18n.js';
import {
  createAnimationPackage,
  parseAnimationAssets,
  validateAnimationAssets
} from '../../utils/animation-package.js';

const section = defineModel('section', {
  type: Object,
  required: true
});

const props = defineProps({
  animationBase: {
    type: Object,
    default: null
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
  },
  submittedAt: {
    type: String,
    default: ''
  },
  reviewStatus: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['save', 'reset']);
const sourceEditor = ref(null);
defineExpose({
  hasUnconvertedChanges: computed(() => sourceEditor.value?.hasUnconvertedChanges),
  validateForSave: () => sourceEditor.value?.validateForSave(),
  resetLatexDraft: () => sourceEditor.value?.resetLatexDraft()
});
const animationPackage = computed(() => parseAnimationAssets(section.value.animation_source || ''));
const animationError = ref('');
const animationLoading = ref(false);
async function chooseAnimation(event) {
  const selectedSection = section.value;
  const selectedBase = props.animationBase;
  const files = event.target.files;
  if (!files?.length) {
    return;
  }
  animationLoading.value = true;
  animationError.value = '';
  try {
    const pkg = await createAnimationPackage(files);
    if (section.value !== selectedSection || props.animationBase !== selectedBase) {
      throw new Error('图书或基础包已变化，请重新导入动画');
    }
    validateAnimationAssets(selectedBase, pkg);
    selectedSection.animation_source = JSON.stringify(pkg);
  } catch (error) {
    animationError.value = error.message || '无法读取动画资源';
  } finally {
    animationLoading.value = false;
    event.target.value = '';
  }
}
</script>

<template>
  <WorkbenchPanel
    kind="SECTION"
    :title="section.title || section.slug || t('未命名小节')"
    :dirty="dirty"
    :saving="saving"
    :editable="editable"
    :can-save="dirty"
    :read-only-message="readOnlyMessage"
    :submitted-at="submittedAt"
    :review-status="reviewStatus"
    :reviewed-at="reviewedAt"
    @save="emit('save')"
    @reset="emit('reset')"
  >
    <template #actions><slot name="actions" /></template>
    <div
      class="wb-block"
      :inert="!editable"
    >
      <div class="wb-form-grid">
        <MInput
          v-model="section.title"
          :label="t('小节标题')"
          required
        />
        <MInput
          v-model="section.slug"
          :label="t('小节标识')"
          :hint="t('章节内唯一')"
          required
        />
        <MInput
          v-model="section.tag"
          :label="t('标签')"
        />
        <div class="wb-span-2">
          <MTextarea
            v-model="section.summary"
            :label="t('摘要')"
            :rows="2"
          />
        </div>
      </div>
    </div>
    <div
      class="wb-block"
      :inert="!editable"
    >
      <div class="wb-block-head">
        <span class="wb-block-title">{{ t('分步动画') }}</span>
      </div>
      <MFilePicker
        :title="t(animationLoading ? '正在检查动画文件…' : '小节动画资源')"
        :detail="t('包含 animation.json 和场景资源，最大 22 MB')"
        :action="t(animationPackage ? '替换文件夹' : '选择文件夹')"
        directory
        :disabled="animationLoading || !editable"
        @change="chooseAnimation"
      />
      <p
        v-if="animationError"
        class="animation-error"
      >
        {{ animationError }}
      </p>
      <template v-if="animationPackage">
        <details class="animation-files">
          <summary>
            {{
              t('已导入 {count} 个文件', {
                count: Object.keys(animationPackage.files).length
              })
            }}
          </summary>
          <ul>
            <li
              v-for="path in Object.keys(animationPackage.files).sort()"
              :key="path"
            >
              {{ path }}
            </li>
          </ul>
        </details>
        <button
          class="animation-remove"
          type="button"
          @click="section.animation_source = ''"
        >
          {{ t('移除动画') }}
        </button>
      </template>
      <p
        v-else-if="section.animation_source"
        class="animation-error"
      >
        {{ t('当前动画不是资源包，请选择动画文件夹替换。') }}
      </p>
    </div>
    <div class="wb-block">
      <div class="wb-block-head">
        <span class="wb-block-title">{{ t('小节内容') }}</span>
      </div>
      <TypstEditorPreview
        ref="sourceEditor"
        :key="section.occurrence_id"
        v-model="section.source"
        :editable="editable"
        knowledge-references
        @save="emit('save')"
      />
    </div>
  </WorkbenchPanel>
</template>

<style scoped>
.animation-error {
  color: var(--tag-red);
  font-size: var(--font-size-smaller);
}
.animation-files {
  margin: 8px 0;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
}
.animation-files ul {
  max-height: 180px;
  overflow: auto;
  padding-left: 20px;
  overflow-wrap: anywhere;
}
.animation-remove {
  margin-top: 10px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
</style>
