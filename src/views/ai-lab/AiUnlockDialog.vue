<script setup>
import { ref } from 'vue';

import { notify } from '../../components/feedback/MNotice.vue';
import MButton from '../../components/form/MButton.vue';
import MModal from '../../components/overlay/MModal.vue';
import {
  AI_PROVIDERS,
  deleteAiCredential,
  setAiConfiguration,
  unlockAiCredential
} from '../../utils/ai-credentials.js';

const props = defineProps({
  configuration: {
    type: Object,
    default: null
  }
});
const emit = defineEmits(['unlocked', 'deleted']);
const passwordInput = ref(null);
const busy = ref(false);
const confirmDelete = ref(false);

async function unlock() {
  const password = passwordInput.value?.value || '';
  if (!password) {
    notify('请输入独立口令', 'error');
    return;
  }
  busy.value = true;
  try {
    const { provider, baseUrl, models } = props.configuration;
    await unlockAiCredential(provider, baseUrl, password);
    if (models.length) {
      setAiConfiguration(provider, baseUrl, models);
    }
    passwordInput.value.value = '';
    notify('凭证已解锁', 'success');
    emit('unlocked', {
      needsSettings: !models.length
    });
  } catch (error) {
    notify(error.message || '解锁失败', 'error');
  } finally {
    busy.value = false;
  }
}

async function remove() {
  busy.value = true;
  try {
    await deleteAiCredential(props.configuration.provider, props.configuration.baseUrl);
    if (passwordInput.value) {
      passwordInput.value.value = '';
    }
    confirmDelete.value = false;
    notify('已删除本地凭证', 'success');
    emit('deleted');
  } catch {
    notify('删除凭证失败，请重试', 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <MModal
    :open="Boolean(configuration)"
    title="解锁 AI 凭证"
    width="440px"
    hide-footer
    contained
  >
    <form
      class="unlock-form"
      @submit.prevent="unlock"
    >
      <p>
        请输入独立口令，解锁 {{ AI_PROVIDERS[configuration?.provider]?.label || '已保存的' }} 凭证。
      </p>
      <label class="unlock-field">
        <span>独立口令</span>
        <input
          ref="passwordInput"
          type="password"
          autocomplete="current-password"
          :disabled="busy"
        />
      </label>
      <div
        v-if="confirmDelete"
        class="unlock-confirm"
      >
        <p>删除后无法恢复此浏览器中保存的 Key，需要重新输入。服务商的 Key 不会被撤销。</p>
        <div class="unlock-actions">
          <MButton
            type="button"
            variant="ghost"
            :disabled="busy"
            @click="confirmDelete = false"
            >取消</MButton
          >
          <MButton
            type="button"
            variant="danger"
            :disabled="busy"
            @click="remove"
            >确认删除</MButton
          >
        </div>
      </div>
      <div
        v-else
        class="unlock-actions"
      >
        <MButton
          type="button"
          variant="ghost"
          :disabled="busy"
          @click="confirmDelete = true"
          >忘记口令？</MButton
        >
        <MButton
          type="submit"
          variant="primary"
          :disabled="busy"
          >{{ busy ? '解锁中…' : '解锁' }}</MButton
        >
      </div>
    </form>
  </MModal>
</template>

<style scoped>
.unlock-form,
.unlock-field,
.unlock-confirm {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.unlock-form p {
  margin: 0;
  color: var(--text-secondary);
}
.unlock-field input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
  color: var(--text-primary);
}
.unlock-field input:focus {
  border-color: var(--border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-muted);
}
.unlock-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
</style>
