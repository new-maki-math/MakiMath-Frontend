import { computed, reactive } from 'vue';

// 表单脏检查与增量变更提取
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

  const commit = (saved = form) => {
    for (const key of fields) baseline[key] = saved[key];
  };

  return { form, fill, dirty, reset, diff, commit };
}

// 独立文本脏检查
export function useText(initial = '') {
  const value = reactive({ text: initial, baseline: initial });

  const dirty = computed(() => value.text !== value.baseline);
  const reset = () => { value.text = value.baseline; };
  const set = (text) => { value.text = text; value.baseline = text; };
  const commit = (saved = value.text) => { value.baseline = saved; };

  return { state: value, dirty, reset, set, commit };
}
