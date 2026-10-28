<script setup>
import { provide, onMounted, ref } from 'vue';
import ProgressBar from '../components/ProgressBar.vue';
import MNotice from '../components/MNotice.vue';
import MUserModal from '../components/MUserModal.vue';
import MHelpModal from '../components/MHelpModal.vue';
import KnowledgeSearchOverlay from '../components/KnowledgeSearchOverlay.vue';
import MAuthForm from '../components/MAuthForm.vue';
import MModal from '../components/MModal.vue';
import MInput from '../components/MInput.vue';
import MButton from '../components/MButton.vue';
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
  userModalMode,
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
const knowledgeSearchOverlay = ref(null);
provide('openKnowledgeSearch', (node, focusTarget) => knowledgeSearchOverlay.value?.openPoint(node, focusTarget));

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
      :open="isUserModalOpen && userModalMode === 'profile'"
      :user="currentUser"
      @close="closeUserModal"
    />

    <MModal :open="isUserModalOpen && userModalMode === 'login'" title="登录或注册" hide-footer show-close @close="closeUserModal">
      <MAuthForm v-if="isUserModalOpen && userModalMode === 'login'" @success="closeUserModal" />
    </MModal>

    <MHelpModal
      :open="isHelpModalOpen"
      @close="closeHelpModal"
    />

    <MModal
      :open="authStatus === 'expired'"
      title="登录已过期"
      desc="请使用当前账号重新登录，正在编辑的内容会保留"
      hide-footer
    >
      <form class="reauth-form" @submit.prevent="reauthenticate">
        <div class="reauth-fields">
          <MInput :model-value="currentUser?.username || ''" label="账号" disabled />
          <MInput v-model="reauthPassword" label="密码" type="password" :disabled="reauthBusy" />
        </div>
        <div class="reauth-actions">
          <MButton type="submit" variant="primary" :disabled="reauthBusy || !reauthPassword">{{ reauthBusy ? '正在登录…' : '重新登录' }}</MButton>
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

.reauth-form, .reauth-fields {
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
