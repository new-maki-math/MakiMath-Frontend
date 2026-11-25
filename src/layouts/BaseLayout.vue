<script setup>
import { computed, provide, ref, watch } from 'vue';

import MAuthForm from '../components/account/MAuthForm.vue';
import MUserModal from '../components/account/MUserModal.vue';
import MHelpModal from '../components/app/MHelpModal.vue';
import MNotice, { notify } from '../components/feedback/MNotice.vue';
import ProgressBar from '../components/feedback/ProgressBar.vue';
import MButton from '../components/form/MButton.vue';
import MInput from '../components/form/MInput.vue';
import KnowledgeSearchOverlay from '../components/knowledge/KnowledgeSearchOverlay.vue';
import MModal from '../components/overlay/MModal.vue';
import { t } from '../i18n.js';
import { authenticate, authStatus } from '../utils/auth.js';
import LayoutDesktop from './LayoutDesktop.vue';
import LayoutMobile from './LayoutMobile.vue';
import { useLayoutState } from './useLayoutState.js';

// 初始化全局统一布局业务状态
const layoutState = useLayoutState();

const {
  isMobile,
  currentTheme,
  isSeasonalTheme,
  progressBarRef,
  isUserModalOpen,
  userModalMode,
  isHelpModalOpen,
  currentUser,
  closeUserModal,
  closeHelpModal
} = layoutState;

const bannerTransitionMs = 260;
const hasLayoutBanner = computed(() => isSeasonalTheme.value && !isMobile.value);
const isBannerCollapsed = ref(true);
let bannerCollapseEndsAt = 0;
let bannerTouchStart;
let isBannerSwipe = false;

watch([currentTheme, isMobile], () => {
  isBannerCollapsed.value = true;
  bannerCollapseEndsAt = 0;
  bannerTouchStart = undefined;
  isBannerSwipe = false;
});

function getBannerViewport(target) {
  if (!hasLayoutBanner.value || !(target instanceof Element)) {
    return;
  }
  const viewport = target.closest('[data-layout-viewport]');
  if (!viewport || target.closest('[role="dialog"], .monaco-editor, textarea, select')) {
    return;
  }
  return viewport;
}

function collapseBanner() {
  isBannerCollapsed.value = true;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bannerCollapseEndsAt = performance.now() + bannerTransitionMs;
  }
}

function handleBannerClick(event) {
  if (!hasLayoutBanner.value || !event.target.matches('.layout-banner-toggle')) {
    return;
  }
  if (isBannerCollapsed.value) {
    isBannerCollapsed.value = false;
    bannerCollapseEndsAt = 0;
  } else {
    collapseBanner();
  }
}

function handleBannerWheel(event) {
  if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
    return;
  }
  if (!getBannerViewport(event.target)) {
    return;
  }
  if (!isBannerCollapsed.value && event.deltaY > 0) {
    event.preventDefault();
    collapseBanner();
  } else if (performance.now() < bannerCollapseEndsAt) {
    event.preventDefault();
  }
}

function startBannerTouch(event) {
  isBannerSwipe = false;
  bannerTouchStart =
    event.touches.length === 1 && getBannerViewport(event.target) ? event.touches[0] : undefined;
}

function moveBannerTouch(event) {
  if (!bannerTouchStart || event.touches.length !== 1) {
    bannerTouchStart = undefined;
    return;
  }
  const touch = event.touches[0];
  const deltaY = bannerTouchStart.clientY - touch.clientY;
  const deltaX = bannerTouchStart.clientX - touch.clientX;
  if (isBannerSwipe || (deltaY > 0 && performance.now() < bannerCollapseEndsAt)) {
    isBannerSwipe = true;
    event.preventDefault();
    return;
  }
  if (Math.abs(deltaY) <= Math.abs(deltaX)) {
    return;
  }
  if (!isBannerCollapsed.value && deltaY > 0) {
    event.preventDefault();
    if (deltaY >= 18) {
      collapseBanner();
      isBannerSwipe = true;
    }
  }
}

const reauthPassword = ref('');
const reauthBusy = ref(false);
const reauthenticate = async () => {
  if (reauthBusy.value || !reauthPassword.value) {
    return;
  }
  reauthBusy.value = true;
  try {
    await authenticate('/api/auth/login', {
      username: currentUser.value.username,
      password: reauthPassword.value
    });
    reauthPassword.value = '';
    notify(t('登录已恢复，请继续编辑'), 'success');
  } catch (err) {
    notify(err.message || t('重新登录失败'), 'error');
  } finally {
    reauthBusy.value = false;
  }
};

// 向桌面和移动布局提供共享状态
provide('layoutState', layoutState);
const knowledgeSearchOverlay = ref(null);
provide('openKnowledgeSearch', (node, focusTarget) =>
  knowledgeSearchOverlay.value?.openPoint(node, focusTarget)
);
</script>

