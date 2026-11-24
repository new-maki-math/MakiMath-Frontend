<script setup>
import 'katex/dist/katex.min.css';
import 'markstream-vue/index.css';

import MarkdownRender, { enableKatex, setCustomComponents } from 'markstream-vue';
import { defineComponent, h, onBeforeUnmount, onMounted, provide, ref } from 'vue';

import AiReferenceCode from './AiReferenceCode.vue';

defineProps({
  content: {
    type: String,
    required: true
  },
  final: {
    type: Boolean,
    default: true
  }
});
const emit = defineEmits(['reference']);
provide('ai-open-reference', (type, id, target) =>
  emit('reference', {
    type,
    id,
    target
  })
);

const dark = ref(document.documentElement.dataset.theme === 'dark');
const reducedMotion = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let observer;
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function updateMotionPreference(event) {
  reducedMotion.value = event.matches;
}
const ImagePlaceholder = defineComponent({
  props: {
    node: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    return () =>
      h(
        'span',
        {
          class: 'ai-markdown-image'
        },
        props.node.alt || '图片'
      );
  }
});

enableKatex();
setCustomComponents('maki-ai', {
  image: ImagePlaceholder,
  inline_code: AiReferenceCode
});

onMounted(() => {
  motionPreference.addEventListener('change', updateMotionPreference);
  observer = new MutationObserver(() => {
    dark.value = document.documentElement.dataset.theme === 'dark';
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});
onBeforeUnmount(() => {
  observer?.disconnect();
  motionPreference.removeEventListener('change', updateMotionPreference);
});
</script>

<template>
  <MarkdownRender
    class="ai-markdown"
    custom-id="maki-ai"
    mode="chat"
    html-policy="escape"
    :content="content"
    :is-dark="dark"
    :final="final"
    :fade="!final && !reducedMotion"
    :smooth-streaming="!final && !reducedMotion ? 'auto' : false"
    :render-code-blocks-as-pre="true"
  />
</template>

<style scoped>
.ai-markdown {
  color: var(--text-primary);
  overflow-wrap: anywhere;
  user-select: text;
  -webkit-user-select: text;
}
.ai-markdown :deep(.paragraph-node),
.ai-markdown :deep(.list-item > .paragraph-node) {
  line-height: 2;
}
.ai-markdown :deep(.list-item) {
  margin-block: 1em;
}
.ai-markdown :deep(.list-item > .paragraph-node + .paragraph-node) {
  margin-top: 0.6em;
}
.ai-markdown :deep(.math-inline-wrapper) {
  padding-block: 0.15em;
}
.ai-markdown :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
}
.ai-markdown :deep(.math-block) {
  max-width: 100%;
  padding-block: 0.35em;
  overflow-x: auto;
  overflow-y: hidden;
}
.ai-markdown :deep(.katex-display) {
  overflow: visible;
}
</style>
