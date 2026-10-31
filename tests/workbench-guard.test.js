import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { createRenderer, h, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter, isNavigationFailure, RouterView } from 'vue-router';

import { useWorkbenchGuard, workbenchPanelState } from '../src/composables/useWorkbenchGuard.js';

const renderer = createRenderer({
  createElement: (type) => ({
    type,
    children: []
  }),
  createText: (text) => ({
    text
  }),
  createComment: (text) => ({
    text
  }),
  setText: (node, text) => {
    node.text = text;
  },
  setElementText: (node, text) => {
    node.text = text;
  },
  parentNode: (node) => node.parent,
  nextSibling: (node) => {
    const siblings = node.parent?.children || [];
    return siblings[siblings.indexOf(node) + 1] || null;
  },
  insert: (node, parent, anchor = null) => {
    if (node.parent) {
      node.parent.children.splice(node.parent.children.indexOf(node), 1);
    }
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node);
    node.parent = parent;
  },
  remove: (node) => {
    node.parent?.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
  },
  patchProp: () => {}
});

let app;
let originalWindow;

async function mountWorkbench() {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: new EventTarget()
  });
  const dirty = ref(false);
  const saving = ref(false);
  const busy = ref(false);
  const blocked = ref(false);
  let guard;
  const page = {
    setup() {
      guard = useWorkbenchGuard({
        dirty,
        saving,
        busy: () => busy.value,
        blocked: () => blocked.value
      });
      return () => h('section');
    }
  };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/workbench',
        component: page
      },
      {
        path: '/away',
        component: {
          render: () => h('p')
        }
      }
    ]
  });
  await router.push('/workbench');
  app = renderer.createApp({
    render: () => h(RouterView)
  });
  app.use(router);
  app.mount({
    children: []
  });
  await nextTick();
  return {
    dirty,
    saving,
    busy,
    blocked,
    router,
    guard
  };
}

afterEach(() => {
  app?.unmount();
  app = null;
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);
  } else {
    delete globalThis.window;
  }
});

test('没有修改时直接离开工作台', async () => {
  const { router, guard } = await mountWorkbench();
  await router.push('/away');
  assert.equal(router.currentRoute.value.path, '/away');
  assert.equal(guard.leaveOpen.value, false);
});

test('取消离开时保留当前页面和未保存状态', async () => {
  const { dirty, router, guard } = await mountWorkbench();
  dirty.value = true;
  const navigation = router.push('/away');
  await setImmediate();
  assert.equal(guard.leaveOpen.value, true);
  assert.equal(await guard.confirmLeave(), false);
  guard.finishLeave(false);
  assert.equal(isNavigationFailure(await navigation), true);
  assert.equal(router.currentRoute.value.path, '/workbench');
  assert.equal(dirty.value, true);
  assert.equal(workbenchPanelState.value.dirty, true);
});

test('确认离开后清除布局保护状态和浏览器关闭监听', async () => {
  const { dirty, router, guard } = await mountWorkbench();
  dirty.value = true;
  const event = new Event('beforeunload', {
    cancelable: true
  });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  const navigation = router.push('/away');
  await setImmediate();
  guard.finishLeave(true);
  await navigation;
  await nextTick();
  assert.equal(router.currentRoute.value.path, '/away');
  assert.deepEqual(workbenchPanelState.value, {
    dirty: false,
    saving: false
  });
  const afterLeave = new Event('beforeunload', {
    cancelable: true
  });
  window.dispatchEvent(afterLeave);
  assert.equal(afterLeave.defaultPrevented, false);
});

test('保存和归档期间阻止路由跳转和浏览器关闭', async () => {
  const { saving, busy, router, guard } = await mountWorkbench();
  for (const flag of [saving, busy]) {
    flag.value = true;
    assert.equal(workbenchPanelState.value.saving, true);
    assert.equal(isNavigationFailure(await router.push('/away')), true);
    assert.equal(guard.leaveOpen.value, false);
    const event = new Event('beforeunload', {
      cancelable: true
    });
    window.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    flag.value = false;
  }
});

test('切换或删除处理中保持当前上下文', async () => {
  const { blocked, router, guard } = await mountWorkbench();
  blocked.value = true;
  assert.equal(isNavigationFailure(await router.push('/away')), true);
  assert.equal(guard.leaveOpen.value, false);
  blocked.value = false;
  await router.push('/away');
  assert.equal(router.currentRoute.value.path, '/away');
});

test('工作台销毁时结束尚未处理的离开确认', async () => {
  const { dirty, guard } = await mountWorkbench();
  dirty.value = true;
  const confirmation = guard.confirmLeave();
  app.unmount();
  app = null;
  assert.equal(await confirmation, false);
  assert.equal(guard.leaveOpen.value, false);
  assert.deepEqual(workbenchPanelState.value, {
    dirty: false,
    saving: false
  });
});
