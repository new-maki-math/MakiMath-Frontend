<script setup>
import { ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
import { ArrowRight } from '../../components/icons.js';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import { authStatus, currentUser } from '../../utils/auth.js';

const props = defineProps({
  resource: {
    type: Object,
    default: null
  }
});
const emit = defineEmits(['close', 'quota-change', 'downloaded']);
const previewLimit = 5 * 1024 * 1024;
const objectUrl = ref('');
const loading = ref(false);
const downloading = ref(false);
const error = ref('');
const quota = ref(null);
const tooLarge = ref(false);
const downloadResult = ref(false);
let downloadGeneration = 0;
let downloadController = null;

async function download() {
  if (!props.resource || loading.value || downloading.value) {
    return;
  }
  const resourceId = props.resource.id;
  const generation = downloadGeneration;
  const controller = new AbortController();
  downloadController = controller;
  downloading.value = true;
  downloadResult.value = false;
  error.value = '';
  quota.value = null;
  try {
    const result = await resourceApi.downloadTicket(resourceId, {
      signal: controller.signal
    });
    if (generation !== downloadGeneration) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = resourceApi.downloadUrl(resourceId, result.ticket);
    anchor.download = props.resource.name;
    anchor.rel = 'noreferrer';
    anchor.click();
    downloadResult.value = true;
  } catch (failure) {
    if (generation !== downloadGeneration || failure.name === 'AbortError') {
      return;
    }
    quota.value =
      failure.data?.details?.code === 'DOWNLOAD_QUOTA_EXCEEDED' ? failure.data.details : null;
    error.value = quota.value ? '下载额度不足' : failure.message || '无法开始下载';
    emit('quota-change');
  } finally {
    if (generation === downloadGeneration) {
      downloadController = null;
      downloading.value = false;
    }
  }
}

watch(
  () => [
    props.resource?.id,
    props.resource?.content_hash,
    props.resource?.size_bytes,
    authStatus.value,
    currentUser.value?.id
  ],
  async ([id], previous, onCleanup) => {
    downloadGeneration++;
    downloadController?.abort();
    downloadController = null;
    const controller = new AbortController();
    let active = true;
    let url = '';
    onCleanup(() => {
      active = false;
      downloadGeneration++;
      downloadController?.abort();
      downloadController = null;
      controller.abort();
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
    objectUrl.value = '';
    error.value = '';
    quota.value = null;
    tooLarge.value = false;
    loading.value = false;
    downloading.value = false;
    downloadResult.value = false;
    if (!id) {
      return;
    }
    async function fetchContent() {
      if (!active || loading.value || downloading.value) {
        return;
      }
      loading.value = true;
      error.value = '';
      quota.value = null;
      try {
        const response = await resourceApi.content(
          id,
          {
            disposition: 'attachment'
          },
          {
            signal: controller.signal
          }
        );
        if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf')) {
          throw new Error('文件响应格式错误');
        }
        if (!active) {
          return;
        }
        emit('downloaded');
        emit('quota-change');
        const blob = await response.blob();
        if (!active) {
          return;
        }
        tooLarge.value = blob.size > previewLimit;
        url = URL.createObjectURL(blob);
        objectUrl.value = url;
      } catch (failure) {
        if (!active || failure.name === 'AbortError') {
          return;
        }
        quota.value =
          failure.data?.details?.code === 'DOWNLOAD_QUOTA_EXCEEDED' ? failure.data.details : null;
        error.value = quota.value ? '下载额度不足' : failure.message || 'PDF 加载失败';
        emit('quota-change');
      } finally {
        if (active) {
          loading.value = false;
          downloading.value = false;
        }
      }
    }
    loading.value = true;
    try {
      const result = await resourceApi.detail(id, {
        signal: controller.signal
      });
      if (!active) {
        return;
      }
      const resource = result?.resource;
      if (
        String(resource?.id) !== String(id) ||
        resource?.kind !== 'pdf' ||
        !Number.isSafeInteger(resource.size_bytes) ||
        resource.size_bytes < 0
      ) {
        throw new Error('无法确认文件大小，请刷新后重试');
      }
      tooLarge.value = resource.size_bytes > previewLimit;
      loading.value = false;
      if (!tooLarge.value) {
        await fetchContent();
      }
    } catch (failure) {
      if (!active || failure.name === 'AbortError') {
        return;
      }
      error.value = failure.message || '无法读取文件信息，请刷新后重试';
      loading.value = false;
    }
  },
  {
    immediate: true
  }
);
</script>

<template>
  <MModal
    :open="!!resource"
    :title="resource?.name || 'PDF'"
    width="960px"
    hide-footer
    show-close
    @close="emit('close')"
  >
    <div
      v-if="loading"
      class="pdf-loading"
      role="status"
    >
      {{ downloading ? '正在下载 PDF…' : '正在加载预览…' }}
    </div>
    <div
      v-else-if="error"
      class="pdf-message"
      role="alert"
    >
      <p>{{ error }}</p>
      <p v-if="quota">
        剩余额度 {{ (quota.remaining_bytes / 1024 / 1024).toFixed(1) }} MiB<span
          v-if="quota.next_available_at"
          >，最早释放时间 {{ new Date(quota.next_available_at).toLocaleString() }}</span
        >
      </p>
    </div>
    <div
      v-if="downloadResult && !loading"
      class="download-state"
      role="status"
    >
      <span class="download-state-icon">
        <svg
          viewBox="0 0 48 48"
          width="72"
          height="72"
          fill="none"
          aria-hidden="true"
        >
          <circle
            class="download-state-circle"
            cx="24"
            cy="24"
            r="21"
          />
          <path
            class="download-state-check"
            d="m15 24 6 6 12-12"
          />
        </svg>
      </span>
      <h3>已发起下载</h3>
      <div class="download-state-actions">
        <MButton
          v-if="objectUrl && !tooLarge"
          variant="ghost"
          @click="downloadResult = false"
        >返回预览</MButton>
        <MButton
          v-else
          variant="ghost"
          :disabled="downloading"
          @click="download"
        >再次下载</MButton>
        <MButton @click="emit('close')">关闭</MButton>
      </div>
    </div>
    <template v-else-if="tooLarge && !loading">
      <p class="pdf-message">文件过大，无法预览，请下载后查看</p>
      <div class="pdf-actions">
        <MButton
          variant="primary"
          :disabled="downloading"
          @click="download"
          >下载 PDF</MButton
        >
      </div>
    </template>
    <template v-else-if="objectUrl && !loading">
      <iframe
        class="pdf-preview"
        :src="objectUrl"
        :title="resource.name"
      />
      <div class="pdf-actions">
        <a
          class="pdf-open"
          :href="objectUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          在新页面打开
          <ArrowRight
            class="pdf-open-icon"
            width="15"
            height="15"
          />
        </a>
        <MButton :disabled="downloading" @click="download">下载 PDF</MButton>
      </div>
    </template>
  </MModal>
</template>

<style scoped>
.pdf-preview {
  width: 100%;
  height: min(70vh, 760px);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
.pdf-message {
  color: var(--text-secondary);
  line-height: 1.6;
}
.pdf-message p {
  margin: 0;
}
.pdf-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-secondary);
}
.pdf-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}
.download-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 16px 12px;
  text-align: center;
}
.download-state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tag-green);
}
.download-state-circle,
.download-state-check {
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.download-state-circle {
  stroke-dasharray: 132;
  stroke-dashoffset: 132;
  animation: download-circle 500ms ease-out forwards;
}
.download-state-check {
  stroke-dasharray: 27;
  stroke-dashoffset: 27;
  animation: download-check 300ms ease-out 350ms forwards;
}
.download-state h3 {
  margin: 16px 0 0;
  color: var(--text-primary);
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
}
@keyframes download-circle {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes download-check {
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .download-state-circle,
  .download-state-check {
    animation: none;
    stroke-dashoffset: 0;
  }
}
.download-state-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}
.pdf-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-size);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}
.pdf-open:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.pdf-open:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}
.pdf-open-icon {
  flex: none;
  transform: rotate(-45deg);
}
@media (max-width: 700px) {
  .pdf-preview {
    height: 52dvh;
  }
  .pdf-actions {
    justify-content: space-between;
  }
  .download-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 16px 12px;
  text-align: center;
}
.download-state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--tag-blue-bg);
  color: var(--tag-blue);
}
.download-state h3 {
  margin: 16px 0 0;
  color: var(--text-primary);
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
}
.download-state-name {
  max-width: 100%;
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  overflow-wrap: anywhere;
}
.download-state-help {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  line-height: 1.6;
}
.download-state-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}
.pdf-open {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .pdf-actions :deep(.m-button),
  .download-state-actions :deep(.m-button) {
    min-height: 44px;
  }
}
</style>
