<script setup>
import { computed, ref, shallowRef, watch } from 'vue';

import { notify } from '../feedback/MNotice.vue';
import MButton from '../form/MButton.vue';
import { InfoCircleSolid } from '../icons/icons.js';
import KnowledgeReferencePicker from '../knowledge/KnowledgeReferencePicker.vue';
import MModal from '../overlay/MModal.vue';
import TypstDoc from '../typst-renderer/TypstDoc.vue';
import {
  convertLatexDocument,
  projectLatexDocument,
  projectTypstDocument,
  restoreTypstOriginals
} from './formula-source.js';
import { findKnowledgeInsertion } from './knowledge-reference-editor.js';
import TypstMonacoEditor from './TypstMonacoEditor.vue';
import { usePreviewScrollSync } from './usePreviewScrollSync.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  editable: {
    type: Boolean,
    default: false
  },
  knowledgeReferences: {
    type: Boolean,
    default: false
  },
  allowQuestionReferences: {
    type: Boolean,
    default: true
  }
});
const emit = defineEmits(['update:modelValue', 'save']);
const editorRef = ref(null);
const previewRef = ref(null);
const referenceTarget = shallowRef(null);
const languages = ['Typst', 'LaTeX'];
const language = ref('Typst');
const latexDraft = ref('');
const latexError = ref('');
const latexHelpOpen = ref(false);
const projection = shallowRef(null);
let lastConverted = null;
const typstProjection = computed(() => projectTypstDocument(props.modelValue));
const editorSource = computed(() =>
  language.value === 'LaTeX' ? latexDraft.value : typstProjection.value.source
);
const hasUnconvertedChanges = computed(() => Boolean(latexError.value));

function resetLatexDraft() {
  latexError.value = '';
  projection.value = projectLatexDocument(props.modelValue);
  latexDraft.value = projection.value.source;
}

function selectLanguage(tab) {
  if (tab === 'LaTeX' && !projection.value && !latexError.value) {
    resetLatexDraft();
  }
  language.value = tab;
}

function updateSource(source) {
  if (language.value === 'Typst') {
    emit('update:modelValue', restoreTypstOriginals(source, typstProjection.value.originals));
    return;
  }
  latexDraft.value = source;
  try {
    const converted = convertLatexDocument(source, projection.value?.originals);
    latexError.value = '';
    if (converted !== props.modelValue) {
      lastConverted = converted;
      emit('update:modelValue', converted);
    }
  } catch (error) {
    latexError.value = error.message;
  }
}

watch(
  () => props.modelValue,
  (source) => {
    if (lastConverted === source) {
      lastConverted = null;
      return;
    }
    lastConverted = null;
    projection.value = null;
    if (language.value === 'LaTeX' && !latexError.value) {
      resetLatexDraft();
    }
  }
);

function validateForSave() {
  if (!hasUnconvertedChanges.value) {
    return true;
  }
  notify('请先修正或放弃尚未转换的 LaTeX 修改', 'warn');
  return false;
}

defineExpose({
  hasUnconvertedChanges,
  validateForSave,
  resetLatexDraft
});
function handleType({ text, model, selection }) {
  if (language.value !== 'Typst' || !props.knowledgeReferences || !['e', '('].includes(text)) {
    return;
  }
  const range = findKnowledgeInsertion(model, selection, true);
  if (range) {
    openReference({
      range,
      version: model.getVersionId(),
      model
    });
  }
}
function openReference(target) {
  if (target) {
    referenceTarget.value = target;
  } else {
    notify('请将光标移到要插入的位置', 'warn');
  }
}
function closeReference() {
  referenceTarget.value = null;
  editorRef.value?.focus();
}
function insertReference(slug) {
  if (typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return;
  }
  if (!editorRef.value?.replaceRange(referenceTarget.value, `#mm-knowledge(slug: "${slug}")`)) {
    notify('编辑器内容已变化，请重新选择插入位置', 'warn');
  }
  closeReference();
}
const { scrollSyncEnabled, syncPreview, syncEditor, toggleScrollSync } = usePreviewScrollSync(
  editorRef,
  previewRef
);

function keepPanelPosition(event) {
  if (!event.target.closest('.monaco-mount')) {
    return;
  }
  const panel = event.currentTarget.closest('.panel-body');
  if (!panel) {
    return;
  }
  const top = panel.scrollTop;
  const left = panel.scrollLeft;
  requestAnimationFrame(() => {
    panel.scrollTop = top;
    panel.scrollLeft = left;
  });
}
</script>

