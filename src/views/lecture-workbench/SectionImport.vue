<script setup>
import { onUnmounted, ref, watch } from 'vue';

import MFilePicker from '../../components/MFilePicker.vue';
import MInput from '../../components/MInput.vue';
import MModal from '../../components/MModal.vue';
import { notify } from '../../components/MNotice.vue';

const chapter = defineModel('chapter', {
  type: Object,
  required: true
});

const props = defineProps({
  editable: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['imported']);
const open = ref(false);
const reading = ref(false);
const items = ref([]);
let sequence = 0;
let pickerChapter = null;

function close() {
  open.value = false;
  items.value = [];
}

watch(
  () => chapter.value,
  () => {
    if (open.value || reading.value) {
      notify('章节已变化，请重新选择要导入的文件', 'warn');
    }
    sequence++;
    reading.value = false;
    close();
  }
);
onUnmounted(() => {
  sequence++;
});

function selectFiles() {
  if (!props.editable || props.saving || reading.value) {
    return;
  }
  pickerChapter = chapter.value;
}

async function readFiles(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length || !props.editable || props.saving) {
    return;
  }
  if (pickerChapter !== chapter.value) {
    notify('章节已变化，请重新选择要导入的文件', 'warn');
    return;
  }
  if (files.some((file) => !/\.typ$/i.test(file.name))) {
    notify('请选择 .typ 文件', 'warn');
    return;
  }
  const current = ++sequence;
  const targetChapter = chapter.value;
  reading.value = true;
  try {
    const results = [];
    for (const file of files) {
      const name = file.name.replace(/\.typ$/i, '').trim();
      let source;
      try {
        source = new TextDecoder('utf-8', {
          fatal: true
        }).decode(await file.arrayBuffer());
      } catch {
        throw new Error(`无法读取 ${file.name}，请确认文件为 UTF-8 编码`);
      }
      if (current !== sequence || targetChapter !== chapter.value) {
        return;
      }
      results.push({
        key: crypto.randomUUID(),
        filename: file.name,
        title: name,
        slug: name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        source
      });
    }
    if (current !== sequence || targetChapter !== chapter.value) {
      return;
    }
    items.value = results;
    open.value = true;
  } catch (err) {
    if (current === sequence) {
      notify(err.message || '读取文件失败', 'error');
    }
  } finally {
    if (current === sequence) {
      reading.value = false;
    }
  }
}

function confirmImport() {
  if (!props.editable || props.saving || !items.value.length) {
    return;
  }
  const slugs = new Set(chapter.value.sections.map((section) => section.slug.trim()));
  const sections = [];
  for (const item of items.value) {
    const title = item.title.trim();
    const slug = item.slug.trim();
    if (!title || !slug) {
      notify(`请填写 ${item.filename} 的小节标题和小节标识`, 'warn');
      return;
    }
    if (slugs.has(slug)) {
      notify(`小节标识 ${slug} 与章节内已有或待导入的小节重复`, 'warn');
      return;
    }
    slugs.add(slug);
    sections.push({
      occurrence_id: crypto.randomUUID(),
      title,
      slug,
      tag: '',
      summary: '',
      source: item.source
    });
  }
  for (const section of sections) {
    chapter.value.sections.push(section);
  }
  emit('imported');
  close();
  notify(`已添加 ${sections.length} 个小节，请保存讲义`, 'success');
}
</script>

<template>
  <div
    v-if="editable"
    class="wb-block section-import"
  >
    <div class="wb-block-head"><span class="wb-block-title">批量导入小节</span></div>
    <MFilePicker
      title="Typst 文件"
      :detail="reading ? '正在读取文件…' : '可选择一个或多个 .typ 文件，导入后请保存讲义'"
      accept=".typ"
      multiple
      :disabled="saving || reading"
      @choose="selectFiles"
      @change="readFiles"
    />
  </div>
  <MModal
    :open="open"
    title="批量导入小节"
    desc="请确认每个文件的小节标题和小节标识，导入后保存讲义生效。"
    width="720px"
    confirm-text="添加小节"
    :busy="saving || !editable"
    @close="close"
    @confirm="confirmImport"
  >
    <div class="import-list">
      <div
        v-for="item in items"
        :key="item.key"
        class="import-item"
      >
        <div
          class="import-filename"
          :title="item.filename"
        >
          {{ item.filename }}
        </div>
        <div class="import-fields">
          <MInput
            v-model="item.title"
            label="小节标题"
            required
          />
          <MInput
            v-model="item.slug"
            label="小节标识"
            hint="章节内唯一"
            required
          />
        </div>
      </div>
    </div>
  </MModal>
</template>

<style scoped>
.import-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.import-item {
  min-width: 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-subtle);
}
.import-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}
.import-filename {
  margin-bottom: 10px;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.import-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 600px) {
  .import-fields {
    grid-template-columns: 1fr;
  }
}
</style>
