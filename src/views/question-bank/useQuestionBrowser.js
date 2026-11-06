import { onScopeDispose, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import { authStatus, currentUser } from '../../utils/auth.js';

export function useQuestionBrowser() {
  const categoryId = ref(null);
  const query = ref('');
  const offset = ref(0);
  const data = ref(null);
  const loading = ref(false);
  const error = ref('');
  let sequence = 0;
  let controller;
  let timer;
  async function load() {
    const current = ++sequence;
    controller?.abort();
    controller = new AbortController();
    loading.value = true;
    error.value = '';
    data.value = null;
    try {
      const result = await questionApi.entries(
        {
          category_id: categoryId.value,
          q: query.value.trim(),
          limit: 50,
          offset: offset.value
        },
        {
          signal: controller.signal
        }
      );
      if (current !== sequence) {
        return;
      }
      if (
        !Array.isArray(result?.children) ||
        !Array.isArray(result?.items) ||
        !Array.isArray(result?.breadcrumbs) ||
        !Number.isSafeInteger(result?.pagination?.total)
      ) {
        throw new Error('题库列表格式错误');
      }
      if (offset.value && offset.value >= result.pagination.total) {
        offset.value = Math.max(0, Math.floor((result.pagination.total - 1) / 50) * 50);
        return;
      }
      data.value = result;
    } catch (failure) {
      if (current === sequence && failure.name !== 'AbortError') {
        error.value = failure.message || '题库加载失败';
      }
    } finally {
      if (current === sequence) {
        loading.value = false;
      }
    }
  }
  function navigate(id) {
    clearTimeout(timer);
    categoryId.value = id;
    offset.value = 0;
  }
  watch([categoryId, offset, authStatus, () => currentUser.value?.id], load, {
    immediate: true
  });
  watch(
    query,
    () => {
      clearTimeout(timer);
      sequence++;
      controller?.abort();
      loading.value = true;
      timer = setTimeout(() => {
        if (offset.value) {
          offset.value = 0;
        } else {
          load();
        }
      }, 200);
    },
    {
      flush: 'sync'
    }
  );
  onScopeDispose(() => {
    sequence++;
    controller?.abort();
    clearTimeout(timer);
  });
  return {
    categoryId,
    query,
    offset,
    data,
    loading,
    error,
    load,
    navigate
  };
}
