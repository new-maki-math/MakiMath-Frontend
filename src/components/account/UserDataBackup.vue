<script setup>
import { computed, onMounted, ref } from 'vue';

import { workbenchPanelState } from '../../composables/useWorkbenchGuard.js';
import {
  clearRecoveryBackup,
  deleteSelectedDatabases,
  exportUserData,
  getRecoveryBackup,
  inspectUserBackup,
  listClearableDatabases,
  restoreUserData
} from '../../utils/user-data-backup.js';
import { notify } from '../feedback/MNotice.vue';
import MButton from '../form/MButton.vue';
import MCheckbox from '../form/MCheckbox.vue';
import MFilePicker from '../form/MFilePicker.vue';
import MRadio from '../form/MRadio.vue';
import { Download, Trash, Upload } from '../icons/icons.js';
import MModal from '../overlay/MModal.vue';

const open = ref(false);
const busy = ref(false);
const error = ref('');
const fileName = ref('');
const inspection = ref(null);
const recovery = ref(null);
const recoveryIncomplete = ref(false);
const clearOpen = ref(false);
const cleanupOpen = ref(false);
const cleanupMode = ref('legacy');
const cleanupDatabases = ref([]);
const selectedDatabases = ref([]);
const cleanupStage = ref(0);
const cleanupError = ref('');
const cleanupProgress = ref('');
const cleanupIncomplete = ref(false);
const visibleDatabases = computed(() =>
  cleanupDatabases.value.filter((item) => cleanupMode.value === 'all' || item.legacy)
);
let sequence = 0;

const labels = {
  MakiMath_LocalLectures: '本地讲义',
  MakiMath_KnowledgeMastery: '知识点掌握记录',
  MakiMath_UpdateLog: '更新日志已读记录',
  'maki-lecture-covers': '讲义封面缓存',
  'maki-knowledge-glyphs': '旧知识地图字形缓存',
  MakiMath_UserData: '旧版讲义册数据'
};

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function updateRecovery() {
  try {
    recovery.value = await getRecoveryBackup();
  } catch {
    error.value = '无法读取浏览器恢复副本';
  }
}

