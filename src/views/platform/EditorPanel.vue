<script setup>
// 课程协作者授权面板组件
import { ref, onMounted } from 'vue';
import { Plus, Refresh } from '@iconoir/vue';
import { request } from '../../api/client.js';
import { notify } from '../../components/MNotice.vue';
import MButton from '../../components/MButton.vue';
import MTag from '../../components/MTag.vue';
import MModal from '../../components/MModal.vue';
import MTable from '../../components/MTable.vue';
import { formatDate } from './utils.js';

const courses = ref([]);
const selectedCourseId = ref(null);
const courseEditors = ref([]);
const isLoadingEditors = ref(false);
const isAssignEditorOpen = ref(false);
const assignUserId = ref('');
const isAssigning = ref(false);
const activeUsers = ref([]);

// 加载课程列表与备选用户
const loadEditorMatrix = async () => {
  try {
    const res = await request('/api/courses');
    if (Array.isArray(res)) {
      courses.value = res;
      if (res.length > 0 && !selectedCourseId.value) {
        selectedCourseId.value = res[0].id;
        loadCourseEditors(res[0].id);
      }
    }
  } catch (err) {
    notify(err.message || '加载课程失败', 'error');
  }
};

// 加载可指派的候选用户
const loadActiveUsers = async () => {
  try {
    const res = await request('/api/users');
    if (Array.isArray(res)) {
      activeUsers.value = res.filter((u) => u.status === 'active');
    }
  } catch {
    activeUsers.value = [];
  }
};

// 切换选中的课程
const handleSelectCourse = (course) => {
  selectedCourseId.value = course.id;
  loadCourseEditors(course.id);
};

// 加载指定课程的协作者
const loadCourseEditors = async (courseId) => {
  if (!courseId) return;
  isLoadingEditors.value = true;
  try {
    const res = await request(`/api/courses/${courseId}/editors`);
    courseEditors.value = Array.isArray(res) ? res : [];
  } catch (err) {
    notify(err.message || '加载协作者列表失败', 'error');
  } finally {
    isLoadingEditors.value = false;
  }
};

// 指派新协作者
const handleAssignEditor = async () => {
  if (!assignUserId.value) {
    notify('请选择要指派的编者用户', 'error');
    return;
  }
  isAssigning.value = true;
  try {
    await request(`/api/courses/${selectedCourseId.value}/editors`, {
      method: 'POST',
      body: { userId: Number(assignUserId.value) }
    });
    notify('协作者指派成功', 'success');
    isAssignEditorOpen.value = false;
    assignUserId.value = '';
    loadCourseEditors(selectedCourseId.value);
  } catch (err) {
    notify(err.message || '指派协作者失败', 'error');
  } finally {
    isAssigning.value = false;
  }
};

// 移除课程协作者
const handleRemoveEditor = async (editor) => {
  if (!window.confirm(`确定要移除 ${editor.username} 对此课程的编辑权限吗？`)) return;
  try {
    await request(`/api/courses/${selectedCourseId.value}/editors/${editor.id}`, {
      method: 'DELETE'
    });
    notify('已收回协作者权限', 'success');
    loadCourseEditors(selectedCourseId.value);
  } catch (err) {
    notify(err.message || '移除协作者失败', 'error');
  }
};

onMounted(() => {
  loadEditorMatrix();
  loadActiveUsers();
});
</script>

<template>
  <section class="section-pane is-fill-pane font-mono">
    <div class="pane-toolbar">
      <div class="toolbar-title-wrap">
        <h1 class="pane-title font-mono">EDITORS // 课程协作者授权</h1>
        <p class="pane-subtitle">将特定课程的讲义编撰与排版发布权指派给指定编者，精细化管理创作团队。</p>
      </div>
      <div class="toolbar-actions">
        <MButton
          v-if="selectedCourseId"
          variant="primary"
          size="sm"
          :mono="true"
          @click="isAssignEditorOpen = true; loadActiveUsers()"
        >
          <template #icon><Plus width="14" height="14" /></template>
          指派新编者
        </MButton>
      </div>
    </div>

    <div class="split-editor-box">
      <div class="course-picker-list">
        <div class="list-head">课程目录</div>
        <div
          v-for="c in courses"
          :key="c.id"
          class="course-picker-item"
          :class="{ active: selectedCourseId === c.id }"
          @click="handleSelectCourse(c)"
        >
          <span class="c-title">{{ c.title }}</span>
          <span class="c-slug">{{ c.slug }}</span>
        </div>
      </div>

      <div class="editors-display-pane">
        <div class="pane-inner-head">
          <span>已授权编者列表</span>
          <button
            class="icon-action-btn"
            title="刷新"
            @click="loadCourseEditors(selectedCourseId)"
          >
            <Refresh width="14" height="14" />
          </button>
        </div>

        <div v-if="isLoadingEditors" class="empty-holder">正在拉取协作者...</div>
        <div v-else-if="courseEditors.length === 0" class="empty-holder">
          当前课程尚未指派协作者，所有超级管理员均具备完全编辑权。
        </div>
        <MTable v-else :data="courseEditors" :loading="isLoadingEditors">
          <template #header>
            <th>用户</th>
            <th>昵称</th>
            <th>角色</th>
            <th>授权时间</th>
            <th>操作</th>
          </template>
          <template #rows="{ data }">
            <tr v-for="ed in data" :key="ed.id">
              <td class="col-bold">{{ ed.username }}</td>
              <td>{{ ed.display_name || '-' }}</td>
              <td>
                <MTag variant="gray" size="sm">{{ ed.role }}</MTag>
              </td>
              <td class="col-dim">{{ formatDate(ed.assigned_at) }}</td>
              <td>
                <MButton
                  variant="danger"
                  size="sm"
                  :mono="true"
                  title="收回编辑权"
                  @click="handleRemoveEditor(ed)"
                >
                  移除
                </MButton>
              </td>
            </tr>
          </template>
        </MTable>
      </div>
    </div>

    <!-- 指派编者弹窗 -->
    <MModal
      :open="isAssignEditorOpen"
      title="指派课程协作者"
      confirm-text="确认指派"
      :busy="isAssigning"
      @close="isAssignEditorOpen = false"
      @confirm="handleAssignEditor"
    >
      <div class="form-grid">
        <div class="field-item">
          <span class="field-label">选择编者用户</span>
          <select v-model="assignUserId" class="native-select">
            <option value="" disabled>-- 请选择编者 --</option>
            <option
              v-for="u in activeUsers"
              :key="u.id"
              :value="u.id"
            >
              {{ u.username }} ({{ u.display_name || '无昵称' }}) - {{ u.role }}
            </option>
          </select>
        </div>
      </div>
    </MModal>
  </section>
</template>

<style scoped>
.section-pane {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-pane.is-fill-pane {
  flex: 1;
  min-height: 0;
  max-width: none;
}

.pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pane-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.pane-subtitle {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 120ms ease;
}

.icon-action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.split-editor-box {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.course-picker-list {
  width: 240px;
  flex-shrink: 0;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.list-head {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  font-weight: var(--font-weight-semibold);
}

.course-picker-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color 120ms ease;
}

.course-picker-item:hover {
  background-color: var(--bg-hover);
}

.course-picker-item.active {
  background-color: var(--bg-elevated);
  border-left: 2px solid var(--accent-primary);
}

.c-title {
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
}

.c-slug {
  color: var(--text-muted);
  font-size: 11px;
}

.editors-display-pane {
  flex: 1;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.pane-inner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.empty-holder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.col-dim {
  color: var(--text-muted);
}

.col-bold {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
}

.native-select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
  outline: none;
}
</style>
