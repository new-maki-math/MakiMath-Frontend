<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: [Boolean, Array],
    default: false
  },
  value: {
    type: [String, Number, Boolean, Object],
    default: undefined
  },
  ariaLabel: {
    type: String,
    default: undefined
  },
  indeterminate: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['update:modelValue']);
const checked = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});
</script>

<template>
  <label
    class="m-choice"
    :class="{
      'is-disabled': disabled
    }"
  >
    <input
      v-model="checked"
      type="checkbox"
      :value="value"
      :aria-label="ariaLabel"
      :indeterminate="indeterminate"
      :disabled="disabled"
    />
    <span v-if="$slots.default"><slot /></span>
  </label>
</template>

<style scoped src="./choice.css"></style>