<template>
  <div
    class="maki-base-layout-root"
    :class="{
      'has-layout-banner': hasLayoutBanner,
      'is-banner-collapsed': hasLayoutBanner && isBannerCollapsed
    }"
  >
    <!-- 全局进度条 (两端共享，切端不重新实例化) -->
    <ProgressBar ref="progressBarRef" />

    <!-- 全局轻量浮动通知组件 -->
    <MNotice />

    <!-- 全局用户详情与安全设置弹窗 -->
    <MUserModal
      :open="isUserModalOpen && userModalMode === 'profile'"
      :user="currentUser"
      @close="closeUserModal"
    />

    <MModal
      :open="isUserModalOpen && userModalMode === 'login'"
      :title="t('登录或注册')"
      hide-footer
      show-close
      @close="closeUserModal"
    >
      <MAuthForm
        v-if="isUserModalOpen && userModalMode === 'login'"
        @success="closeUserModal"
      />
    </MModal>

    <MHelpModal
      :open="isHelpModalOpen"
      @close="closeHelpModal"
    />

    <MModal
      :open="authStatus === 'expired'"
      :title="t('登录已过期')"
      :desc="t('请使用当前账号重新登录，正在编辑的内容会保留')"
      hide-footer
    >
      <form
        class="reauth-form"
        @submit.prevent="reauthenticate"
      >
        <div class="reauth-fields">
          <MInput
            :model-value="currentUser?.username || ''"
            :label="t('账号')"
            disabled
          />
          <MInput
            v-model="reauthPassword"
            :label="t('密码')"
            type="password"
            :disabled="reauthBusy"
          />
        </div>
        <div class="reauth-actions">
          <MButton
            type="submit"
            variant="primary"
            :disabled="reauthBusy || !reauthPassword"
            >{{ t(reauthBusy ? '正在登录…' : '重新登录') }}</MButton
          >
        </div>
      </form>
    </MModal>

    <KnowledgeSearchOverlay ref="knowledgeSearchOverlay" />

    <!-- 根据当前视口设备渲染对应布局组件 -->
    <LayoutMobile v-if="isMobile">
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </LayoutMobile>
    <LayoutDesktop
      v-else
      @click="handleBannerClick"
      @wheel="handleBannerWheel"
      @touchstart.passive="startBannerTouch"
      @touchmove="moveBannerTouch"
    >
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </LayoutDesktop>
  </div>
</template>

<style scoped>
.maki-base-layout-root {
  --layout-current-topbar-height: var(--layout-banner-height, var(--topbar-height));
  --layout-banner-transition: v-bind('`${bannerTransitionMs}ms`') var(--ease-layout);
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  isolation: isolate;
  background-color: var(--layout-canvas-bg);
}

.maki-base-layout-root.has-layout-banner {
  background-image: var(--layout-canvas-gradient, none);
}

.maki-base-layout-root.has-layout-banner::before {
  --layout-artwork-expanded-height: calc(
    var(--layout-banner-height, var(--topbar-height)) + var(--layout-artwork-fade, 0px)
  );
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: calc(var(--layout-current-topbar-height) + var(--layout-artwork-fade, 0px));
  z-index: -1;
  pointer-events: none;
  background-image: var(--layout-canvas-image, none);
  background-position: center
    calc((var(--layout-artwork-expanded-height) - 100vw / 3) * var(--layout-artwork-align, 0.68));
  background-size: 100% auto;
  background-repeat: no-repeat;
  mask-image: linear-gradient(#000 calc(100% - var(--layout-artwork-fade, 0px)), transparent);
  transition: height var(--layout-banner-transition);
}

.maki-base-layout-root.is-banner-collapsed {
  --layout-current-topbar-height: var(--topbar-height);
}

.maki-base-layout-root :deep(.layout-banner-toggle) {
  display: none;
  position: absolute;
  inset: 0;
  z-index: -1;
  cursor: zoom-out;
}

.maki-base-layout-root.has-layout-banner :deep(.layout-banner-toggle) {
  display: block;
}

.maki-base-layout-root.is-banner-collapsed :deep(.layout-banner-toggle) {
  cursor: zoom-in;
}

.maki-base-layout-root :deep(.layout-banner-toggle:focus-visible) {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}

.maki-base-layout-root.has-layout-banner :deep(.topbar-right :is(.user-name, button)) {
  color: var(--layout-brand-text);
  text-shadow: var(--layout-brand-shadow);
}

.maki-base-layout-root.has-layout-banner :deep(.topbar-right button svg) {
  filter: var(--layout-brand-icon-filter);
}

.maki-base-layout-root.has-layout-banner
  :deep(.topbar-right button:is(:hover:not(:disabled), .active, [aria-expanded='true'])) {
  background-color: rgb(43 24 12 / 40%);
}

@media (max-width: 767px) {
  .maki-base-layout-root {
    height: 100dvh;
    background-color: var(--bg-app);
  }
}

@media (prefers-reduced-motion: reduce) {
  .maki-base-layout-root.has-layout-banner::before {
    transition: none;
  }
}

.reauth-form,
.reauth-fields {
  min-width: 0;
}

.reauth-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reauth-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}

@media (max-width: 480px) {
  .reauth-actions > * {
    width: 100%;
  }
}
</style>
