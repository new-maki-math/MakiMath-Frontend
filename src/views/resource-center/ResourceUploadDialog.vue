<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
import MFileTypeIcon from '../../components/display/MFileTypeIcon.vue';
import MProgress from '../../components/feedback/MProgress.vue';
import MButton from '../../components/form/MButton.vue';
import MFilePicker from '../../components/form/MFilePicker.vue';
import { Xmark } from '../../components/icons/icons.js';
import MModal from '../../components/overlay/MModal.vue';
import { authStatus, currentUser, isSuperAdmin } from '../../utils/auth.js';
import { formatFileSize } from '../../utils/file-size.js';

const props = defineProps({
  open: Boolean,
  parentId: {
    type: [Number, String],
    default: null
  }
});
const emit = defineEmits(['close', 'changed']);
const entries = ref([]);
const busy = ref(false);
const pendingCount = computed(
  () => entries.value.filter((entry) => entry.status === 'pending').length
);
let nextId = 0;
let controller;
let runSequence = 0;

function selectFiles(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  for (const file of files) {
    const valid =
      file.name.toLowerCase().endsWith('.pdf') && file.size > 0 && file.size <= 32 * 1024 * 1024;
    entries.value.push({
      id: ++nextId,
      file,
      progress: 0,
      status: valid ? 'pending' : 'invalid',
      message: valid ? '' : '请选择不超过 32 MiB 的非空 PDF 文件'
    });
  }
}
function close() {
  if (!busy.value) {
    emit('close');
  }
}
async function uploadEntries(items) {
  if (busy.value || !isSuperAdmin.value || authStatus.value !== 'authenticated') {
    return;
  }
  const accountId = currentUser.value?.id;
  const destination = props.parentId;
  const sequence = ++runSequence;
  busy.value = true;
  controller = new AbortController();
  try {
    for (const entry of items) {
      if (
        sequence !== runSequence ||
        controller.signal.aborted ||
        currentUser.value?.id !== accountId ||
        !isSuperAdmin.value
      ) {
        break;
      }
      entry.status = 'uploading';
      entry.progress = 0;
      entry.message = '';
      const form = new FormData();
      form.append('file', entry.file);
      form.append('name', entry.file.name);
      if (destination !== null) {
        form.append('parent_id', String(destination));
      }
      try {
        await resourceApi.uploadWithProgress(form, {
          signal: controller.signal,
          onProgress: (fraction) => {
            if (sequence === runSequence) {
              entry.progress = Math.min(99, Math.floor(fraction * 100));
            }
          }
        });
        if (sequence !== runSequence || currentUser.value?.id !== accountId) {
          break;
        }
        entry.progress = 100;
        entry.status = 'success';
        emit('changed');
      } catch (failure) {
        if (sequence !== runSequence || currentUser.value?.id !== accountId) {
          break;
        }
        entry.status = 'error';
        entry.message = failure.message || '上传失败';
        if (failure.name === 'AbortError') {
          emit('changed');
          break;
        }
      }
    }
  } finally {
    if (sequence === runSequence) {
      busy.value = false;
      controller = null;
    }
  }
}
function cancelUpload() {
  controller?.abort();
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      entries.value = [];
    } else {
      runSequence++;
      controller?.abort();
      controller = null;
      busy.value = false;
    }
  }
);
watch([authStatus, () => currentUser.value?.id, isSuperAdmin], () => {
  if (props.open && (authStatus.value !== 'authenticated' || !isSuperAdmin.value)) {
    runSequence++;
    controller?.abort();
    controller = null;
    busy.value = false;
    emit('close');
    emit('changed');
  }
});
onUnmounted(() => {
  runSequence++;
  controller?.abort();
});
</script>

