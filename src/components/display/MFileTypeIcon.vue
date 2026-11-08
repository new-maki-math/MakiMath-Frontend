<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'file'
  }
});

const types = {
  pdf: {
    color: '#D85C64',
    label: 'PDF'
  },
  doc: {
    color: '#5388D8',
    label: 'DOC'
  },
  docx: {
    color: '#5388D8',
    label: 'DOC'
  },
  xls: {
    color: '#43A779',
    label: 'XLS'
  },
  xlsx: {
    color: '#43A779',
    label: 'XLS'
  },
  ppt: {
    color: '#D98954',
    label: 'PPT'
  },
  pptx: {
    color: '#D98954',
    label: 'PPT'
  },
  image: {
    color: '#A77BCC',
    label: 'IMG'
  },
  zip: {
    color: '#B6924F',
    label: 'ZIP'
  },
  file: {
    color: '#8793A2',
    label: ''
  }
};
const file = computed(() => types[props.type.toLowerCase()] || types.file);
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <template v-if="type === 'folder' || type === 'archive'">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h7l2.5 3h11.5A2.5 2.5 0 0 1 29 10.5V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z"
        :fill="type === 'archive' ? '#8090A0' : '#DDAE55'"
      />
      <path
        d="M3 13h26v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13Z"
        :fill="type === 'archive' ? '#A0ADBA' : '#EBC67A'"
      />
      <path
        v-if="type === 'archive'"
        d="M12 18h8"
        stroke="#536474"
        stroke-width="2"
        stroke-linecap="round"
      />
    </template>
    <template v-else>
      <path
        d="M7 2.5h11l7 7V27a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 5 27V5a2.5 2.5 0 0 1 2-2.5Z"
        :fill="file.color"
      />
      <path
        d="M18 2.5v5a2 2 0 0 0 2 2h5L18 2.5Z"
        fill="#fff"
        fill-opacity=".38"
      />
      <path
        v-if="!file.label"
        d="M9 16h12M9 20h12M9 24h8"
        stroke="#fff"
        stroke-opacity=".82"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <text
        v-else
        x="15"
        y="23"
        text-anchor="middle"
        fill="#fff"
        font-family="Arial, sans-serif"
        font-size="7.5"
        font-weight="700"
        letter-spacing=".1"
      >
        {{ file.label }}
      </text>
    </template>
  </svg>
</template>
