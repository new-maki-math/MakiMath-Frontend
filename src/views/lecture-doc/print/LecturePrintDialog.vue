<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import MButton from '../../../components/MButton.vue';
import MCheckbox from '../../../components/MCheckbox.vue';
import MModal from '../../../components/MModal.vue';
import MRadio from '../../../components/MRadio.vue';
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
const busy = ref(false);
const message = ref('');
const error = ref('');
const ready = ref(false);
let sequence = 0;
let prepared = null;
let output = null;

function clear() {
  sequence++;
  output?.dispose();
  output = null;
  prepared = null;
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
    const frame = await createPrintFrame(result, theme.value, ensureCurrent, progress, {
      hideSectionTitles: hideSectionTitles.value,
      scope: scope.value
    });
    ensureCurrent();
    output = frame;
    prepared = {
 context,
version: result.version 
};
    ready.value = true;
    message.value = '准备完成，请在打印窗口选择另存为 PDF';
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
      <MRadio v-model="scope"
name="print-scope"
value="section">指定小节</MRadio>
      <MRadio v-model="scope"
name="print-scope"
value="chapter">指定章节</MRadio>
      <MRadio v-model="scope"
name="print-scope"
value="lecture">整本讲义</MRadio>
    </fieldset>
    <label
      v-if="scope !== 'lecture'"
      class="print-select"
      >章节
      <select
        v-model="selectedChapter"
        :disabled="busy"
      >
        <option
          v-for="chapter in chapterOptions"
          :key="chapter.slug"
          :value="chapter.slug"
        >
          {{ chapter.title }}
        </option>
      </select>
    </label>
    <label
      v-if="scope === 'section'"
      class="print-select"
      >小节
      <select
        v-model="selectedSection"
        :disabled="busy"
      >
        <option
          v-for="section in sectionOptions"
          :key="section.slug"
          :value="section.slug"
        >
          {{ section.title }}
        </option>
      </select>
    </label>
    <fieldset :disabled="busy">
      <legend>页面主题</legend>
      <MRadio v-model="theme"
name="print-theme"
value="light">浅色</MRadio>
      <MRadio v-model="theme"
name="print-theme"
value="dark">深色</MRadio>
    </fieldset>
    <MCheckbox v-model="hideSectionTitles"
:disabled="busy">不显示系统添加的小节标题</MCheckbox>
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
    <div class="print-actions">
      <MButton
        variant="ghost"
        @click="close"
        >{{ busy ? '取消准备' : '取消' }}</MButton
      >
      <MButton
        v-if="!ready"
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
  border-radius: var(--radius-xs);
}
.print-message {
  color: var(--text-secondary);
}
.print-error {
  color: var(--status-danger, #df6570);
  white-space: pre-wrap;
}
.print-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
