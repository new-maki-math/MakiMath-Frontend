<script setup>
import { InlineCodeNode } from 'markstream-vue';
import { computed, inject } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});
const openReference = inject('ai-open-reference', null);
const reference = computed(() =>
  /^(知识点|题目|讲义|本地讲义)\s*[:：]\s*([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/.exec(
    props.node.code || ''
  )
);
</script>

<template>
  <button
    v-if="reference && openReference"
    type="button"
    class="ai-reference"
    :title="`查看${reference[1]}详情`"
    @click="openReference(reference[1], reference[2], $event.currentTarget)"
  >
    {{ node.code }}
  </button>
  <InlineCodeNode
    v-else
    :node="node"
  />
</template>

<style scoped>
.ai-reference {
  display: inline;
  max-width: 100%;
  padding: 1px 5px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-hover);
  color: var(--accent-primary);
  font: inherit;
  font-size: 0.9em;
  line-height: 1.5;
  overflow-wrap: anywhere;
  vertical-align: baseline;
}
.ai-reference:hover {
  border-color: var(--accent-primary);
  text-decoration: underline;
}
.ai-reference:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
</style>
