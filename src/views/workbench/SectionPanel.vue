<script setup>
import { computed, ref, watch } from 'vue';
import { workbenchApi, readTextFile, titleFromFilename } from '../../api/workbench.js';
import { useForm, useText } from './useForm.js';
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';
import MModal from '../../components/MModal.vue';
import MButton from '../../components/MButton.vue';
import PrereqPicker from './PrereqPicker.vue';
import { Upload, Download } from '@iconoir/vue';
import LectureViewerEmbed from '../../components/LectureViewerEmbed.vue';
import MTabs from '../../components/MTabs.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['changed', 'error', 'saved']);

const { form, fill, dirty, reset, diff, commit } = useForm(['slug', 'tag', 'title', 'summary']);
const source = useText('');

const SOURCE_PLACEHOLDER = [
  '#set page(paper: "a4", margin: 2cm)',
  '#import "@preview/cetz:0.3.1": canvas',
  '',
  '= 小节标题',
  '正文内容'
].join('\n');

const record = ref(null);
const candidates = ref([]);
const prereqs = ref([]);
const prereqBaseline = ref([]);
const loading = ref(true);
const saving = ref(false);

const fileInput = ref(null);
const pendingFile = ref(null);
const importOpen = ref(false);
const renameOnImport = ref(true);

const prereqsDirty = computed(
  () => [...prereqs.value].sort().join(',') !== [...prereqBaseline.value].sort().join(',')
);

// 动画表单与基准状态
const animForm = ref({
  enabled: false,
  title: '',
  cues_str: '[]',
  parts_str: '[]',
  steps_str: '[]',
  scenes_code: ''
});
const animBaseline = ref('');
const activeAnimTab = ref('preview'); // 'preview' | 'scenes' | 'data'

const animDirty = computed(() => {
  return JSON.stringify(animForm.value) !== animBaseline.value;
});

const dirtyAll = computed(() => dirty.value || source.dirty.value || prereqsDirty.value || animDirty.value);

// 构造传递给预览组件的数据模型
const animPreviewData = computed(() => {
  let cues = [], parts = [], steps = [];
  try { cues = JSON.parse(animForm.value.cues_str || '[]'); } catch (e) {}
  try { parts = JSON.parse(animForm.value.parts_str || '[]'); } catch (e) {}
  try { steps = JSON.parse(animForm.value.steps_str || '[]'); } catch (e) {}
  return {
    title: animForm.value.title || form.title || '动画预览',
    cues,
    parts,
    steps,
    scenes_code: animForm.value.scenes_code,
    enabled: animForm.value.enabled
  };
});

const meta = computed(() => {
  if (!record.value) return '';
  const parts = [
    record.value.course_title,
    record.value.chapter_title,
    `hash ${String(record.value.source_hash || '').slice(0, 8) || '--------'}`
  ];
  if (record.value.updated_at) parts.push(formatTime(record.value.updated_at));
  return parts.filter(Boolean).join(' · ');
});

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const load = async () => {
  loading.value = true;
  try {
    const rec = await workbenchApi.sections.get(props.node.id);
    record.value = rec;
    fill(rec);
    source.set(rec.source ?? '');
    prereqs.value = (rec.prereqs ?? []).map(Number);
    prereqBaseline.value = [...prereqs.value];

    const tree = await workbenchApi.courses.tree(rec.course_id);
    const list = [];
    for (const ch of tree.chapters || []) {
      for (const sec of ch.sections || []) {
        if (sec.id !== props.node.id) {
          list.push({
            id: sec.id,
            label: sec.title,
            meta: `${ch.tag || ch.title} · ${sec.slug}`
          });
        }
      }
    }
    candidates.value = list;

    // 加载动画数据
    const anim = await workbenchApi.sections.getAnimation(props.node.id);
    if (anim) {
      animForm.value = {
        enabled: Boolean(anim.enabled),
        title: anim.title || '',
        cues_str: JSON.stringify(anim.cues || [], null, 2),
        parts_str: JSON.stringify(anim.parts || [], null, 2),
        steps_str: JSON.stringify(anim.steps || [], null, 2),
        scenes_code: anim.scenes_code || ''
      };
    } else {
      animForm.value = {
        enabled: false,
        title: '',
        cues_str: '[]',
        parts_str: '[]',
        steps_str: '[]',
        scenes_code: ''
      };
    }
    animBaseline.value = JSON.stringify(animForm.value);
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

const discard = () => {
  reset();
  source.reset();
  prereqs.value = [...prereqBaseline.value];
  if (animBaseline.value) {
    animForm.value = JSON.parse(animBaseline.value);
  }
};

const save = async () => {
  if (saving.value || loading.value) return;
  saving.value = true;
  // 缓存课程标识以供父级刷新树
  const courseId = record.value?.course_id;
  const completed = [];
  try {
    let animation = null;
    if (animDirty.value) {
      const values = {};
      for (const [field, label] of [['cues', '字幕'], ['parts', '大纲'], ['steps', '步骤']]) {
        try {
          values[field] = JSON.parse(animForm.value[`${field}_str`] || '[]');
        } catch {
          throw new Error(`${label}不是合法的 JSON 格式`);
        }
        if (!Array.isArray(values[field])) throw new Error(`${label}必须是数组`);
      }
      animation = {
        enabled: animForm.value.enabled,
        title: animForm.value.title || form.title || '',
        ...values,
        scenes_code: animForm.value.scenes_code || ''
      };
    }
    const patch = diff();
    if (Object.keys(patch).length > 0) {
      record.value = await workbenchApi.sections.update(props.node.id, patch);
      commit();
      completed.push('基本信息');
    }
    if (source.dirty.value) {
      const res = await workbenchApi.sections.setSource(props.node.id, source.state.text);
      record.value = { ...record.value, ...res };
      source.commit();
      completed.push('源码');
    }
    if (prereqsDirty.value) {
      await workbenchApi.sections.setPrereqs(props.node.id, prereqs.value);
      prereqBaseline.value = [...prereqs.value];
      completed.push('前置小节');
    }
    if (animation) {
      await workbenchApi.sections.setAnimation(props.node.id, animation);
      animBaseline.value = JSON.stringify(animForm.value);
      completed.push('动画');
    }
    emit('saved', '小节已保存');
    emit('changed', { scope: 'section', courseId, sectionId: props.node.id, label: form.title });
  } catch (err) {
    if (completed.length) {
      emit('changed', { scope: 'section', courseId, sectionId: props.node.id, label: form.title });
      emit('error', new Error(`已保存${completed.join('、')}，其余内容未保存：${err.message}`));
    } else {
      emit('error', err);
    }
  } finally {
    saving.value = false;
  }
};

const onPick = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await readTextFile(file);
    pendingFile.value = { name: file.name, size: file.size, text };
    importOpen.value = true;
  } catch (err) {
    emit('error', err);
  }
};