<template>
  <div class="content-layout">
    <div
      class="content-editor"
      @pointerdown.capture="keepPanelPosition"
    >
      <TypstMonacoEditor
        ref="editorRef"
        :key="editable"
        :model-value="editorSource"
        @update:model-value="updateSource"
        height="max(600px, calc(100vh - 300px))"
        :readonly="!editable || (language === 'Typst' && hasUnconvertedChanges)"
        @type="handleType"
        @save="editable && validateForSave() && emit('save')"
        @scroll="language === 'Typst' && syncPreview($event)"
      >
        <template #label>
          <div
            class="source-language-tabs"
            role="group"
            aria-label="公式输入语言"
          >
            <MButton
              v-for="tab in languages"
              :key="tab"
              size="sm"
              :variant="language === tab ? 'secondary' : 'ghost'"
              :aria-pressed="language === tab"
              @click="selectLanguage(tab)"
              >{{ tab }}</MButton
            >
          </div>
        </template>
        <template #actions>
          <MButton
            v-if="language === 'LaTeX'"
            size="sm"
            variant="ghost"
            icon-only
            aria-label="LaTeX 输入提示"
            title="LaTeX 输入提示"
            aria-haspopup="dialog"
            @click="latexHelpOpen = true"
          >
            <template #icon
              ><InfoCircleSolid
                width="16"
                height="16"
            /></template>
          </MButton>
        </template>
        <template #notice>
          <div
            v-if="latexError"
            class="conversion-status"
          >
            <p role="status">{{ latexError }}。预览仍显示上一次有效内容。</p>
            <MButton
              size="sm"
              @click="resetLatexDraft"
              >放弃未转换修改</MButton
            >
          </div>
        </template>
      </TypstMonacoEditor>
    </div>
    <div class="preview-column">
      <div class="preview-heading">
        <span>预览</span
        ><MButton
          variant="secondary"
          size="sm"
          :aria-pressed="language === 'Typst' && scrollSyncEnabled"
          :disabled="language !== 'Typst'"
          @click="toggleScrollSync"
          >同步滚动：{{ language === 'Typst' && scrollSyncEnabled ? '开' : '关' }}</MButton
        >
      </div>
      <div
        ref="previewRef"
        class="content-preview"
        @scroll="language === 'Typst' && syncEditor()"
      >
        <TypstDoc
          v-if="typstProjection.source"
          :source="typstProjection.source"
          :allow-question-references="allowQuestionReferences"
        />
        <p
          v-else
          class="preview-empty"
        >
          输入源码后显示预览
        </p>
      </div>
    </div>
  </div>
  <KnowledgeReferencePicker
    :open="Boolean(referenceTarget)"
    @close="closeReference"
    @select="insertReference"
  />
  <MModal
    :open="latexHelpOpen"
    title="LaTeX 输入提示"
    width="520px"
    hide-footer
    show-close
    @close="latexHelpOpen = false"
  >
    <div class="latex-help">
      <p><u>此功能目前仍在测试，建议在其他地方完成 LaTeX 书写，然后复制到此处。</u></p>
      <p>行内公式写作 <code>\(\frac{a}{b}\)</code>，独立公式写作 <code>\[\frac{a}{b}\]</code>。</p>
      <p>正文、题目卡片等结构仍使用 Typst。右侧预览和保存都使用转换后的 Typst 源码。</p>
      <p>有些公式暂不支持转换，会保留为 Typst。公式没有改动时，切换标签会保留原写法。</p>
    </div>
  </MModal>
</template>

<style scoped>
.content-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}
.content-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.content-editor :deep(.code-head) {
  min-height: 28px;
}
.source-language-tabs,
.conversion-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.conversion-status {
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.conversion-status p {
  margin: 0;
}
.latex-help {
  display: grid;
  gap: 12px;
  line-height: 1.6;
}
.latex-help code {
  overflow-wrap: anywhere;
}
.preview-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  padding: 0 1px;
  font-size: var(--font-size-smaller);
  font-weight: 500;
  color: var(--text-secondary);
}
.content-preview {
  flex: 1;
  min-height: 600px;
  max-height: max(600px, calc(100vh - 300px));
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
}
.preview-empty {
  margin: 0;
  color: var(--text-muted);
}
@media (max-width: 900px) {
  .content-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .content-preview {
    min-height: 240px;
    max-height: 600px;
  }
}
</style>
