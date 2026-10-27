<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Terminal, Compass, Bookmark } from '@iconoir/vue';
import StartBackground from './StartBackground.vue';
import SearchBar from '../../components/SearchBar.vue';

const router = useRouter();

// 头部胶囊文字解码动效
const getTargetPillText = () => {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return 'MAKIMATH // MATH WORKSTATION';
  }
  return 'MAKIMATH // ADVANCED MATHEMATICAL WORKSTATION';
};

const TARGET_PILL_TEXT = ref(getTargetPillText());
const displayPillText = ref('');
let decodeInterval = null;

const runDecodeAnimation = () => {
  if (decodeInterval) clearInterval(decodeInterval);
  const chars = '01#_*/Σ∂∫λΔΩπ∇+-=<>[]';
  const target = TARGET_PILL_TEXT.value;
  const length = target.length;
  let iteration = 0;
  const totalFrames = 42;

  decodeInterval = setInterval(() => {
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
      clearInterval(decodeInterval);
      displayPillText.value = target;
    }
  }, 36);
};

const handleWindowResize = () => {
  const newTarget = getTargetPillText();
  if (newTarget !== TARGET_PILL_TEXT.value) {
    TARGET_PILL_TEXT.value = newTarget;
    displayPillText.value = newTarget;
  }
};

// 快捷导航项
const quickShortcuts = [
  { label: '讲义推荐路线', path: '/recom-lecture', icon: Compass },
  { label: '我的讲义', path: '/my-lecture', icon: Bookmark },
  { label: '讲义工作台', path: '/lecture-workbench', icon: Terminal }
];

// 点击快捷导航卡片跳转
const handleShortcutClick = (targetPath) => {
  router.push(targetPath);
};

onMounted(() => {
  TARGET_PILL_TEXT.value = getTargetPillText();
  runDecodeAnimation();
  window.addEventListener('resize', handleWindowResize, { passive: true });
});

onUnmounted(() => {
  if (decodeInterval) clearInterval(decodeInterval);
  window.removeEventListener('resize', handleWindowResize);
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
          Typst 实时排版 · 知识依赖可视化 · 流畅细腻的交互体验
        </p>
      </header>

      <!-- 中央超级检索舱（Hero 模式） -->
      <div class="hero-search-wrapper">
        <SearchBar variant="hero" />
      </div>

      <!-- 快捷胶囊入口 -->
      <div class="shortcuts-row">
        <span class="shortcuts-label font-mono">FAST TRACK //</span>
        <div class="shortcuts-grid">
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
/* 欢迎页视口布局：必须为 column 纵向排列 */
.start-viewport {
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  background-color: var(--bg-app);
  user-select: none;
  padding-top: clamp(80px, 17vh, 150px);
  overflow-x: hidden;
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
  margin: 0 auto;
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
  text-align: center;
}

.start-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  max-width: 520px;
  line-height: 1.6;
  text-align: center;
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

.shortcuts-grid {
  display: contents;
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

/* 移动端专属响应式断点 (<768px) */
@media (max-width: 768px) {
  .start-viewport {
    height: 100%;
    min-height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-top: clamp(48px, 9vh, 96px);
    padding-bottom: 72px; /* 留出底部备案信息的常驻安全边距，杜绝遮挡 */
    align-items: center;
    justify-content: flex-start;
    position: relative;
    box-sizing: border-box;
  }

  .start-main-container {
    padding: 0 20px;
    gap: clamp(28px, 4.5vh, 42px); /* 增大模块间上下呼吸间距 */
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
  }

  .start-header {
    gap: 16px; /* 增大胶囊、大标题与副标题之间上下间距 */
    width: 100%;
  }

  .brand-pill {
    max-width: calc(100vw - 36px);
    padding: 5px 14px;
    font-size: 11px;
    letter-spacing: 0.8px;
    margin-bottom: 2px;
  }

  .start-title {
    font-size: clamp(22px, 6vw, 26px);
    line-height: 1.4;
    letter-spacing: -0.2px;
  }

  .start-desc {
    font-size: 13.5px;
    line-height: 1.65;
    padding: 0 4px;
    max-width: 360px;
    margin: 0 auto;
  }

  .hero-search-wrapper {
    max-width: 100%;
    width: 100%;
  }

  .shortcuts-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px; /* 增大快捷指引与按钮组间距 */
    width: 100%;
    margin-top: 6px;
  }

  .shortcuts-label {
    text-align: center;
    letter-spacing: 1px;
    font-size: 11px;
    margin-bottom: 2px;
  }

  .shortcuts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }

  .shortcut-btn {
    height: 46px;
    padding: 0 12px;
    justify-content: center;
    font-size: 13.5px;
    border-radius: var(--radius-sm);
    gap: 8px;
  }

  .shortcut-btn:last-child:nth-child(odd) {
    grid-column: span 2;
  }

  /* 备案信息在移动端依然固定贴底居中 */
  .start-beian-footer {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0 16px;
    gap: 8px;
    font-size: 11.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
    z-index: 15;
    pointer-events: auto;
  }
}
</style>
