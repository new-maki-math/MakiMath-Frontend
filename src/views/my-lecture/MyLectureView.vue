<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { bookApi } from '../../api/books.js';
import ShelfCompanion from '../../components/app/ShelfCompanion.vue';
import MLectureCover from '../../components/book/MLectureCover.vue';
import MHorizontalShelf from '../../components/display/MHorizontalShelf.vue';
import MDataView from '../../components/feedback/MDataView.vue';
import MEmpty from '../../components/feedback/MEmpty.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MButton from '../../components/form/MButton.vue';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import { lectureLocation } from '../../utils/lecture-route.js';
import { listLocalLectures, validateLocalLectureSlug } from '../../utils/local-lectures.js';
import LectureVersionStack from './LectureVersionStack.vue';

const router = useRouter();
const localLectures = ref([]);
const guideRef = ref(null);
const arrowPath = ref('');
const guidePosition = ref(null);
const guideVisible = ref(true);
let guideObserver;

function updateGuideArrow() {
  const guide = guideRef.value;
  const target = document.querySelector('[data-navigation-id="recom-lecture"]');
  const shelf = guide?.closest('.my-lecture');
  guideVisible.value = window.innerWidth < 768 || !shelf || shelf.scrollTop < 1;
  if (!guide || !target || window.innerWidth < 768) {
    arrowPath.value = '';
    guidePosition.value = null;
    return;
  }
  const to = target.getBoundingClientRect();
  const x = to.right + 24;
  const y = to.top + to.height / 2;
  const startX = x + 100;
  const startY = y + 18;
  guidePosition.value = {
    left: `${startX + 12}px`,
    top: `${startY - 18}px`
  };
  arrowPath.value = `M ${startX} ${startY} C ${startX - 65} ${startY}, ${x + 75} ${y}, ${x} ${y} M ${x + 12} ${y - 6} L ${x} ${y} L ${x + 12} ${y + 6}`;
}

watch(guideRef, async (guide) => {
  guideObserver?.disconnect();
  await nextTick();
  if (!guide) {
    arrowPath.value = '';
    guidePosition.value = null;
    return;
  }
  const target = document.querySelector('[data-navigation-id="recom-lecture"]');
  guideObserver = new ResizeObserver(updateGuideArrow);
  guideObserver.observe(guide);
  const shelf = guide.closest('.shelf-section');
  if (shelf) {
    guideObserver.observe(shelf);
  }
  if (target) {
    guideObserver.observe(target);
  }
  updateGuideArrow();
});
const onlineLectures = ref([]);
const localLectureItems = computed(() =>
  localLectures.value.filter(
    (item) => (item.kind ?? item.revision?.kind ?? 'lecture') === 'lecture'
  )
);
const localWorkbookItems = computed(() =>
  localLectures.value.filter((item) => (item.kind ?? item.revision?.kind) === 'workbook')
);
function onlineBooks(kind) {
  return onlineLectures.value.filter((item) => item.kind === kind);
}
const onlineLectureItems = computed(() => onlineBooks('lecture'));
const onlineWorkbookItems = computed(() => onlineBooks('workbook'));
const shelfBookHeight = ref(0);
const shelfHeightLeader = computed(() => {
  if (localLectureItems.value.length) return 'local-lecture';
  if (onlineLectureItems.value.length) return 'online-lecture';
  if (localWorkbookItems.value.length) return 'local-workbook';
  if (onlineWorkbookItems.value.length) return 'online-workbook';
  return '';
});
function updateShelfBookHeight(shelf, height) {
  if (shelf === shelfHeightLeader.value) shelfBookHeight.value = height;
}
const localLoading = ref(true);
const onlineLoading = ref(false);
const localError = ref('');
const onlineError = ref('');
let localSequence = 0;
let onlineSequence = 0;

async function loadLocal() {
  const sequence = ++localSequence;
  localLoading.value = true;
  localError.value = '';
  try {
    const items = await listLocalLectures();
    if (
      items.some(
        (item) =>
          (item.kind ?? item.revision?.kind) != null &&
          !['lecture', 'workbook'].includes(item.kind ?? item.revision.kind)
      )
    ) {
      throw new Error('图书类型不正确');
    }
    if (sequence === localSequence) {
      localLectures.value = items;
    }
  } catch {
    if (sequence === localSequence) {
      localError.value = '本地讲义加载失败';
    }
  } finally {
    if (sequence === localSequence) {
      localLoading.value = false;
    }
  }
}

