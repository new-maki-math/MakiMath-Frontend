<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { notify } from '../../components/feedback/MNotice.vue';
import { canUseAi } from '../../utils/ai-access.js';
import AiComposer from './AiComposer.vue';
import AiSettingsDialog from './AiSettingsDialog.vue';
import { pendingCardMessage } from './card-message.js';

const props = defineProps({
  reference: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['sent']);
const router = useRouter();
const composer = ref(null);
const settingsOpen = ref(false);
const sending = ref(false);

onMounted(() => composer.value?.focusInput());

async function send(message) {
  if (!canUseAi.value) {
    return;
  }
  if (pendingCardMessage.value) {
    notify('上一条卡片提问正在等待发送', 'error');
    return;
  }
  sending.value = true;
  try {
    await router.push({
      name: 'ai-lab'
    });
    if (!canUseAi.value) {
      return;
    }
    if (router.currentRoute.value.name !== 'ai-lab') {
      notify('无法打开 AI Lab，请重试', 'error');
      return;
    }
    pendingCardMessage.value = {
      ...message,
      reference: props.reference
    };
    emit('sent');
  } catch {
    notify('无法打开 AI Lab，请重试', 'error');
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AiComposer
    ref="composer"
    floating
    :busy="sending"
    @send="send"
    @settings="settingsOpen = true"
  />
  <AiSettingsDialog
    :z-index="110"
    :open="settingsOpen"
    @saved="composer?.updateModels()"
    @close="settingsOpen = false"
  />
</template>