<template>
  <MModal
    :open="open"
    title="上传 PDF"
    width="560px"
    hide-footer
    show-close
    @close="close"
  >
    <MFilePicker
      title="选择 PDF 文件"
      detail="可多选，单个文件不超过 32 MiB"
      accept=".pdf,application/pdf"
      multiple
      :disabled="busy"
      @change="selectFiles"
    />
    <template v-if="entries.length">
      <div class="upload-list-heading">
        <span>已选择 {{ entries.length }} 个文件</span>
        <span v-if="busy">逐个上传</span>
      </div>
      <div class="upload-list">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="upload-item"
        >
          <div class="upload-row">
            <MFileTypeIcon
              class="upload-icon"
              type="pdf"
            />
            <div class="upload-file">
              <span
                class="upload-name"
                :title="entry.file.name"
                >{{ entry.file.name }}</span
              >
              <span class="upload-size">{{ formatFileSize(entry.file.size) }}</span>
            </div>
            <span
              class="upload-status"
              :class="`is-${entry.status}`"
              >{{
                entry.status === 'pending'
                  ? '等待上传'
                  : entry.status === 'uploading'
                    ? entry.progress === 99
                      ? '正在处理'
                      : `${entry.progress}%`
                    : entry.status === 'success'
                      ? '已完成'
                      : '未完成'
              }}</span
            >
            <div
              v-if="!busy && entry.status !== 'success'"
              class="upload-item-actions"
            >
              <MButton
                v-if="entry.status === 'error'"
                size="sm"
                variant="ghost"
                @click="uploadEntries([entry])"
                >重试</MButton
              >
              <MButton
                size="sm"
                variant="ghost"
                icon-only
                :title="`移除 ${entry.file.name}`"
                :aria-label="`移除 ${entry.file.name}`"
                @click="entries = entries.filter((item) => item.id !== entry.id)"
              >
                <Xmark
                  width="16"
                  height="16"
                  aria-hidden="true"
                />
              </MButton>
            </div>
          </div>
          <MProgress
            v-if="entry.status === 'uploading' || entry.status === 'success'"
            class="upload-progress"
            :value="entry.progress"
            :label="`${entry.file.name} 上传进度`"
          />
          <p
            v-if="entry.message"
            class="upload-error"
            role="alert"
          >
            {{ entry.message }}
          </p>
        </div>
      </div>
    </template>
    <div class="upload-footer">
      <MButton
        v-if="busy"
        variant="ghost"
        @click="cancelUpload"
        >停止上传</MButton
      >
      <MButton
        v-else
        variant="ghost"
        @click="close"
        >关闭</MButton
      >
      <MButton
        variant="primary"
        :disabled="busy || !pendingCount"
        @click="uploadEntries(entries.filter((entry) => entry.status === 'pending'))"
        >{{ busy ? '上传中…' : `上传${pendingCount ? ` ${pendingCount} 个文件` : ''}` }}</MButton
      >
    </div>
  </MModal>
</template>

<style scoped>
.upload-list {
  display: flex;
  flex-direction: column;
  max-height: min(42vh, 340px);
  overflow: auto;
  border-top: 1px solid var(--border-subtle);
}
.upload-list-heading {
  display: flex;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.upload-item {
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-subtle);
}
.upload-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.upload-icon {
  flex: none;
  width: 26px;
  height: 26px;
}
.upload-file {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.upload-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
.upload-status {
  flex: none;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.upload-size {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.upload-status.is-success {
  color: var(--tag-green);
}
.upload-status.is-error,
.upload-status.is-invalid {
  color: var(--tag-red);
}
.upload-progress {
  margin-top: 8px;
}
.upload-error {
  margin: 8px 0 0;
  color: var(--tag-red);
  overflow-wrap: anywhere;
}
.upload-item-actions {
  display: flex;
  align-items: center;
  flex: none;
}
.upload-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 700px) {
  .upload-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .upload-file {
    flex-basis: calc(100% - 36px);
  }
  .upload-status {
    margin-left: 34px;
  }
  .upload-item-actions {
    margin-left: auto;
  }
  .upload-item-actions :deep(.m-button),
  .upload-footer :deep(.m-button) {
    min-height: 40px;
  }
  .upload-item-actions :deep(.is-icon-only) {
    min-width: 40px;
  }
}
</style>
