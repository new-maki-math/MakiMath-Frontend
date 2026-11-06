<script setup>
import { ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
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
const objectUrl = ref('');
const loading = ref(false);
const error = ref('');
const quota = ref(null);

function download() {
  if (!objectUrl.value || !props.resource) {
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = objectUrl.value;
  anchor.download = props.resource.name.toLowerCase().endsWith('.pdf')
    ? props.resource.name
    : `${props.resource.name}.pdf`;
  anchor.click();
}

watch(
  () => [props.resource?.id, authStatus.value, currentUser.value?.id],
  async ([id], previous, onCleanup) => {
    const controller = new AbortController();
    let active = true;
    let url = '';
    onCleanup(() => {
      active = false;
      controller.abort();
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
    objectUrl.value = '';
    error.value = '';
    quota.value = null;
    loading.value = false;
    if (!id) {
      return;
    }
    loading.value = true;
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
      const blob = await response.blob();
      if (!active) {
        return;
      }
      url = URL.createObjectURL(blob);
      objectUrl.value = url;
      emit('downloaded');
      emit('quota-change');
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
      }
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
    <p
      v-if="loading"
      class="pdf-message"
      role="status"
    >
      正在加载 PDF…
    </p>
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
    <template v-else-if="objectUrl">
      <iframe
        class="pdf-preview"
        :src="objectUrl"
        :title="resource.name"
      />
      <div class="pdf-actions"><MButton @click="download">下载 PDF</MButton></div>
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
.pdf-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
