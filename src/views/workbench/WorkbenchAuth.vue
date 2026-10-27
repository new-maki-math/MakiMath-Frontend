<script setup>
// 讲义工作台登录与邀请注册组件
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { authenticate } from '../../utils/auth.js';
import { request } from '../../api/client.js';
import { notify } from '../../components/MNotice.vue';
import MInput from '../../components/MInput.vue';
import MButton from '../../components/MButton.vue';
import MTabs from '../../components/MTabs.vue';

// 声明认证成功回调事件
const emit = defineEmits(['success']);

// 认证模式切换状态
const mode = ref('login');
const isSubmitting = ref(false);

// 卡片内容引用节点
const contentRef = ref(null);

// 卡片自适应高度变量
const cardHeight = ref('');

// 刷新卡片高度数值
const updateHeight = () => {
  if (contentRef.value) {
    cardHeight.value = `${contentRef.value.offsetHeight}px`;
  }
};

// 监听模式变更联动高度
watch(mode, async () => {
  await nextTick();
  updateHeight();
});

// 尺寸观察器引用
let resizeObserver = null;

// 挂载时初始化高度与尺寸监听
onMounted(async () => {
  await nextTick();
  updateHeight();
  if (contentRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(contentRef.value);
  }
});

// 卸载时注销观察器
onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

// 登录表单数据模型
const loginForm = ref({
  username: '',
  password: ''
});

// 邀请注册表单数据模型
const registerForm = ref({
  inviteCode: '',
  username: '',
  displayName: '',
  password: '',
  confirmPassword: ''
});

// 执行登录操作
const handleLogin = async () => {
  if (isSubmitting.value) return;
  if (!loginForm.value.username.trim() || !loginForm.value.password) {
    notify('用户名和密码不能为空', 'error');
    return;
  }
  isSubmitting.value = true;
  try {
    const user = await authenticate('/api/auth/login', {
      username: loginForm.value.username.trim(),
      password: loginForm.value.password
    });
    notify('登录成功', 'success');
    emit('success', user);
  } catch (err) {
    notify(err.message || '登录失败，请检查账号密码', 'error');
  } finally {
    isSubmitting.value = false;
  }
};

// 执行邀请码注册操作
const handleRegister = async () => {
  if (isSubmitting.value) return;
  if (!registerForm.value.inviteCode.trim()) {
    notify('请输入邀请码', 'error');
    return;
  }
  if (registerForm.value.username.trim().length < 3) {
    notify('用户名至少需要三个字符', 'error');
    return;
  }
  if (registerForm.value.password.length < 8 || new TextEncoder().encode(registerForm.value.password).length > 72) {
    notify('密码至少需要八位字符且不能超过七十二字节', 'error');
    return;
  }
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    notify('两次输入的密码不一致', 'error');
    return;
  }
  isSubmitting.value = true;
  try {
    await request('/api/auth/register', { method: 'POST', body: {
      invite_code: registerForm.value.inviteCode.trim(),
      username: registerForm.value.username.trim(),
      display_name: registerForm.value.displayName.trim(),
      password: registerForm.value.password
    } });
    loginForm.value.username = registerForm.value.username.trim();
    mode.value = 'login';
    notify('注册成功，请登录', 'success');
  } catch (err) {
    notify(err.message || '注册失败，请检查邀请码或输入信息', 'error');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card" :style="{ height: cardHeight }">
      <div ref="contentRef" class="auth-card-inner">
        <div class="auth-head">
          <h2 class="auth-title">讲义工作台</h2>
          <p class="auth-desc">请登录以进入数学讲义编撰与排版系统</p>
        </div>

        <MTabs
          v-model="mode"
          :tabs="[
            { label: '账号登录', value: 'login' },
            { label: '邀请码注册', value: 'register' }
          ]"
        />

        <transition name="auth-fade" mode="out-in">
          <form v-if="mode === 'login'" key="login" class="auth-form" @submit.prevent="handleLogin">
            <MInput
              v-model="loginForm.username"
              label="用户名"
              placeholder="请输入用户名"
              :disabled="isSubmitting"
            />
            <MInput
              v-model="loginForm.password"
              label="密码"
              type="password"
              placeholder="请输入密码"
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
                {{ isSubmitting ? '登录中...' : '立即登录' }}
              </MButton>
            </div>
          </form>

          <form v-else key="register" class="auth-form" @submit.prevent="handleRegister">
            <MInput
              v-model="registerForm.inviteCode"
              label="邀请码"
              placeholder="请输入专属邀请码"
              :disabled="isSubmitting"
            />
            <MInput
              v-model="registerForm.username"
              label="设置用户名"
              placeholder="至少三个字符"
              :disabled="isSubmitting"
            />
            <MInput
              v-model="registerForm.displayName"
              label="显示昵称"
              placeholder="例如 高数助教"
              :disabled="isSubmitting"
            />
            <MInput
              v-model="registerForm.password"
              label="设置密码"
              type="password"
              placeholder="至少六位密码"
              :disabled="isSubmitting"
            />
            <MInput
              v-model="registerForm.confirmPassword"
              label="确认密码"
              type="password"
              placeholder="请再次输入密码"
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
                {{ isSubmitting ? '注册中...' : '验证并注册' }}
              </MButton>
            </div>
          </form>
        </transition>
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
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  transition: height 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.auth-card-inner {
  padding: 32px 28px;
}

.auth-head {
  margin-bottom: 24px;
  text-align: center;
}

.auth-title {
  font-size: 20px;
  font-weight: var(--font-weight-bold, 600);
  color: var(--text-primary);
  margin-bottom: 6px;
}

.auth-desc {
  font-size: var(--font-size-smaller, 13px);
  color: var(--text-secondary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-action {
  margin-top: 8px;
}

.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.auth-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.auth-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
