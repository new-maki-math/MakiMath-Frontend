<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { bookApi } from '../../api/books.js';
import { lectureBundleFromTree } from '../../api/courses.js';
import { reviewApi } from '../../api/reviews.js';
import MLectureCover from '../../components/book/MLectureCover.vue';
import MTag from '../../components/display/MTag.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MButton from '../../components/form/MButton.vue';
import MInput from '../../components/form/MInput.vue';
import MTextarea from '../../components/form/MTextarea.vue';
import { EditPencil, NavArrowRight, Trash } from '../../components/icons/icons.js';
import MCollapse from '../../components/overlay/MCollapse.vue';
import MModal from '../../components/overlay/MModal.vue';
import { authStatus, currentUser, isSuperAdmin } from '../../utils/auth.js';
import { portableToLocalLecture } from '../../utils/lecture-portable.js';
import { lectureLocation, lectureNavigationOrigin } from '../../utils/lecture-route.js';
import {
  createLocalLecture,
  deleteLocalLecture,
  updateLocalLectureCover,
  validateLocalLectureSlug
} from '../../utils/local-lectures.js';
import { fetchShelfLectureTree } from '../../utils/shelf-lecture.js';
import LecturePrintDialog from '../lecture-doc/print/LecturePrintDialog.vue';
import RoadmapGraph from './RoadmapGraph.vue';

const route = useRoute();
const router = useRouter();

const lectureId = computed(() => route.params.lectureSlug);
const shelfSource = computed(() => (route.name === 'local-lecture-home' ? 'local' : 'online'));
const revisionId = computed(() => route.query.revision_id ?? '');
const lecture = ref(null);
const isWorkbook = computed(() => lecture.value?.kind === 'workbook');
const chapters = ref([]);
const printOpen = ref(false);
const printContext = computed(() => ({
  source: shelfSource.value,
  slug: lectureId.value,
  revisionId: revisionId.value
}));
const openChapters = ref(new Set());
const isLoading = ref(true);
const loadError = ref('');
const coverInput = ref(null);
const coverSaving = ref(false);
const coverDialogOpen = ref(false);
const deleteDialogOpen = ref(false);
const deleteSaving = ref(false);
const addOpen = ref(false);
const addSlug = ref('');
const addSaving = ref(false);
const loadedRevisionId = ref(null);
const loadedHasCover = ref(false);
const loadedCoverHash = ref('');
const revisionStatus = ref('');
const isPublicVersion = ref(false);
const publicCheckError = ref(false);
const publicChecking = ref(false);
const reviewDecision = ref('');
const reviewComment = ref('');
const reviewSaving = ref(false);
let loadId = 0;
let publicCheckSequence = 0;

