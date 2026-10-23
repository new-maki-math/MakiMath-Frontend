<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Terminal, Compass, Book, Sparks } from '@iconoir/vue';
import StartBackground from './StartBackground.vue';
import SearchBar from '../../components/SearchBar.vue';

const router = useRouter();

// 头部胶囊文字解码动效
const TARGET_PILL_TEXT = 'MAKIMATH // ADVANCED MATHEMATICAL WORKSTATION';
const displayPillText = ref('');

const runDecodeAnimation = () => {
  const chars = '01#_*/Σ∂∫λΔΩπ∇+-=<>[]';
  const target = TARGET_PILL_TEXT;
  const length = target.length;
  let iteration = 0;
  const totalFrames = 42;

  const interval = setInterval(() => {
    displayPillText.value = target
      .split('')
      .map((letter, index) => {
        if (letter === ' ' || letter === '/') return letter;
        if (index < (iteration / totalFrames) * length) {
          return target[index];
        }
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');

    iteration++;
    if (iteration > totalFrames) {
      clearInterval(interval);
      displayPillText.value = target;
    }
  }, 36);
};

// 快捷导航项
const quickShortcuts = [
  { label: '考研数学精讲', path: '/course/1', icon: Book },
  { label: '讲义工作台', path: '/workbench', icon: Terminal },
  { label: '讲义推荐路线', path: '/recom-lecture', icon: Compass },
  { label: '如何使用平台', path: '/how-to-use', icon: Sparks }
];

// 点击快捷导航卡片跳转
const handleShortcutClick = (targetPath) => {
  router.push(targetPath);
};

onMounted(() => {
  runDecodeAnimation();
});
</script>

<template>
  <div class="start-viewport">
    <!-- 动态拓扑背景独立组件 -->
    <StartBackground />

    <div class="start-main-container">
      <!-- 极客头部标识与副标题 -->
      <header class="start-header">
        <div class="brand-pill font-mono">
          <Terminal width="13" height="13" class="pill-icon" />
          <span>{{ displayPillText || TARGET_PILL_TEXT }}</span>
        </div>
        <h1 class="start-title">
          结构化数学讲义与知识拓扑平台
        </h1>
        <p class="start-desc">
          毫秒级 Typst 公式排版 · 前置定理依赖图谱 · 沉浸式 IDE 极客视界
        </p>
      </header>

      <!-- 中央超级检索舱（Hero 模式） -->
      <div class="hero-search-wrapper">
        <SearchBar variant="hero" />
      </div>

      <!-- 快捷胶囊入口 -->
      <div class="shortcuts-row">
        <span class="shortcuts-label font-mono">FAST TRACK //</span>
        <button
          v-for="sc in quickShortcuts"
          :key="sc.path"
          type="button"
          class="shortcut-btn"
          @click="handleShortcutClick(sc.path)"
        >
          <component :is="sc.icon" width="14" height="14" class="sc-icon" />
          <span>{{ sc.label }}</span>
        </button>
      </div>
    </div>

    <!-- 底部悬挂备案信息 -->
    <footer class="start-beian-footer font-mono">
      <span class="beian-item copyright">© 2026 MakiMath</span>
      <span class="beian-sep">/</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        class="beian-link"
      >
        沪ICP备2022010774号
      </a>
    </footer>
  </div>
</template>

<style scoped>
/* 欢迎页视口布局 */
.start-viewport {
  width: 100%;
  height: 100%;
  min-height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  background-color: var(--bg-app);
  user-select: none;
  padding-top: clamp(80px, 17vh, 150px);
}

/* 主容器 */
.start-main-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 720px;
  padding: 0 24px;
}

/* 顶部标题栏 */
.start-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.brand-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 1px;
  position: relative;
  overflow: hidden;
}

.brand-pill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.08),
    transparent
  );
  transform: skewX(-20deg);
  animation: pillShimmer 6s infinite;
}

@keyframes pillShimmer {
  from {
    left: -100%;
  }
  to {
    left: 200%;
  }
}

.pill-icon {
  color: var(--accent-primary);
}

.start-title {
  font-size: 26px;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.start-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  max-width: 520px;
  line-height: 1.6;
}

/* 检索舱容器 */
.hero-search-wrapper {
  position: relative;
  width: 100%;
  max-width: 640px;
}

/* 快捷胶囊入口 */
.shortcuts-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 4px;
}

.shortcuts-label {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.shortcut-btn:hover {
  background-color: var(--bg-elevated);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.sc-icon {
  color: var(--accent-primary);
}

/* 备案信息页脚 */
.start-beian-footer {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
  z-index: 10;
  pointer-events: auto;
}

.beian-item {
  color: var(--text-muted);
}

.beian-sep {
  color: var(--border-subtle);
}

.beian-link {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 140ms ease;
}

.beian-link:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}
</style>
