<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import MButton from '../../../components/form/MButton.vue';
import MCheckbox from '../../../components/form/MCheckbox.vue';
import MRadio from '../../../components/form/MRadio.vue';
import MSelect from '../../../components/form/MSelect.vue';
import MModal from '../../../components/overlay/MModal.vue';
import { createPrintFrame } from './create-print-frame.js';
import { prepareLecturePrint, verifyLecturePrint } from './prepare-lecture-print.js';

const props = defineProps({
  open: Boolean,
  context: {
    type: Object,
    required: true
  },
  chapters: {
    type: Array,
    default: () => []
  }
});
const emit = defineEmits(['close']);
const scope = ref('lecture');
const theme = ref('light');
const hideSectionTitles = ref(false);
const selectedChapter = ref('');
const selectedSection = ref('');
const chapterOptions = computed(() => props.chapters.filter((chapter) => chapter.sections?.length));
const sectionOptions = computed(
  () =>
    chapterOptions.value.find((chapter) => chapter.slug === selectedChapter.value)?.sections || []
);
const chapterSelectOptions = computed(() =>
  chapterOptions.value.map((chapter) => ({
    value: chapter.slug,
    label: chapter.title
  }))
);
const sectionSelectOptions = computed(() =>
  sectionOptions.value.map((section) => ({
    value: section.slug,
    label: section.title
  }))
);
const busy = ref(false);
const message = ref('');
const error = ref('');
const ready = ref(false);
const diagnostics = ref([]);
let sequence = 0;
let prepared = null;
let output = null;
let pending = null;

function clear() {
  sequence++;
  output?.dispose();
  output = null;
  prepared = null;
  pending = null;
  diagnostics.value = [];
  ready.value = false;
  busy.value = false;
  message.value = '';
  error.value = '';
}
function close() {
  clear();
  emit('close');
}
watch(
  () => props.open,
  (open) => {
    if (!open) {
      clear();
    } else {
      selectedChapter.value = chapterOptions.value[0]?.slug || '';
    }
  }
);
watch(selectedChapter, () => {
  selectedSection.value = sectionOptions.value[0]?.slug || '';
});
watch([scope, theme, hideSectionTitles, selectedChapter, selectedSection], clear);
watch(
  () => props.context,
  () => {
    if (props.open) {
      close();
    }
  }
);
onBeforeUnmount(clear);

async function prepare() {
  clear();
  const current = sequence;
  const context = {
    ...props.context,
    chapterSlug: selectedChapter.value,
    sectionSlug: selectedSection.value
  };
  const ensureCurrent = () => {
    if (current !== sequence) {
      throw new Error('打印准备已取消');
    }
  };
  const progress = (value) => {
    if (current === sequence) {
      message.value = value;
    }
  };
  busy.value = true;
  message.value = '正在读取讲义目录';
  try {
    const result = await prepareLecturePrint(context, scope.value, ensureCurrent, progress);
    ensureCurrent();
    if (result.diagnostics.length) {
      diagnostics.value = result.diagnostics;
      pending = {
        result,
        context
      };
      message.value = '';
      return;
    }
    await renderPrepared(result, context, ensureCurrent, progress);
  } catch (failure) {
    if (current === sequence) {
      message.value = '';
      error.value =
        failure.status === 429
          ? '请求过于频繁，已停止准备。请稍后重试，或选择较小的打印范围。'
          : failure.status === 409
            ? '讲义版本已变化，请重新准备。'
            : failure.message || '打印准备失败，请重试';
    }
  } finally {
    if (current === sequence) {
      busy.value = false;
    }
  }
}
async function renderPrepared(result, context, ensureCurrent, progress) {
  const frame = await createPrintFrame(result, theme.value, ensureCurrent, progress, {
    hideSectionTitles: hideSectionTitles.value,
    scope: scope.value
  });
  try {
    ensureCurrent();
  } catch (failure) {
    frame.dispose();
    throw failure;
  }
  output = frame;
  prepared = {
    context,
    version: result.version
  };
  ready.value = true;
  pending = null;
  diagnostics.value = [];
  message.value = '准备完成，请在打印窗口选择另存为 PDF';
}
async function continueWithDiagnostics() {
  if (!pending || busy.value) {
    return;
  }
  const current = sequence;
  const { result, context } = pending;
  const ensureCurrent = () => {
    if (current !== sequence) {
      throw new Error('打印准备已取消');
    }
  };
  const progress = (value) => {
    if (current === sequence) {
      message.value = value;
    }
  };
  busy.value = true;
  error.value = '';
  try {
    await verifyLecturePrint(context, result.version, ensureCurrent);
    ensureCurrent();
    await renderPrepared(result, context, ensureCurrent, progress);
  } catch (failure) {
    if (current === sequence) {
      pending = null;
      diagnostics.value = [];
      message.value = '';
      error.value = failure.message || '打印准备失败，请重试';
    }
  } finally {
    if (current === sequence) {
      busy.value = false;
    }
  }
}

