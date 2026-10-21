<script setup>
import { ref, watch } from 'vue';
import {
  NavArrowRight,
  NavArrowLeft
} from '@iconoir/vue';

const props = defineProps({
  chapters: {
    type: Array,
    default: () => []
  },
  currentSectionId: {
    type: String,
    default: ''
  },
  collapsed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select-section', 'toggle-collapse']);

// 默认展开所有大编/大章
const expandedChapters = ref(new Set(props.chapters.map(c => c.id)));

watch(
  () => props.chapters,
  (newChaps) => {
    if (newChaps && newChaps.length > 0) {
      newChaps.forEach(c => expandedChapters.value.add(c.id));
    }
  },
  { immediate: true }
);

const toggleChapter = (chapterId) => {
  if (expandedChapters.value.has(chapterId)) {
    expandedChapters.value.delete(chapterId);
  } else {
    expandedChapters.value.add(chapterId);
  }
};

const handleSelect = (section) => {
  emit('select-section', section);
};
</script>

<template>
  <aside
    class="chapter-nav-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    aria-label="课程章节目录导航"
  >
    <div class="chapter-nav-inner">
      <!-- 目录头部与收起触发按钮 -->
      <div class="nav-header">
        <div class="nav-header-title font-mono">
          <span>CHAPTERS // 目录</span>
        </div>
        <button
          class="nav-toggle-btn"
          title="收起章节目录"
          @click="emit('toggle-collapse')"
        >
          <NavArrowLeft width="14" height="14" />
        </button>
      </div>

      <!-- 章节列表 -->
      <div class="chapter-tree">
        <div
          v-for="chap in chapters"
          :key="chap.id"
          class="chapter-group"
        >
          <!-- 大章行（点击折叠/展开） -->
          <div
            class="chapter-row"
            :class="{ 'is-open': expandedChapters.has(chap.id) }"
            :title="chap.prereqText ? `${chap.tag || ''} ${chap.title} · ${chap.prereqText}` : chap.title"
            @click="toggleChapter(chap.id)"
          >
            <div class="chevron-wrap">
              <NavArrowRight
                width="11"
                height="11"
                class="chapter-chevron"
                :class="{ 'is-open': expandedChapters.has(chap.id) }"
              />
            </div>
            <MTag v-if="chap.tag" variant="cyan" size="sm">{{ chap.tag }}</MTag>
            <span class="chapter-title">{{ chap.title }}</span>
          </div>

          <!-- 子节列表 -->
          <MCollapse :open="expandedChapters.has(chap.id)">
            <div class="section-list">
              <div
                v-for="sec in chap.sections"
                :key="sec.id"
                class="section-row"
                :class="{ active: currentSectionId === sec.id }"
                @click="handleSelect(sec)"
              >
                <span class="section-title" :title="sec.desc || sec.title">{{ sec.title }}</span>
              </div>
            </div>
          </MCollapse>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.chapter-nav-sidebar {
  width: 100%;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}

.chapter-nav-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.nav-header {
  height: 44px;
  padding: 0 14px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.nav-header-title {
  font-size: var(--font-size-smallest);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.8px;
  color: var(--text-muted);
}

.nav-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.nav-toggle-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.chapter-tree {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chapter-group {
  display: flex;
  flex-direction: column;
}

.chapter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
  transition: background-color 120ms ease, color 120ms ease;
}

.chapter-row:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.chevron-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: var(--text-muted);
}

.chapter-chevron {
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
}

.chapter-chevron.is-open {
  transform: rotate(90deg);
}

.chapter-title {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-list {
  display: flex;
  flex-direction: column;
  margin-left: 14px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  gap: 2px;
  margin-top: 2px;
  margin-bottom: 4px;
}

.section-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms ease, color 120ms ease;
}

.section-row:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.section-row.active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.section-row.active .section-title {
  color: var(--accent-primary);
}

.section-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
