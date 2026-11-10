<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useAttrs, useId, watch } from 'vue';

import { CheckCircleSolid, NavArrowDown } from '../icons/icons.js';

defineOptions({
  inheritAttrs: false
});

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  ariaLabel: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'ghost'].includes(value)
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();
const id = useId();
const listId = `select-list-${id}`;
const hintId = `select-hint-${id}`;
const trigger = ref(null);
const menu = ref(null);
const open = ref(false);
const activeIndex = ref(-1);
const position = ref(null);
let searchText = '';
let searchTimer;

function triggerAttrs() {
  const value = {
    ...attrs
  };
  delete value.class;
  delete value.style;
  return value;
}
const selectedIndex = computed(() =>
  props.options.findIndex((option) => String(option.value) === String(props.modelValue))
);
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? '请选择');
const describedBy = computed(
  () => [attrs['aria-describedby'], props.hint ? hintId : ''].filter(Boolean).join(' ') || undefined
);
function optionId(index) {
  return `${listId}-option-${index}`;
}
function enabledIndex(start, direction) {
  if (!props.options.length) {
    return -1;
  }
  for (let step = 0; step < props.options.length; step++) {
    const index = (start + step * direction + props.options.length) % props.options.length;
    if (!props.options[index].disabled) {
      return index;
    }
  }
  return -1;
}
function scrollActive() {
  nextTick(() => {
    const item = document.getElementById(optionId(activeIndex.value));
    const container = menu.value;
    if (!item || !container) {
      return;
    }
    if (item.offsetTop < container.scrollTop) {
      container.scrollTop = item.offsetTop;
    } else if (item.offsetTop + item.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = item.offsetTop + item.offsetHeight - container.clientHeight;
    }
  });
}
function updatePosition() {
  if (!open.value || !trigger.value || !menu.value) {
    return;
  }
  const rect = trigger.value.getBoundingClientRect();
  const margin = 8;
  const gap = 4;
  const width = Math.max(0, Math.min(Math.max(rect.width, 160), window.innerWidth - margin * 2));
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  const below = Math.max(0, window.innerHeight - rect.bottom - margin - gap);
  const above = Math.max(0, rect.top - margin - gap);
  const naturalHeight = Math.min(menu.value.scrollHeight, 256);
  const useAbove = below < naturalHeight && above > below;
  const available = useAbove ? above : below;
  const maxHeight = Math.max(0, Math.min(256, available));
  const height = Math.min(naturalHeight, maxHeight);
  position.value = {
    left: `${left}px`,
    top: `${useAbove ? rect.top - gap - height : rect.bottom + gap}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`
  };
}
async function show() {
  if (props.disabled || open.value) {
    return;
  }
  document.dispatchEvent(
    new CustomEvent('maki-select-open', {
      detail: id
    })
  );
  activeIndex.value =
    selectedIndex.value >= 0 && !props.options[selectedIndex.value]?.disabled
      ? selectedIndex.value
      : enabledIndex(0, 1);
  position.value = null;
  open.value = true;
  await nextTick();
  updatePosition();
  scrollActive();
}
function close(restoreFocus = false) {
  open.value = false;
  position.value = null;
  searchText = '';
  clearTimeout(searchTimer);
  if (restoreFocus) {
    nextTick(() =>
      trigger.value?.focus({
        preventScroll: true
      })
    );
  }
}
function selectOption(index) {
  const option = props.options[index];
  if (!option || option.disabled) {
    return;
  }
  if (String(option.value) !== String(props.modelValue)) {
    emit('update:modelValue', String(option.value));
  }
  close(true);
}
function onKeydown(event) {
  if (event.key === 'Tab') {
    close();
    return;
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    event.stopPropagation();
    close(true);
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    if (!open.value) {
      show();
      return;
    }
    const start =
      activeIndex.value < 0
        ? direction > 0
          ? 0
          : props.options.length - 1
        : (activeIndex.value + direction + props.options.length) % props.options.length;
    activeIndex.value = enabledIndex(start, direction);
    scrollActive();
    return;
  }
  if (open.value && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault();
    activeIndex.value = enabledIndex(
      event.key === 'Home' ? 0 : props.options.length - 1,
      event.key === 'Home' ? 1 : -1
    );
    scrollActive();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (open.value) {
      selectOption(activeIndex.value);
    } else {
      show();
    }
    return;
  }
  if (open.value && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    searchText += event.key.toLocaleLowerCase();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchText = '';
    }, 700);
    const index = props.options.findIndex(
      (option) =>
        !option.disabled && String(option.label).toLocaleLowerCase().startsWith(searchText)
    );
    if (index >= 0) {
      activeIndex.value = index;
      scrollActive();
    }
  }
}
function onOutsidePointer(event) {
  if (open.value && !trigger.value?.contains(event.target) && !menu.value?.contains(event.target)) {
    close();
  }
}
function onOtherSelect(event) {
  if (event.detail !== id) {
    close();
  }
}
function onScroll(event) {
  if (!menu.value?.contains(event.target)) {
    updatePosition();
  }
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close();
  }
);
watch(
  () => props.options,
  () => {
    if (open.value) {
      activeIndex.value =
        selectedIndex.value >= 0 && !props.options[selectedIndex.value]?.disabled
          ? selectedIndex.value
          : enabledIndex(0, 1);
      nextTick(updatePosition);
    }
  }
);
onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer, true);
  document.addEventListener('maki-select-open', onOtherSelect);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', onScroll, true);
});
onUnmounted(() => {
  clearTimeout(searchTimer);
  document.removeEventListener('pointerdown', onOutsidePointer, true);
  document.removeEventListener('maki-select-open', onOtherSelect);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', onScroll, true);
});
</script>