async function print() {
  if (!output || !prepared || busy.value) {
    return;
  }
  const current = sequence;
  const ensureCurrent = () => {
    if (current !== sequence) {
      throw new Error('打印准备已取消');
    }
  };
  busy.value = true;
  error.value = '';
  try {
    await verifyLecturePrint(prepared.context, prepared.version, ensureCurrent);
    ensureCurrent();
    output.frame.contentWindow.focus();
    output.frame.contentWindow.print();
  } catch (failure) {
    if (current === sequence) {
      error.value = failure.message || '无法打开打印窗口';
      ready.value = false;
    }
  } finally {
    if (current === sequence) {
      busy.value = false;
    }
  }
}
</script>

<template>
  <MModal
    :open="open"
    title="打印讲义"
    width="460px"
    hide-footer
    show-close
    @close="close"
  >
    <fieldset :disabled="busy">
      <legend>打印范围</legend>
      <MRadio
        v-model="scope"
        name="print-scope"
        value="section"
        >指定小节</MRadio
      >
      <MRadio
        v-model="scope"
        name="print-scope"
        value="chapter"
        >指定章节</MRadio
      >
      <MRadio
        v-model="scope"
        name="print-scope"
        value="lecture"
        >整本讲义</MRadio
      >
    </fieldset>
    <MSelect
      v-if="scope !== 'lecture'"
      v-model="selectedChapter"
      class="print-select"
      label="章节"
      :options="chapterSelectOptions"
      :disabled="busy"
    />
    <MSelect
      v-if="scope === 'section'"
      v-model="selectedSection"
      class="print-select"
      label="小节"
      :options="sectionSelectOptions"
      :disabled="busy"
    />
    <fieldset :disabled="busy">
      <legend>页面主题</legend>
      <MRadio
        v-model="theme"
        name="print-theme"
        value="light"
        >浅色</MRadio
      >
      <MRadio
        v-model="theme"
        name="print-theme"
        value="dark"
        >深色</MRadio
      >
    </fieldset>
    <MCheckbox
      v-model="hideSectionTitles"
      :disabled="busy"
      >不显示系统添加的小节标题</MCheckbox
    >
    <p
      v-if="message"
      class="print-message"
      role="status"
    >
      {{ message }}
    </p>
    <p
      v-if="theme === 'dark'"
      class="print-message"
    >
      深色打印时请在浏览器设置中启用背景图形。
    </p>
    <p
      v-if="error"
      class="print-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div
      v-if="diagnostics.length"
      class="print-diagnostics"
      role="alert"
    >
      <p>
        发现 {{ diagnostics.length }} 处 Typst
        解析错误。继续打印时，无法解析的内容会按阅读页的方式显示，可能影响正文和引用的完整性。
      </p>
      <ul>
        <li
          v-for="(item, index) in diagnostics"
          :key="index"
        >
          {{ item.label }} · 第 {{ item.line }} 行第 {{ item.column }} 列：{{ item.message }}
        </li>
      </ul>
    </div>
    <div class="print-actions">
      <MButton
        variant="ghost"
        @click="close"
        >{{ busy ? '取消准备' : '取消' }}</MButton
      >
      <MButton
        v-if="diagnostics.length"
        :disabled="busy"
        @click="continueWithDiagnostics"
        >继续准备打印</MButton
      >
      <MButton
        v-else-if="!ready"
        :disabled="busy"
        @click="prepare"
        >{{ busy ? '准备中…' : '准备打印' }}</MButton
      >
      <MButton
        v-else
        :disabled="busy"
        @click="print"
        >打开打印窗口</MButton
      >
    </div>
  </MModal>
</template>

<style scoped>
fieldset {
  border: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
legend {
  margin-bottom: 10px;
  color: var(--text-secondary);
}
label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.print-select {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  color: var(--text-secondary);
}
select {
  padding: 8px;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.print-message {
  color: var(--text-secondary);
}
.print-error {
  color: var(--status-error);
  white-space: pre-wrap;
}
.print-diagnostics {
  color: var(--status-error);
  font-size: var(--font-size-smaller);
  line-height: 1.5;
}
.print-diagnostics p {
  margin: 0 0 8px;
}
.print-diagnostics ul {
  max-height: min(32vh, 240px);
  overflow-y: auto;
  margin: 0;
  padding-left: 20px;
}
.print-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
