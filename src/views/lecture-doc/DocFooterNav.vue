<script setup>
import { NavArrowLeft, NavArrowRight } from '@iconoir/vue';

defineProps({
  prevSection: {
    type: Object,
    default: null
  },
  nextSection: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['select-section']);

const handleNavigate = (section) => {
  if (section) {
    emit('select-section', section);
  }
};
</script>

<template>
  <footer class="doc-footer-nav" aria-label="讲义章节切换导航">
    <!-- 上一讲卡片 -->
    <button
      v-if="prevSection"
      type="button"
      class="nav-card prev-card"
      @click="handleNavigate(prevSection)"
    >
      <div class="card-direction font-mono">
        <NavArrowLeft width="14" height="14" class="arrow-icon prev-arrow" />
        <span>PREV // 上一讲</span>
      </div>
      <div class="card-content">
        <MTag v-if="prevSection.chapterTag" variant="cyan" size="sm" class="chapter-tag">
          {{ prevSection.chapterTag }}
        </MTag>
        <span class="section-title" :title="prevSection.title">
          {{ prevSection.title }}
        </span>
      </div>
    </button>
    <div v-else class="nav-placeholder" aria-hidden="true" />

    <!-- 下一讲卡片 -->
    <button
      v-if="nextSection"
      type="button"
      class="nav-card next-card"
      @click="handleNavigate(nextSection)"
    >
      <div class="card-direction font-mono">
        <span>下一讲 // NEXT</span>
        <NavArrowRight width="14" height="14" class="arrow-icon next-arrow" />
      </div>
      <div class="card-content">
        <span class="section-title" :title="nextSection.title">
          {{ nextSection.title }}
        </span>
        <MTag v-if="nextSection.chapterTag" variant="cyan" size="sm" class="chapter-tag">
          {{ nextSection.chapterTag }}
        </MTag>
      </div>
    </button>
    <div v-else class="nav-placeholder" aria-hidden="true" />
  </footer>
</template>

<style scoped>
.doc-footer-nav {
  margin-top: 56px;
  padding-top: 24px;
  border-top: 1px solid var(--border-subtle);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
  user-select: none !important;
  -webkit-user-select: none !important;
}

.doc-footer-nav * {
  user-select: none !important;
  -webkit-user-select: none !important;
}

.nav-placeholder {
  visibility: hidden;
}

.nav-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  user-select: none;
  transition: background-color 120ms ease, border-color 120ms ease;
  min-height: 80px;
}

.nav-card:hover {
  background-color: var(--bg-hover);
  border-color: rgba(255, 255, 255, 0.12);
}

.prev-card {
  align-items: flex-start;
}

.next-card {
  align-items: flex-end;
  text-align: right;
}

.card-direction {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.arrow-icon {
  flex-shrink: 0;
  transition: transform 120ms ease;
}

.nav-card:hover .prev-arrow {
  transform: translateX(-3px);
}

.nav-card:hover .next-arrow {
  transform: translateX(3px);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  flex-wrap: wrap;
}

.next-card .card-content {
  justify-content: flex-end;
}

.section-title {
  font-size: var(--font-size);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  transition: color 120ms ease;
}

.nav-card:hover .section-title {
  color: var(--accent-primary);
}

.chapter-tag {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .doc-footer-nav {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .next-card {
    align-items: flex-start;
    text-align: left;
  }
  .next-card .card-content {
    justify-content: flex-start;
  }
}
</style>
