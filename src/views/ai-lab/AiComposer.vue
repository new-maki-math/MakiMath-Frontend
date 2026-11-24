<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AiGlow from '../../components/display/AiGlow.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MButton from '../../components/form/MButton.vue';
import MSelect from '../../components/form/MSelect.vue';
import { SendArrow, Settings, Xmark } from '../../components/icons/icons.js';
import { getAiConfiguration } from '../../utils/ai-credentials.js';
import { loadSelectedAiModel, saveSelectedAiModel } from '../../utils/ai-models.js';
import AiImagePreview from './AiImagePreview.vue';
const draft = ref('');
const configuration = ref(getAiConfiguration());
const selectedModel = ref('');
const props = defineProps({
  busy: Boolean,
  hasMessages: Boolean,
  floating: Boolean
});
const emit = defineEmits(['send', 'settings', 'height']);
const modelOptions = computed(() =>
  (configuration.value?.models || []).map((item) => ({
    value: item.id,
    label: item.name
  }))
);

function updateModels() {
  const previous = configuration.value;
  const next = getAiConfiguration();
  configuration.value = next;
  if (!next) {
    selectedModel.value = '';
    return;
  }
  const sameProvider = previous?.provider === next.provider && previous?.baseUrl === next.baseUrl;
  const remembered = loadSelectedAiModel(next.provider, next.baseUrl);
  const candidate = sameProvider && selectedModel.value ? selectedModel.value : remembered;
  selectedModel.value = modelOptions.value.some((item) => item.value === candidate)
    ? candidate
    : modelOptions.value[0]?.value || '';
}

function selectModel(value) {
  selectedModel.value = value;
  if (!configuration.value || !value) {
    return;
  }
  try {
    saveSelectedAiModel(configuration.value.provider, configuration.value.baseUrl, value);
  } catch {
    notify('模型选择保存失败，请检查浏览器存储权限', 'error');
  }
}
const images = ref([]);
const previewImage = ref(null);
const composerWrap = ref(null);
const inputElement = ref(null);
const inputMeasure = ref(null);
const composerHeight = ref(180);
const pendingImageUrls = new Set();
let composerObserver;
let composerWidth = 0;

function pasteImages(event) {
  const files = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && /^image\/(png|jpeg|webp|gif)$/.test(item.type))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!files.length) {
    return;
  }
  if (!event.clipboardData?.getData('text/plain')) {
    event.preventDefault();
  }
  images.value.push(
    ...files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file)
    }))
  );
}

function removeImage(id) {
  const image = images.value.find((item) => item.id === id);
  if (image) {
    if (previewImage.value?.id === id) {
      previewImage.value = null;
    }
    pendingImageUrls.add(image.url);
    images.value = images.value.filter((item) => item.id !== id);
  }
}

function releaseRemovedImage(element) {
  const url = element.dataset.previewUrl;
  if (url && pendingImageUrls.delete(url)) {
    URL.revokeObjectURL(url);
  }
}

onBeforeUnmount(() => {
  composerObserver?.disconnect();
  for (const image of images.value) {
    URL.revokeObjectURL(image.url);
  }
  for (const url of pendingImageUrls) {
    URL.revokeObjectURL(url);
  }
});

onMounted(() => {
  updateModels();
  resizeInput();
  if (typeof ResizeObserver !== 'undefined') {
    composerObserver = new ResizeObserver(() => {
      composerHeight.value = composerWrap.value?.offsetHeight || 180;
      emit('height', composerHeight.value);
      const width = composerWrap.value?.clientWidth || 0;
      if (width !== composerWidth) {
        composerWidth = width;
        resizeInput();
      }
    });
    composerObserver.observe(composerWrap.value);
  }
});

function resizeInput() {
  const input = inputElement.value;
  const measure = inputMeasure.value;
  if (!input || !measure) {
    return;
  }
  measure.textContent = `${input.value}\u200b`;
  input.style.height = `${Math.max(24, Math.min(measure.scrollHeight, 200))}px`;
}

watch(draft, resizeInput, {
  flush: 'post'
});