async function loadOnline() {
  const sequence = ++onlineSequence;
  onlineLectures.value = [];
  onlineError.value = '';
  if (authStatus.value !== 'authenticated') {
    onlineLoading.value = false;
    return;
  }
  onlineLoading.value = true;
  try {
    const items = await bookApi.owned();
    if (
      !Array.isArray(items) ||
      items.some((item) => !['lecture', 'workbook'].includes(item.kind))
    ) {
      throw new Error('我创作的讲义列表格式错误');
    }
    if (sequence !== onlineSequence) {
      return;
    }
    onlineLectures.value = items.map((item) => {
      if (!Array.isArray(item.versions)) {
        return {
          ...item,
          title: '讲义版本加载失败',
          versions: [],
          versionsError: true
        };
      }
      const draftCount = item.versions.filter((entry) => entry.kind === 'working_draft').length;
      const versions = item.versions.map((entry) => ({
        ...entry,
        invalidDraft:
          (entry.kind === 'working_draft' && (entry.status !== 'draft' || draftCount > 1)) ||
          (entry.kind === 'snapshot' && entry.status === 'draft') ||
          (entry.is_public && (entry.kind !== 'snapshot' || entry.status !== 'approved')) ||
          !['working_draft', 'snapshot'].includes(entry.kind)
      }));
      const draft = versions.find((entry) => entry.kind === 'working_draft' && !entry.invalidDraft);
      const first = draft || versions.find((entry) => !entry.invalidDraft);
      return {
        ...item,
        title: first?.title || '未命名讲义',
        subtitle: draft?.descr || '',
        coverVersion: draft || null,
        versions
      };
    });
  } catch {
    if (sequence === onlineSequence) {
      onlineError.value = '我创作的讲义加载失败';
    }
  } finally {
    if (sequence === onlineSequence) {
      onlineLoading.value = false;
    }
  }
}

function openVersion(lecture, version) {
  if (!lecture.slug || !version.revision_id || version.invalidDraft) {
    notify('讲义或版本标识缺失，无法打开', 'warn');
    return;
  }
  router.push(
    lectureLocation({
      slug: lecture.slug,
      kind: lecture.kind,
      revisionId: version.is_public ? undefined : String(version.revision_id),
      origin: 'my-lecture'
    })
  );
}

function openLecture(source, lecture) {
  if (source === 'local') {
    try {
      validateLocalLectureSlug(lecture.slug);
    } catch (error) {
      notify('本地讲义标识无效，请在讲义工作台修改', 'warn');
      return;
    }
    if (localLectures.value.filter((item) => item.slug === lecture.slug).length !== 1) {
      notify('本地讲义标识重复，请在讲义工作台修改', 'warn');
      return;
    }
    router.push(
      lectureLocation({
        source: 'local',
        slug: lecture.slug,
        kind: lecture.kind ?? lecture.revision?.kind,
        origin: 'my-lecture'
      })
    );
    return;
  }
  if (!lecture.slug) {
    notify('我创作的讲义缺少标识，无法打开', 'warn');
    return;
  }
  router.push(
    lectureLocation({
      slug: lecture.slug,
      origin: 'my-lecture'
    })
  );
}

watch([authStatus, () => currentUser.value?.id], loadOnline, {
  immediate: true
});
onMounted(() => {
  window.addEventListener('resize', updateGuideArrow);
  window.addEventListener('scroll', updateGuideArrow, true);
  loadLocal();
  initAuth();
});
onUnmounted(() => {
  window.removeEventListener('resize', updateGuideArrow);
  window.removeEventListener('scroll', updateGuideArrow, true);
  guideObserver?.disconnect();
  localSequence++;
  onlineSequence++;
});
</script>

