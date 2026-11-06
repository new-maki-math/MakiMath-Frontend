<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { lectureApi } from '../../api/lectures.js';
import MButton from '../../components/MButton.vue';
import MDataView from '../../components/MDataView.vue';
import MEmpty from '../../components/MEmpty.vue';
import MHorizontalShelf from '../../components/MHorizontalShelf.vue';
import MLectureCover from '../../components/MLectureCover.vue';
import { notify } from '../../components/MNotice.vue';
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
    const items = await lectureApi.owned();
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
  if (lecture.kind === 'workbook') {
    notify('题目册阅读暂未开放', 'info');
    return;
  }
  if (!lecture.slug || !version.revision_id || version.invalidDraft) {
    notify('讲义或版本标识缺失，无法打开', 'warn');
    return;
  }
  router.push(
    lectureLocation({
      slug: lecture.slug,
      revisionId: version.is_public ? undefined : String(version.revision_id),
      origin: 'my-lecture'
    })
  );
}

function openLecture(source, lecture) {
  if (source === 'local') {
    if ((lecture.kind ?? lecture.revision?.kind) === 'workbook') {
      notify('题目册阅读暂未开放', 'info');
      return;
    }
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
    <section class="shelf-section">
      <h1>本地讲义</h1>
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
        <MHorizontalShelf v-else>
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
    </section>
    <section
      v-if="authStatus === 'authenticated'"
      class="shelf-section"
    >
      <h2>我创作的讲义</h2>
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
        <MHorizontalShelf v-else>
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
      <h2>本地题目册</h2>
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
        <MHorizontalShelf v-else>
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
      <h2>我创作的题目册</h2>
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
        <MHorizontalShelf v-else>
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
  </main>
</template>

<style scoped>
.my-lecture {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: clamp(20px, 3vh, 36px);
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px clamp(20px, 3vw, 40px) clamp(20px, 3vw, 40px);
  color: var(--text-primary);
}
.shelf-section {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 220px;
}
.shelf-section :deep(.horizontal-shelf) {
  flex: 0 0 255px;
}
.shelf-section + .shelf-section {
  padding-top: clamp(20px, 3vh, 36px);
  border-top: 1px solid var(--border-subtle);
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
  margin: 0 0 16px;
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
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
    padding: 14px 16px 20px;
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
