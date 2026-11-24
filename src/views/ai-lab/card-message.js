import { shallowRef, watch } from 'vue';

import { canUseAi } from '../../utils/ai-access.js';

export const pendingCardMessage = shallowRef(null);
watch(canUseAi, (allowed) => {
  if (!allowed) {
    pendingCardMessage.value = null;
  }
});
