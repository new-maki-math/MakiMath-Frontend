<script setup>
import { computed, ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
import MButton from '../../components/form/MButton.vue';
import MFilePicker from '../../components/form/MFilePicker.vue';
import MInput from '../../components/form/MInput.vue';
import MModal from '../../components/overlay/MModal.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MTextarea from '../../components/form/MTextarea.vue';
import { authStatus, currentUser, isSuperAdmin } from '../../utils/auth.js';
import ResourceDestinationPicker from './ResourceDestinationPicker.vue';

const props = defineProps({
  action: {
    type: String,
    default: ''
  },
  item: {
    type: Object,
    default: null
  },
  parentId: {
    type: [Number, String],
    default: null
  }
});
const emit = defineEmits(['close', 'changed']);
const titleMap = {
  folder: '新建文件夹',
  edit: '编辑资源',
  replace: '替换 PDF',
  copy: '复制资源',
  move: '移动资源',
  remove: '永久删除资源'
};
const name = ref('');
const description = ref('');
const file = ref(null);
const destination = ref(undefined);
const destinationLoading = ref(false);
const busy = ref(false);
const deleteStage = ref(0);
const showName = computed(() => ['folder', 'edit', 'copy'].includes(props.action));
const showDescription = computed(() => ['folder', 'edit'].includes(props.action));
const showFile = computed(() => props.action === 'replace');
const showDestination = computed(() => ['copy', 'move'].includes(props.action));

watch(
  () => props.action,
  (action) => {
    if (!action) {
      return;
    }
    name.value = props.item?.name || '';
    description.value = props.item?.description || '';
    file.value = null;
    destination.value = undefined;
    destinationLoading.value = false;
    deleteStage.value = 0;
  }
);
function selectFile(event) {
  const selected = event.target.files?.[0];
  event.target.value = '';
  file.value = selected || null;
}
function close() {
  if (!busy.value) {
    emit('close');
  }
}
async function submit() {
  if (busy.value || authStatus.value !== 'authenticated' || !isSuperAdmin.value) {
    return;
  }
  if (props.item?.is_system) {
    return notify('系统文件夹不能修改', 'warn');
  }
  if (props.action === 'remove' && deleteStage.value < 2) {
    deleteStage.value++;
    return;
  }
  if (showName.value && !name.value.trim()) {
    return notify('请填写名称', 'warn');
  }
  if (showFile.value && !file.value) {
    return notify('请选择 PDF 文件', 'warn');
  }
  if (file.value && file.value.size > 32 * 1024 * 1024) {
    return notify('PDF 文件不能超过 32 MiB', 'warn');
  }
  if (showDestination.value && destination.value === undefined) {
    return notify('请选择目标目录', 'warn');
  }
  if (['edit', 'replace'].includes(props.action) && typeof props.item?.updated_at !== 'string') {
    return notify('资源版本信息缺失，请刷新后重试', 'error');
  }
  const userId = currentUser.value?.id;
  const action = props.action;
  const item = props.item;
  busy.value = true;
  try {
    if (action === 'folder') {
      await resourceApi.createFolder({
        parent_id: props.parentId,
        name: name.value.trim(),
        description: description.value
      });
    } else if (action === 'edit') {
      await resourceApi.edit(item.id, {
        updated_at: item.updated_at,
        name: name.value.trim(),
        description: description.value
      });
    } else if (action === 'copy') {
      await resourceApi.copy(item.id, {
        parent_id: destination.value,
        name: name.value.trim()
      });
    } else if (action === 'move') {
      await resourceApi.move(item.id, {
        parent_id: destination.value
      });
    } else if (action === 'remove') {
      await resourceApi.remove(item.id);
    } else if (action === 'replace') {
      const form = new FormData();
      form.append('file', file.value);
      form.append('updated_at', item.updated_at);
      await resourceApi.replace(item.id, form);
    }
    if (
      currentUser.value?.id !== userId ||
      authStatus.value !== 'authenticated' ||
      !isSuperAdmin.value
    ) {
      return;
    }
    notify('操作成功', 'success');
    emit('changed');
    emit('close');
  } catch (failure) {
    if (currentUser.value?.id !== userId || !isSuperAdmin.value) {
      return;
    }
    notify(
      failure.status === 409 ? '资源已变化或名称冲突，请刷新后重试' : failure.message || '操作失败',
      'error'
    );
    if (failure.status === 409) {
      emit('changed');
      emit('close');
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <MModal
    :open="!!action"
    :title="titleMap[action] || ''"
    width="520px"
    :height="showDestination ? 'min(600px, calc(100vh - 96px))' : ''"
    hide-footer
    show-close
    @close="close"
  >
    <p
      v-if="action === 'remove'"
      class="action-message"
    >
      永久删除后无法恢复。文件夹及其中的所有内容都会被删除。
      {{ item?.name }}
    </p>
    <MFilePicker
      v-if="showFile"
      :title="file?.name || '选择 PDF 文件'"
      accept=".pdf,application/pdf"
      :disabled="busy"
      detail="单个文件不超过 32 MiB"
      @change="selectFile"
    />
    <MInput
      v-if="showName"
      v-model="name"
      label="名称"
      required
      :disabled="busy"
    />
    <MTextarea
      v-if="showDescription"
      v-model="description"
      label="说明"
      :disabled="busy"
    />
    <ResourceDestinationPicker
      v-if="showDestination"
      :open="showDestination"
      :disabled="busy"
      :forbidden-id="action === 'move' ? item?.id : null"
      @select="destination = $event"
      @loading="destinationLoading = $event"
    />
    <div class="action-footer">
      <MButton
        variant="ghost"
        :disabled="busy"
        @click="close"
        >取消</MButton
      >
      <MButton
        :variant="action === 'remove' ? 'danger' : 'primary'"
        :disabled="busy || (showDestination && destination === undefined)"
        :class="{
          'destination-loading': showDestination && destinationLoading && !busy
        }"
        @click="submit"
        >{{
          busy
            ? '处理中…'
            : action === 'remove'
              ? ['确认所选 1/3', '再次确认 2/3', '永久删除 3/3'][deleteStage]
              : '确认'
        }}</MButton
      >
    </div>
  </MModal>
</template>

<style scoped>
.destination-loading:disabled {
  opacity: 1;
}
.action-message {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}
.action-footer {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
