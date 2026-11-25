<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import MEmpty from '../../components/feedback/MEmpty.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MButton from '../../components/form/MButton.vue';
import MCheckbox from '../../components/form/MCheckbox.vue';
import MRadio from '../../components/form/MRadio.vue';
import MSelect from '../../components/form/MSelect.vue';
import MModal from '../../components/overlay/MModal.vue';
import { canUseAi } from '../../utils/ai-access.js';
import {
  AI_PROVIDERS,
  beginCredentialWarning,
  cancelCredentialWarning,
  deleteAiCredential,
  getAiConfiguration,
  getSavedAiConfiguration,
  hasSavedAiCredential,
  hasSessionCredential,
  resolveAiBaseUrl,
  saveAiCredential,
  setAiConfiguration,
  setSessionCredential,
  unlockAiCredential,
  updateSavedAiConfiguration,
  useSessionCredential,
  warningRemaining
} from '../../utils/ai-credentials.js';
import { loadSavedAiModels, saveAiModels } from '../../utils/ai-models.js';

const props = defineProps({
  zIndex: {
    type: Number,
    default: 90
  },
  open: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['close', 'saved']);
const provider = ref('openai');
const baseUrl = ref(AI_PROVIDERS.openai.baseUrl);
const models = ref([]);
const selectedModelIds = ref([]);
const allModelsSelected = computed(
  () => models.value.length > 0 && selectedModelIds.value.length === models.value.length
);

function toggleAllModels(checked) {
  selectedModelIds.value = checked ? models.value.map((item) => item.id) : [];
  persistModels();
}

function persistModels() {
  try {
    saveAiModels(provider.value, baseUrl.value, models.value, selectedModelIds.value);
  } catch {
    notify('模型列表保存失败，请检查浏览器存储空间或权限', 'error');
  }
}

function restoreModels(fallback = []) {
  const saved = loadSavedAiModels(provider.value, baseUrl.value);
  models.value =
    saved?.models ||
    fallback.map((item) => ({
      ...item
    }));
  selectedModelIds.value = saved?.selectedIds || fallback.map((item) => item.id);
}
const storageMode = ref('session');
const configured = ref(false);
const saved = ref(false);
const loading = ref(false);
const prompt = ref('');
const remaining = ref(5);
const busy = ref(false);
const keyInput = ref(null);
const passphraseInput = ref(null);
const confirmPassphraseInput = ref(null);
const providerOptions = Object.entries(AI_PROVIDERS).map(([value, item]) => ({
  value,
  label: item.label
}));
let warning;
let timer;
let requestController;
let revision = 0;

function clearInput(input) {
  if (input.value) {
    input.value.value = '';
  }
}

function stopWarning() {
  clearInterval(timer);
  timer = undefined;
  if (warning) {
    cancelCredentialWarning(warning);
    warning = undefined;
  }
}

function resetRequest() {
  revision++;
  requestController?.abort();
  requestController = null;
  loading.value = false;
}

async function updateStatus() {
  const currentRevision = ++revision;
  configured.value = hasSessionCredential(provider.value, baseUrl.value);
  saved.value = false;
  try {
    const exists = await hasSavedAiCredential(provider.value, baseUrl.value);
    if (currentRevision === revision) {
      saved.value = exists;
    }
  } catch {
    if (currentRevision === revision) {
      saved.value = false;
    }
  }
}

function changeProvider(value) {
  resetRequest();
  stopWarning();
  provider.value = value;
  baseUrl.value = AI_PROVIDERS[value].baseUrl;
  restoreModels();
  storageMode.value = 'session';
  clearInput(keyInput);
  updateStatus();
}

function changeBaseUrl() {
  resetRequest();
  stopWarning();
  storageMode.value = 'session';
  restoreModels();
  clearInput(keyInput);
  updateStatus();
}

function changeCredential() {
  resetRequest();
}

function closePrompt() {
  clearInput(passphraseInput);
  clearInput(confirmPassphraseInput);
  if (prompt.value === 'warning') {
    stopWarning();
  }
  prompt.value = '';
}

function beginWarning() {
  try {
    stopWarning();
    warning = beginCredentialWarning(provider.value, baseUrl.value);
    remaining.value = 5;
    prompt.value = 'warning';
    timer = setInterval(() => {
      remaining.value = Math.ceil(warningRemaining(warning) / 1000);
    }, 100);
  } catch (issue) {
    notify(issue.message, 'error');
  }
}

function acceptWarning() {
  if (!warning || warningRemaining(warning) > 0) {
    return;
  }
  clearInterval(timer);
  timer = undefined;
  storageMode.value = 'encrypted';
  prompt.value = '';
}

function chooseSession() {
  stopWarning();
  storageMode.value = 'session';
}

async function loadModels() {
  if (!canUseAi.value) {
    return;
  }
  resetRequest();
  const previousNames = new Map(models.value.map((item) => [item.id, item.name]));
  const currentRevision = revision;
  const controller = new AbortController();
  requestController = controller;
  loading.value = true;
  try {
    const endpoint = `${resolveAiBaseUrl(provider.value, baseUrl.value)}/models`;
    const key = keyInput.value?.value.trim() || '';
    const fetchModels = async (credential) => {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${credential}`
        },
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`获取模型失败（HTTP ${response.status}）`);
      }
      const length = Number(response.headers.get('content-length'));
      if (length > 1048576) {
        throw new Error('模型列表过大');
      }
      const text = await response.text();
      if (text.length > 1048576) {
        throw new Error('模型列表过大');
      }
      const data = JSON.parse(text);
      if (!Array.isArray(data?.data)) {
        throw new Error('模型列表格式无效');
      }
      return [
        ...new Set(
          data.data
            .map((item) => item?.id)
            .filter(
              (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/.test(id)
            )
        )
      ].sort();
    };
    const list = key
      ? await fetchModels(key)
      : await useSessionCredential(provider.value, baseUrl.value, fetchModels);
    if (currentRevision === revision && props.open) {
      models.value = list.map((id) => ({
        id,
        name: previousNames.get(id) || ''
      }));
      selectedModelIds.value = selectedModelIds.value.filter((id) => list.includes(id));
      persistModels();
      if (!list.length) {
        notify('未获取到可用模型', 'warn');
      }
    }
  } catch (issue) {
    if (currentRevision === revision && issue.name !== 'AbortError') {
      const message =
        issue instanceof TypeError || issue instanceof SyntaxError
          ? '浏览器直连失败或返回格式无效，请检查地址、网络及跨域设置'
          : issue.message;
      notify(message, 'error');
    }
  } finally {
    if (currentRevision === revision) {
      loading.value = false;
      requestController = null;
    }
  }
}

async function save() {
  try {
    resolveAiBaseUrl(provider.value, baseUrl.value);
    if (!selectedModelIds.value.length) {
      throw new Error('请至少选择一个模型');
    }
    const key = keyInput.value?.value.trim() || '';
    if (storageMode.value === 'encrypted') {
      if (!key) {
        throw new Error('请输入要保存的 API Key');
      }
      if (!warning || warningRemaining(warning) > 0) {
        stopWarning();
        storageMode.value = 'session';
        throw new Error('请重新选择加密保存并阅读风险提示');
      }
      prompt.value = 'save';
      return;
    }
    if (key) {
      setSessionCredential(provider.value, baseUrl.value, key);
    } else if (!hasSessionCredential(provider.value, baseUrl.value)) {
      throw new Error('请输入 API Key 或解锁已保存的凭证');
    }
    setAiConfiguration(
      provider.value,
      baseUrl.value,
      models.value.filter((item) => selectedModelIds.value.includes(item.id))
    );
    if (saved.value && !key) {
      await updateSavedAiConfiguration(
        provider.value,
        baseUrl.value,
        models.value.filter((item) => selectedModelIds.value.includes(item.id))
      );
    }
    clearInput(keyInput);
    emit('saved');
    notify('AI 设置已保存', 'success');
    emit('close');
  } catch (issue) {
    notify(issue.message, 'error');
  }
}

async function confirmCredential() {
  const passphrase = passphraseInput.value?.value || '';
  if (!passphrase) {
    notify('请输入独立口令', 'error');
    return;
  }
  if (prompt.value === 'save' && passphrase !== confirmPassphraseInput.value?.value) {
    notify('两次输入的口令不一致', 'error');
    return;
  }
  busy.value = true;
  try {
    if (prompt.value === 'save') {
      const key = keyInput.value?.value.trim() || '';
      await saveAiCredential({
        provider: provider.value,
        baseUrl: baseUrl.value,
        credential: key,
        passphrase,
        warning,
        models: models.value.filter((item) => selectedModelIds.value.includes(item.id))
      });
      warning = undefined;
      setSessionCredential(provider.value, baseUrl.value, key);
      setAiConfiguration(
        provider.value,
        baseUrl.value,
        models.value.filter((item) => selectedModelIds.value.includes(item.id))
      );
      clearInput(keyInput);
      clearInput(passphraseInput);
      clearInput(confirmPassphraseInput);
      prompt.value = '';
      emit('saved');
      notify('AI 设置已保存', 'success');
      emit('close');
    } else {
      await unlockAiCredential(provider.value, baseUrl.value, passphrase);
      clearInput(passphraseInput);
      clearInput(confirmPassphraseInput);
      prompt.value = '';
      configured.value = true;
      if (selectedModelIds.value.length) {
        setAiConfiguration(
          provider.value,
          baseUrl.value,
          models.value.filter((item) => selectedModelIds.value.includes(item.id))
        );
        emit('saved');
      }
      notify('凭证已解锁', 'success');
    }
  } catch (issue) {
    notify(issue.message, 'error');
    if (prompt.value === 'save') {
      stopWarning();
      storageMode.value = 'session';
      clearInput(passphraseInput);
      clearInput(confirmPassphraseInput);
      prompt.value = '';
    }
  } finally {
    busy.value = false;
  }
}

async function removeSaved() {
  busy.value = true;
  try {
    await deleteAiCredential(provider.value, baseUrl.value);
    prompt.value = '';
    configured.value = false;
    saved.value = false;
    clearInput(keyInput);
  } catch {
    notify('删除凭证失败，请重试', 'error');
  } finally {
    busy.value = false;
  }
}

async function restoreSavedConfiguration() {
  const activeConfiguration = getAiConfiguration();
  if (activeConfiguration) {
    provider.value = activeConfiguration.provider;
    baseUrl.value = activeConfiguration.baseUrl;
    restoreModels(activeConfiguration.models);
    await updateStatus();
    return;
  }
  restoreModels();
  const currentRevision = revision;
  try {
    const savedConfiguration = await getSavedAiConfiguration();
    if (!savedConfiguration || !props.open || currentRevision !== revision) {
      return;
    }
    const {
      provider: savedProvider,
      baseUrl: savedBaseUrl,
      models: savedModels
    } = savedConfiguration;
    resolveAiBaseUrl(savedProvider, savedBaseUrl);
    provider.value = savedProvider;
    baseUrl.value = savedBaseUrl;
    restoreModels(savedModels);
    await updateStatus();
  } catch {
    // 已保存的凭证仍可通过手动选择服务商和地址解锁。
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      updateStatus();
      restoreSavedConfiguration();
    } else {
      resetRequest();
      stopWarning();
      clearInput(keyInput);
      clearInput(passphraseInput);
      clearInput(confirmPassphraseInput);
      prompt.value = '';
      storageMode.value = 'session';
    }
  }
);

onBeforeUnmount(() => {
  resetRequest();
  stopWarning();
  clearInput(keyInput);
  clearInput(passphraseInput);
  clearInput(confirmPassphraseInput);
});
</script>

<template>
  <MModal
    :z-index="zIndex"
    :open="open"
    title="AI 设置"
    width="720px"
    hide-footer
    show-close
    @close="emit('close')"
  >
    <form
      class="ai-settings"
      @submit.prevent="save"
    >
      <div class="ai-settings-provider-row">
        <MSelect
          :model-value="provider"
          label="服务商"
          :options="providerOptions"
          @update:model-value="changeProvider"
        />
        <label class="ai-settings-field">
          <span class="ai-settings-label">Base URL</span>
          <input
            v-model="baseUrl"
            class="ai-settings-input"
            :disabled="provider !== 'other'"
            :title="provider !== 'other' ? '该服务商的地址不可修改' : undefined"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://example.com/v1"
            @input="changeBaseUrl"
          />
        </label>
      </div>
      <div class="ai-settings-field">
        <span class="ai-settings-label">API Key</span>
        <div class="ai-settings-model-row">
          <input
            ref="keyInput"
            class="ai-settings-input"
            type="password"
            autocomplete="new-password"
            spellcheck="false"
            aria-label="API Key"
            :placeholder="configured ? '已设置，留空保持不变' : '输入 API Key'"
            @input="changeCredential"
          />
          <MButton
            v-if="saved && !configured"
            type="button"
            @click="prompt = 'unlock'"
            >解锁已保存凭证</MButton
          >
          <MButton
            v-if="saved"
            variant="ghost"
            type="button"
            @click="prompt = 'delete'"
            >删除已保存凭证</MButton
          >
          <MButton
            type="button"
            class="ai-settings-model-fetch"
            :disabled="loading"
            :title="`将 API Key 发送到 ${baseUrl || '填写的地址'} 以获取模型`"
            @click="loadModels"
            >{{ loading ? '获取中…' : '获取模型' }}</MButton
          >
        </div>
      </div>
      <div class="ai-settings-field">
        <span class="ai-settings-label">模型</span>
        <div class="ai-model-list">
          <MEmpty v-if="!models.length" />
          <div
            v-if="models.length"
            class="ai-model-columns"
          >
            <MCheckbox
              :model-value="allModelsSelected"
              :indeterminate="selectedModelIds.length > 0 && !allModelsSelected"
              aria-label="全选模型"
              @update:model-value="toggleAllModels"
            />
            <span>自定义名称</span>
            <span>模型 ID</span>
          </div>
          <div
            v-if="models.length"
            class="ai-model-rows"
          >
            <div
              v-for="item in models"
              :key="item.id"
              class="ai-model-row"
            >
              <MCheckbox
                v-model="selectedModelIds"
                :value="item.id"
                :aria-label="`选择模型 ${item.id}`"
                @update:model-value="persistModels"
              />
              <input
                v-model="item.name"
                class="ai-settings-input ai-model-name"
                :placeholder="item.id"
                :aria-label="`${item.id} 的自定义名称`"
                maxlength="128"
                autocomplete="off"
                @input="persistModels"
              />
              <span
                class="ai-model-id"
                :title="item.id"
                >{{ item.id }}</span
              >
            </div>
          </div>
        </div>
      </div>
      <fieldset class="ai-settings-storage">
        <legend class="ai-settings-label">凭证保存方式</legend>
        <MRadio
          :model-value="storageMode"
          value="session"
          name="ai-credential-mode"
          @update:model-value="chooseSession"
        >
          仅本次会话有效
        </MRadio>
        <MRadio
          :model-value="storageMode"
          value="encrypted"
          name="ai-credential-mode"
          @click.prevent="storageMode !== 'encrypted' && beginWarning()"
        >
          加密保存在此浏览器
        </MRadio>
      </fieldset>
      <div class="ai-settings-actions">
        <MButton
          variant="ghost"
          type="button"
          @click="emit('close')"
          >取消</MButton
        >
        <MButton
          variant="primary"
          type="submit"
          >保存设置</MButton
        >
      </div>
    </form>
  </MModal>

  <MModal
    :z-index="zIndex"
    :open="prompt === 'warning'"
    title="保存凭证的风险"
    width="480px"
    hide-footer
    show-close
    @close="closePrompt"
  >
    <div class="ai-settings-prompt">
      <p>
        API Key
        会加密保存在当前浏览器，需要独立口令解锁。即使加密，同源恶意脚本、浏览器扩展或受感染的设备仍可能在解锁时读取密钥。请使用强口令并妥善保管。
      </p>
      <p>OpenRouter OAuth 签发的 Key 仅支持本次会话。</p>
      <div class="ai-settings-actions">
        <MButton
          type="button"
          variant="ghost"
          @click="closePrompt"
          >取消</MButton
        >
        <MButton
          type="button"
          variant="primary"
          :disabled="remaining > 0"
          @click="acceptWarning"
          >{{ remaining > 0 ? `请阅读（${remaining} 秒）` : '我已了解' }}</MButton
        >
      </div>
    </div>
  </MModal>

  <MModal
    :z-index="zIndex"
    :open="prompt === 'save' || prompt === 'unlock'"
    :title="prompt === 'save' ? '设置独立口令' : '解锁凭证'"
    width="440px"
    hide-footer
    show-close
    @close="closePrompt"
  >
    <form
      class="ai-settings-prompt"
      @submit.prevent="confirmCredential"
    >
      <label class="ai-settings-field"
        ><span class="ai-settings-label">独立口令</span
        ><input
          ref="passphraseInput"
          type="password"
          class="ai-settings-input"
          autocomplete="new-password"
      /></label>
      <label
        v-if="prompt === 'save'"
        class="ai-settings-field"
      >
        <span class="ai-settings-label">确认独立口令</span>
        <input
          ref="confirmPassphraseInput"
          type="password"
          class="ai-settings-input"
          autocomplete="new-password"
        />
      </label>
      <p
        v-if="prompt === 'save'"
        class="ai-settings-note"
      >
        请妥善保管口令；遗失后无法找回已保存的 Key。
      </p>
      <div class="ai-settings-actions">
        <MButton
          type="button"
          variant="ghost"
          :disabled="busy"
          @click="closePrompt"
          >取消</MButton
        >
        <MButton
          type="submit"
          variant="primary"
          :disabled="busy"
          >{{ busy ? '处理中…' : '确认' }}</MButton
        >
      </div>
    </form>
  </MModal>

  <MModal
    :z-index="zIndex"
    :open="prompt === 'delete'"
    title="删除已保存凭证"
    width="440px"
    hide-footer
    show-close
    @close="closePrompt"
  >
    <div class="ai-settings-prompt">
      <p>确定删除当前服务商在此浏览器中保存的 Key？此操作不会撤销服务商的 Key。</p>
      <div class="ai-settings-actions">
        <MButton
          variant="ghost"
          :disabled="busy"
          @click="closePrompt"
          >取消</MButton
        ><MButton
          variant="danger"
          :disabled="busy"
          @click="removeSaved"
          >删除</MButton
        >
      </div>
    </div>
  </MModal>
</template>

<style scoped>
.ai-settings,
.ai-settings-prompt {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ai-settings-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.ai-settings-provider-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr);
  align-items: end;
  gap: 12px;
}
.ai-settings-label {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.ai-settings-input {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
  color: var(--text-primary);
  transition:
    border-color 180ms var(--ease-standard),
    box-shadow 180ms var(--ease-standard),
    background-color 180ms var(--ease-standard);
}
.ai-settings-input:disabled {
  background: var(--bg-elevated);
  border-color: var(--border-subtle);
  color: var(--text-muted);
  opacity: 1;
  cursor: not-allowed;
  user-select: none;
}
.ai-settings-input:focus:not(:disabled),
.ai-settings :deep(.select-trigger:focus-visible),
.ai-settings :deep(.select-trigger[aria-expanded='true']) {
  border-color: var(--border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-muted);
}
.ai-settings :deep(.select-trigger) {
  transition:
    border-color 180ms var(--ease-standard),
    box-shadow 180ms var(--ease-standard),
    background-color 180ms var(--ease-standard);
}
.ai-settings-model-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.ai-settings-model-row .ai-settings-input {
  flex: 1 1 180px;
}
.ai-settings-model-fetch.m-button {
  height: 36px;
  border-color: var(--border-subtle);
  background: var(--bg-surface);
}
.ai-settings-model-fetch.m-button:hover:not(:disabled) {
  border-color: var(--border-hover);
  background: var(--bg-elevated);
}
.ai-model-list {
  min-width: 0;
  min-height: 36px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
}
.ai-model-columns,
.ai-model-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.ai-model-columns {
  padding: 8px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  border-bottom: 1px solid var(--border-subtle);
}
.ai-model-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  padding: 8px;
  overflow-y: auto;
}
.ai-model-name {
  padding: 6px 8px;
}
.ai-model-id {
  display: block;
  min-width: 0;
  padding: 6px 8px;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-settings-storage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}
.ai-settings-storage .m-choice {
  align-items: center;
}
.ai-settings-note,
.ai-settings-prompt p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  line-height: 1.6;
}
.ai-settings-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .ai-settings-input,
  .ai-settings :deep(.select-trigger) {
    transition: none;
  }
}
</style>