<template>
  <div
    class="m-field"
    :class="[$attrs.class, variant === 'ghost' ? 'is-inline' : '']"
    :style="$attrs.style"
  >
    <span
      v-if="label"
      class="field-label"
      :id="`${listId}-label`"
      >{{ label }}</span
    >
    <button
      ref="trigger"
      v-bind="triggerAttrs()"
      type="button"
      class="select-trigger"
      :class="[`size-${size}`, `variant-${variant}`, iconOnly ? 'is-icon-only' : '']"
      :disabled="disabled"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :aria-label="ariaLabel || undefined"
      :aria-labelledby="!ariaLabel && label ? `${listId}-label` : undefined"
      :aria-describedby="describedBy"
      :aria-required="required || undefined"
      @click="open ? close() : show()"
      @keydown="onKeydown"
    >
      <span
        v-if="$slots.icon"
        class="select-icon"
        aria-hidden="true"
        ><slot name="icon"
      /></span>
      <span
        v-if="!iconOnly"
        class="select-text"
        >{{ selectedLabel }}</span
      >
      <NavArrowDown
        v-if="!iconOnly"
        class="select-caret"
        width="14"
        height="14"
        aria-hidden="true"
      />
    </button>
    <input
      v-if="name"
      type="hidden"
      :name="name"
      :value="modelValue"
      :disabled="disabled"
    />
    <span
      v-if="hint"
      :id="hintId"
      class="field-hint"
      >{{ hint }}</span
    >
    <Teleport to="body">
      <div
        v-if="open"
        ref="menu"
        :id="listId"
        class="select-menu"
        :style="position || 'visibility: hidden'"
        role="listbox"
        :aria-label="ariaLabel || label || '选择选项'"
      >
        <div
          v-for="(option, index) in options"
          :id="optionId(index)"
          :key="`${option.value}:${index}`"
          class="select-option"
          :class="[
            index === activeIndex ? 'is-active' : '',
            index === selectedIndex ? 'is-selected' : '',
            option.disabled ? 'is-disabled' : ''
          ]"
          role="option"
          :aria-selected="index === selectedIndex"
          :aria-disabled="option.disabled || undefined"
          @mouseenter="!option.disabled && (activeIndex = index)"
          @mousedown.prevent
          @click="selectOption(index)"
        >
          <component
            :is="option.icon"
            v-if="option.icon"
            class="option-icon"
            width="16"
            height="16"
            aria-hidden="true"
          />
          <span class="option-label">{{ option.label }}</span>
          <CheckCircleSolid
            v-if="index === selectedIndex"
            class="option-check"
            width="15"
            height="15"
          />
        </div>
        <div
          v-if="!options.length"
          class="select-empty"
        >
          暂无选项
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="./field.css"></style>

<style scoped>
.m-field.is-inline {
  display: inline-block;
}
.select-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--font-size);
  text-align: left;
}
.select-trigger.size-sm {
  height: 28px;
  padding: 0 8px;
  font-size: var(--font-size-smaller);
}
.select-trigger:hover:not(:disabled),
.select-trigger[aria-expanded='true'] {
  border-color: var(--border-hover);
  background: var(--bg-elevated);
}
.select-trigger:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}
.select-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.select-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
}
.select-caret {
  flex: none;
  color: var(--text-muted);
  transition: transform 140ms ease;
}
.select-trigger[aria-expanded='true'] .select-caret {
  transform: rotate(180deg);
}
.select-trigger.variant-ghost {
  width: auto;
  min-width: 36px;
  border-color: transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.select-trigger.variant-ghost:hover:not(:disabled),
.select-trigger.variant-ghost[aria-expanded='true'] {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.select-trigger.is-icon-only {
  justify-content: center;
  width: 36px;
  padding: 0;
}
.select-menu {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  box-shadow: 0 8px 24px var(--shadow-color-strong);
  color: var(--text-primary);
  overscroll-behavior: contain;
}
.select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 7px 9px;
  border-radius: var(--radius);
  font-size: var(--font-size-smaller);
  cursor: pointer;
}
.select-option.is-active:not(.is-disabled) {
  background: var(--bg-hover);
}
.select-option.is-selected {
  color: var(--accent-primary);
  font-weight: var(--font-weight-medium);
}
.select-option.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.option-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.option-icon {
  flex: none;
}
.option-check {
  flex: none;
}
.select-empty {
  padding: 10px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
@media (max-width: 600px) {
  .select-option {
    min-height: 40px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .select-caret {
    transition: none;
  }
}
</style>
