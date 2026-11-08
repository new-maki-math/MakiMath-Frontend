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
  <label class="m-choice"
:class="{
 'is-disabled': disabled 
}">
    <input v-model="checked"
type="checkbox"
:value="value"
:disabled="disabled" />
    <span><slot /></span>
  </label>
</template>

<style scoped src="./choice.css"></style>
