<script setup>
import { ref } from 'vue';

import { ArrowLeft, NavArrowRight, Page } from '../../components/icons/icons.js';
import MButton from '../../components/form/MButton.vue';
import MDataView from '../../components/feedback/MDataView.vue';
import MEmpty from '../../components/feedback/MEmpty.vue';
import MFileTypeIcon from '../../components/display/MFileTypeIcon.vue';
import MPagination from '../../components/display/MPagination.vue';
import MInput from '../../components/form/MInput.vue';
import QuestionDetailDialog from './QuestionDetailDialog.vue';
import { useQuestionBrowser } from './useQuestionBrowser.js';

const { categoryId, query, offset, data, loading, error, load, navigate } = useQuestionBrowser();
const selectedId = ref(null);
const selectedEntryId = ref(null);
const selectedTitle = ref('');
function selectQuestion(item) {
  selectedId.value = item.question_id;
  selectedEntryId.value = item.id;
  selectedTitle.value = item.source_number || item.slug || '';
}
function closeQuestion() {
  selectedId.value = null;
  selectedEntryId.value = null;
  selectedTitle.value = '';
}
function goUp() {
  navigate(data.value?.breadcrumbs?.at(-2)?.id ?? null);
}
</script>

<template>
  <main class="question-bank">
    <div class="browser-heading">
      <MButton
        v-if="categoryId !== null"
        variant="ghost"
        size="sm"
        icon-only
        aria-label="上一级"
        title="上一级"
        @click="goUp"
        ><ArrowLeft
          width="18"
          height="18"
      /></MButton>
      <nav
        class="path"
        aria-label="题库路径"
      >
        <button
          type="button"
          :disabled="categoryId === null"
          @click="navigate(null)"
        >
          全部题目
        </button>
        <template
          v-for="crumb in data?.breadcrumbs || []"
          :key="crumb.id"
        >
          <NavArrowRight
            width="14"
            height="14"
            aria-hidden="true"
          />
          <button
            type="button"
            :disabled="crumb.id === categoryId"
            @click="navigate(crumb.id)"
          >
            {{ crumb.name }}
          </button>
        </template>
      </nav>
      <MInput
        v-model="query"
        class="search"
        aria-label="搜索题目"
        placeholder="搜索题干、标识或来源题号"
      />
    </div>
    <MDataView
      :loading="loading"
      text="正在加载题库…"
      :content-key="`${categoryId}:${offset}:${query}`"
    >
      <p
        v-if="error"
        class="state"
        role="alert"
      >
        {{ error }}
        <MButton
          size="sm"
          variant="ghost"
          @click="load"
          >重试</MButton
        >
      </p>
      <template v-else-if="data">
        <p
          v-if="query.trim()"
          class="scope"
        >
          {{ categoryId === null ? '搜索整个题库' : '搜索当前目录及子目录' }}
        </p>
        <div class="items">
          <button
            v-for="folder in data.children"
            :key="`folder:${folder.id}`"
            class="row"
            type="button"
            @click="navigate(folder.id)"
          >
            <MFileTypeIcon
              type="folder"
              class="item-icon"
            />
            <span class="item-name">{{ folder.name }}</span>
            <NavArrowRight
              width="16"
              height="16"
              aria-hidden="true"
            />
          </button>
          <button
            v-for="item in data.items"
            :key="`entry:${item.id}`"
            class="row"
            type="button"
            @click="selectQuestion(item)"
          >
            <Page
              class="item-icon question-icon"
              aria-hidden="true"
            />
            <span class="item-copy"
              ><strong>{{ item.source_number || item.slug }}</strong
              ><span>{{ item.stem_summary || item.slug }}</span></span
            >
            <span class="difficulty">难度 {{ item.difficulty }} / 5</span>
          </button>
        </div>
        <MEmpty v-if="!data.children.length && !data.items.length" />
        <MPagination
          v-if="data.pagination.total > 50"
          class="pagination"
          compact
          :page="Math.floor(offset / 50) + 1"
          :page-size="50"
          :total="data.pagination.total"
          :disabled="loading"
          @update:page="offset = ($event - 1) * 50"
        />
      </template>
    </MDataView>
    <QuestionDetailDialog
      :question-id="selectedId"
      :entry-id="selectedEntryId"
      :question-title="selectedTitle"
      @navigate="selectQuestion"
      @close="closeQuestion"
    />
  </main>
</template>

<style scoped>
.question-bank {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 24px clamp(20px, 3vw, 40px);
  color: var(--text-primary);
}
.browser-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}
.path {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  color: var(--text-secondary);
}
.path button:disabled {
  color: var(--text-primary);
}
.path button:not(:disabled):hover {
  color: var(--accent-primary);
}
.path svg {
  flex: none;
}
.search {
  width: min(300px, 45%);
}
.scope,
.state {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.items {
  border-top: 1px solid var(--border-subtle);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 54px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  text-align: left;
}
.row:hover {
  background: var(--bg-hover);
}
.item-icon {
  flex: none;
  width: 24px;
  height: 24px;
}
.question-icon {
  color: var(--accent-primary);
}
.item-name,
.item-copy {
  flex: 1;
  min-width: 0;
}
.item-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.item-copy strong {
  font-weight: var(--font-weight-medium);
}
.item-copy span {
  overflow: hidden;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.difficulty,
.pagination {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
}
@media (max-width: 600px) {
  .browser-heading {
    flex-wrap: wrap;
  }
  .search {
    width: 100%;
  }
  .question-bank {
    padding: 16px;
  }
}
</style>