const totalSectionsCount = computed(() => {
  return chapters.value.reduce((acc, c) => acc + (c.sections?.length || 0), 0);
});
const reviewStatusLabel = computed(
  () =>
    ({
      draft: '草稿',
      pending: '审核中',
      approved: '已通过',
      rejected: '已驳回'
    })[revisionStatus.value] || '未提供'
);
const updatedAt = computed(() => {
  if (!lecture.value?.updatedAt) {
    return '';
  }
  const date = new Date(lecture.value.updatedAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN');
});

// 构建供路线图组件直接消费的目录树
const lectureTree = computed(() => {
  if (!lecture.value && chapters.value.length === 0) {
    return null;
  }
  return {
    id: lecture.value?.dbId || lecture.value?.id || lectureId.value,
    title: lecture.value?.title || '当前讲义',
    chapters: chapters.value
  };
});

const toggleChapter = (chapterId) => {
  if (openChapters.value.has(chapterId)) {
    openChapters.value.delete(chapterId);
  } else {
    openChapters.value.add(chapterId);
  }
};

const expandAll = () => {
  openChapters.value = new Set(chapters.value.map((c) => c.id));
};

const collapseAll = () => {
  openChapters.value.clear();
};

const openLecture = (sectionId) => {
  const chapter = chapters.value.find((item) =>
    item.sections?.some((section) => String(section.id) === String(sectionId))
  );
  const section = chapter?.sections.find((item) => String(item.id) === String(sectionId));
  if (!chapter || !section) {
    return;
  }
  router.push(
    lectureLocation({
      source: shelfSource.value,
      slug: lectureId.value,
      chapterSlug: chapter.slug,
      sectionSlug: section.slug,
      revisionId: revisionId.value,
      origin: lectureNavigationOrigin()
    })
  );
};

const enterDoc = () => {
  // 无小节时不跳转
  const firstSecId = chapters.value.find((chapter) => chapter.sections?.length)?.sections[0].id;
  if (!firstSecId) {
    return;
  }
  openLecture(firstSecId);
};

const scrollToCatalog = () => {
  const el = document.getElementById('curriculum-toc');
  if (el) {
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
};

function openAddLecture() {
  if (
    shelfSource.value !== 'online' ||
    !lecture.value ||
    !loadedRevisionId.value ||
    !isPublicVersion.value ||
    addSaving.value
  ) {
    return;
  }
  addSlug.value = lectureId.value;
  addOpen.value = true;
}

async function checkPublicVersion() {
  const current = ++publicCheckSequence;
  const page = loadId;
  const id = lecture.value?.dbId;
  const revision = loadedRevisionId.value;
  isPublicVersion.value = false;
  publicCheckError.value = false;
  if (shelfSource.value !== 'online' || !id || !revision || revisionStatus.value !== 'approved') {
    return false;
  }
  publicChecking.value = true;
  try {
    const items = await bookApi.list({
      cache: 'no-store'
    });
    if (!Array.isArray(items)) {
      throw new Error('公开讲义列表格式不正确');
    }
    if (current !== publicCheckSequence || page !== loadId) {
      return false;
    }
    isPublicVersion.value = items.some(
      (item) => String(item.id) === String(id) && String(item.revision_id) === String(revision)
    );
    return isPublicVersion.value;
  } catch {
    if (current === publicCheckSequence && page === loadId) {
      publicCheckError.value = true;
    }
    return false;
  } finally {
    if (current === publicCheckSequence) {
      publicChecking.value = false;
    }
  }
}

async function addLecture() {
  if (
    !addOpen.value ||
    addSaving.value ||
    shelfSource.value !== 'online' ||
    !lecture.value ||
    !loadedRevisionId.value ||
    !isPublicVersion.value
  ) {
    return;
  }
  const slug = addSlug.value.trim();
  try {
    validateLocalLectureSlug(slug);
  } catch (error) {
    notify(error.message, 'warn');
    return;
  }
  const sequence = loadId;
  const sourceId = lecture.value.dbId;
  const sourceRevisionId = loadedRevisionId.value;
  addSaving.value = true;
  try {
    const data = await bookApi.exportRevision(sourceRevisionId);
    if (sequence !== loadId || !addOpen.value) {
      return;
    }
    if (!(await checkPublicVersion())) {
      notify('无法确认该版本仍为公开版本，请刷新后重试', 'warn');
      return;
    }
    if (sequence !== loadId || !addOpen.value) {
      return;
    }
    const record = portableToLocalLecture(data);
    record.slug = slug;
    record.sourceLectureId = sourceId;
    record.sourceRevisionId = sourceRevisionId;
    await createLocalLecture(record);
    addOpen.value = false;
    notify('已添加到我的书架，可在讲义工作台编辑本地副本', 'success');
  } catch (error) {
    notify(error.message || '添加讲义失败，请重试', 'error');
  } finally {
    addSaving.value = false;
  }
}

function openReview(decision) {
  if (
    !isSuperAdmin.value ||
    revisionStatus.value !== 'pending' ||
    !loadedRevisionId.value ||
    reviewSaving.value
  ) {
    return;
  }
  reviewDecision.value = decision;
  reviewComment.value = '';
}

async function submitReview() {
  if (
    !isSuperAdmin.value ||
    revisionStatus.value !== 'pending' ||
    !loadedRevisionId.value ||
    !reviewDecision.value ||
    reviewSaving.value
  ) {
    return;
  }
  const current = loadId;
  const id = loadedRevisionId.value;
  const decision = reviewDecision.value;
  reviewSaving.value = true;
  try {
    await reviewApi.decide('book', id, decision, reviewComment.value);
    if (current === loadId) {
      revisionStatus.value = decision;
      reviewDecision.value = '';
      if (decision === 'approved') {
        checkPublicVersion();
      }
      notify('审核已完成', 'success');
    }
  } catch (error) {
    notify(
      error.status === 409 ? '审核状态已变化，请刷新后重新核对' : error.message || '审核失败',
      'error'
    );
  } finally {
    reviewSaving.value = false;
  }
}

const scrollToChapter = (chapterId) => {
  if (!chapterId) {
    return;
  }
  openChapters.value.add(chapterId);
  setTimeout(() => {
    const el = document.getElementById(`chapter-${chapterId}`);
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, 50);
};

async function changeCover(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || coverSaving.value) {
    return;
  }
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    notify('请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片', 'warn');
    return;
  }
  const id = String(lecture.value.id);
  coverSaving.value = true;
  try {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
    await updateLocalLectureCover(id, data);
    if (shelfSource.value === 'local' && String(lecture.value?.id) === id && lecture.value) {
      lecture.value = {
        ...lecture.value,
        cover: data
      };
    }
    coverDialogOpen.value = false;
    notify('封面已保存', 'success');
  } catch (error) {
    notify(error.message || '保存封面失败', 'error');
  } finally {
    coverSaving.value = false;
  }
}

async function removeCover() {
  if (coverSaving.value || shelfSource.value !== 'local' || !lecture.value?.cover) {
    return;
  }
  const id = String(lecture.value.id);
  coverSaving.value = true;
  try {
    await updateLocalLectureCover(id, '');
    if (shelfSource.value === 'local' && String(lecture.value?.id) === id && lecture.value) {
      lecture.value = {
        ...lecture.value,
        cover: ''
      };
    }
    coverDialogOpen.value = false;
    notify('已恢复通用封面', 'success');
  } catch (error) {
    notify(error.message || '删除封面失败', 'error');
  } finally {
    coverSaving.value = false;
  }
}

async function removeLecture() {
  if (deleteSaving.value || shelfSource.value !== 'local' || !lecture.value?.id) {
    return;
  }
  const id = String(lecture.value.id);
  const currentLoad = loadId;
  deleteSaving.value = true;
  try {
    await deleteLocalLecture(id);
    if (
      currentLoad === loadId &&
      shelfSource.value === 'local' &&
      String(lecture.value?.id) === id
    ) {
      deleteDialogOpen.value = false;
      notify('本地讲义已删除', 'success');
      await router.push('/my-lecture');
    }
  } catch (error) {
    if (currentLoad === loadId) {
      notify(error.message || '删除本地讲义失败', 'error');
    }
  } finally {
    deleteSaving.value = false;
  }
}

const loadLectureData = async (slug) => {
  if (!slug) {
    return;
  }
  const id = ++loadId;
  isLoading.value = true;
  loadError.value = '';
  lecture.value = null;
  loadedRevisionId.value = null;
  loadedHasCover.value = false;
  loadedCoverHash.value = '';
  revisionStatus.value = '';
  publicCheckSequence++;
  isPublicVersion.value = false;
  publicCheckError.value = false;
  publicChecking.value = false;
  reviewDecision.value = '';
  addOpen.value = false;
  coverDialogOpen.value = false;
  deleteDialogOpen.value = false;
  chapters.value = [];
  try {
    const tree = await fetchShelfLectureTree(slug, shelfSource.value, revisionId.value);
    if (id === loadId && tree.kind === 'workbook') {
      await router.replace(
        lectureLocation({
          slug,
          source: shelfSource.value,
          kind: 'workbook',
          revisionId: revisionId.value,
          origin: lectureNavigationOrigin()
        })
      );
      return;
    }
    const bundle = lectureBundleFromTree(tree);
    if (id !== loadId) {
      return;
    }
    loadedRevisionId.value = tree.revision_id || null;
    loadedHasCover.value = Boolean(tree.has_cover);
    loadedCoverHash.value = tree.cover_hash || '';
    revisionStatus.value = tree.revision_status || '';
    lecture.value = bundle.lecture;
    chapters.value = bundle.chapters;
    if (shelfSource.value === 'online') {
      checkPublicVersion();
    }
    // 默认展开所有章节
    openChapters.value = new Set(bundle.chapters.map((c) => c.id));
  } catch (err) {
    if (id === loadId) {
      loadError.value =
        err.status === 404
          ? revisionId.value
            ? '讲义或指定版本不可访问，可能已更新或下架，请返回列表刷新'
            : '讲义不存在或当前账号无权访问'
          : err.message || '讲义加载失败，请重试';
    }
  } finally {
    if (id === loadId) {
      isLoading.value = false;
    }
  }
};

watch(
  [
    lectureId,
    shelfSource,
    revisionId,
    () => (shelfSource.value === 'online' ? authStatus.value : null),
    () => (shelfSource.value === 'online' ? currentUser.value?.id : null)
  ],
  ([id]) => loadLectureData(id),
  {
    immediate: true
  }
);
onUnmounted(() => {
  loadId++;
  publicCheckSequence++;
});
</script>

<template>
  <div class="view-container">
    <!-- 加载占位 -->
    <div
      v-if="isLoading"
      class="lecture-loading font-mono"
    >
      LOADING LECTURE DATA // {{ lectureId }}...
    </div>

    <!-- 课程详情 -->
    <div
      v-else-if="loadError"
      class="lecture-not-found font-mono"
    >
      <p>{{ loadError }}</p>
      <MButton
        variant="secondary"
        @click="loadLectureData(lectureId)"
        >重试</MButton
      >
    </div>
    <template v-else-if="lecture">
      <!-- 课程头部 -->
      <header class="lecture-header">
        <div
          class="header-cover"
          aria-hidden="true"
          inert
        >
          <MLectureCover
            :title="lecture.title"
            :image="lecture.cover || ''"
            :show-caption="false"
            :cover-revision-id="loadedRevisionId"
            :cover-hash="loadedCoverHash"
            :has-cover="loadedHasCover"
          />
        </div>
        <template v-if="shelfSource === 'local'">
          <input
            ref="coverInput"
            class="cover-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="changeCover"
          />
        </template>
        <div class="header-copy">
          <div class="header-info">
            <h1 class="lecture-title">{{ lecture.title }}</h1>
            <div class="lecture-description">
              <p
                id="lecture-description"
                class="lecture-desc"
                tabindex="0"
              >
                {{ lecture.desc || '暂无课程描述信息。' }}
              </p>
            </div>
          </div>

          <!-- 快捷操作栏 -->
          <div
            class="lecture-actions"
            :class="{
              'is-local': shelfSource === 'local'
            }"
          >
            <MButton
              v-if="lecture.live"
              class="main-action"
              variant="primary"
              :mono="true"
              @click="enterDoc"
            >
              {{ isWorkbook ? '阅读题目册' : '阅读讲义'
              }}<span class="action-translation">
                // {{ isWorkbook ? 'READ WORKBOOK' : 'READ LECTURE' }}</span
              >
            </MButton>
            <MButton
              v-else
              class="main-action"
              variant="ghost"
              :mono="true"
              disabled
            >
              筹划编排中<span class="action-translation"> // COMING SOON</span>
            </MButton>

            <MButton
              class="main-action"
              variant="secondary"
              :mono="true"
              @click="scrollToCatalog"
            >
              查看大纲目录<span class="action-translation"> // OUTLINE</span>
            </MButton>
            <MButton
              variant="secondary"
              :disabled="!totalSectionsCount"
              @click="printOpen = true"
            >
              {{ isWorkbook ? '打印题目册' : '打印讲义' }}
            </MButton>
            <MButton
              v-if="shelfSource === 'local'"
              variant="secondary"
              :disabled="coverSaving || deleteSaving"
              @click="coverDialogOpen = true"
            >
              <template #icon
                ><EditPencil
                  width="16"
                  height="16"
              /></template>
              编辑封面
            </MButton>
            <MButton
              v-if="shelfSource === 'local'"
              variant="secondary"
              :disabled="coverSaving || deleteSaving"
              @click="deleteDialogOpen = true"
            >
              <template #icon
                ><Trash
                  width="16"
                  height="16"
              /></template>
              {{ isWorkbook ? '删除题目册' : '删除讲义' }}
            </MButton>
            <MButton
              v-if="shelfSource === 'online' && isPublicVersion"
              variant="secondary"
              :disabled="addSaving || publicChecking"
              @click="openAddLecture"
            >
              添加到我的书架
            </MButton>
            <MButton
              v-if="publicCheckError"
              variant="ghost"
              :disabled="publicChecking"
              @click="checkPublicVersion"
              >公开状态检查失败，重试</MButton
            >
            <div
              v-if="
                shelfSource === 'online' &&
                revisionId &&
                isSuperAdmin &&
                revisionStatus === 'pending'
              "
              class="review-actions"
            >
              <MButton
                variant="primary"
                :disabled="reviewSaving"
                @click="openReview('approved')"
                >通过审核</MButton
              >
              <MButton
                variant="danger"
                :disabled="reviewSaving"
                @click="openReview('rejected')"
                >驳回讲义</MButton
              >
            </div>
          </div>
        </div>
      </header>

      <MModal
        :open="coverDialogOpen && shelfSource === 'local'"
        title="编辑封面"
        hide-footer
        show-close
        @close="!coverSaving && (coverDialogOpen = false)"
      >
        <p class="cover-dialog-note">选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。</p>
        <div class="cover-dialog-actions">
          <MButton
            variant="primary"
            :disabled="coverSaving"
            @click="coverInput?.click()"
            >{{ lecture?.cover ? '替换封面' : '选择封面' }}</MButton
          >
          <MButton
            v-if="lecture?.cover"
            variant="ghost"
            :disabled="coverSaving"
            @click="removeCover"
            >删除封面</MButton
          >
        </div>
      </MModal>
      <MModal
        :open="deleteDialogOpen && shelfSource === 'local'"
        :title="isWorkbook ? '删除本地题目册' : '删除本地讲义'"
        :confirm-text="isWorkbook ? '删除题目册' : '删除讲义'"
        confirm-variant="danger"
        :busy="deleteSaving"
        @close="!deleteSaving && (deleteDialogOpen = false)"
        @confirm="removeLecture"
      >
        <p class="cover-dialog-note">
          确定删除“{{ lecture?.title }}”吗？本地{{
            isWorkbook ? '题目册' : '讲义'
          }}内容将被删除，且无法恢复。
        </p>
      </MModal>
      <LecturePrintDialog
        :open="printOpen"
        :context="printContext"
        :chapters="chapters"
        @close="printOpen = false"
      />
      <!-- 概览卡片区 -->
      <section class="lecture-sections">
        <div class="grid-layout">
          <!-- 课程概览 -->
          <div class="spec-card">
            <div class="card-header">
              <span class="card-title font-mono"
                >OVERVIEW // {{ isWorkbook ? '题目册概要' : '讲义概要' }}</span
              >
            </div>
            <div class="spec-body">
              <div class="spec-item">
                <span class="spec-label">章节与小节</span>
                <span class="spec-value font-mono"
                  >{{ chapters.length }} 章 · {{ totalSectionsCount }} 节</span
                >
              </div>
              <div class="spec-item">
                <span class="spec-label">{{ isWorkbook ? '题目册版本' : '讲义版本' }}</span>
                <span class="spec-value">{{
                  shelfSource === 'local'
                    ? '本地版本'
                    : lecture.revisionNo != null
                      ? `V${lecture.revisionNo}`
                      : '未提供'
                }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">版本状态</span>
                <span class="spec-value">{{
                  shelfSource === 'local' ? '本地编辑' : reviewStatusLabel
                }}</span>
              </div>
              <div
                v-if="updatedAt"
                class="spec-item"
              >
                <span class="spec-label">更新时间</span
                ><span class="spec-value font-mono">{{ updatedAt }}</span>
              </div>
            </div>
          </div>

          <!-- 学习指引 -->
          <div class="spec-card">
            <div class="card-header">
              <span class="card-title font-mono">PREREQUISITES // 学习指引</span>
            </div>
            <div class="spec-body">
              <p class="guide-text">
                {{
                  isWorkbook
                    ? '本题目册按章节和小节组织题目。你可以从目录中选择小节开始阅读。'
                    : '本讲义按章节和小节组织内容。你可以从目录中选择小节开始阅读。'
                }}
              </p>
              <div class="guide-note font-mono">
                TIP:
                {{
                  isWorkbook
                    ? '点击下方目录中的小节即可查看题目。'
                    : '点击下方目录中的任一讲次即可直接进入全屏讲义阅读。'
                }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 知识路线图 -->
      <section
        v-if="!isWorkbook"
        class="roadmap-section"
      >
        <div class="roadmap-header">
          <div class="section-title-wrap">
            <span class="section-kicker font-mono">RELATIONSHIP GRAPH</span>
            <h2 class="section-heading">讲义目录结构</h2>
          </div>
          <div class="roadmap-meta font-mono">
            <span>OBSIDIAN-STYLE INTERACTIVE MAP</span>
          </div>
        </div>
        <div class="roadmap-container-box">
          <RoadmapGraph
            :tree="lectureTree"
            :lecture-id="lecture?.dbId || lecture?.id || lectureId"
            :source="shelfSource"
            :lecture-slug="lectureId"
            :revision-id="revisionId"
            @select-chapter="scrollToChapter"
          />
        </div>
      </section>

      <!-- 讲义大纲目录 -->
      <section
        id="curriculum-toc"
        class="curriculum-section"
      >
        <div class="curriculum-header">
          <div class="section-title-wrap">
            <span class="section-kicker font-mono">{{
              isWorkbook ? 'CONTENTS & QUESTIONS' : 'SYLLABUS & LECTURES'
            }}</span>
            <h2 class="section-heading">{{ isWorkbook ? '题目册目录' : '讲义大纲与章节目录' }}</h2>
          </div>
          <div class="curriculum-actions font-mono">
            <span class="curriculum-stats">
              {{ chapters.length }} {{ isWorkbook ? '章' : '编' }} · {{ totalSectionsCount }}
              {{ isWorkbook ? '节' : '讲' }}
            </span>
            <div class="toggle-group">
              <button
                class="toggle-btn"
                @click="expandAll"
              >
                全部展开
              </button>
              <span class="toggle-sep">/</span>
              <button
                class="toggle-btn"
                @click="collapseAll"
              >
                全部折叠
              </button>
            </div>
          </div>
        </div>

        <!-- 目录列表 -->
        <div
          v-if="chapters.length > 0"
          class="chapters-wrapper"
        >
          <div
            v-for="chap in chapters"
            :key="chap.id"
            :id="`chapter-${chap.id}`"
            class="chapter-panel"
            :class="{
              'is-collapsed': !openChapters.has(chap.id)
            }"
          >
            <!-- 章节标题栏 -->
            <button
              class="chapter-header-btn"
              @click="toggleChapter(chap.id)"
            >
              <div class="chapter-meta">
                <span class="chapter-title">{{ chap.title }}</span>
                <MTag
                  v-if="!shelfSource && chap.prereqText"
                  :variant="chap.isOrigin ? 'green' : 'muted'"
                  size="sm"
                  :dot="chap.isOrigin"
                >
                  {{ chap.prereqText }}
                </MTag>
              </div>

              <div class="chapter-aside">
                <span class="section-count font-mono"
                  >{{ chap.sections?.length || 0 }} {{ isWorkbook ? '节' : '讲' }}</span
                >
                <span
                  class="arrow-icon"
                  :class="{
                    'is-rotated': openChapters.has(chap.id)
                  }"
                >
                  <NavArrowRight
                    width="14"
                    height="14"
                  />
                </span>
              </div>
            </button>

            <!-- 小节列表 -->
            <MCollapse :open="openChapters.has(chap.id)">
              <div class="sections-container">
                <div
                  v-for="sec in chap.sections"
                  :key="sec.id"
                  class="section-entry"
                  @click="openLecture(sec.id)"
                >
                  <div class="entry-left">
                    <div class="entry-text">
                      <span
                        class="entry-title"
                        :title="sec.desc || sec.title"
                        >{{ sec.title }}</span
                      >
                    </div>
                  </div>

                  <div class="entry-action font-mono">
                    <span class="read-link">{{ isWorkbook ? '查看题目' : '进入讲义' }} →</span>
                  </div>
                </div>
              </div>
            </MCollapse>
          </div>
        </div>

        <!-- 空目录占位 -->
        <div
          v-else
          class="empty-curriculum font-mono"
        >
          STATUS: COMING SOON // 该课程大纲筹备与内容撰写中
        </div>
      </section>
    </template>

    <!-- 未找到课程 -->
    <div
      v-else
      class="lecture-not-found font-mono"
    >
      404 // 未找到讲义信息: {{ lectureId }}
    </div>
    <MModal
      :open="addOpen"
      title="添加到我的书架"
      desc="下载当前版本为本地讲义，可在讲义工作台编辑。"
      confirm-text="添加"
      :busy="addSaving"
      @close="!addSaving && (addOpen = false)"
      @confirm="addLecture"
    >
      <MInput
        v-model="addSlug"
        label="本地讲义标识"
        hint="本地讲义标识需在本浏览器中唯一"
        required
      />
    </MModal>
    <MModal
      :open="Boolean(reviewDecision)"
      :title="reviewDecision === 'approved' ? '通过审核' : '驳回讲义'"
      :confirm-text="reviewDecision === 'approved' ? '确认通过' : '确认驳回'"
      :confirm-variant="reviewDecision === 'approved' ? 'primary' : 'danger'"
      :busy="reviewSaving"
      @close="!reviewSaving && (reviewDecision = '')"
      @confirm="submitReview"
    >
      <MTextarea
        v-model="reviewComment"
        label="审核意见"
        :rows="3"
      />
    </MModal>
  </div>