function send() {
  if (props.busy || (!draft.value.trim() && !images.value.length)) {
    return;
  }
  if (!selectedModel.value) {
    notify('请先在 AI 设置中选择模型', 'error');
    return;
  }
  emit('send', {
    text: draft.value.trim(),
    files: images.value.map((image) => image.file),
    model: selectedModel.value
  });
  if (props.floating) {
    return;
  }
  draft.value = '';
  for (const image of images.value) {
    URL.revokeObjectURL(image.url);
  }
  images.value = [];
}
defineExpose({
  updateModels,
  focusInput() {
    inputElement.value?.focus({ preventScroll: true });
  }
});
</script>
<template>
  <div>
    <div
      ref="composerWrap"
      class="ai-lab-composer-wrap"
      :class="{ 'is-floating': floating }"
    >
      <AiGlow
        class="ai-lab-composer"
        :active="!hasMessages"
        :full-ring="floating"
      >
        <div
          class="ai-lab-images-shell"
          :class="{
            'has-images': images.length
          }"
        >
          <TransitionGroup
            name="ai-lab-image"
            tag="div"
            class="ai-lab-images"
            aria-label="已粘贴的图片"
            @after-leave="releaseRemovedImage"
          >
            <div
              v-for="(image, index) in images"
              :key="image.id"
              class="ai-lab-image"
              :data-preview-url="image.url"
            >
              <button
                type="button"
                class="ai-lab-image-preview"
                :aria-label="`预览图片 ${index + 1}`"
                @click="previewImage = image"
              >
                <img
                  :src="image.url"
                  :alt="`粘贴的图片 ${index + 1}`"
                />
              </button>
              <button
                type="button"
                class="ai-lab-image-remove"
                :aria-label="`移除图片 ${index + 1}`"
                @click="removeImage(image.id)"
              >
                <Xmark
                  width="14"
                  height="14"
                  aria-hidden="true"
                />
              </button>
            </div>
          </TransitionGroup>
        </div>
        <textarea
          ref="inputElement"
          v-model="draft"
          class="ai-lab-input"
          placeholder="输入你的问题…"
          aria-label="输入你的问题"
          rows="1"
          @input="resizeInput"
          @paste="pasteImages"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <div
          ref="inputMeasure"
          class="ai-lab-input-measure"
          aria-hidden="true"
        ></div>
        <div class="ai-lab-actions">
          <div class="ai-lab-tools">
            <MButton
              variant="ghost"
              size="md"
              icon-only
              class="ai-lab-settings"
              title="AI 设置"
              aria-label="AI 设置"
              @click="emit('settings')"
            >
              <Settings
                width="18"
                height="18"
                aria-hidden="true"
              />
            </MButton>
            <MSelect
              :model-value="selectedModel"
              class="ai-lab-model-select"
              variant="ghost"
              aria-label="选择模型"
              :options="modelOptions"
              :disabled="!modelOptions.length"
              @update:model-value="selectModel"
            />
          </div>
          <MButton
            variant="primary"
            size="md"
            icon-only
            class="ai-lab-send"
            :disabled="busy || (!draft.trim() && !images.length)"
            :title="busy ? '正在等待回复' : '发送消息'"
            @click="send"
            aria-label="发送消息"
          >
            <SendArrow
              width="20"
              height="20"
              aria-hidden="true"
            />
          </MButton>
        </div>
      </AiGlow>
    </div>
    <AiImagePreview
      :src="previewImage?.url || ''"
      :filename="previewImage?.file.name || ''"
      @close="previewImage = null"
    />
  </div>
</template>
<style scoped>
.ai-lab-composer-wrap {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 16px 24px calc(24px + env(safe-area-inset-bottom, 0px));
}
.ai-lab-composer {
  position: relative;
  isolation: isolate;
  width: min(100%, 800px);
  margin: 0 auto;
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
  box-shadow: 0 8px 24px var(--shadow-color-soft);
  transition: border-color 140ms var(--ease-standard);
}
.ai-lab-composer:focus-within {
  border-color: var(--border-focus);
}
.ai-lab-input {
  display: block;
  width: 100%;
  min-height: 24px;
  max-height: 200px;
  padding: 0;
  overflow-y: auto;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  line-height: 1.6;
  transition: height 180ms var(--ease-layout);
}
.ai-lab-input-measure {
  position: absolute;
  right: 12px;
  left: 12px;
  visibility: hidden;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font: inherit;
  line-height: 1.6;
  pointer-events: none;
}
.ai-lab-images-shell {
  display: grid;
  grid-template-rows: 0fr;
  margin-bottom: 0;
  transition:
    grid-template-rows 220ms var(--ease-layout),
    margin-bottom 220ms var(--ease-layout);
}
.ai-lab-images-shell.has-images {
  grid-template-rows: 1fr;
  margin-bottom: 10px;
}
.ai-lab-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 0;
  max-height: 160px;
  overflow-y: auto;
}
.ai-lab-image {
  position: relative;
  flex: none;
  width: 72px;
  height: 72px;
}
.ai-lab-image-enter-active,
.ai-lab-image-leave-active,
.ai-lab-image-move {
  transition:
    opacity 220ms var(--ease-layout),
    transform 220ms var(--ease-layout);
}
.ai-lab-image-enter-from,
.ai-lab-image-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
.ai-lab-image-preview {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
}
.ai-lab-image-preview:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
.ai-lab-image img {
  display: block;
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  object-fit: cover;
}
.ai-lab-image-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--overlay-backdrop);
  color: var(--color-on-solid);
  opacity: 0;
  transition: opacity 140ms var(--ease-standard);
}
.ai-lab-image:hover .ai-lab-image-remove,
.ai-lab-image:focus-within .ai-lab-image-remove {
  opacity: 0.75;
}
.ai-lab-image .ai-lab-image-remove:hover {
  opacity: 1;
}
.ai-lab-image-remove:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
@media (hover: none) {
  .ai-lab-image-remove {
    opacity: 0.65;
  }
}
.ai-lab-input::placeholder {
  color: var(--text-muted);
}
.ai-lab-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
.ai-lab-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}
.ai-lab-model-select {
  min-width: 0;
}
.ai-lab-model-select :deep(.select-trigger) {
  max-width: 100%;
  height: auto;
  min-height: 36px;
  padding-block: 6px;
}
.ai-lab-model-select :deep(.select-text) {
  overflow: visible;
  overflow-wrap: anywhere;
  white-space: normal;
}
.ai-lab-settings.m-button {
  border-color: transparent;
}
.ai-lab-actions .ai-lab-send.m-button.is-icon-only {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.ai-lab-send.m-button:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  opacity: 1;
}
@media (max-width: 767px) {
  .ai-lab-composer-wrap {
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  }
}
.ai-lab-composer-wrap.is-floating {
  position: relative;
  padding: 0;
}
@media (prefers-reduced-motion: reduce) {
  .ai-lab-input,
  .ai-lab-images-shell,
  .ai-lab-image-enter-active,
  .ai-lab-image-leave-active,
  .ai-lab-image-move {
    animation: none;
    transition: none;
  }
}
</style>
