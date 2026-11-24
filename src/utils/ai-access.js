import { computed } from 'vue';

import { authStatus, currentUser } from './auth.js';

export const aiFeaturesEnabled = (import.meta.env.VITE_AI_ENABLED ?? 'true') === 'true';
export const canUseAi = computed(
  () =>
    aiFeaturesEnabled &&
    authStatus.value === 'authenticated' &&
    ['admin', 'super_admin'].includes(currentUser.value?.role)
);