</template>

<style scoped>
.view-container {
  padding: 32px 36px 64px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1080px;
  margin: 0 auto;
  width: 100%;
}

.lecture-loading,
.lecture-not-found {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  padding: 40px 0;
}

/* 课程头部 */
.lecture-header {
  position: relative;
  display: grid;
  grid-template-columns: minmax(150px, 240px) minmax(0, 1fr);
  align-items: stretch;
  gap: 24px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 24px;
}

.header-copy {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  gap: 16px;
}
.header-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}
.header-cover {
  grid-column: 1;
  grid-row: 1;
  width: 100%;
  box-sizing: border-box;
  pointer-events: none;
}

.header-cover :deep(.lecture-cover) {
  width: 100%;
}
.header-cover :deep(.cover-image) {
  object-fit: contain;
}

.cover-dialog-note {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.cover-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cover-input {
  display: none;
}
.lecture-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.lecture-description {
  min-width: 0;
  max-width: 840px;
}

.lecture-desc {
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 840px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.lecture-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 8px;
  flex-wrap: wrap;
}
.review-actions {
  display: flex;
  flex-basis: 100%;
  flex-wrap: wrap;
  gap: 12px;
}

/* 概览卡片区 */
.lecture-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.spec-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.spec-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.spec-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.spec-label {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.spec-value {
  font-size: var(--font-size-smaller);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.guide-text {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  line-height: 1.6;
}

.guide-note {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  background-color: var(--bg-elevated);
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border-subtle);
}

/* 知识图谱区域 */
.roadmap-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roadmap-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.roadmap-meta {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
}

.roadmap-container-box {
  width: 100%;
  height: 520px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
  isolation: isolate;
  z-index: 1;
  background-color: var(--bg-surface);
  position: relative;
  box-sizing: border-box;
}

/* 课程目录区域 */
.curriculum-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  scroll-margin-top: 24px;
}

.curriculum-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-kicker {
  font-size: var(--font-size-smallest);
  color: var(--accent-primary);
  letter-spacing: 0.5px;
}

.section-heading {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.curriculum-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  cursor: pointer;
  padding: 0;
  transition: color 120ms ease;
}

.toggle-btn:hover {
  color: var(--text-primary);
}

.toggle-sep {
  color: var(--text-muted);
  opacity: 0.5;
}

/* 章节列表 */
.chapters-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chapter-panel {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 120ms ease;
}

.chapter-panel:hover {
  border-color: var(--border-hover);
}

.chapter-header-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color 120ms ease;
}

