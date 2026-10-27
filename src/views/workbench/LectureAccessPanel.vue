<script setup>
import { ref } from 'vue';
import { lectureApi } from '../../api/lectures.js';
import { notify } from '../../components/MNotice.vue';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';

const props = defineProps({
  lecture: { type: Object, required: true },
  collaborators: { type: Array, required: true },
  isAdmin: { type: Boolean, default: false }
});
const emit = defineEmits(['updated']);
const userId = ref('');
const permission = ref('view');
const busy = ref(false);

const update = async (body) => {
  if (busy.value) return;
  busy.value = true;
  try {
    const lecture = await lectureApi.setPublication(props.lecture.id, body);
    emit('updated', { lecture });
    notify('讲义状态已更新', 'success');
  } catch (err) {
    notify(err.message || '更新讲义状态失败', 'error');
  } finally {
    busy.value = false;
  }
};

const saveCollaborator = async () => {
  if (busy.value || !/^\d+$/.test(userId.value) || Number(userId.value) < 1) return;
  busy.value = true;
  try {
    await lectureApi.setCollaborator(props.lecture.id, Number(userId.value), permission.value);
    emit('updated', { collaborators: await lectureApi.collaborators(props.lecture.id) });
    userId.value = '';
    notify('协作者权限已更新', 'success');
  } catch (err) {
    notify(err.message || '设置协作者失败', 'error');
  } finally {
    busy.value = false;
  }
};

const removeCollaborator = async (item) => {
  if (busy.value) return;
  busy.value = true;
  try {
    await lectureApi.removeCollaborator(props.lecture.id, item.user_id);
    emit('updated', { collaborators: await lectureApi.collaborators(props.lecture.id) });
    notify('协作者已移除', 'success');
  } catch (err) {
    notify(err.message || '移除协作者失败', 'error');
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <section class="access-panel">
    <h3>讲义设置</h3>
    <p>发布状态：{{ lecture.publication_status }}</p>
    <div class="actions">
      <MButton size="sm" :disabled="busy || !lecture.public_revision_id" @click="update({ publication_status: 'published' })">上架</MButton>
      <MButton size="sm" :disabled="busy" @click="update({ publication_status: 'withdrawn' })">下架</MButton>
      <MButton size="sm" :disabled="busy" @click="update({ publication_status: 'archived' })">归档</MButton>
      <MButton v-if="isAdmin" size="sm" :disabled="busy" @click="update({ is_recommended: !lecture.is_recommended })">{{ lecture.is_recommended ? '取消推荐' : '推荐' }}</MButton>
    </div>
    <h3>协作者</h3>
    <div v-for="item in collaborators" :key="item.user_id" class="collaborator">
      <span>{{ item.display_name || item.username }} · {{ item.permission === 'edit' ? '编辑' : '查看' }}</span>
      <MButton size="sm" variant="danger" :disabled="busy" @click="removeCollaborator(item)">移除</MButton>
    </div>
    <MInput v-model="userId" label="用户 ID" />
    <MSelect v-model="permission" label="权限" :options="[{ value: 'view', label: '查看' }, { value: 'edit', label: '编辑' }]" />
    <MButton size="sm" :disabled="busy || !userId" @click="saveCollaborator">设置协作者</MButton>
  </section>
</template>

<style scoped>
.access-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  padding: 16px;
  background: var(--bg-surface);
}

.actions,
.collaborator {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