async function exportData() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    const json = await exportUserData();
    download(
      new Blob([json], {
        type: 'application/json'
      }),
      `maki-math-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    notify('本地数据备份已开始下载', 'success');
  } catch (failure) {
    notify(failure.message || '导出失败', 'error', 6000);
  } finally {
    busy.value = false;
  }
}

function openImport() {
  error.value = '';
  fileName.value = '';
  inspection.value = null;
  open.value = true;
  updateRecovery();
}

function closeImport() {
  if (busy.value) {
    return;
  }
  sequence++;
  open.value = false;
  inspection.value = null;
}

async function selectFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || busy.value) {
    return;
  }
  const current = ++sequence;
  fileName.value = file.name;
  inspection.value = null;
  error.value = '';
  busy.value = true;
  try {
    const result = await inspectUserBackup(file);
    if (current === sequence) {
      inspection.value = result;
    }
  } catch (failure) {
    if (current === sequence) {
      error.value = failure.message || '备份校验失败';
    }
  } finally {
    if (current === sequence) {
      busy.value = false;
    }
  }
}

async function confirmImport() {
  if (!inspection.value || busy.value || recovery.value) {
    return;
  }
  if (workbenchPanelState.value.dirty || workbenchPanelState.value.saving) {
    error.value = '工作台有未保存或正在保存的内容，请先处理后再导入';
    return;
  }
  error.value = '';
  busy.value = true;
  try {
    await restoreUserData(inspection.value, (message) => {
      error.value = message;
      recoveryIncomplete.value = true;
      updateRecovery();
    });
  } catch (failure) {
    error.value = failure.message || '导入失败';
    await updateRecovery();
    busy.value = false;
  }
}

function downloadRecovery() {
  if (recovery.value) {
    download(recovery.value, 'maki-math-recovery.json');
  }
}

async function clearRecovery() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    await clearRecoveryBackup();
    recovery.value = null;
    clearOpen.value = false;
    notify('已清除浏览器中的恢复副本', 'success');
  } catch (failure) {
    error.value = failure.message || '清除恢复副本失败';
    clearOpen.value = false;
  } finally {
    busy.value = false;
  }
}

async function openCleanup() {
  if (busy.value) {
    return;
  }
  cleanupOpen.value = true;
  cleanupMode.value = 'legacy';
  selectedDatabases.value = [];
  cleanupStage.value = 0;
  cleanupError.value = '';
  cleanupProgress.value = '';
  cleanupIncomplete.value = false;
  busy.value = true;
  try {
    cleanupDatabases.value = await listClearableDatabases();
  } catch (failure) {
    cleanupError.value = failure.message || '读取数据库列表失败';
  } finally {
    busy.value = false;
  }
}

function closeCleanup() {
  if (busy.value) {
    return;
  }
  cleanupOpen.value = false;
}

function changeCleanupMode(mode) {
  cleanupMode.value = mode;
  selectedDatabases.value = [];
}

function selectVisibleDatabases() {
  selectedDatabases.value = visibleDatabases.value
    .filter((item) => typeof item.name === 'string' && item.name)
    .map((item) => item.name);
}

async function confirmCleanup() {
  if (busy.value || !selectedDatabases.value.length) {
    return;
  }
  if (cleanupStage.value < 2) {
    cleanupStage.value++;
    return;
  }
  if (workbenchPanelState.value.dirty || workbenchPanelState.value.saving) {
    cleanupError.value = '工作台有未保存或正在保存的内容，请先处理后再清理';
    return;
  }
  const selected = cleanupDatabases.value.filter((item) =>
    selectedDatabases.value.includes(item.name)
  );
  cleanupError.value = '';
  busy.value = true;
  try {
    await deleteSelectedDatabases(
      selected,
      (message) => {
        cleanupProgress.value = message;
      },
      (message) => {
        cleanupProgress.value = '';
        cleanupError.value = message;
        cleanupIncomplete.value = true;
      }
    );
  } catch (failure) {
    cleanupError.value = failure.message || '删除数据库失败';
    cleanupProgress.value = '';
    busy.value = false;
  }
}

function reloadPage() {
  window.location.reload();
}

onMounted(updateRecovery);
</script>

<template>
  <div class="backup-actions">
    <MButton
      variant="ghost"
      size="md"
      icon-only
      :disabled="busy"
      title="导出用户数据"
      aria-label="导出用户数据"
      @click="exportData"
    >
      <Upload
        width="19"
        height="19"
        aria-hidden="true"
      />
    </MButton>
    <MButton
      variant="ghost"
      size="md"
      icon-only
      :disabled="busy"
      title="导入用户数据"
      aria-label="导入用户数据"
      @click="openImport"
    >
      <Download
        width="19"
        height="19"
        aria-hidden="true"
      />
    </MButton>
    <MButton
      variant="ghost"
      size="md"
      icon-only
      :disabled="busy"
      title="清理本地数据"
      aria-label="清理本地数据"
      @click="openCleanup"
    >
      <Trash
        width="19"
        height="19"
        aria-hidden="true"
      />
    </MButton>
    <MModal
      :open="open"
      title="导入用户数据"
      width="520px"
      hide-footer
      show-close
      @close="closeImport"
    >
      <MFilePicker
        :title="fileName || '选择用户数据备份'"
        detail="仅支持本站导出的 JSON 备份"
        accept=".json,application/json"
        :disabled="busy"
        @change="selectFile"
      />
      <template v-if="inspection">
        <p class="backup-text">备份时间：{{ new Date(inspection.exportedAt).toLocaleString() }}</p>
        <ul class="backup-list">
          <li
            v-for="item in inspection.summary"
            :key="item.name"
          >
            {{ labels[item.name] }}：{{ item.count }} 条
          </li>
        </ul>
        <p class="backup-warning">
          确认后将覆盖上述数据库中的当前数据，其他数据库不会被删除。建议先导出备份，并关闭其他本站标签页。
        </p>
        <p class="backup-text">
          只包含当前浏览器的本地数据，不包含登录凭据和服务器在线数据。导入成功后页面将刷新。
        </p>
      </template>
      <div
        v-if="recovery"
        class="backup-recovery"
      >
        <p>检测到上次导入的恢复副本，请先保存并确认后再清除。</p>
        <div class="backup-recovery-actions">
          <MButton
            size="sm"
            @click="downloadRecovery"
            >下载恢复副本</MButton
          >
          <MButton
            v-if="!recoveryIncomplete"
            size="sm"
            variant="ghost"
            @click="clearOpen = true"
            >清除恢复副本</MButton
          >
        </div>
      </div>
      <p
        v-if="busy && !recoveryIncomplete"
        class="backup-text"
        role="status"
      >
        正在处理本地数据，请稍候…
      </p>
      <p
        v-if="error"
        class="backup-error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="backup-footer">
        <MButton
          v-if="recoveryIncomplete"
          variant="primary"
          @click="reloadPage"
          >刷新页面</MButton
        >
        <MButton
          v-else
          variant="ghost"
          :disabled="busy"
          @click="closeImport"
          >取消</MButton
        >
        <MButton
          v-if="!recoveryIncomplete"
          variant="primary"
          :disabled="busy || !inspection || !!recovery"
          @click="confirmImport"
          >确认覆盖导入</MButton
        >
      </div>
    </MModal>
    <MModal
      :open="clearOpen"
      title="清除恢复副本"
      desc="请先确认已下载并保存恢复副本。清除后无法再从浏览器找回。"
      confirm-text="确认清除"
      confirm-variant="danger"
      :busy="busy"
      @close="clearOpen = false"
      @confirm="clearRecovery"
    />
    <MModal
      :open="cleanupOpen"
      title="清理本地数据"
      width="520px"
      hide-footer
      show-close
      @close="closeCleanup"
    >
      <template v-if="cleanupStage === 0">
        <p class="backup-warning">
          请选择要永久删除的数据库。不会自动保留副本，建议先导出；请关闭其他本站标签页。
        </p>
        <div class="cleanup-modes">
          <MRadio
            :model-value="cleanupMode"
            name="cleanup-mode"
            value="legacy"
            :disabled="busy"
            @update:model-value="changeCleanupMode"
            >已停用的数据库</MRadio
          >
          <MRadio
            :model-value="cleanupMode"
            name="cleanup-mode"
            value="all"
            :disabled="busy"
            @update:model-value="changeCleanupMode"
            >全部数据库</MRadio
          >
        </div>
        <p class="backup-text">当前没有可确认安全删除的遗弃字段，未识别的字段不会被自动清理。</p>
        <div
          v-if="visibleDatabases.length"
          class="cleanup-modes"
        >
          <MButton
            size="sm"
            variant="ghost"
            @click="selectVisibleDatabases"
            >全选当前范围</MButton
          >
          <MButton
            size="sm"
            variant="ghost"
            @click="selectedDatabases = []"
            >清空选择</MButton
          >
        </div>
        <div
          v-if="visibleDatabases.length"
          class="cleanup-list"
        >
          <MCheckbox
            v-for="database in visibleDatabases"
            :key="database.name"
            v-model="selectedDatabases"
            :value="database.name"
            :disabled="busy"
            class="cleanup-item"
          >
            {{ labels[database.name] || '未识别数据库' }} · {{ database.name }}
            <span v-if="database.legacy">（已停用）</span
            ><span v-else-if="!database.known">（用途未知）</span>
          </MCheckbox>
        </div>
        <p
          v-else-if="!busy"
          class="backup-text"
        >
          当前范围没有数据库。
        </p>
        <p
          v-if="selectedDatabases.includes('MakiMath_UserData')"
          class="backup-warning"
        >
          旧版讲义册库可能包含旧讲义和收藏记录，删除后不可恢复。
        </p>
      </template>
      <template v-else>
        <p class="backup-warning">
          {{
            cleanupStage === 1
              ? '再次确认要永久删除以下数据库？'
              : '最后确认：删除后无法恢复，且不会自动保留副本。'
          }}
        </p>
        <ul class="backup-list">
          <li
            v-for="name in selectedDatabases"
            :key="name"
          >
            {{ labels[name] || '未识别数据库' }} · {{ name }}
          </li>
        </ul>
        <p class="backup-text">其他未选择的数据库、登录凭据和服务器数据不受此操作影响。</p>
      </template>
      <p
        v-if="cleanupProgress"
        class="backup-text"
        role="status"
      >
        {{ cleanupProgress }}
      </p>
      <p
        v-if="cleanupError"
        class="backup-error"
        role="alert"
      >
        {{ cleanupError }}
      </p>
      <div class="backup-footer">
        <MButton
          v-if="cleanupIncomplete"
          variant="primary"
          @click="reloadPage"
          >刷新页面</MButton
        >
        <MButton
          v-else
          variant="ghost"
          :disabled="busy"
          @click="closeCleanup"
          >取消</MButton
        >
        <MButton
          v-if="!cleanupIncomplete"
          variant="danger"
          :disabled="busy || !selectedDatabases.length"
          @click="confirmCleanup"
          >{{ ['确认所选 1/3', '再次确认 2/3', '永久删除 3/3'][cleanupStage] }}</MButton
        >
      </div>
    </MModal>
  </div>
</template>

<style scoped>
.backup-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.backup-text {
  color: var(--text-secondary);
  line-height: 1.6;
}
.backup-list {
  padding-left: 1.3em;
  color: var(--text-primary);
  line-height: 1.8;
}
.backup-warning {
  color: var(--text-primary);
  line-height: 1.6;
}
.backup-error {
  color: var(--tag-red);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.backup-recovery {
  padding: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
}
.backup-recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.backup-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cleanup-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.cleanup-item {
  align-items: flex-start;
}
.cleanup-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 220px;
  overflow: auto;
}
</style>