<template>
  <main class="my-lecture">
    <div class="shelf-content">
    <section class="shelf-section has-companion">
      <div class="shelf-heading">
        <h1>本地讲义</h1>
        <span v-if="!localLoading && !localError" class="shelf-count">{{ localLectureItems.length }} 本</span>
      </div>
      <MDataView
        :loading="localLoading"
        text="正在加载本地讲义…"
        :animate="!!localLectureItems.length && !localError"
      >
        <p
          v-if="localError"
          class="shelf-message error"
        >
          {{ localError }}
          <MButton
            size="sm"
            variant="ghost"
            @click="loadLocal"
            >重试</MButton
          >
        </p>
        <MEmpty
          v-else-if="!localLectureItems.length"
          class="shelf-empty"
        >
          <div
            ref="guideRef"
            class="shelf-guide"
            :class="{
              'is-positioned': guidePosition,
              'is-hidden': !guideVisible
            }"
            :style="guidePosition"
            :aria-hidden="!guideVisible"
          >
            <svg
              v-if="arrowPath"
              class="shelf-guide-arrow"
              fill="none"
              aria-hidden="true"
            >
              <path :d="arrowPath" />
            </svg>
            <MButton
              variant="ghost"
              :tabindex="guideVisible ? undefined : -1"
              @click="router.push('/recom-lecture')"
              >去图书推荐，添加一本讲义到本地</MButton
            >
          </div>
        </MEmpty>
        <MHorizontalShelf v-else :book-height="shelfHeightLeader === 'local-lecture' ? 0 : shelfBookHeight" @book-height-change="updateShelfBookHeight('local-lecture', $event)">
          <MLectureCover
            v-for="lecture in localLectureItems"
            :key="lecture.id"
            :title="lecture.revision?.title || '未命名讲义'"
            :subtitle="lecture.revision?.subtitle || ''"
            :image="lecture.cover || ''"
            @click="openLecture('local', lecture)"
          />
        </MHorizontalShelf>
      </MDataView>
      <ShelfCompanion class="shelf-widget calendar-widget" mode="calendar" />
      <ShelfCompanion class="saying-note" mode="saying" />
    </section>
    <section
      v-if="authStatus === 'authenticated'"
      class="shelf-section"
    >
      <div class="shelf-heading">
        <h2>我创作的讲义</h2>
        <span v-if="!onlineLoading && !onlineError" class="shelf-count">{{ onlineLectureItems.length }} 本</span>
      </div>
      <MDataView
        :loading="onlineLoading"
        text="正在加载我创作的讲义…"
        :animate="!!onlineLectureItems.length && !onlineError"
      >
        <p
          v-if="onlineError"
          class="shelf-message error"
        >
          {{ onlineError }}
          <MButton
            size="sm"
            variant="ghost"
            @click="loadOnline"
            >重试</MButton
          >
        </p>
        <MEmpty
          v-else-if="!onlineLectureItems.length"
          class="shelf-empty"
        />
        <MHorizontalShelf v-else :book-height="shelfHeightLeader === 'online-lecture' ? 0 : shelfBookHeight" @book-height-change="updateShelfBookHeight('online-lecture', $event)">
          <LectureVersionStack
            v-for="lecture in onlineLectureItems"
            :key="lecture.id"
            :lecture="lecture"
            @open="openVersion"
            @retry="loadOnline"
          />
        </MHorizontalShelf>
      </MDataView>
    </section>
    <section class="shelf-section">
      <div class="shelf-heading">
        <h2>本地题目册</h2>
        <span v-if="!localLoading && !localError" class="shelf-count">{{ localWorkbookItems.length }} 本</span>
      </div>
      <MDataView
        :loading="localLoading"
        text="正在加载本地题目册…"
      >
        <p
          v-if="localError"
          class="shelf-message error"
        >
          {{ localError }}
        </p>
        <MEmpty
          v-else-if="!localWorkbookItems.length"
          class="shelf-empty"
        />
        <MHorizontalShelf v-else :book-height="shelfHeightLeader === 'local-workbook' ? 0 : shelfBookHeight" @book-height-change="updateShelfBookHeight('local-workbook', $event)">
          <MLectureCover
            v-for="book in localWorkbookItems"
            :key="book.id"
            :title="book.revision?.title || '未命名题目册'"
            :subtitle="book.revision?.subtitle || ''"
            :image="book.cover || ''"
            @click="openLecture('local', book)"
          />
        </MHorizontalShelf>
      </MDataView>
    </section>
    <section
      v-if="authStatus === 'authenticated'"
      class="shelf-section"
    >
      <div class="shelf-heading">
        <h2>我创作的题目册</h2>
        <span v-if="!onlineLoading && !onlineError" class="shelf-count">{{ onlineWorkbookItems.length }} 本</span>
      </div>
      <MDataView
        :loading="onlineLoading"
        text="正在加载我创作的题目册…"
      >
        <p
          v-if="onlineError"
          class="shelf-message error"
        >
          {{ onlineError }}
        </p>
        <MEmpty
          v-else-if="!onlineWorkbookItems.length"
          class="shelf-empty"
        />
        <MHorizontalShelf v-else :book-height="shelfHeightLeader === 'online-workbook' ? 0 : shelfBookHeight" @book-height-change="updateShelfBookHeight('online-workbook', $event)">
          <LectureVersionStack
            v-for="book in onlineWorkbookItems"
            :key="book.id"
            :lecture="book"
            @open="openVersion"
            @retry="loadOnline"
          />
        </MHorizontalShelf>
      </MDataView>
    </section>
    </div>
  </main>
</template>

