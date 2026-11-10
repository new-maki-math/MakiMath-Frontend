<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { lectureBundleFromTree } from '../../api/courses.js';
import { bookApi } from '../../api/books.js';
import { reviewApi } from '../../api/reviews.js';
import MLectureCover from '../../components/book/MLectureCover.vue';
import MDataView from '../../components/feedback/MDataView.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MButton from '../../components/form/MButton.vue';
import MInput from '../../components/form/MInput.vue';
import MTextarea from '../../components/form/MTextarea.vue';
import { NavArrowRight } from '../../components/icons/icons.js';
import MCollapse from '../../components/overlay/MCollapse.vue';
import MModal from '../../components/overlay/MModal.vue';
import { authStatus, currentUser, isSuperAdmin } from '../../utils/auth.js';
import { portableToLocalLecture } from '../../utils/lecture-portable.js';
import { lectureLocation, lectureNavigationOrigin } from '../../utils/lecture-route.js';
import { createLocalLecture, deleteLocalLecture, updateLocalLectureCover, validateLocalLectureSlug } from '../../utils/local-lectures.js';
import { fetchShelfLectureTree } from '../../utils/shelf-lecture.js';

const route = useRoute();
const router = useRouter();
const slug = computed(() => String(route.params.lectureSlug || ''));
const source = computed(() => route.name === 'local-workbook-home' ? 'local' : 'online');
const revisionId = computed(() => route.query.revision_id || '');
const book = ref(null);
const chapters = ref([]);
const openChapters = ref(new Set());
const loading = ref(true);
const error = ref('');
const treeInfo = ref(null);
const publicVersion = ref(false);
const coverInput = ref(null);
const coverOpen = ref(false);
const deleteOpen = ref(false);
const addOpen = ref(false);
const addSlug = ref('');
const busy = ref(false);
const reviewStatus = ref('');
const reviewDecision = ref('');
const reviewComment = ref('');
const reviewSaving = ref(false);
let sequence = 0;
const sectionCount = computed(() => chapters.value.reduce((sum, chapter) => sum + chapter.sections.length, 0));
const updatedAt = computed(() => {
  const value = book.value?.updatedAt;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('zh-CN') : '';
});
async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  book.value = null;
  chapters.value = [];
  treeInfo.value = null;
  publicVersion.value = false;
  reviewStatus.value = '';
  reviewDecision.value = '';
  coverOpen.value = false;
  deleteOpen.value = false;
  addOpen.value = false;
  try {
    const tree = await fetchShelfLectureTree(slug.value, source.value, revisionId.value);
    if (current !== sequence) return;
    if (tree.kind !== 'workbook') throw new Error('该图书不是题目册');
    const bundle = lectureBundleFromTree(tree);
    book.value = bundle.lecture;
    chapters.value = bundle.chapters;
    treeInfo.value = tree;
    reviewStatus.value = tree.revision_status || '';
    openChapters.value = new Set(bundle.chapters.map((chapter) => chapter.id));
    if (source.value === 'online' && tree.revision_status === 'approved') {
      try {
        const published = await bookApi.list({ cache: 'no-store' });
        if (current === sequence && Array.isArray(published)) {
          publicVersion.value = published.some((item) => String(item.id) === String(tree.id) && String(item.revision_id) === String(tree.revision_id));
        }
      } catch { /* 未能确认公开状态时不展示添加入口。 */ }
    }
  } catch (failure) {
    if (current === sequence) error.value = failure.status === 404 ? '题目册不存在或当前账号无权访问' : failure.message || '题目册加载失败';
  } finally {
    if (current === sequence) loading.value = false;
  }
}
watch([slug, source, revisionId, authStatus, () => currentUser.value?.id], load, { immediate: true });
onUnmounted(() => { sequence++; });
function toggle(id) {
  const next = new Set(openChapters.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  openChapters.value = next;
}
function openSection(chapter, section) {
  router.push(lectureLocation({ slug: slug.value, source: source.value, chapterSlug: chapter.slug, sectionSlug: section.slug, revisionId: revisionId.value, origin: lectureNavigationOrigin() }));
}
function readFirst() {
  const chapter = chapters.value.find((item) => item.sections.length);
  if (chapter) openSection(chapter, chapter.sections[0]);
}
function scrollToCatalog() {
  document.getElementById('question-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function changeCover(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || busy.value || !book.value) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    notify('请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片', 'warn');
    return;
  }
  const current = sequence;
  const id = book.value.id;
  busy.value = true;
  try {
    const url = URL.createObjectURL(file);
    try { const image = new Image(); image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
    if (current !== sequence) return;
    await updateLocalLectureCover(String(id), data);
    if (current === sequence) { book.value = { ...book.value, cover: data }; coverOpen.value = false; notify('封面已保存', 'success'); }
  } catch (failure) { if (current === sequence) notify(failure.message || '封面保存失败', 'error'); }
  finally { busy.value = false; }
}
async function removeCover() {
  if (!book.value?.cover || busy.value) return;
  const current = sequence;
  busy.value = true;
  try {
    await updateLocalLectureCover(String(book.value.id), '');
    if (current === sequence) { book.value = { ...book.value, cover: '' }; coverOpen.value = false; notify('已恢复通用封面', 'success'); }
  } catch (failure) { if (current === sequence) notify(failure.message || '删除封面失败', 'error'); }
  finally { busy.value = false; }
}
async function removeBook() {
  if (!book.value || busy.value) return;
  const current = sequence;
  busy.value = true;
  try {
    await deleteLocalLecture(String(book.value.id));
    if (current === sequence) { deleteOpen.value = false; notify('本地题目册已删除', 'success'); await router.push('/my-lecture'); }
  } catch (failure) { if (current === sequence) notify(failure.message || '删除题目册失败', 'error'); }
  finally { busy.value = false; }
}
async function addBook() {
  if (!treeInfo.value?.revision_id || !publicVersion.value || busy.value) return;
  const localSlug = addSlug.value.trim();
  try { validateLocalLectureSlug(localSlug); } catch (failure) { notify(failure.message, 'warn'); return; }
  const current = sequence;
  const tree = treeInfo.value;
  busy.value = true;
  try {
    const data = await bookApi.exportRevision(tree.revision_id);
    const published = await bookApi.list({ cache: 'no-store' });
    if (current !== sequence || !addOpen.value) return;
    if (!Array.isArray(published) || !published.some((item) => String(item.id) === String(tree.id) && String(item.revision_id) === String(tree.revision_id))) throw new Error('该版本已不再公开，请刷新后重试');
    const record = portableToLocalLecture(data);
    record.slug = localSlug;
    record.sourceLectureId = tree.id;
    record.sourceRevisionId = tree.revision_id;
    await createLocalLecture(record);
    if (current === sequence) { addOpen.value = false; notify('已添加到我的书架', 'success'); }
  } catch (failure) { if (current === sequence) notify(failure.message || '添加题目册失败', 'error'); }
  finally { busy.value = false; }
}
function openReview(decision) {
  if (!isSuperAdmin.value || reviewStatus.value !== 'pending' || !treeInfo.value?.revision_id || reviewSaving.value) return;
  reviewDecision.value = decision;
  reviewComment.value = '';
}
async function submitReview() {
  if (!isSuperAdmin.value || reviewStatus.value !== 'pending' || !treeInfo.value?.revision_id || !reviewDecision.value || reviewSaving.value) return;
  const current = sequence;
  const id = treeInfo.value.revision_id;
  const decision = reviewDecision.value;
  reviewSaving.value = true;
  try {
    await reviewApi.decide('book', id, decision, reviewComment.value);
    if (current === sequence) {
      reviewStatus.value = decision;
      reviewDecision.value = '';
      notify('审核已完成', 'success');
      if (decision === 'approved') {
        try {
          const published = await bookApi.list({ cache: 'no-store' });
          if (current === sequence && Array.isArray(published)) {
            publicVersion.value = published.some((item) => String(item.id) === String(treeInfo.value?.id) && String(item.revision_id) === String(id));
          }
        } catch { /* 无法确认公开状态时保留当前页面。 */ }
      }
    }
  } catch (failure) {
    if (current === sequence) notify(failure.status === 409 ? '审核状态已变化，请刷新后重新核对' : failure.message || '审核失败', 'error');
  } finally {
    reviewSaving.value = false;
  }
}
</script>

<template>
  <main class="view-container">
    <MDataView :loading="loading" text="正在加载题目册…" :content-key="`${source}:${slug}:${revisionId}`">
      <p v-if="error" class="state" role="alert">{{ error }} <MButton variant="ghost" size="sm" @click="load">重试</MButton></p>
      <template v-else-if="book">
        <header class="book-header">
          <div class="cover" aria-hidden="true" inert><MLectureCover :title="book.title" :image="book.cover || ''" :show-caption="false" :cover-revision-id="treeInfo?.revision_id || ''" :cover-hash="treeInfo?.cover_hash || ''" :has-cover="Boolean(treeInfo?.has_cover)" /></div>
          <input v-if="source === 'local'" ref="coverInput" class="cover-input" type="file" accept="image/jpeg,image/png,image/webp" @change="changeCover" />
          <div class="header-copy">
            <div><span class="eyebrow">QUESTION COLLECTION</span><h1>{{ book.title }}</h1><p class="description">{{ book.desc || '暂无题目册简介。' }}</p></div>
            <div class="actions">
              <MButton variant="primary" :disabled="!sectionCount" @click="readFirst">阅读题目册</MButton>
              <MButton variant="secondary" @click="scrollToCatalog">查看题目册目录</MButton>
              <MButton v-if="source === 'local'" variant="secondary" :disabled="busy" @click="coverOpen = true">编辑封面</MButton>
              <MButton v-if="source === 'local'" variant="secondary" :disabled="busy" @click="deleteOpen = true">删除题目册</MButton>
              <MButton v-if="source === 'online' && publicVersion" variant="secondary" :disabled="busy" @click="addSlug = slug; addOpen = true">添加到我的书架</MButton>
              <div v-if="source === 'online' && revisionId && isSuperAdmin && reviewStatus === 'pending'" class="review-actions">
                <MButton variant="primary" :disabled="reviewSaving" @click="openReview('approved')">通过审核</MButton>
                <MButton variant="danger" :disabled="reviewSaving" @click="openReview('rejected')">驳回题目册</MButton>
              </div>
            </div>
          </div>
        </header>
        <section class="overview">
          <div class="spec-card"><span class="card-title">OVERVIEW // 题目册概要</span>
            <div class="spec-item"><span>章节与小节</span><strong>{{ chapters.length }} 章 · {{ sectionCount }} 节</strong></div>
            <div class="spec-item"><span>题目册版本</span><strong>{{ source === 'local' ? '本地版本' : book.revisionNo != null ? `V${book.revisionNo}` : '未提供' }}</strong></div>
            <div class="spec-item"><span>版本状态</span><strong>{{ source === 'local' ? '本地编辑' : ({ draft: '草稿', pending: '审核中', approved: '已通过', rejected: '已驳回' }[reviewStatus] || '未提供') }}</strong></div>
            <div v-if="updatedAt" class="spec-item"><span>更新时间</span><strong>{{ updatedAt }}</strong></div>
          </div>
          <div class="spec-card"><span class="card-title">GUIDE // 学习指引</span><p class="guide">从目录中选择小节，查看题目并回顾考点与解答。</p><p class="note">点击下方目录中的小节进入阅读。</p></div>
        </section>
        <section id="question-catalog" class="section catalog">
          <div class="section-header"><div><span class="kicker">CONTENTS &amp; QUESTIONS</span><h2>题目册目录</h2></div><div class="catalog-actions"><span>{{ chapters.length }} 章 · {{ sectionCount }} 节</span><button type="button" @click="openChapters = new Set(chapters.map((chapter) => chapter.id))">全部展开</button><span>/</span><button type="button" @click="openChapters = new Set()">全部折叠</button></div></div>
          <div v-if="chapters.length" class="chapter-list"><div v-for="chapter in chapters" :key="chapter.id" class="chapter">
            <button type="button" class="chapter-header" :aria-expanded="openChapters.has(chapter.id)" @click="toggle(chapter.id)"><strong>{{ chapter.title }}</strong><span class="chapter-meta">{{ chapter.sections.length }} 节 <NavArrowRight :class="{ rotated: openChapters.has(chapter.id) }" width="14" height="14" /></span></button>
            <MCollapse :open="openChapters.has(chapter.id)"><div class="papers"><button v-for="section in chapter.sections" :key="section.id" type="button" class="paper" @click="openSection(chapter, section)"><span>{{ section.title }}</span><span>查看题目 →</span></button></div></MCollapse>
          </div></div>
          <p v-else class="state">暂无题目册目录</p>
        </section>
      </template>
    </MDataView>
    <MModal :open="coverOpen && source === 'local'" title="编辑封面" hide-footer show-close @close="!busy && (coverOpen = false)"><p class="guide">选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。</p><div class="actions"><MButton variant="primary" :disabled="busy" @click="coverInput?.click()">{{ book?.cover ? '替换封面' : '选择封面' }}</MButton><MButton v-if="book?.cover" variant="ghost" :disabled="busy" @click="removeCover">删除封面</MButton></div></MModal>
    <MModal :open="deleteOpen && source === 'local'" title="删除本地题目册" confirm-text="删除题目册" confirm-variant="danger" :busy="busy" @close="!busy && (deleteOpen = false)" @confirm="removeBook"><p class="guide">确定删除“{{ book?.title }}”吗？本地题目册内容将被删除，且无法恢复。</p></MModal>
    <MModal :open="addOpen" title="添加到我的书架" desc="保存当前公开版本为本地题目册。" confirm-text="添加" :busy="busy" @close="!busy && (addOpen = false)" @confirm="addBook"><MInput v-model="addSlug" label="本地题目册标识" hint="标识需在本浏览器中唯一" required /></MModal>
    <MModal :open="Boolean(reviewDecision)" :title="reviewDecision === 'approved' ? '通过审核' : '驳回题目册'" :confirm-text="reviewDecision === 'approved' ? '确认通过' : '确认驳回'" :confirm-variant="reviewDecision === 'approved' ? 'primary' : 'danger'" :busy="reviewSaving" @close="!reviewSaving && (reviewDecision = '')" @confirm="submitReview"><MTextarea v-model="reviewComment" label="审核意见" :rows="3" /></MModal>
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
.review-actions { display: flex; flex-basis: 100%; flex-wrap: wrap; gap: 12px; }
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
.paper { width: 100%; text-align: left; display: flex; justify-content: space-between; gap: 12px; padding: 13px 20px; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.paper + .paper { border-top: 1px solid var(--border-subtle); }
.paper span:last-child { color: var(--text-muted); }
@media (max-width: 600px) { .view-container { padding: 20px 16px 48px; gap: 24px; } .book-header { flex-direction: column; align-items: center; gap: 20px; } .cover { width: 200px; max-width: 65%; } .header-copy { width: 100%; gap: 18px; } .overview { grid-template-columns: 1fr; } .section-header { align-items: flex-start; flex-wrap: wrap; } .catalog-actions { flex-wrap: wrap; } }
.view-container :deep(.data-content) { gap: 32px; }
.cover-input { display: none; }
.state { color: var(--text-secondary); }
.paper:hover { background: var(--bg-hover); color: var(--text-primary); }
@media (max-width: 600px) { .view-container :deep(.data-content) { gap: 24px; } }
</style>
