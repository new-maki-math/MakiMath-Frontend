<script setup>
import { computed, ref } from 'vue';
import { adminApi, COURSE_STATUSES } from '../../api/admin.js';
import './admin.css';
import AdminTree from './AdminTree.vue';
import CategoryPanel from './CategoryPanel.vue';
import CoursePanel from './CoursePanel.vue';
import ChapterPanel from './ChapterPanel.vue';
import SectionPanel from './SectionPanel.vue';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';
import MModal from '../../components/MModal.vue';
import { Trash, FolderPlus } from '@iconoir/vue';

const PANELS = {
  category: CategoryPanel,
  course: CoursePanel,
  chapter: ChapterPanel,
  section: SectionPanel
};

const CHILD_TYPE = { category: 'course', course: 'chapter', chapter: 'section' };
const KIND_LABEL = { category: '分类', course: '课程', chapter: '章节', section: '小节' };

const treeRef = ref(null);
const selected = ref(null);

const notice = ref(null);
let noticeTimer = null;

const createOpen = ref(false);
const creating = ref(false);
const createParent = ref(null);
const createForm = ref({ title: '', slug: '', tag: '', status: 'draft' });

const deleteTarget = ref(null);
const deleting = ref(false);

const selectedKey = computed(() =>
  selected.value ? `${selected.value.type}:${selected.value.id}` : ''
);

const panelComponent = computed(() =>
  selected.value ? PANELS[selected.value.type] : null
);

const createKind = computed(() =>
  createParent.value ? CHILD_TYPE[createParent.value.type] : 'category'
);

const createTitle = computed(() => `新建${KIND_LABEL[createKind.value]}`);

const createDesc = computed(() =>
  createParent.value ? `归属于「${createParent.value.label}」` : '新建顶层分类'
);

const createTitleLabel = computed(
  () =>
    ({
      category: '分类名称',
      course: '课程名称',
      chapter: '章节名称',
      section: '小节标题'
    })[createKind.value]
);

// 只有章节和小节在表里有 tag 字段
const createHasTag = computed(
  () => createKind.value === 'chapter' || createKind.value === 'section'
);

const deleteWarning = computed(() => {
  const target = deleteTarget.value;
  if (!target) return '';
  if (target.type === 'category') {
    return '分类下若仍有课程，数据库外键会拒绝删除。请先删除或移走其下的课程。';
  }
  if (target.type === 'course') {
    return '该课程下的所有章节、小节与资源会一并级联删除，且不可撤销。';
  }
  if (target.type === 'chapter') {
    return '该章节下的所有小节会一并级联删除，且不可撤销。';
  }
  return '该小节的 Typst 源文会一并删除，且不可撤销。';
});

const notify = (text, kind = 'ok') => {
  if (!text) return;
  notice.value = { text, kind };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = null;
  }, 3200);
};

const handleError = (err) => notify(err?.message || String(err), 'error');

const selectNode = (node) => {
  selected.value = {
    type: node.type,
    id: node.id,
    label: node.label ?? node.title ?? ''
  };
};

const openCreate = (parent) => {
  createParent.value = parent;
  createForm.value = { title: '', slug: '', tag: '', status: 'draft' };
  createOpen.value = true;
};

const createChild = async () => {
  const parent = createParent.value;
  const kind = createKind.value;
  const payload = createForm.value;

  if (!payload.title.trim()) {
    notify('名称不能为空', 'error');
    return;
  }
  if (!payload.slug.trim()) {
    notify('slug 不能为空', 'error');
    return;
  }

  creating.value = true;
  try {
    let created;
    if (kind === 'category') {
      created = await adminApi.categories.create({
        slug: payload.slug.trim(),
        name: payload.title.trim()
      });
    } else if (kind === 'course') {
      created = await adminApi.courses.create({
        category_id: parent.id,
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        status: payload.status
      });
    } else if (kind === 'chapter') {
      created = await adminApi.chapters.create({
        course_id: parent.id,
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        tag: payload.tag.trim()
      });
    } else {
      created = await adminApi.sections.create({
        chapter_id: parent.id,
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        tag: payload.tag.trim()
      });
    }

    createOpen.value = false;
    await treeRef.value.refreshForNode(
      parent ? parent.type : 'category',
      parent ? parent.id : created.id
    );

    selectNode({ type: kind, id: created.id, label: created.title ?? created.name });
    notify(`${KIND_LABEL[kind]}已创建`);
  } catch (err) {
    handleError(err);
  } finally {
    creating.value = false;
  }
};

const askDelete = (node) => {
  deleteTarget.value = node;
};

const runDelete = async () => {
  const target = deleteTarget.value;
  if (!target) return;

  deleting.value = true;
  try {
    if (target.type === 'category') await adminApi.categories.remove(target.id);
    else if (target.type === 'course') await adminApi.courses.remove(target.id);
    else if (target.type === 'chapter') await adminApi.chapters.remove(target.id);
    else await adminApi.sections.remove(target.id);

    if (selected.value?.type === target.type && selected.value?.id === target.id) {
      selected.value = null;
    }
    deleteTarget.value = null;
    await treeRef.value.reload();
    notify(`${KIND_LABEL[target.type]}已删除`);
  } catch (err) {
    handleError(err);
  } finally {
    deleting.value = false;
  }
};

const move = async (payload) => {
  const node = payload?.node;
  const delta = payload?.delta ?? 0;
  if (!node || !delta) return;

  const info = treeRef.value?.getSiblings(node.type, node.id);
  if (!info) return;

  const target = info.index + delta;
  if (target < 0 || target >= info.siblings.length) return;

  const ids = info.siblings.map((n) => n.id);
  [ids[info.index], ids[target]] = [ids[target], ids[info.index]];

  try {
    if (node.type === 'category') await adminApi.categories.order(ids);
    else if (node.type === 'course') await adminApi.courses.order(info.parent.id, ids);
    else if (node.type === 'chapter') await adminApi.chapters.order(info.parent.id, ids);
    else await adminApi.sections.order(info.parent.id, ids);

    await treeRef.value.reload();
    notify('顺序已更新');
  } catch (err) {
    handleError(err);
  }
};

