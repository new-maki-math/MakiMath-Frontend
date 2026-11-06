import { computed, onUnmounted, ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
import { authStatus, currentUser, isSuperAdmin } from '../../utils/auth.js';

const PAGE_SIZE = 50;

export function useResourceBrowser(layoutState) {
  const parentId = ref(null);
  const sort = ref('name');
  const order = ref('asc');
  const offset = ref(0);
  const data = ref(null);
  const pathCrumbs = ref([]);
  const loading = ref(false);
  const error = ref('');
  const isManager = computed(() => authStatus.value === 'authenticated' && isSuperAdmin.value);
  let sequence = 0;
  let controller;

  async function load() {
    const current = ++sequence;
    controller?.abort();
    controller = new AbortController();
    loading.value = true;
    error.value = '';
    data.value = null;
    const params = {
      sort: sort.value,
      order: order.value,
      limit: PAGE_SIZE,
      offset: offset.value
    };
    if (parentId.value !== null) {
      params.parent_id = parentId.value;
    }
    try {
      const result = await resourceApi.list(params, {
        signal: controller.signal
      });
      if (current !== sequence) {
        return;
      }
      if (
        !result ||
        !Array.isArray(result.items) ||
        !Array.isArray(result.breadcrumbs) ||
        !result.pagination ||
        !Number.isSafeInteger(result.pagination.total)
      ) {
        throw new Error('资源列表数据格式错误');
      }
      if (offset.value > 0 && offset.value >= result.pagination.total) {
        offset.value = Math.max(
          0,
          Math.floor((result.pagination.total - 1) / PAGE_SIZE) * PAGE_SIZE
        );
        return;
      }
      pathCrumbs.value = result.breadcrumbs;
      data.value = result;
    } catch (failure) {
      if (current === sequence && failure.name !== 'AbortError') {
        error.value = failure.message || '资源加载失败';
      }
    } finally {
      if (current === sequence) {
        loading.value = false;
      }
    }
  }

  function navigate(nextParent = null) {
    if (parentId.value === nextParent && offset.value === 0) {
      return;
    }
    if (nextParent === null) {
      pathCrumbs.value = [];
    } else {
      const index = pathCrumbs.value.findIndex((crumb) => crumb.id === nextParent);
      const folder = data.value?.items?.find(
        (item) => item.id === nextParent && item.kind === 'folder'
      );
      if (index !== -1) {
        pathCrumbs.value = pathCrumbs.value.slice(0, index + 1);
      } else if (folder) {
        pathCrumbs.value = [
          ...pathCrumbs.value,
          {
            id: folder.id,
            name: folder.name
          }
        ];
      }
    }
    parentId.value = nextParent;
    offset.value = 0;
  }
  function changeSort(field) {
    if (sort.value === field) {
      order.value = order.value === 'asc' ? 'desc' : 'asc';
    } else {
      sort.value = field;
      order.value = field === 'name' ? 'asc' : 'desc';
    }
    offset.value = 0;
  }
  function goUp() {
    const parent = pathCrumbs.value.at(-2);
    navigate(parent?.id ?? null);
  }
  watch(
    [
      parentId,
      sort,
      order,
      offset,
      authStatus,
      () => currentUser.value?.id,
      () => currentUser.value?.role
    ],
    () => {
      load();
    },
    {
      immediate: true
    }
  );
  watch(
    pathCrumbs,
    (crumbs) => {
      layoutState.resourceBreadcrumbs.value = [
        {
          label: '资源中心',
          action: () => navigate(null)
        },
        ...crumbs.map((crumb) => ({
          label: crumb.name,
          action: () => navigate(crumb.id)
        }))
      ];
    },
    {
      immediate: true
    }
  );
  onUnmounted(() => {
    sequence++;
    controller?.abort();
    layoutState.resourceBreadcrumbs.value = [];
  });
  return {
    parentId,
    sort,
    order,
    offset,
    data,
    loading,
    error,
    isManager,
    pageSize: PAGE_SIZE,
    load,
    navigate,
    changeSort,
    goUp
  };
}
