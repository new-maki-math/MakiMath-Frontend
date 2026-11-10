<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MLoadingMask from '../../components/feedback/MLoadingMask.vue';
import MButton from '../../components/form/MButton.vue';
import { cacheAnimationFont, prepareAnimationCDNStyles } from '../../utils/animation-cdn-cache.js';
import {
  buildAnimationDocument,
  buildStandardAnimationDocument,
  combineAnimationAssets,
  listAnimationCDNStyles,
  listLegacyAnimationCDNStyles,
  parseAnimationAssets,
  parseAnimationPackage
} from '../../utils/animation-package.js';

const props = defineProps({
  source: {
    type: String,
    required: true
  },
  base: {
    type: Object,
    default: null
  },
  loadBase: {
    type: Function,
    default: null
  }
});
const packageFrame = ref(null);
const packageProgress = ref(null);
const playbackError = ref('');
const aspectRatio = ref('16 / 9');
const documentSource = ref('');
const loading = ref(true);
const retryKey = ref(0);
let loadSequence = 0;
let cdnFonts = new Set();
let cdnScope = '';

async function loadAnimation() {
  const sequence = ++loadSequence;
  loading.value = true;
  documentSource.value = '';
  packageProgress.value = null;
  playbackError.value = '';
  cdnFonts = new Set();
  cdnScope = '';
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (sequence !== loadSequence) {
    return;
  }
  try {
    const base = props.loadBase ? await props.loadBase() : props.base;
    if (sequence !== loadSequence) {
      return;
    }
    const assets = parseAnimationAssets(props.source);
    if (assets?.files && Object.hasOwn(assets.files, 'animation.json')) {
      const urls = listAnimationCDNStyles(base, assets);
      const cdn = urls.length ? await prepareAnimationCDNStyles(urls) : null;
      if (sequence !== loadSequence) {
        return;
      }
      cdnFonts = cdn?.fonts || new Set();
      cdnScope = cdn?.scope || '';
      documentSource.value = buildStandardAnimationDocument(base, assets, cdn);
    } else {
      const legacy = parseAnimationPackage(props.source) || combineAnimationAssets(base, assets);
      const urls = listLegacyAnimationCDNStyles(legacy);
      const cdn = urls.length ? await prepareAnimationCDNStyles(urls) : null;
      if (sequence !== loadSequence) {
        return;
      }
      cdnFonts = cdn?.fonts || new Set();
      cdnScope = cdn?.scope || '';
      documentSource.value = buildAnimationDocument(legacy, cdn);
    }
  } catch (error) {
    if (sequence === loadSequence) {
      playbackError.value = error.message || '无法读取动画资源';
      loading.value = false;
    }
  }
}
function sendCommand(action) {
  const target = packageFrame.value?.contentWindow;
  target?.postMessage(
    {
      type: 'maki-animation-command',
      action
    },
    '*'
  );
  target?.postMessage(
    {
      type: action
    },
    '*'
  );
}
function receive(event) {
  if (event.source !== packageFrame.value?.contentWindow) {
    return;
  }
  if (event.data?.type === 'maki-animation-font-resource') {
    if (typeof event.data.url === 'string') {
      cacheAnimationFont(event.data.url, cdnFonts, cdnScope);
    }
    return;
  }
  if (!['lecture-step', 'maki-animation-state'].includes(event.data?.type)) {
    return;
  }
  if (event.data.error) {
    playbackError.value = String(event.data.error);
    loading.value = false;
    return;
  }
  const { page, step, steps, pages, width, height } = event.data;
  if (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= 4096 &&
    height <= 4096
  ) {
    aspectRatio.value = `${width} / ${height}`;
  }
  if ([page, step, steps, pages].every((value) => Number.isSafeInteger(value) && value > 0)) {
    packageProgress.value = {
      page,
      step,
      steps,
      pages
    };
    playbackError.value = '';
    loading.value = false;
  }
}
watch([() => props.source, () => props.base, () => props.loadBase, retryKey], loadAnimation, {
  immediate: true
});
onMounted(() => window.addEventListener('message', receive));
onBeforeUnmount(() => {
  loadSequence++;
  window.removeEventListener('message', receive);
});
</script>

<template>
  <section
    class="section-animation"
    aria-label="小节分步动画"
  >
    <div
      class="animation-stage"
      :style="{
        aspectRatio
      }"
    >
      <iframe
        v-if="documentSource"
        ref="packageFrame"
        class="course-frame"
        title="小节动画"
        :srcdoc="documentSource"
        sandbox="allow-scripts"
        @error="
          playbackError = '动画加载失败';
          loading = false;
        "
      ></iframe>
      <MLoadingMask
        :visible="loading"
        text="正在加载动画…"
        :z-index="1"
      />
      <div
        v-if="playbackError"
        class="animation-error"
        role="alert"
      >
        <p>动画无法显示：{{ playbackError }}</p>
        <MButton
          size="sm"
          @click="retryKey++"
          >重试</MButton
        >
      </div>
    </div>
    <div
      v-if="documentSource && !playbackError"
      class="animation-controls"
    >
      <MButton
        size="sm"
        :disabled="loading"
        @click="sendCommand('prev')"
        >上一步</MButton
      >
      <span
        v-if="packageProgress"
        class="animation-progress"
        >{{ packageProgress.page }} / {{ packageProgress.pages }} 页 · {{ packageProgress.step }} /
        {{ packageProgress.steps }} 步</span
      >
      <MButton
        size="sm"
        variant="primary"
        :disabled="loading"
        @click="sendCommand('next')"
        >下一步</MButton
      >
    </div>
  </section>
</template>

<style scoped>
.section-animation {
  overflow: hidden;
  margin-bottom: 24px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
}
.animation-stage {
  position: relative;
  width: 100%;
  min-height: 180px;
  background: var(--bg-surface);
}
.course-frame {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--animation-stage-bg);
}
.animation-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  flex-wrap: wrap;
}
.animation-progress {
  min-width: 64px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  text-align: center;
}
.animation-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  text-align: center;
  overflow-wrap: anywhere;
  background: var(--bg-surface);
}
.animation-error p {
  margin: 0;
}
</style>
