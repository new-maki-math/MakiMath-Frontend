import { computed, reactive } from 'vue';

/**
 * 表单字段与原始值比对，提供脏检查、放弃改动与增量提交
 */
export function useForm(fields) {
  const form = reactive({});
  const baseline = reactive({});

  const fill = (source) => {
    for (const key of fields) {
      const value = source?.[key];
      form[key] = value === undefined || value === null ? '' : value;
      baseline[key] = form[key];
    }
  };

  const dirty = computed(() => fields.some((key) => form[key] !== baseline[key]));

  const reset = () => {
    for (const key of fields) form[key] = baseline[key];
  };

  const diff = () => {
    const out = {};
    for (const key of fields) {
      if (form[key] !== baseline[key]) out[key] = form[key];
    }
    return out;
  };

  const commit = () => {
    for (const key of fields) baseline[key] = form[key];
  };

  return { form, fill, dirty, reset, diff, commit };
}

/**
 * 非 PATCH 字段（如 Typst 源文）的独立脏检查
 */
export function useText(initial = '') {
  const value = reactive({ text: initial, baseline: initial });

  const dirty = computed(() => value.text !== value.baseline);
  const reset = () => { value.text = value.baseline; };
  const set = (text) => { value.text = text; value.baseline = text; };
  const commit = () => { value.baseline = value.text; };

  return { state: value, dirty, reset, set, commit };
}
