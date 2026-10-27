<script setup>
import { ref, watch } from 'vue';
import { managementApi } from '../../api/management.js';
import { invalidateCourseCaches } from '../../api/courses.js';
import { notify } from '../../components/MNotice.vue';
import MTabs from '../../components/MTabs.vue';
import MTable from '../../components/MTable.vue';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MSelect from '../../components/MSelect.vue';

const kind = ref('knowledge');
const items = ref([]);
const selected = ref(null);
const form = ref({ slug: '', name: '', descr: '', parent_id: '', pos: 0, status: 'active' });
const open = ref(false);
const busy = ref(false);
const loading = ref(false);
let loadId = 0;

const load = async () => {
  const id = ++loadId;
  loading.value = true;
  try {
    const result = await managementApi.categories(kind.value);
    if (id === loadId) items.value = result;
  } catch (err) {
    if (id === loadId) notify(err.message || '加载分类失败', 'error');
  } finally {
    if (id === loadId) loading.value = false;
  }
};

const edit = (item = null) => {
  selected.value = item;
  form.value = item
    ? { slug: item.slug, name: item.name, descr: item.descr || '', parent_id: item.parent_id == null ? '' : String(item.parent_id), pos: item.pos, status: 'active' }
    : { slug: '', name: '', descr: '', parent_id: '', pos: 0, status: 'active' };
  open.value = true;
};

const save = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    const body = {
      name: form.value.name.trim(),
      descr: form.value.descr,
      parent_id: form.value.parent_id ? Number(form.value.parent_id) : null,
      pos: Number(form.value.pos)
    };
    if (selected.value) {
      await managementApi.updateCategory(kind.value, selected.value.id, { ...body, status: form.value.status });
    } else {
      await managementApi.createCategory(kind.value, { ...body, slug: form.value.slug.trim() });
    }
    invalidateCourseCaches();
    open.value = false;
    await load();
    notify('分类已保存', 'success');
  } catch (err) {
    notify(err.message || '分类保存失败', 'error');
  } finally {
    busy.value = false;
  }
};

watch(kind, () => {
  items.value = [];
  load();
}, { immediate: true });
</script>

<template>
  <section class="category-management font-mono">
    <h1>分类管理</h1>
    <MTabs v-model="kind" :tabs="[{ label: '知识点', value: 'knowledge' }, { label: '讲义', value: 'lecture' }]" />
    <MButton variant="primary" size="sm" @click="edit()">新建分类</MButton>
    <MTable :data="items" :loading="loading">
      <template #header><th>名称</th><th>标识</th><th>父分类</th><th>排序</th><th>操作</th></template>
      <template #rows="{ data }">
        <tr v-for="item in data" :key="item.id">
          <td>{{ item.name }}</td><td>{{ item.slug }}</td><td>{{ item.parent_id || '-' }}</td><td>{{ item.pos }}</td>
          <td><MButton size="sm" @click="edit(item)">编辑</MButton></td>
        </tr>
      </template>
    </MTable>
    <MModal :open="open" :title="selected ? '编辑分类' : '新建分类'" :busy="busy" @close="!busy && (open = false)" @confirm="save">
      <MInput v-model="form.name" label="名称" />
      <MInput v-if="!selected" v-model="form.slug" label="标识" />
      <MTextarea v-model="form.descr" label="描述" :rows="2" />
      <MSelect v-model="form.parent_id" label="父分类" :options="[{ value: '', label: '无' }, ...items.filter((item) => item.id !== selected?.id).map((item) => ({ value: String(item.id), label: item.name }))]" />
      <MInput v-model="form.pos" label="排序" type="number" />
      <MSelect v-if="selected" v-model="form.status" label="状态" :options="[{ value: 'active', label: '启用' }, { value: 'archived', label: '归档' }]" />
    </MModal>
  </section>
</template>

<style scoped>
.category-management {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
</style>
