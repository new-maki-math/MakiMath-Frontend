<script setup>
import TypstDoc from '../../components/Renderer/TypstDoc.vue';
import { ref, watch } from 'vue';
import { reviewApi } from '../../api/reviews.js';
import { lectureApi } from '../../api/lectures.js';
import { notify } from '../../components/MNotice.vue';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import MTable from '../../components/MTable.vue';
import MTextarea from '../../components/MTextarea.vue';

const kind = ref('lecture');
const items = ref([]);
const loading = ref(false);
const selected = ref(null);
const detail = ref(null);
const detailError = ref('');
const detailLoading = ref(false);
const decision = ref('');
const comment = ref('');
const saving = ref(false);
let loadId = 0;
let detailId = 0;

const load = async () => {
  const id = ++loadId;
  loading.value = true;
  try {
    const result = await reviewApi.pending(kind.value);
    if (id === loadId) items.value = result;
  } catch (err) {
    if (id === loadId) notify(err.message || '加载审核列表失败', 'error');
  } finally {
    if (id === loadId) loading.value = false;
  }
};

const showDetail = async (item) => {
  const id = ++detailId;
  selected.value = item;
  comment.value = '';
  decision.value = '';
  detail.value = null;
  detailError.value = '';
  detailLoading.value = true;
  try {
    const result = await lectureApi.getRevision(item.id);
    if (id === detailId) detail.value = result;
  } catch (err) {
    if (id === detailId) detailError.value = err.message || '读取审核内容失败';
  } finally {
    if (id === detailId) detailLoading.value = false;
  }
};

const closeDetail = () => {
  if (saving.value) return;
  detailId++;
  selected.value = null;
};

const submit = async () => {
  if (!selected.value || !detail.value || !decision.value || saving.value) return;
  saving.value = true;
  try {
    await reviewApi.decide(kind.value, selected.value.id, decision.value, comment.value);
    selected.value = null;
    decision.value = '';
    comment.value = '';
    await load();
    notify('审核已完成', 'success');
  } catch (err) {
    notify(err.status === 409 ? '审核状态已变化，请刷新后重新核对' : err.message || '审核失败', 'error');
  } finally {
    saving.value = false;
  }
};

watch(kind, () => {
  detailId++;
  selected.value = null;
  items.value = [];
  load();
}, { immediate: true });
</script>

<template>
  <section class="review-panel font-mono">
    <h1>内容审核</h1>
    <MTable :data="items" :loading="loading">
      <template #header><th>版本</th><th>标题</th><th>提交时间</th><th>操作</th></template>
      <template #rows="{ data }">
        <tr v-for="item in data" :key="item.id">
          <td>{{ item.id }}</td><td>{{ item.title }}</td><td>{{ item.submitted_at }}</td>
          <td><MButton size="sm" @click="showDetail(item)">查看</MButton></td>
        </tr>
      </template>
    </MTable>
    <MModal :open="Boolean(selected)" title="审核内容" width="760px" hide-footer @close="closeDetail">
      <p v-if="detailLoading">正在加载内容</p>
      <p v-else-if="detailError">{{ detailError }}</p>
      <template v-else-if="detail">
        <div class="review-content">
          <template>
            <h2>{{ detail.revision.title }}</h2>
            <p class="review-note">当前仅支持部分语法，未支持的内容请结合源码及诊断审核。</p>
            <section v-for="chapter in detail.chapters" :key="chapter.occurrence_id">
              <h3>{{ chapter.title }}</h3>
              <div v-for="section in chapter.sections" :key="section.occurrence_id">
                <h4>{{ section.title }}</h4>
                <template v-if="section.source">
                  <TypstDoc :source="section.source" />
                  <details class="review-source"><summary>查看原始源码</summary><pre>{{ section.source }}</pre></details>
                </template>
                <p v-else>暂无源码</p>
              </div>
            </section>
          </template>
        </div>
        <MTextarea v-model="comment" label="审核意见" :rows="3" />
        <div class="review-actions">
          <MButton variant="danger" :disabled="saving" @click="decision = 'rejected'; submit()">驳回</MButton>
          <MButton variant="primary" :disabled="saving" @click="decision = 'approved'; submit()">通过</MButton>
        </div>
      </template>
    </MModal>
  </section>
</template>

<style scoped>
.review-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-content {
  max-height: 45vh;
  overflow: auto;
}

.review-note { color: var(--text-secondary); font-size: var(--font-size-smaller); }

.review-source pre { white-space: pre-wrap; overflow-wrap: anywhere; }

.review-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
