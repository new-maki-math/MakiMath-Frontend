<script setup>
import { provide, onMounted, ref } from 'vue';
import ProgressBar from '../components/ProgressBar.vue';
import MNotice from '../components/MNotice.vue';
import MUserModal from '../components/MUserModal.vue';
import MModal from '../components/MModal.vue';
import MInput from '../components/MInput.vue';
import MButton from '../components/MButton.vue';
import MTag from '../components/MTag.vue';
import { authStatus, authenticate } from '../utils/auth.js';
import { notify } from '../components/MNotice.vue';
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
  isHelpModalOpen,
  currentUser,
  closeUserModal,
  closeHelpModal
} = layoutState;

const reauthPassword = ref('');
const reauthBusy = ref(false);
const reauthenticate = async () => {
  if (reauthBusy.value || !reauthPassword.value) return;
  reauthBusy.value = true;
  try {
    await authenticate('/api/auth/login', {
      username: currentUser.value.username,
      password: reauthPassword.value
    });
    reauthPassword.value = '';
    notify('登录已恢复，请继续编辑', 'success');
  } catch (err) {
    notify(err.message || '重新登录失败', 'error');
  } finally {
    reauthBusy.value = false;
  }
};

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

    <MModal
      :open="isHelpModalOpen"
      title="如何使用"
      hide-footer
      @close="closeHelpModal"
    >
      <div class="help-content font-mono">
        <MTag variant="blue" size="sm">DOCS // 手册</MTag>
        <h2 class="help-title">COMING SOON</h2>
        <p class="help-desc">使用手册正在编撰完善中，敬请期待</p>
        <MButton variant="secondary" size="sm" @click="closeHelpModal">关闭</MButton>
      </div>
    </MModal>

    <MModal
      :open="authStatus === 'expired'"
      title="登录已过期"
      desc="请使用当前账号重新登录，正在编辑的内容会保留"
      hide-footer
    >
      <form @submit.prevent="reauthenticate">
        <MInput :model-value="currentUser?.username || ''" label="账号" disabled />
        <MInput v-model="reauthPassword" label="密码" type="password" :disabled="reauthBusy" />
        <MButton type="submit" variant="primary" :disabled="reauthBusy || !reauthPassword">重新登录</MButton>
      </form>
    </MModal>

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

.help-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 24px 0 8px;
  text-align: center;
}

.help-title {
  color: var(--text-primary);
  font-size: var(--font-size-largest);
  letter-spacing: 2px;
}

.help-desc {
  color: var(--text-muted);
  font-size: var(--font-size);
}
</style>