const handleChanged = async (payload) => {
  if (!payload) return;
  if (payload.label && selected.value) {
    selected.value = { ...selected.value, label: payload.label };
  }
  if (payload.scope === 'category') {
    await treeRef.value.refreshCategory(payload.categoryId, payload.label);
  } else if (payload.scope === 'course') {
    await treeRef.value.refreshCourse(payload.courseId, payload.label);
  } else if (payload.courseId) {
    // 章 / 小节是课程的子级，重拉课程树时标题会一并更新。
    // 这里不能把 label 透传下去，否则会拿章的标题覆盖掉课程名。
    await treeRef.value.refreshCourse(payload.courseId);
  }
};

// 从面板里的列表跳到另一个节点，同时把树展开到位
const navigateTo = async (target) => {
  selectNode(target);
  try {
    if (target.categoryId) {
      await treeRef.value.expandTo('category', target.categoryId);
      await treeRef.value.expandTo('course', target.id);
    } else if (target.courseId) {
      await treeRef.value.expandTo('course', target.courseId);
      if (target.chapterId) await treeRef.value.expandTo('chapter', target.chapterId);
    }
  } catch {
    // 树尚未加载到该分支时忽略，选中态仍然生效
  }
};
</script>

<template>
  <div class="admin-workspace">
    <AdminTree
      ref="treeRef"
      :selected-key="selectedKey"
      @select="selectNode"
      @add="openCreate"
      @remove="askDelete"
      @move="move"
      @error="handleError"
      @create-category="openCreate(null)"
    />

    <div class="admin-main">
      <Transition name="notice-fade">
        <div
          v-if="notice"
          class="admin-notice"
          :class="`is-${notice.kind}`"
        >
          {{ notice.text }}
        </div>
      </Transition>

      <component
        :is="panelComponent"
        v-if="selected"
        :key="selectedKey"
        :node="selected"
        @changed="handleChanged"
        @error="handleError"
        @saved="notify"
        @navigate="navigateTo"
      >
        <template #actions>
          <button
            class="head-tool is-danger"
            type="button"
            title="删除"
            @click="askDelete(selected)"
          >
            <Trash width="13" height="13" />
          </button>
        </template>
      </component>

      <div
        v-else
        class="admin-blank"
      >
        <div class="blank-mark font-mono">// LECTURE WORKSPACE</div>
        <h2 class="blank-title">讲义管理</h2>
        <p class="blank-desc">
          层级为 分类 → 课程 → 章节 → 小节，一个小节对应一个 Typst 源文件。<br />
          从左侧选择一个节点开始编辑，把鼠标移到分类 / 课程 / 章节行上可新建子项。
        </p>
        <MButton
          variant="secondary"
          :mono="true"
          @click="openCreate(null)"
        >
          <template #icon>
            <FolderPlus width="14" height="14" />
          </template>
          新建分类
        </MButton>
      </div>
    </div>

    <MModal
      :open="createOpen"
      :title="createTitle"
      :desc="createDesc"
      width="480px"
      confirm-text="创建"
      :busy="creating"
      @close="createOpen = false"
      @confirm="createChild"
    >
      <MInput
        v-model="createForm.title"
        :label="createTitleLabel"
        placeholder="必填"
      />
      <MInput
        v-model="createForm.slug"
        label="slug"
        placeholder="必填，仅限字母数字与 . _ -"
      />
      <MInput
        v-if="createHasTag"
        v-model="createForm.tag"
        label="标签"
        placeholder="选填，例如 第一章"
      />
      <MSelect
        v-if="createKind === 'course'"
        v-model="createForm.status"
        label="状态"
        :options="COURSE_STATUSES"
      />
    </MModal>

    <MModal
      :open="Boolean(deleteTarget)"
      title="确认删除"
      :desc="deleteTarget ? `${KIND_LABEL[deleteTarget.type]}：${deleteTarget.label}` : ''"
      width="440px"
      confirm-text="删除"
      confirm-variant="danger"
      :busy="deleting"
      @close="deleteTarget = null"
      @confirm="runDelete"
    >
      <div class="adm-note">{{ deleteWarning }}</div>
    </MModal>
  </div>
</template>

<style scoped>
.admin-workspace {
  height: calc(100vh - var(--topbar-height));
  display: flex;
  align-items: stretch;
  background-color: var(--bg-app);
  overflow: hidden;
}

.admin-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.admin-notice {
  /* 全局浮层：固定在顶部居中，层级高于弹窗/顶栏 */
  position: fixed;
  top: calc(var(--topbar-height) + 14px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: min(520px, calc(100vw - 48px));
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-smaller);
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  color: var(--text-primary);
}

.admin-notice.is-error {
  border-color: rgba(224, 112, 112, 0.5);
  color: #e8a0a0;
}

.notice-fade-enter-active,
.notice-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.notice-fade-enter-from,
.notice-fade-leave-to {
  opacity: 0;
  /* 保留居中位移，只做上浮淡出 */
  transform: translate(-50%, -6px);
}

.head-tool {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.head-tool:hover:not(:disabled) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.head-tool:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.head-tool.is-danger:hover:not(:disabled) {
  color: #e07070;
}

.admin-blank {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px;
  text-align: center;
}

.blank-mark {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  letter-spacing: 1px;
}

.blank-title {
  font-size: 24px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.blank-desc {
  max-width: 520px;
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 2;
}
</style>
