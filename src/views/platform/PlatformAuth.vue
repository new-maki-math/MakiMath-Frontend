<script setup>
// 平台管理超级管理员登录组件
import { ref } from 'vue';

import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import { notify } from '../../components/MNotice.vue';
import { authenticate } from '../../utils/auth.js';

// 声明登录成功事件
const emit = defineEmits(['success']);

const isSubmitting = ref(false);

// 登录表单数据模型
const form = ref({
  username: '',
  password: ''
});

// 执行超管登录验证
const handleLogin = async () => {
  if (!form.value.username.trim() || !form.value.password) {
    notify('用户名和密码不能为空', 'error');
    return;
  }
  isSubmitting.value = true;
  try {
    const user = await authenticate(
      '/api/auth/login',
      {
        username: form.value.username.trim(),
        password: form.value.password
      },
      'super_admin'
    );
    notify('超级管理员认证成功', 'success');
    emit('success', user);
  } catch (err) {
    notify(err.message || '登录失败，请检查账号密码', 'error');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="auth-wrap font-mono">
    <div class="auth-card">
      <div class="auth-card-inner">
        <header class="auth-head">
          <h2 class="auth-title">PLATFORM ADMIN</h2>
          <p class="auth-desc">请验证超级管理员凭据以进入系统管理控制台</p>
        </header>

        <form
          class="auth-form"
          @submit.prevent="handleLogin"
        >
          <MInput
            v-model="form.username"
            label="管理员账号"
            placeholder="请输入超级管理员用户名"
            :disabled="isSubmitting"
          />
          <MInput
            v-model="form.password"
            label="登录密码"
            type="password"
            placeholder="请输入管理员密码"
            :disabled="isSubmitting"
          />
          <div class="auth-action">
            <MButton
              variant="primary"
              type="submit"
              :block="true"
              :mono="true"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? '验证中...' : '进入控制台' }}
            </MButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap {
  width: 100%;
  height: calc(100vh - var(--topbar-height, 54px));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.auth-card-inner {
  padding: 36px 32px;
}

.auth-head {
  margin-bottom: 28px;
  text-align: center;
}

.auth-title {
  font-size: 20px;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.auth-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  line-height: 1.5;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.auth-action {
  margin-top: 6px;
}
</style>