.chapter-header-btn:hover {
  background-color: var(--bg-hover);
}

.chapter-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-title {
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.chapter-aside {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.arrow-icon {
  display: flex;
  align-items: center;
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
}

.arrow-icon.is-rotated {
  transform: rotate(90deg);
}

/* 小节列表 */
.sections-container {
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-app);
  display: flex;
  flex-direction: column;
}

.section-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color 120ms ease;
}

.section-entry:last-child {
  border-bottom: none;
}

.section-entry:hover {
  background-color: var(--bg-hover);
}

.entry-left {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.entry-text {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.entry-title {
  font-size: var(--font-size-smaller);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  transition: color 120ms ease;
}

.section-entry:hover .entry-title {
  color: var(--accent-primary);
}

.entry-action {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 120ms ease,
    transform 120ms ease,
    color 120ms ease;
  flex-shrink: 0;
}

.section-entry:hover .entry-action {
  opacity: 1;
  transform: translateX(0);
  color: var(--accent-primary);
}

.empty-curriculum {
  padding: 32px;
  background-color: var(--bg-surface);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  text-align: center;
}

@media (max-width: 768px) {
  .view-container {
    padding: 16px 14px 48px;
    gap: 24px;
  }

  .lecture-header {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    align-items: start;
    row-gap: 10px;
    padding-bottom: 20px;
  }

  .header-cover {
    grid-column: 1;
    grid-row: 1;
    width: min(150px, 45%);
    justify-self: center;
  }

  .header-copy {
    display: contents;
  }

  .header-info {
    display: contents;
  }

  .lecture-title {
    grid-column: 1;
    grid-row: 2;
    align-self: start;
    margin: 0;
    text-align: center;
    font-size: clamp(18px, 5vw, 22px);
    line-height: 1.35;
  }

  .lecture-description {
    grid-column: 1 / -1;
    grid-row: 3;
    padding-top: 2px;
  }

  .lecture-desc {
    font-size: 13.5px;
    line-height: 1.65;
  }

  .lecture-actions {
    display: grid;
    grid-column: 1 / -1;
    grid-row: 4;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    align-items: stretch;
    width: 100%;
    gap: 8px;
    margin-top: 0;
    padding-top: 0;
  }

  .lecture-actions > :deep(.m-button) {
    grid-column: span 3;
  }

  .lecture-actions.is-local > :deep(.m-button:not(.main-action)) {
    grid-column: span 2;
  }

  .lecture-actions :deep(.m-button) {
    min-width: 0;
    min-height: 42px;
    height: auto;
    padding: 10px 8px;
    line-height: 1.4;
  }

  .review-actions {
    grid-column: 1 / -1;
  }

  .action-translation {
    display: none;
  }

  .review-actions > :deep(.m-button) {
    flex: 1;
  }

  .grid-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .spec-card {
    padding: 16px;
    gap: 12px;
  }

  .roadmap-container-box {
    height: 360px;
  }

  .roadmap-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding-bottom: 10px;
  }

  .curriculum-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-bottom: 10px;
  }

  .curriculum-actions {
    width: 100%;
    justify-content: space-between;
  }

  .chapter-header-btn {
    padding: 12px 14px;
  }

  .chapter-meta {
    flex-wrap: wrap;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .chapter-title {
    font-size: 13.5px;
    overflow-wrap: anywhere;
  }

  .chapter-aside {
    flex-shrink: 0;
    gap: 8px;
    font-size: 12px;
  }

  .section-entry {
    padding: 12px 14px;
    gap: 8px;
  }

  .entry-left {
    gap: 10px;
    flex: 1;
  }

  .entry-text {
    min-width: 0;
  }

  .entry-title {
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .toggle-btn {
    min-height: 36px;
    padding: 0 4px;
  }

  /* 移动端无鼠标 hover，常驻展示进入讲义提示 */
  .entry-action {
    opacity: 0.85;
    transform: translateX(0);
    color: var(--accent-primary);
    font-size: 11px;
  }
}

@media (max-width: 600px) {
  .roadmap-container-box {
    height: 300px;
  }
}
</style>
