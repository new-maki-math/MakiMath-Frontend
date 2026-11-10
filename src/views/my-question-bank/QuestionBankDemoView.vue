<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import MLectureCover from '../../components/book/MLectureCover.vue';
import MButton from '../../components/form/MButton.vue';
import { NavArrowRight } from '../../components/icons/icons.js';
import MCollapse from '../../components/overlay/MCollapse.vue';

const router = useRouter();
const title = '考研数学真题 · 原始套卷';
const chapters = Array.from({ length: 17 }, (_, index) => {
  const year = 2026 - index;
  return { year, papers: ['数一', '数二', '数三'].map((name) => ({ name, count: year <= 2020 ? 23 : 22 })) };
});
const openYears = ref(new Set([2026]));
function toggle(year) {
  const next = new Set(openYears.value);
  if (next.has(year)) next.delete(year); else next.add(year);
  openYears.value = next;
}
function scrollToCatalog() {
  document.getElementById('question-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <main class="view-container">
    <header class="book-header">
      <div class="cover" aria-hidden="true" inert><MLectureCover :title="title" :show-caption="false" /></div>
      <div class="header-copy">
        <div>
          <span class="eyebrow">QUESTION COLLECTION <span class="demo-label">示例页面</span></span>
          <h1>{{ title }}</h1>
          <p class="description">收录 2010—2026 年考研数学一、数学二、数学三真题，按照年份与卷别整理，方便按套练习与回顾。</p>
        </div>
        <div class="actions">
          <MButton variant="primary" @click="router.push('/question-bank')">浏览题库</MButton>
          <MButton variant="secondary" @click="scrollToCatalog">查看题目册目录</MButton>
        </div>
      </div>
    </header>

    <section class="overview">
      <div class="spec-card">
        <span class="card-title">OVERVIEW // 题目册概要</span>
        <div class="spec-item"><span>年份</span><strong>2010 — 2026</strong></div>
        <div class="spec-item"><span>试卷</span><strong>51 套</strong></div>
        <div class="spec-item"><span>题位</span><strong>1,155 题</strong></div>
      </div>
      <div class="spec-card">
        <span class="card-title">GUIDE // 练习指引</span>
        <p class="guide">按年份和卷别选择试卷，练习后回顾考点与解答。</p>
        <p class="note">当前为页面示例，目录为展示数据。</p>
      </div>
    </section>

    <section id="question-catalog" class="section catalog">
      <div class="section-header">
        <div><span class="kicker">PAPERS &amp; QUESTIONS</span><h2>题目册目录</h2></div>
        <div class="catalog-actions"><span>17 年 · 51 套</span><button type="button" @click="openYears = new Set(chapters.map((chapter) => chapter.year))">全部展开</button><span>/</span><button type="button" @click="openYears = new Set()">全部折叠</button></div>
      </div>
      <div class="chapter-list">
        <div v-for="chapter in chapters" :key="chapter.year" class="chapter">
          <button type="button" class="chapter-header" :aria-expanded="openYears.has(chapter.year)" @click="toggle(chapter.year)">
            <strong>{{ chapter.year }} 年</strong>
            <span class="chapter-meta">3 套试卷 <NavArrowRight :class="{ rotated: openYears.has(chapter.year) }" width="14" height="14" /></span>
          </button>
          <MCollapse :open="openYears.has(chapter.year)">
            <div class="papers"><div v-for="paper in chapter.papers" :key="paper.name" class="paper"><span>{{ chapter.year }} 年 {{ paper.name }}</span><span>{{ paper.count }} 题</span></div></div>
          </MCollapse>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 32px; width: 100%; max-width: 1080px; margin: 0 auto; padding: 32px 36px 64px; box-sizing: border-box; }
.book-header { display: flex; gap: 28px; align-items: stretch; }
.cover { width: 160px; flex: none; }
.header-copy { display: flex; flex-direction: column; justify-content: space-between; gap: 24px; min-width: 0; padding: 4px 0; }
.eyebrow, .kicker { color: var(--accent-primary); font-size: var(--font-size-smallest); letter-spacing: .5px; }
.demo-label { color: var(--text-muted); margin-left: 8px; }
h1 { margin: 8px 0 12px; color: var(--text-primary); font-size: clamp(24px, 3vw, 32px); }
.description { color: var(--text-secondary); line-height: 1.8; margin: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; }
.overview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.spec-card { display: flex; flex-direction: column; gap: 12px; padding: 20px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); }
.card-title { color: var(--text-muted); font-size: var(--font-size-smaller); font-weight: var(--font-weight-semibold); letter-spacing: .5px; margin-bottom: 4px; }
.spec-item { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 9px; border-bottom: 1px solid var(--border-subtle); font-size: var(--font-size-smaller); color: var(--text-muted); }
.spec-item:last-child { border-bottom: 0; padding-bottom: 0; }
.spec-item strong { font-weight: var(--font-weight-medium); color: var(--text-primary); }
.guide, .note { margin: 0; font-size: var(--font-size-smaller); line-height: 1.7; color: var(--text-secondary); }
.note { margin-top: auto; padding: 10px 12px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); border-radius: var(--radius-xs); color: var(--text-muted); font-size: var(--font-size-smallest); }
.section { display: flex; flex-direction: column; gap: 16px; }
.section-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--border-subtle); }
h2 { margin: 4px 0 0; font-size: var(--font-size-larger); color: var(--text-primary); }
.section-meta, .catalog-actions { color: var(--text-muted); font-size: var(--font-size-smallest); }
.catalog { scroll-margin-top: 24px; }
.catalog-actions { display: flex; align-items: center; gap: 8px; }
.catalog-actions button { color: var(--text-muted); white-space: nowrap; }
.catalog-actions button:hover { color: var(--text-primary); }
.chapter-list { display: flex; flex-direction: column; gap: 12px; }
.chapter { border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-surface); }
.chapter-header { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 18px 20px; color: var(--text-primary); text-align: left; }
.chapter-meta { display: flex; align-items: center; gap: 12px; color: var(--text-muted); font-size: var(--font-size-smaller); }
.chapter-meta svg { transition: transform 150ms ease; }.chapter-meta svg.rotated { transform: rotate(90deg); }
.papers { border-top: 1px solid var(--border-subtle); }
.paper { display: flex; justify-content: space-between; gap: 12px; padding: 13px 20px; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.paper + .paper { border-top: 1px solid var(--border-subtle); }
.paper span:last-child { color: var(--text-muted); }
@media (max-width: 600px) { .view-container { padding: 20px 16px 48px; gap: 24px; } .book-header { flex-direction: column; align-items: center; gap: 20px; } .cover { width: 200px; max-width: 65%; } .header-copy { width: 100%; gap: 18px; } .overview { grid-template-columns: 1fr; } .section-header { align-items: flex-start; flex-wrap: wrap; } .catalog-actions { flex-wrap: wrap; } }
</style>
