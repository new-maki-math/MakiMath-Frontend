import { computed, onBeforeUnmount, onMounted, readonly, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

const panelState = ref({
  dirty: false,
  saving: false
});
export const workbenchPanelState = readonly(panelState);

export function useWorkbenchGuard({ dirty, saving, busy = () => false, blocked = () => false }) {
  const leaveOpen = ref(false);
  const isBusy = computed(() => saving.value || busy());
  let resolveLeave = null;

  watch(
    [dirty, isBusy],
    ([changed, pending]) => {
      panelState.value = {
        dirty: changed,
        saving: pending
      };
    },
    {
      immediate: true,
      flush: 'sync'
    }
  );

  function finishLeave(confirmed) {
    leaveOpen.value = false;
    const resolve = resolveLeave;
    resolveLeave = null;
    resolve?.(confirmed);
  }

  function confirmLeave() {
    if (isBusy.value || blocked() || resolveLeave) {
      return Promise.resolve(false);
    }
    if (!dirty.value) {
      return Promise.resolve(true);
    }
    leaveOpen.value = true;
    return new Promise((resolve) => {
      resolveLeave = resolve;
    });
  }

  function beforeUnload(event) {
    if (!dirty.value && !isBusy.value) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  }

  onBeforeRouteLeave(confirmLeave);
  onMounted(() => window.addEventListener('beforeunload', beforeUnload));
  onBeforeUnmount(() => {
    finishLeave(false);
    panelState.value = {
      dirty: false,
      saving: false
    };
    window.removeEventListener('beforeunload', beforeUnload);
  });

  return {
    leaveOpen,
    confirmLeave,
    finishLeave
  };
}
