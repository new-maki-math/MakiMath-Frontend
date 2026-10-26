<script setup>
import { provide, onMounted } from 'vue';
import ProgressBar from '../components/ProgressBar.vue';
import MNotice from '../components/MNotice.vue';
import MUserModal from '../components/MUserModal.vue';
import LayoutDesktop from './LayoutDesktop.vue';
import LayoutMobile from './LayoutMobile.vue';
import { useLayoutState } from './useLayoutState.js';
import { registerProgressBar } from '../utils';

// 初始化全局统一布局业务状态
const layoutState = useLayoutState();

const {
  isMobile,
  progressBarRef,
  isUserModalOpen,
  currentUser,
  closeUserModal
} = layoutState;

// 深度向下 provide 布局状态，供 LayoutDesktop 与 LayoutMobile 复用
provide('layoutState', layoutState);

onMounted(() => {
  if (progressBarRef.value) {
    registerProgressBar(progressBarRef.value);
  }
});
</script>

<template>
  <div class="maki-base-layout-root">
    <!-- 全局进度条 (两端共享，切端不重新实例化) -->
    <ProgressBar ref="progressBarRef" />

    <!-- 全局轻量浮动通知组件 -->
    <MNotice />

    <!-- 全局用户详情与安全设置弹窗 -->
    <MUserModal
      :open="isUserModalOpen"
      :user="currentUser"
      @close="closeUserModal"
    />

    <!-- 根据当前视口设备渲染对应布局组件 -->
    <LayoutMobile v-if="isMobile">
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </LayoutMobile>
    <LayoutDesktop v-else>
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </LayoutDesktop>
  </div>
</template>

<style scoped>
.maki-base-layout-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-app);
}
</style>