const closeImport = () => {
  importOpen.value = false;
  pendingFile.value = null;
};

const runImport = () => {
  if (!pendingFile.value) return;
  source.state.text = pendingFile.value.text;
  if (renameOnImport.value) {
    const next = titleFromFilename(pendingFile.value.name);
    if (next) form.title = next;
  }
  closeImport();
  save();
};

const exportSource = () => {
  const blob = new Blob([source.state.text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${form.slug || 'section'}.typ`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

watch(() => props.node.id, load, { immediate: true });
</script>

<template>
  <WorkbenchPanel
    kind="SECTION"
    :title="form.title || node.label"
    :meta="meta"
    :dirty="dirtyAll"
    :saving="saving"
    @save="save"
    @reset="discard"
  >
    <template #actions>
      <MButton
        variant="ghost"
        size="sm"
        :mono="true"
        @click="exportSource"
      >
        <template #icon>
          <Download width="13" height="13" />
        </template>
        导出
      </MButton>
      <MButton
        variant="secondary"
        size="sm"
        :mono="true"
        @click="fileInput?.click()"
      >
        <template #icon>
          <Upload width="13" height="13" />
        </template>
        导入 .typ
      </MButton>
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept=".typ,.txt,text/plain"
        @change="onPick"
      />
      <slot name="actions" />
    </template>

    <div
      v-if="loading"
      class="wb-empty font-mono"
    >
      加载中...
    </div>

    <template v-else>
      <div class="wb-block">
        <div class="wb-form-grid">
          <MInput
            v-model="form.title"
            label="小节标题"
            placeholder="例如：极限的定义"
          />
          <MInput
            v-model="form.slug"
            label="slug"
            placeholder="L01"
            hint="章节内唯一"
          />
          <MInput
            v-model="form.tag"
            label="标签"
            placeholder="选填"
          />
          <div class="wb-span-2">
            <MTextarea
              v-model="form.summary"
              label="摘要"
              :rows="2"
              placeholder="本小节内容概述"
            />
          </div>
        </div>
      </div>

      <div class="wb-block">
        <div class="wb-block-head">
          <span class="wb-block-title">Typst 源文</span>
          <span class="wb-block-desc font-mono">Ctrl / Cmd + S 保存</span>
        </div>
        <MCodeEditor
          v-model="source.state.text"
          height="56vh"
          :placeholder="SOURCE_PLACEHOLDER"
          @save="save"
        />
      </div>

      <div class="wb-block">
        <div class="wb-block-head">
          <span class="wb-block-title">前置小节</span>
          <span class="wb-block-desc font-mono">建议先学完这些小节</span>
        </div>
        <PrereqPicker
          v-model="prereqs"
          :candidates="candidates"
          placeholder="按小节标题筛选"
        />
      </div>

      <div class="wb-block">
        <div class="wb-block-head">
          <div class="anim-head-left">
            <span class="wb-block-title">配套手绘交互动画</span>
            <label class="anim-toggle">
              <input
                v-model="animForm.enabled"
                type="checkbox"
              />
              <span class="anim-toggle-text font-mono">
                {{ animForm.enabled ? '已开启交互动画' : '未开启（点击开启）' }}
              </span>
            </label>
          </div>
          <div class="anim-head-actions">
            <span class="wb-block-desc font-mono">在小节页面顶部展示手绘白板步骤式动画</span>
          </div>
        </div>

        <div v-if="animForm.enabled" class="anim-body">
          <MTabs
            v-model="activeAnimTab"
            :tabs="[
              { label: '实时预览', value: 'preview' },
              { label: '场景绘制脚本(scenes_code)', value: 'scenes' },
              { label: '数据配置(cues/steps/parts)', value: 'data' }
            ]"
          />

          <!-- Tab 1: 实时预览 -->
          <div v-if="activeAnimTab === 'preview'" class="anim-tab-pane">
            <LectureViewerEmbed
              :active="activeAnimTab === 'preview'"
              :animation="animPreviewData"
              :title="animForm.title || form.title || '动画预览'"
            />
          </div>

          <!-- Tab 2: scenes_code 脚本编辑器 -->
          <div v-show="activeAnimTab === 'scenes'" class="anim-tab-pane">
            <div class="anim-hint font-mono">
              包含页面场景函数 scene({ id, t0, t1, title, draw(t) { ... } }) 与板书 item 声明。
            </div>
            <MCodeEditor
              v-model="animForm.scenes_code"
              :show-preview="false"
              height="50vh"
              placeholder="// 在此处编写或粘贴 scenes 绘图代码&#10;(function() {&#10;  const { C, CT, INK, pr, lin, show, item, mix, scene } = SK;&#10;  // ...&#10;})();"
              @save="save"
            />
          </div>

          <!-- Tab 3: 数据配置 (cues / steps / parts) -->
          <div v-show="activeAnimTab === 'data'" class="anim-tab-pane">
            <div style="margin-bottom: 16px;">
              <MInput
                v-model="animForm.title"
                label="动画自定义标题"
                :placeholder="form.title || '选填，留空默认显示小节标题'"
              />
            </div>

            <div class="anim-json-editors">
              <div class="anim-json-item">
                <MCodeEditor
                  v-model="animForm.parts_str"
                  label="大纲目录 Parts (JSON 数组)"
                  height="260px"
                  :show-preview="false"
                  placeholder='["极限的定义", "左右极限", "海涅定理"]'
                  @save="save"
                />
              </div>

              <div class="anim-json-item">
                <MCodeEditor
                  v-model="animForm.steps_str"
                  label="交互切步 Steps (JSON 数组)"
                  height="360px"
                  :show-preview="false"
                  placeholder='[&#10;  {&#10;    "id": "l03a_seq",&#10;    "steps": [{ "a": 0, "b": 5.2 }]&#10;  }&#10;]'
                  @save="save"
                />
              </div>

              <div class="anim-json-item">
                <MCodeEditor
                  v-model="animForm.cues_str"
                  label="讲解文稿 Cues (JSON 数组)"
                  height="460px"
                  :show-preview="false"
                  placeholder='[&#10;  [0.0, 3.5, "讲解文字第一句"],&#10;  [3.5, 7.2, "第二句"]&#10;]'
                  @save="save"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <MModal
      :open="importOpen"
      title="导入 .typ 覆盖当前源文"
      :desc="pendingFile ? `${pendingFile.name} · ${formatSize(pendingFile.size)}` : ''"
      width="520px"
      confirm-text="覆盖并保存"
      @close="closeImport"
      @confirm="runImport"
    >
      <div class="wb-note">
        当前源文将被文件内容整体替换，保存后写入数据库并刷新 source_hash。
      </div>
      <label class="rename-toggle">
        <input
          v-model="renameOnImport"
          type="checkbox"
        />
        <span>同时用文件名更新小节标题</span>
      </label>
      <pre class="preview">{{ (pendingFile?.text || '').slice(0, 600) }}</pre>
    </MModal>
  </WorkbenchPanel>
</template>

<style scoped>
.hidden-input {
  display: none;
}

.rename-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size);
  color: var(--text-secondary);
  cursor: pointer;
}

.rename-toggle input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-primary);
  cursor: pointer;
}

.preview {
  max-height: 220px;
  overflow: auto;
  padding: 12px 14px;
  /* 预览区容器 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--font-size-smaller);
  line-height: 1.8;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}

.anim-head-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.anim-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.anim-toggle input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--accent-primary, #007acc);
  cursor: pointer;
}

.anim-toggle-text {
  font-size: var(--font-size-smaller);
  color: var(--accent-primary, #007acc);
  font-weight: 500;
}

.anim-head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.anim-body {
  margin-top: 14px;
}

.anim-tab-pane {
  padding-top: 2px;
}

.anim-hint {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  margin-bottom: 8px;
}

.anim-json-editors {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.anim-json-item {
  width: 100%;
}
</style>