<style scoped>
.my-lecture {
  display: flex;
  flex: 1;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: clamp(24px, 3vw, 40px);
  padding-top: 24px;
  color: var(--text-primary);
}
.shelf-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.shelf-section {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 220px;
}
.shelf-section::after {
  content: '';
  display: block;
  flex: none;
  height: 10px;
  margin-inline: -12px;
  border-top: 2px solid color-mix(in srgb, var(--bg-elevated) 55%, var(--shelf-face));
  border-bottom: 1px solid var(--shelf-edge);
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--shelf-face);
  box-shadow:
    inset 0 -2px 0 color-mix(in srgb, var(--shelf-edge) 45%, transparent),
    0 4px 8px var(--shadow-color-subtle);
}
.shelf-section.has-companion {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
  grid-template-rows: auto 1fr auto;
  column-gap: clamp(24px, 3vw, 40px);
}
.has-companion .shelf-heading {
  grid-column: 1;
}
.has-companion :deep(.m-data-view) {
  grid-column: 1;
  align-self: end;
  min-width: 0;
}
.has-companion .shelf-widget {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: start;
  padding: 0 0 18px;
}
.has-companion .calendar-widget {
  align-self: end;
  padding-bottom: 0;
}
.saying-note {
  position: absolute;
  z-index: 1;
  top: calc(100% + 20px);
  right: min(170px, 50%);
  width: max-content;
  max-width: min(340px, 100%);
  padding: 0;
  transform: translateX(50%);
}
.saying-note::before,
.saying-note::after {
  content: '';
  position: absolute;
  top: -24px;
  width: 1px;
  height: 24px;
  background: var(--shelf-edge);
}
.saying-note::before { left: 24%; }
.saying-note::after { right: 24%; }
.saying-note :deep(.saying) {
  min-height: 0;
  box-sizing: border-box;
  padding: 12px 14px;
  overflow: visible;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--calendar-paper) 65%, var(--calendar-band));
  box-shadow:
    1px 0 3px var(--shadow-color-subtle),
    0 3px 8px var(--shadow-color-subtle);
}
.saying-note :deep(.saying)::before,
.saying-note :deep(.saying)::after {
  content: '';
  position: absolute;
  top: -3px;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--shelf-edge);
}
.saying-note :deep(.saying)::before { left: calc(24% - 3px); }
.saying-note :deep(.saying)::after { right: calc(24% - 3px); }
.saying-note :deep(.saying p) {
  margin: 0;
  font-size: var(--font-size);
}
.saying-note :deep(.saying-mark) {
  display: none;
}
.has-companion::after {
  grid-column: 1 / -1;
}
@media (max-width: 1100px) {
  .shelf-section.has-companion {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
  }
  .has-companion .shelf-widget {
    grid-column: 1;
    grid-row: auto;
    width: min(100%, 340px);
    padding: 16px 0;
  }
  .saying-note {
    right: auto;
    left: min(170px, 50%);
    transform: translateX(-50%);
  }
}
@media (max-width: 767px) {
  .has-companion .calendar-widget,
  .saying-note {
    display: none;
  }
}
.shelf-section :deep(.shelf-frame) {
  flex: 0 0 275px;
}
.shelf-section :deep(.m-data-view) {
  min-height: 275px;
}
.shelf-section :deep(.horizontal-shelf) {
  padding-bottom: 0;
}
.shelf-section :deep(.horizontal-shelf .lecture-cover),
.shelf-section :deep(.horizontal-shelf .version-stack) {
  max-height: 275px;
}
.shelf-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.shelf-heading::before {
  content: '';
  align-self: stretch;
  width: 3px;
  border-radius: var(--radius-full);
  background: var(--accent-primary);
}
.shelf-count {
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  font-weight: var(--font-weight-regular);
  white-space: nowrap;
}
.shelf-empty {
  flex: 1;
}
.shelf-guide {
  position: relative;
  opacity: 1;
  transition: opacity 180ms ease;
}
.shelf-guide.is-hidden {
  opacity: 0;
  pointer-events: none;
}
.shelf-guide.is-positioned {
  position: fixed;
  z-index: 21;
}
.shelf-guide-arrow {
  position: fixed;
  inset: 0;
  z-index: 20;
  width: 100vw;
  height: 100vh;
  color: var(--text-muted);
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
h1,
h2 {
  flex: none;
  margin: 0;
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}
.shelf-message {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.shelf-message.error {
  color: var(--tag-red);
}
@media (max-width: 480px) {
  .my-lecture {
    gap: 28px;
    padding: 20px 20px 28px;
  }
  .shelf-content {
    gap: 20px;
  }
  .shelf-section :deep(.shelf-frame) {
    flex-basis: 255px;
  }
  .shelf-section :deep(.m-data-view) {
    min-height: 255px;
  }
  .shelf-section :deep(.horizontal-shelf .lecture-cover),
  .shelf-section :deep(.horizontal-shelf .version-stack) {
    max-height: 255px;
  }
  .shelf-guide-arrow {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .shelf-guide {
    transition: none;
  }
}
</style>
