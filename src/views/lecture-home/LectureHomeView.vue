<script setup>
import { EditPencil, NavArrowRight, Trash } from '@iconoir/vue';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { lectureBundleFromTree } from '../../api/courses.js';
import { lectureApi } from '../../api/lectures.js';
import { reviewApi } from '../../api/reviews.js';
import MButton from '../../components/MButton.vue';
import MCollapse from '../../components/MCollapse.vue';
import MInput from '../../components/MInput.vue';
import MLectureCover from '../../components/MLectureCover.vue';
import MModal from '../../components/MModal.vue';
import { notify } from '../../components/MNotice.vue';
import MTag from '../../components/MTag.vue';
import MTextarea from '../../components/MTextarea.vue';
import RoadmapGraph from '../../components/RoadmapGraph.vue';
import { authStatus, currentUser, isSuperAdmin } from '../../utils/auth.js';
import { portableToLocalLecture } from '../../utils/lecture-portable.js';
import { lectureLocation, lectureNavigationOrigin } from '../../utils/lecture-route.js';
import {
  createLocalLecture,
  updateLocalLectureCover,
  validateLocalLectureSlug
} from '../../utils/local-lectures.js';
import { fetchShelfLectureTree } from '../../utils/shelf-lecture.js';

const route = useRoute();
const router = useRouter();

const lectureId = computed(() => route.params.lectureSlug);
const shelfSource = computed(() => (route.name === 'local-lecture-home' ? 'local' : 'online'));
const revisionId = computed(() => route.query.revision_id ?? '');
const lecture = ref(null);
const chapters = ref([]);
const openChapters = ref(new Set());
const isLoading = ref(true);
const loadError = ref('');
const coverInput = ref(null);
const coverSaving = ref(false);
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
const statusTag = computed(() =>
  shelfSource.value === 'local'
    ? {
        label: 'LOCAL',
        variant: 'cyan'
      }
    : {
        draft: {
          label: 'DRAFT',
          variant: 'amber'
        },
        pending: {
          label: 'IN REVIEW',
          variant: 'blue'
        },
        approved: {
          label: 'APPROVED',
          variant: 'green'
        },
        rejected: {
          label: 'REJECTED',
          variant: 'red'
        }
      }[revisionStatus.value] || {
        label: 'UNKNOWN',
        variant: 'gray'
      }
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
    const items = await lectureApi.list({
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
    const data = await lectureApi.exportRevision(sourceRevisionId);
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
    await reviewApi.decide('lecture', id, decision, reviewComment.value);
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
    notify('已恢复通用封面', 'success');
  } catch (error) {
    notify(error.message || '删除封面失败', 'error');
  } finally {
    coverSaving.value = false;
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
  chapters.value = [];
  try {
    const tree = await fetchShelfLectureTree(slug, shelfSource.value, revisionId.value);
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
          <div class="cover-actions">
            <button
              class="cover-action"
              type="button"
              title="修改封面"
              aria-label="修改封面"
              :disabled="coverSaving"
              @click="coverInput?.click()"
            >
              <EditPencil
                width="17"
                height="17"
              />
            </button>
            <button
              v-if="lecture.cover"
              class="cover-action"
              type="button"
              title="删除封面"
              aria-label="删除封面"
              :disabled="coverSaving"
              @click="removeCover"
            >
              <Trash
                width="17"
                height="17"
              />
            </button>
          </div>
        </template>
        <div class="header-copy">
          <div class="header-tags">
            <MTag
              :variant="statusTag.variant"
              size="md"
              :dot="true"
              >{{ statusTag.label }}</MTag
            >
          </div>

          <h1 class="lecture-title">{{ lecture.title }}</h1>
          <p
            class="lecture-desc"
            tabindex="0"
          >
            {{ lecture.desc || '暂无课程描述信息。' }}
          </p>

          <!-- 快捷操作栏 -->
          <div class="lecture-actions">
            <MButton
              v-if="lecture.live"
              variant="primary"
              :mono="true"
              @click="enterDoc"
            >
              阅读讲义 // READ LECTURE
            </MButton>
            <MButton
              v-else
              variant="ghost"
              :mono="true"
              disabled
            >
              筹划编排中 // COMING SOON
            </MButton>

            <MButton
              variant="secondary"
              :mono="true"
              @click="scrollToCatalog"
            >
              查看大纲目录 // OUTLINE
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

      <!-- 概览卡片区 -->
      <section class="lecture-sections">
        <div class="grid-layout">
          <!-- 课程概览 -->
          <div class="spec-card">
            <div class="card-header">
              <span class="card-title font-mono">OVERVIEW // 讲义概要</span>
            </div>
            <div class="spec-body">
              <div class="spec-item">
                <span class="spec-label">章节与小节</span>
                <span class="spec-value font-mono"
                  >{{ chapters.length }} 章 · {{ totalSectionsCount }} 节</span
                >
              </div>
              <div class="spec-item">
                <span class="spec-label">讲义版本</span>
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
              <div class="spec-item">
                <span class="spec-label">排版引擎</span>
                <span class="spec-value font-mono">Typst {{ lecture.typstVersion || '—' }}</span>
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
                本讲义按章节和小节组织内容。 你可以从目录中选择小节开始阅读。
              </p>
              <div class="guide-note font-mono">
                TIP: 点击下方目录中的任一讲次即可直接进入全屏讲义阅读。
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 知识路线图 -->
      <section class="roadmap-section">
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
            <span class="section-kicker font-mono">SYLLABUS & LECTURES</span>
            <h2 class="section-heading">讲义大纲与章节目录</h2>
          </div>
          <div class="curriculum-actions font-mono">
            <span class="curriculum-stats">
              {{ chapters.length }} 编 · {{ totalSectionsCount }} 讲
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
                <span class="section-count font-mono">{{ chap.sections?.length || 0 }} 讲</span>
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
                    <span class="read-link">进入讲义 →</span>
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

.cover-input {
  display: none;
}
.cover-actions {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 160ms ease;
}
.lecture-header:hover .cover-actions,
.lecture-header:focus-within .cover-actions {
  opacity: 1;
}
.cover-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease;
}
.cover-action:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.cover-action:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
}
.cover-action:disabled {
  cursor: wait;
}
@media (hover: none) {
  .cover-actions {
    opacity: 1;
  }
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lecture-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  line-height: 1.3;
}

.lecture-desc {
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 840px;
  max-height: 120px;
  overflow-y: auto;
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
  border-radius: var(--radius-sm);
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
  border-radius: var(--radius-xs);
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
  border-radius: var(--radius-sm);
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
  border-radius: var(--radius-sm);
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
  border-radius: var(--radius-sm);
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
    gap: 12px;
    padding-bottom: 20px;
  }

  .lecture-title {
    font-size: clamp(20px, 5.5vw, 24px);
    line-height: 1.35;
  }

  .lecture-desc {
    font-size: 13.5px;
    line-height: 1.6;
  }

  .lecture-actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
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
  }

  .chapter-aside {
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

  .entry-title {
    font-size: 13px;
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
  .lecture-header {
    grid-template-columns: 1fr;
  }
  .header-cover {
    grid-column: 1;
    grid-row: 1;
    width: min(180px, 55%);
    justify-self: start;
  }
  .header-copy {
    grid-column: 1;
    grid-row: 2;
  }
  .lecture-actions {
    margin-top: 0;
  }
}
</style>
