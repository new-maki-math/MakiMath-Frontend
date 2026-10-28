<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import { workbenchPanelState } from '../../utils/workbench-state.js';
import { lectureApi, lectureSaveBody } from '../../api/lectures.js';
import { managementApi } from '../../api/management.js';
import { listLocalLectures, createLocalLecture, saveLocalLecture, deleteLocalLecture } from '../../utils/local-lectures.js';
import { notify } from '../../components/MNotice.vue';
import LectureWorkbenchTree from './LectureWorkbenchTree.vue';
import CoursePanel from './CoursePanel.vue';
import ChapterPanel from './ChapterPanel.vue';
import SectionPanel from './SectionPanel.vue';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MModal from '../../components/MModal.vue';
import './workbench.css';

const lectures = ref([]);
const listLoading = ref({ local: true, online: true });
const listErrors = ref({ local: '', online: '' });
const treeRef = ref(null);
const localLectures = ref([]);
const lectureTrees = ref(new Map());
const lectureVersions = ref(new Map());
const versionNameErrors = ref(new Set());
const treeLoadingKeys = ref(new Set());
const lecture = ref(null);
const revision = ref(null);
const chapters = ref([]);
const categories = ref([]);
const selected = ref({ type: 'lecture', id: '' });
const baseline = ref('');
const loading = ref(false);
const loadingKey = ref('');
const saving = ref(false);
const onlineConflict = ref(false);
const pendingSnapshotId = ref(null);
const submitOpen = ref(false);
const submitCountdown = ref(5);
const submitTarget = ref(null);
let submitTimer = null;
let submitDeadline = 0;
const createOpen = ref(false);
const downloadOpen = ref(false);
const downloadSlug = ref('');
const createSource = ref('local');
const createForm = ref({ title: '', slug: '' });
const leaveOpen = ref(false);
const removeTarget = ref(null);
const treeBusy = ref(false);
let loadSequence = 0;
let listSequence = 0;
let resolveLeave = null;
let treeEpoch = 0;
let draftRefreshSequence = 0;
let identityEpoch = 0;
const versionRequests = new Map();

const snapshot = () => JSON.stringify({ revision: revision.value, chapters: chapters.value, slug: lecture.value?.isLocal ? lecture.value.slug : null });
const dirty = computed(() => Boolean(revision.value && baseline.value && snapshot() !== baseline.value));
const ownsContext = computed(() => Boolean(lecture.value?.isLocal || (lecture.value && lecture.value.ownerUserId === (currentUser.value?.id ?? null) && (lecture.value.ownerUserId === null || authStatus.value === 'authenticated'))));
const canEditOnline = computed(() => Boolean(ownsContext.value && lecture.value && !lecture.value.isLocal && lecture.value.permissionValid && lecture.value.canEdit && authStatus.value === 'authenticated' && ['editor', 'super_admin'].includes(currentUser.value?.role)));
const canEdit = computed(() => Boolean(!loading.value && !createOpen.value && (lecture.value?.isLocal || (canEditOnline.value && revision.value?.status === 'draft'))));
const readOnlyMessage = computed(() => canEditOnline.value && revision.value?.status !== 'draft'
  ? '当前版本只供查看，请选择草稿继续编辑。'
  : '当前账号无法编辑此讲义，可下载到本地查看。');
const canCreateOnline = computed(() => authStatus.value === 'authenticated' && ['editor', 'super_admin'].includes(currentUser.value?.role));
const treeNodes = computed(() => ['local', 'online'].map((source) => ({
  type: 'group', id: source, label: source === 'local' ? '本地讲义' : '我创作的讲义', actions: source === 'local' || canCreateOnline.value ? { add: true } : false,
  children: (source === 'local' ? localLectures.value : lectures.value).map((item) => {
    const key = `${source}:${item.id}`;
    const active = ownsContext.value && lecture.value?.key === key;
    const editable = active && canEdit.value && !saving.value;
    const versions = lectureVersions.value.get(key) || [];
    const versionTitle = versions.find((version) => version.status === 'draft' && version.title)?.title || versions.find((version) => version.title)?.title;
    const title = source === 'local' ? (active ? revision.value?.title : item.revision?.title) : item.title || versionTitle || (active ? revision.value?.title : '');
    return {
      type: 'lecture', id: key, label: title || (versionNameErrors.value.has(key) ? '课程名称加载失败' : item.canViewPrivate && !lectureVersions.value.has(key) ? '正在加载课程名称' : '课程名称未提供'),
      item, source, loading: loadingKey.value === key || treeLoadingKeys.value.has(key), actions: source === 'local' ? { add: editable, remove: !saving.value && !treeBusy.value } : editable ? { add: true } : false,
      children: source === 'online' && item.canViewPrivate
        ? [...versions.filter((version) => version.status === 'draft'), ...versions.filter((version) => version.status !== 'draft')].map((version) => ({
          type: 'version', id: `${key}:version:${version.id}`, courseKey: key, revisionId: version.id,
          item, source, version, label: version.status === 'draft' ? '草稿版本' : `${version.revision_no == null ? '版本号未提供' : `V${version.revision_no}`} · ${versionStatus(version.status)}`,
          actions: false, loading: treeLoadingKeys.value.has(`${key}:version:${version.id}`),
          children: makeChapterNodes(item, source, key, ownsContext.value && lecture.value?.key === key && revision.value?.id === version.id ? chapters.value : lectureTrees.value.get(`${key}:version:${version.id}`) || [], ownsContext.value && lecture.value?.key === key && revision.value?.id === version.id && canEdit.value && !saving.value, version.id)
        }))
        : makeChapterNodes(item, source, key, active ? chapters.value : source === 'local' ? item.chapters : lectureTrees.value.get(key) || [], editable)
    };
  })
})));

function versionStatus(status) {
  return { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '已驳回' }[status] || status || '状态未知';
}

function makeChapterNodes(item, source, key, tree, editable, versionId = null) {
  const versionKey = versionId == null ? key : `${key}:version:${versionId}`;
  return tree.map((chapter) => ({
    type: 'chapter', id: `${versionKey}:${chapter.occurrence_id}`, occurrenceId: chapter.occurrence_id,
    label: chapter.title || chapter.slug || '未命名章节', courseKey: key, versionId, item, source,
    actions: editable ? { add: true, move: true, remove: true } : false,
    children: chapter.sections.map((section) => ({
      type: 'section', id: `${versionKey}:${section.occurrence_id}`, occurrenceId: section.occurrence_id,
      label: section.title || section.slug || '未命名小节', courseKey: key, versionId, item, source,
      actions: editable ? { move: true, remove: true } : false
    }))
  }));
}
const selectedKey = computed(() => {
  const key = lecture.value?.key;
  const versionKey = lecture.value?.hasPrivateAccess && revision.value?.id ? `${key}:version:${revision.value.id}` : key;
  return selected.value.type === 'lecture' ? (versionKey === key ? `lecture:${key}` : `version:${versionKey}`) : `${selected.value.type}:${versionKey}:${selected.value.id}`;
});
const selectedChapter = computed(() => chapters.value.find((item) => item.occurrence_id === selected.value.id) || chapters.value.find((item) => item.sections.some((section) => section.occurrence_id === selected.value.id)));
const selectedSection = computed(() => selectedChapter.value?.sections.find((item) => item.occurrence_id === selected.value.id));
watch([dirty, saving], ([changed, busy]) => {
  workbenchPanelState.value = { dirty: changed, saving: busy };
}, { immediate: true, flush: 'sync' });

function finishLeave(confirmed) {
  leaveOpen.value = false;
  const resolve = resolveLeave;
  resolveLeave = null;
  resolve?.(confirmed);
}

function confirmLeave() {
  if (saving.value || loading.value || resolveLeave) return Promise.resolve(false);
  if (!dirty.value) return Promise.resolve(true);
  leaveOpen.value = true;
  return new Promise((resolve) => { resolveLeave = resolve; });
}

onBeforeRouteLeave(() => confirmLeave());
function beforeUnload(event) {
  if (!dirty.value && !saving.value) return;
  event.preventDefault();
  event.returnValue = '';
}

async function loadLectures() {
  const sequence = ++listSequence;
  listLoading.value = { local: true, online: true };
  listErrors.value = { local: '', online: '' };
  let publicItems = [];
  let privateItems = [];
  const updateOnline = () => {
    if (sequence !== listSequence) return;
    const merged = new Map();
    for (const item of publicItems) merged.set(item.id, { ...item, isPublic: true });
    for (const item of privateItems) merged.set(item.id, { ...merged.get(item.id), ...item, canViewPrivate: true });
    lectures.value = [...merged.values()];
  };
  const localPromise = listLocalLectures().then((items) => {
    if (sequence === listSequence) localLectures.value = items;
    return items;
  });
  const onlinePromise = (canCreateOnline.value ? lectureApi.list() : Promise.resolve([])).then((items) => { publicItems = items; updateOnline(); return items; });
  const minePromise = (canCreateOnline.value ? lectureApi.mine() : Promise.resolve([])).then((items) => {
    privateItems = items;
    updateOnline();
    if (sequence === listSequence) preloadCourseVersions(items, sequence);
    return items;
  });
  localPromise.then(() => {
    if (sequence === listSequence) listLoading.value = { ...listLoading.value, local: false };
  }, () => {
    if (sequence !== listSequence) return;
    listLoading.value = { ...listLoading.value, local: false };
    listErrors.value = { ...listErrors.value, local: '本地讲义加载失败' };
  });
  Promise.allSettled([onlinePromise, minePromise]).then(([online, mine]) => {
    if (sequence !== listSequence) return;
    let error = '';
    if (online.status === 'rejected' && mine.status === 'rejected') error = '我创作的讲义加载失败';
    else if (online.status === 'rejected') error = '我创作的讲义加载失败';
    else if (mine.status === 'rejected') error = '我创作的讲义加载失败';
    listLoading.value = { ...listLoading.value, online: false };
    listErrors.value = { ...listErrors.value, online: error };
  });
  const [local, online, mine, categoryList] = await Promise.allSettled([
    localPromise, onlinePromise, minePromise, managementApi.categories('lecture')
  ]);
  if (sequence !== listSequence) return;
  const errors = [];
  const sectionErrors = { local: '', online: '' };
  if (local.status === 'fulfilled') localLectures.value = local.value;
  else { sectionErrors.local = '本地讲义加载失败'; errors.push(sectionErrors.local); }
  if (online.status === 'rejected') { sectionErrors.online = '我创作的讲义加载失败'; errors.push(sectionErrors.online); }
  if (mine.status === 'rejected') {
    sectionErrors.online = '我创作的讲义加载失败';
    errors.push('我创作的讲义加载失败');
  }
  listErrors.value = sectionErrors;
  listLoading.value = { local: false, online: false };
  if (categoryList.status === 'fulfilled') categories.value = categoryList.value;
  if (errors.length) notify(errors.join('；'), 'error');
}

async function getCourseVersions(item) {
  const key = `online:${item.id}`;
  if (lectureVersions.value.has(key)) return lectureVersions.value.get(key);
  if (versionRequests.has(key)) return versionRequests.get(key);
  const epoch = treeEpoch;
  const promise = lectureApi.revisions(item.id).then((versions) => {
    if (!Array.isArray(versions)) throw new Error('课程版本列表不完整');
    if (epoch === treeEpoch) {
      lectureVersions.value = new Map(lectureVersions.value).set(key, versions);
      const errors = new Set(versionNameErrors.value);
      errors.delete(key);
      versionNameErrors.value = errors;
    }
    return versions;
  }).catch((err) => {
    if (epoch === treeEpoch) versionNameErrors.value = new Set(versionNameErrors.value).add(key);
    throw err;
  }).finally(() => {
    if (versionRequests.get(key) === promise) versionRequests.delete(key);
  });
  versionRequests.set(key, promise);
  return promise;
}

function preloadCourseVersions(items, sequence) {
  let index = 0;
  const loadNext = async () => {
    while (sequence === listSequence && index < items.length) {
      const item = items[index++];
      try { await getCourseVersions(item); } catch {}
    }
  };
  for (let i = 0; i < Math.min(4, items.length); i++) loadNext();
}

async function selectLecture(item, source, force = false, discardConfirmed = false) {
  if (source === 'online' && !canCreateOnline.value) return false;
  if (loading.value || saving.value || createOpen.value) return false;
  const key = `${source}:${item.id}`;
  if (!force && ownsContext.value && lecture.value?.key === key && revision.value && (source === 'local' || lecture.value.hasPrivateAccess || !item.canViewPrivate)) return true;
  if (!discardConfirmed && !await confirmLeave()) return false;
  const sequence = ++loadSequence;
  draftRefreshSequence++;
  loading.value = true;
  loadingKey.value = key;
  try {
    let data;
    let canEditLecture = false;
    let pending = null;
    if (source === 'local') {
      data = JSON.parse(JSON.stringify(item));
      for (const chapter of data.chapters) {
        for (const section of chapter.sections) {
          if (typeof section.source === 'string') continue;
          const blocks = section.blocks;
          if (!Array.isArray(blocks) || blocks.length > 1 || blocks.some((block) => block.block_type !== 'author' || block.animation != null || typeof block.source !== 'string')) {
            throw new Error('本地课程包含旧版引用或动画，暂不能安全转换，原数据已保留');
          }
          section.source = blocks[0]?.source || '';
          delete section.blocks;
        }
      }
    }
    else if (item.canViewPrivate && authStatus.value === 'authenticated') {
      const [versions, collaborators] = await Promise.all([force ? lectureApi.revisions(item.id) : getCourseVersions(item), lectureApi.collaborators(item.id)]);
      if (!versions.length) throw new Error('该在线课程暂无版本');
      if (sequence !== loadSequence) return false;
      lectureVersions.value = new Map(lectureVersions.value).set(key, versions);
      pending = versions.find((version) => version.status === 'pending')?.id || null;
      canEditLecture = currentUser.value?.role === 'super_admin' || item.owner_id === currentUser.value?.id || collaborators.some((entry) => entry.user_id === currentUser.value?.id && entry.permission === 'edit');
      if (!canEditLecture && item.isPublic) data = await lectureApi.getBySlug(item.slug);
      else data = await lectureApi.getRevision((canEditLecture ? versions.find((version) => version.status === 'draft') || versions[0] : versions[0]).id);
    } else data = await lectureApi.getBySlug(item.slug);
    if (sequence !== loadSequence) return false;
    lecture.value = { id: item.id, slug: item.slug || data.lecture?.slug, key, isLocal: source === 'local', ownerUserId: source === 'online' ? (currentUser.value?.id ?? null) : null, lectureOwnerId: item.owner_id, editVersion: item.editVersion, canEdit: canEditLecture, permissionValid: true, hasPrivateAccess: source === 'online' && Boolean(item.canViewPrivate) };
    revision.value = JSON.parse(JSON.stringify(data.revision));
    pendingSnapshotId.value = pending;
    chapters.value = JSON.parse(JSON.stringify(data.chapters));
    const treeKey = source === 'online' && item.canViewPrivate ? `${key}:version:${data.revision.id}` : key;
    lectureTrees.value = new Map(lectureTrees.value).set(treeKey, JSON.parse(JSON.stringify(data.chapters)));
    selected.value = { type: 'lecture', id: '' };
    baseline.value = snapshot();
    onlineConflict.value = false;
    return true;
  } catch (err) {
    if (sequence === loadSequence) notify(err.message || '讲义加载失败', 'error');
    return false;
  } finally {
    if (sequence === loadSequence) { loading.value = false; loadingKey.value = ''; }
  }
}

async function selectRevision(node) {
  if (!canCreateOnline.value) return false;
  if (loading.value || saving.value || createOpen.value) return false;
  if (ownsContext.value && lecture.value?.key === node.courseKey && revision.value?.id === node.revisionId) return true;
  if (!await confirmLeave()) return false;
  const sequence = ++loadSequence;
  draftRefreshSequence++;
  loading.value = true;
  loadingKey.value = node.courseKey;
  try {
    const [data, collaborators] = await Promise.all([lectureApi.getRevision(node.revisionId), lectureApi.collaborators(node.item.id)]);
    if (sequence !== loadSequence) return false;
    if (data.revision?.id !== node.revisionId || data.revision?.lecture_id !== node.item.id || !Array.isArray(data.chapters)) throw new Error('版本数据不匹配');
    const editable = currentUser.value?.role === 'super_admin' || node.item.owner_id === currentUser.value?.id || collaborators.some((entry) => entry.user_id === currentUser.value?.id && entry.permission === 'edit');
    lecture.value = { id: node.item.id, slug: node.item.slug, key: node.courseKey, isLocal: false, ownerUserId: currentUser.value?.id ?? null, lectureOwnerId: node.item.owner_id, canEdit: editable, permissionValid: true, hasPrivateAccess: true };
    revision.value = data.revision;
    chapters.value = data.chapters;
    lectureTrees.value = new Map(lectureTrees.value).set(node.id, JSON.parse(JSON.stringify(data.chapters)));
    pendingSnapshotId.value = (lectureVersions.value.get(node.courseKey) || []).find((version) => version.status === 'pending')?.id || null;
    selected.value = { type: 'lecture', id: '' };
    baseline.value = snapshot();
    onlineConflict.value = false;
    return true;
  } catch (err) {
    if (sequence === loadSequence) notify(err.message || '版本加载失败', 'error');
    return false;
  } finally {
    if (sequence === loadSequence) { loading.value = false; loadingKey.value = ''; }
  }
}

async function openCreate(source) {
  if (source === 'online' && !canCreateOnline.value) return;
  if (!await confirmLeave()) return;
  createSource.value = source;
  createForm.value = { title: '', slug: '' };
  createOpen.value = true;
}

async function createLecture() {
  if (saving.value) return;
  if (createSource.value === 'online' && !canCreateOnline.value) {
    notify('当前账号无权新建在线课程', 'warn');
    return;
  }
  const title = createForm.value.title.trim();
  const slug = createForm.value.slug.trim();
  if (!title || !slug) { notify('请填写课程标题和标识', 'warn'); return; }
  saving.value = true;
  const source = createSource.value;
  const epoch = identityEpoch;
  listSequence++;
  try {
    let item;
    if (source === 'local') {
      item = {
        id: crypto.randomUUID(), slug, editVersion: 1, sourceLectureId: null, sourceRevisionId: null,
        revision: { title, subtitle: '', descr: '', category_id: null, typst_version: '0.15.1', metadata: {}, change_note: '' },
        chapters: []
      };
      await createLocalLecture(item);
      localLectures.value = [...localLectures.value, item];
    } else {
      const result = await lectureApi.create({ title, slug });
      if (epoch !== identityEpoch) { notify('课程已创建，账号状态已变化，请重新加载列表', 'warn'); return; }
      item = { ...result.lecture, title: result.revision.title, canViewPrivate: true };
      lectures.value = [...lectures.value.filter((entry) => entry.id !== item.id), item];
    }
    createOpen.value = false;
    treeRef.value?.expand('group', source);
    loadLectures();
    saving.value = false;
    await selectLecture(item, source, false, true);
    notify(source === 'local' ? '本地课程已创建' : '在线课程草稿已创建', 'success');
  } catch (err) {
    notify(err.message || '创建课程失败', 'error');
  } finally { saving.value = false; }
}

function openDownload() {
  if (!lecture.value || !ownsContext.value || lecture.value.isLocal || saving.value || loading.value || createOpen.value) return;
  downloadSlug.value = lecture.value.slug || '';
  downloadOpen.value = true;
}

async function downloadLecture() {
  if (!downloadOpen.value || !lecture.value || !ownsContext.value || lecture.value.isLocal || saving.value || loading.value || createOpen.value) return;
  const record = {
    id: crypto.randomUUID(), slug: downloadSlug.value.trim(), editVersion: 1,
    sourceLectureId: lecture.value.id, sourceRevisionId: revision.value.id,
    revision: JSON.parse(JSON.stringify(revision.value)), chapters: JSON.parse(JSON.stringify(chapters.value))
  };
  saving.value = true;
  try {
    await createLocalLecture(record);
    localLectures.value = await listLocalLectures();
    downloadOpen.value = false;
    treeRef.value?.expand('group', 'local');
    notify('已下载到本地，可选择本地课程进行修改', 'success');
  } catch (err) {
    notify(err.message || '下载讲义失败', 'error');
  } finally { saving.value = false; }
}

function validateDraft() {
  if (!revision.value.title.trim() || !revision.value.typst_version.trim()) return '请填写讲义标题和排版版本';
  const chapterSlugs = new Set();
  for (const chapter of chapters.value) {
    if (!chapter.title.trim()) return '请填写章节名称';
    const slug = chapter.slug.trim();
    if (!slug || chapterSlugs.has(slug)) return '章节标识不能为空或重复';
    chapterSlugs.add(slug);
    const sectionSlugs = new Set();
    for (const section of chapter.sections) {
      if (!section.title.trim()) return '请填写小节标题';
      const sectionSlug = section.slug.trim();
      if (!sectionSlug || sectionSlugs.has(sectionSlug)) return '同一章节中的小节标识不能为空或重复';
      sectionSlugs.add(sectionSlug);
    }
  }
  return '';
}

async function save() {
  if (!canEdit.value || saving.value || !dirty.value) return;
  const issue = validateDraft();
  if (issue) { notify(issue, 'warn'); return; }
  const submitted = snapshot();
  const data = JSON.parse(submitted);
  const epoch = identityEpoch;
  draftRefreshSequence++;
  saving.value = true;
  try {
    if (lecture.value.isLocal) {
      const current = localLectures.value.find((item) => item.id === lecture.value.id);
      if (!current) throw new Error('本地课程不存在，请先备份当前内容');
      const record = { ...current, slug: data.slug, revision: data.revision, chapters: data.chapters };
      const version = await saveLocalLecture(record, lecture.value.editVersion);
      lecture.value.editVersion = version;
      localLectures.value = localLectures.value.map((item) => item.id === record.id ? { ...record, editVersion: version } : item);
      baseline.value = submitted;
    } else {
      if (onlineConflict.value) throw new Error('请先备份并重新读取在线版本');
      const result = await lectureApi.saveRevision(data.revision.id, lectureSaveBody(data.revision, data.chapters));
      if (epoch !== identityEpoch) { onlineConflict.value = true; notify('账号状态已变化，当前修改已保留，请重新核对保存结果', 'warn', 0); return; }
      if (!Number.isInteger(result?.revision?.edit_version) || !Array.isArray(result.chapters) || result.chapters.some((chapter) => !chapter.occurrence_id || !Array.isArray(chapter.sections) || chapter.sections.some((section) => !section.occurrence_id || typeof section.source !== 'string'))) {
        onlineConflict.value = true;
        notify('保存请求已成功，但响应不完整，请先备份当前修改并重新读取', 'warn', 0);
        return;
      }
      lectureTrees.value = new Map(lectureTrees.value).set(`${lecture.value.key}:version:${result.revision.id}`, JSON.parse(JSON.stringify(result.chapters)));
      if (snapshot() === submitted) {
        revision.value = result.revision;
        chapters.value = result.chapters;
        baseline.value = snapshot();
      } else {
        onlineConflict.value = true;
        notify('保存期间内容发生变化，当前修改已保留，请备份后重新读取在线版本', 'warn', 0);
        return;
      }
    }
    notify(lecture.value.isLocal ? '本地课程已保存' : '在线草稿已保存', 'success');
  } catch (err) {
    if (err.status === 409 && !lecture.value.isLocal) onlineConflict.value = true;
    notify(err.status === 409 ? `${err.message || '保存冲突'}，当前修改已保留，请核对后重新读取版本` : err.message || '保存失败，当前修改已保留', 'error');
  } finally { saving.value = false; }
}

async function reloadConflictedLecture() {
  const item = lectures.value.find((entry) => entry.id === lecture.value?.id);
  if (item) await selectLecture(item, 'online', true);
}

function discard() {
  if (!baseline.value) return;
  const saved = JSON.parse(baseline.value);
  revision.value = saved.revision;
  chapters.value = saved.chapters;
  if (lecture.value?.isLocal) lecture.value.slug = saved.slug;
  selected.value = { type: 'lecture', id: '' };
}

function closeSubmit() {
  submitOpen.value = false;
  clearInterval(submitTimer);
  submitTimer = null;
}

function openSubmit() {
  if (!canEditOnline.value || !canEdit.value || saving.value || pendingSnapshotId.value || onlineConflict.value) return;
  if (dirty.value) { notify('请先保存所有修改，再提交审核', 'warn'); return; }
  const versions = lectureVersions.value.get(lecture.value.key);
  const versionNumbers = versions?.map((version) => version.revision_no);
  const expectedVersion = versionNumbers?.length && versionNumbers.every((number) => Number.isSafeInteger(number) && number > 0)
    ? Math.max(...versionNumbers) + 1 : null;
  submitTarget.value = {
    id: revision.value.id,
    editVersion: revision.value.edit_version,
    title: revision.value.title,
    expectedVersion,
    chapterCount: chapters.value.length,
    sectionCount: chapters.value.reduce((count, chapter) => count + chapter.sections.length, 0)
  };
  submitCountdown.value = 5;
  submitDeadline = Date.now() + 5000;
  submitOpen.value = true;
  clearInterval(submitTimer);
  submitTimer = setInterval(() => {
    submitCountdown.value = Math.max(0, Math.ceil((submitDeadline - Date.now()) / 1000));
    if (!submitCountdown.value) { clearInterval(submitTimer); submitTimer = null; }
  }, 200);
}

async function submitDraft() {
  if (!submitOpen.value || Date.now() < submitDeadline || !submitTarget.value || !canEditOnline.value || !canEdit.value || dirty.value || saving.value || pendingSnapshotId.value || onlineConflict.value) return;
  if (revision.value.id !== submitTarget.value.id || revision.value.edit_version !== submitTarget.value.editVersion) {
    closeSubmit();
    notify('草稿状态已变化，请重新检查后提交', 'warn');
    return;
  }
  draftRefreshSequence++;
  const epoch = identityEpoch;
  saving.value = true;
  try {
    const result = await lectureApi.submitRevision(revision.value.id, revision.value.edit_version);
    if (epoch !== identityEpoch) { onlineConflict.value = true; notify('账号状态已变化，请重新核对提交结果', 'warn', 0); return; }
    const submittedRevision = result?.snapshot?.revision || result?.snapshot;
    if (!submittedRevision?.id || !Number.isInteger(result.draft_edit_version)) {
      onlineConflict.value = true;
      notify('提交请求已成功，但响应不完整，请重新读取草稿状态', 'warn', 0);
      return;
    }
    pendingSnapshotId.value = submittedRevision.id;
    treeEpoch++;
    treeLoadingKeys.value = new Set();
    const versions = lectureVersions.value.get(lecture.value.key) || [];
    lectureVersions.value = new Map(lectureVersions.value).set(lecture.value.key, [submittedRevision, ...versions.filter((item) => item.id !== submittedRevision.id)]);
    revision.value.edit_version = result.draft_edit_version;
    baseline.value = snapshot();
    closeSubmit();
    try {
      const updated = await lectureApi.revisions(lecture.value.id);
      lectureVersions.value = new Map(lectureVersions.value).set(lecture.value.key, updated);
      const versionLabel = Number.isSafeInteger(submittedRevision.revision_no) ? ` V${submittedRevision.revision_no}` : '';
      notify(`审核快照${versionLabel}已提交，草稿可继续编辑`, 'success');
    } catch {
      const versionLabel = Number.isSafeInteger(submittedRevision.revision_no) ? ` V${submittedRevision.revision_no}` : '';
      notify(`审核快照${versionLabel}已提交，但版本列表刷新失败，请稍后刷新`, 'warn');
    }
  } catch (err) {
    notify(err.message || '提交审核失败', 'error');
  } finally { saving.value = false; }
}

async function refreshDraftOnVisible() {
  if (document.visibilityState !== 'visible' || !ownsContext.value || !lecture.value?.hasPrivateAccess || authStatus.value !== 'authenticated' || saving.value || loading.value) return;
  const id = revision.value.id;
  const courseKey = lecture.value.key;
  const sequence = ++draftRefreshSequence;
  try {
    const [latest, versions] = await Promise.all([
      canEditOnline.value && revision.value?.status === 'draft' ? lectureApi.getRevision(id) : Promise.resolve(null),
      lectureApi.revisions(lecture.value.id)
    ]);
    if (sequence !== draftRefreshSequence || lecture.value?.key !== courseKey || revision.value?.id !== id || saving.value) return;
    lectureVersions.value = new Map(lectureVersions.value).set(courseKey, versions);
    pendingSnapshotId.value = versions.find((version) => version.status === 'pending')?.id || null;
    if (!latest) return;
    if (latest.revision.edit_version === revision.value.edit_version) return;
    if (dirty.value) {
      onlineConflict.value = true;
      notify('在线草稿已更新，当前修改已保留，请备份后重新读取', 'warn', 0);
      return;
    }
    revision.value = latest.revision;
    chapters.value = latest.chapters;
    baseline.value = snapshot();
    lectureTrees.value = new Map(lectureTrees.value).set(`${courseKey}:version:${latest.revision.id}`, JSON.parse(JSON.stringify(latest.chapters)));
    if (selected.value.type !== 'lecture' && !chapters.value.some((chapter) => chapter.occurrence_id === selected.value.id || chapter.sections.some((section) => section.occurrence_id === selected.value.id))) selected.value = { type: 'lecture', id: '' };
    notify('在线草稿已更新', 'info');
  } catch (err) {
    if (sequence === draftRefreshSequence) notify(err.message || '检查在线草稿更新失败', 'error');
  }
}

async function refreshTree() {
  await loadLectures();
  if (lecture.value?.hasPrivateAccess && authStatus.value === 'authenticated') await refreshDraftOnVisible();
}

function addChapter() {
  treeRef.value?.expand('group', lecture.value.isLocal ? 'local' : 'online');
  treeRef.value?.expand('lecture', lecture.value.key);
  if (lecture.value.hasPrivateAccess) treeRef.value?.expand('version', `${lecture.value.key}:version:${revision.value.id}`);
  const item = { occurrence_id: crypto.randomUUID(), slug: '', title: '', tag: '', summary: '', sections: [] };
  chapters.value.push(item);
  selected.value = { type: 'chapter', id: item.occurrence_id };
}
function addSection(chapter) {
  const key = lecture.value.hasPrivateAccess ? `${lecture.value.key}:version:${revision.value.id}` : lecture.value.key;
  treeRef.value?.expand('chapter', `${key}:${chapter.occurrence_id}`);
  const item = { occurrence_id: crypto.randomUUID(), slug: '', title: '', tag: '', summary: '', source: '' };
  chapter.sections.push(item);
  selected.value = { type: 'section', id: item.occurrence_id };
}
function move(list, index, offset) {
  const target = index + offset;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
}
function removeChapter(chapter) {
  chapters.value.splice(chapters.value.indexOf(chapter), 1);
  selected.value = { type: 'lecture', id: '' };
}
function removeSection(chapter, section) {
  chapter.sections.splice(chapter.sections.indexOf(section), 1);
  selected.value = { type: 'chapter', id: chapter.occurrence_id };
}

async function selectTreeNode(node) {
  if (loading.value || saving.value || createOpen.value) return;
  if (node.type === 'lecture') {
    if (await selectLecture(node.item, node.source)) selected.value = { type: 'lecture', id: '' };
  } else if (node.type === 'version') {
    await selectRevision(node);
  } else if (node.type === 'chapter' || node.type === 'section') {
    if (node.versionId != null) {
      if (!await selectRevision({ ...node, id: `${node.courseKey}:version:${node.versionId}`, revisionId: node.versionId })) return;
    } else if (!await selectLecture(node.item, node.source)) return;
    selected.value = { type: node.type, id: node.occurrenceId };
  }
}

function expandTreeNode(node) {
  if (!canCreateOnline.value) return;
  if (!['lecture', 'version'].includes(node.type) || node.source !== 'online' || treeLoadingKeys.value.has(node.id)) return;
  if (node.type === 'lecture' && node.item.canViewPrivate && lectureVersions.value.has(node.id)) return;
  if (node.type === 'lecture' && !node.item.canViewPrivate && (lecture.value?.key === node.id || lectureTrees.value.has(node.id))) return;
  if (node.type === 'version' && ((lecture.value?.key === node.courseKey && revision.value?.id === node.revisionId) || lectureTrees.value.has(node.id))) return;
  const epoch = treeEpoch;
  treeLoadingKeys.value = new Set(treeLoadingKeys.value).add(node.id);
  requestAnimationFrame(async () => {
    if (epoch !== treeEpoch) return;
    try {
      if (node.type === 'lecture' && node.item.canViewPrivate) {
        const versions = await getCourseVersions(node.item);
        if (epoch === treeEpoch) lectureVersions.value = new Map(lectureVersions.value).set(node.id, versions);
      } else {
        const data = node.type === 'version' ? await lectureApi.getRevision(node.revisionId) : await lectureApi.getBySlug(node.item.slug);
        if (epoch === treeEpoch) lectureTrees.value = new Map(lectureTrees.value).set(node.id, data.chapters);
      }
    } catch (err) {
      if (epoch === treeEpoch) notify(err.message || '加载在线课程目录失败', 'error');
    } finally {
      if (epoch === treeEpoch) {
        const next = new Set(treeLoadingKeys.value);
        next.delete(node.id);
        treeLoadingKeys.value = next;
      }
    }
  });
}

function addTreeNode(node) {
  if (node.type === 'group') { openCreate(node.id); return; }
  if (!canEdit.value || saving.value || lecture.value?.key !== (node.courseKey || node.id)) return;
  if (node.versionId != null && node.versionId !== revision.value?.id) return;
  if (node.type === 'lecture') {
    treeRef.value?.expand('group', lecture.value.isLocal ? 'local' : 'online');
    treeRef.value?.expand('lecture', node.id);
    addChapter();
  } else if (node.type === 'chapter') {
    const chapter = chapters.value.find((item) => item.occurrence_id === node.occurrenceId);
    if (chapter) { treeRef.value?.expand('chapter', node.id); addSection(chapter); }
  }
}

function moveTreeNode({ node, delta }) {
  if (!canEdit.value || saving.value || lecture.value?.key !== node.courseKey) return;
  if (node.versionId != null && node.versionId !== revision.value?.id) return;
  if (node.type === 'chapter') move(chapters.value, chapters.value.findIndex((item) => item.occurrence_id === node.occurrenceId), delta);
  else if (node.type === 'section') {
    const chapter = chapters.value.find((item) => item.sections.some((section) => section.occurrence_id === node.occurrenceId));
    if (chapter) move(chapter.sections, chapter.sections.findIndex((item) => item.occurrence_id === node.occurrenceId), delta);
  }
}

async function askRemoveTreeNode(node) {
  if (treeBusy.value || saving.value || loading.value || createOpen.value || removeTarget.value) return;
  if (node.versionId != null && node.versionId !== revision.value?.id) return;
  if (node.type === 'lecture' && node.source === 'local') {
    if (lecture.value?.key === node.id && !await confirmLeave()) return;
    removeTarget.value = node;
  } else if (canEdit.value && lecture.value?.key === node.courseKey) removeTarget.value = node;
}

async function confirmRemoveTreeNode() {
  const node = removeTarget.value;
  if (!node || treeBusy.value) return;
  if (node.type === 'lecture' && node.source === 'local') {
    treeBusy.value = true;
    try {
      await deleteLocalLecture(node.item.id);
      localLectures.value = localLectures.value.filter((item) => item.id !== node.item.id);
      if (lecture.value?.key === node.id) { lecture.value = null; revision.value = null; chapters.value = []; baseline.value = ''; }
      removeTarget.value = null;
    } catch (err) { notify(err.message || '删除本地课程失败', 'error'); }
    finally { treeBusy.value = false; }
    return;
  }
  if (!canEdit.value || saving.value || lecture.value?.key !== node.courseKey) { removeTarget.value = null; return; }
  if (node.versionId != null && node.versionId !== revision.value?.id) { removeTarget.value = null; return; }
  const chapter = chapters.value.find((item) => item.occurrence_id === node.occurrenceId || item.sections.some((section) => section.occurrence_id === node.occurrenceId));
  if (chapter && node.type === 'chapter') removeChapter(chapter);
  else if (chapter && node.type === 'section') {
    const section = chapter.sections.find((item) => item.occurrence_id === node.occurrenceId);
    if (section) removeSection(chapter, section);
  }
  removeTarget.value = null;
}

async function revalidatePermission(epoch) {
  const context = lecture.value;
  if (!context?.hasPrivateAccess || !ownsContext.value || !canCreateOnline.value) return;
  try {
    const [items, collaborators] = await Promise.all([lectureApi.mine(), lectureApi.collaborators(context.id)]);
    if (epoch !== identityEpoch || lecture.value !== context || !ownsContext.value) return;
    const item = items.find((entry) => entry.id === context.id);
    if (!item) throw new Error('讲义访问权限已变化');
    context.canEdit = currentUser.value?.role === 'super_admin' || item.owner_id === currentUser.value?.id || collaborators.some((entry) => entry.user_id === currentUser.value?.id && entry.permission === 'edit');
    context.permissionValid = true;
  } catch {
    if (epoch === identityEpoch && lecture.value === context) notify('无法确认讲义编辑权限，请重新读取讲义', 'error');
  }
}

watch([authStatus, () => currentUser.value?.id, () => currentUser.value?.role], () => {
  identityEpoch++;
  loadSequence++;
  listSequence++;
  draftRefreshSequence++;
  loading.value = false;
  loadingKey.value = '';
  lectures.value = [];
  closeSubmit();
  removeTarget.value = null;
  if (createSource.value === 'online') createOpen.value = false;
  downloadOpen.value = false;
  if (lecture.value && !lecture.value.isLocal) lecture.value.permissionValid = false;
  treeEpoch++;
  treeLoadingKeys.value = new Set();
  lectureTrees.value = new Map();
  lectureVersions.value = new Map();
  versionNameErrors.value = new Set();
  versionRequests.clear();
  loadLectures();
  revalidatePermission(identityEpoch);
}, { immediate: true, flush: 'sync' });
onMounted(() => {
  initAuth();
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('visibilitychange', refreshDraftOnVisible);
});
onUnmounted(() => {
  loadSequence++;
  listSequence++;
  treeEpoch++;
  closeSubmit();
  draftRefreshSequence++;
  finishLeave(false);
  window.removeEventListener('beforeunload', beforeUnload);
  document.removeEventListener('visibilitychange', refreshDraftOnVisible);
  workbenchPanelState.value = { dirty: false, saving: false };
});
</script>

<template>
  <div class="workbench-workspace">
    <LectureWorkbenchTree :inert="loading || saving || createOpen || downloadOpen" ref="treeRef" :nodes="treeNodes" :show-online="canCreateOnline" :selected-key="selectedKey" :list-loading="listLoading" :list-errors="listErrors" @select="selectTreeNode" @expand="expandTreeNode" @refresh="refreshTree" @add="addTreeNode" @move="moveTreeNode" @remove="askRemoveTreeNode" />
    <main class="workbench-main">
      <div v-if="revision && lecture && !ownsContext" class="workbench-empty"><h2>当前账号无法访问此编辑内容</h2><p>请使用原账号重新登录，或离开后选择其他讲义。</p></div>
      <CoursePanel v-else-if="revision && lecture && selected.type === 'lecture'" :revision="revision" :lecture="lecture" :categories="categories" :dirty="dirty" :saving="saving || loading || createOpen" :editable="canEdit" :read-only-message="readOnlyMessage" @save="save" @reset="discard">
        <template #actions>
          <MButton v-if="onlineConflict" size="sm" :mono="true" :disabled="saving" title="重新读取会放弃未保存的修改" @click="reloadConflictedLecture">重新读取</MButton>
          <MButton v-if="!lecture.isLocal" size="sm" :mono="true" :disabled="saving" @click="openDownload">下载到本地</MButton>
          <MButton v-if="canEditOnline && revision.status === 'draft'" size="sm" :mono="true" :disabled="saving || dirty || !!pendingSnapshotId || onlineConflict" :title="dirty ? '请先保存所有修改' : pendingSnapshotId ? '已有待审核快照' : '提交已保存的草稿'" @click="openSubmit">{{ pendingSnapshotId ? '审核中' : '提交审核' }}</MButton>
        </template>
      </CoursePanel>
      <ChapterPanel v-else-if="revision && lecture && selected.type === 'chapter' && selectedChapter" :chapter="selectedChapter" :dirty="dirty" :saving="saving || loading || createOpen" :editable="canEdit" :read-only-message="readOnlyMessage" :submitted-at="revision.submitted_at || ''" :review-status="revision.status || ''" :reviewed-at="revision.reviewed_at || ''" @save="save" @reset="discard">
        <template #actions>
          <MButton v-if="onlineConflict" size="sm" :mono="true" :disabled="saving" title="重新读取会放弃未保存的修改" @click="reloadConflictedLecture">重新读取</MButton>
          <MButton v-if="!lecture.isLocal" size="sm" :mono="true" :disabled="saving" @click="openDownload">下载到本地</MButton>
          <MButton v-if="canEditOnline && revision.status === 'draft'" size="sm" :mono="true" :disabled="saving || dirty || !!pendingSnapshotId || onlineConflict" :title="dirty ? '请先保存所有修改' : pendingSnapshotId ? '已有待审核快照' : '提交已保存的草稿'" @click="openSubmit">{{ pendingSnapshotId ? '审核中' : '提交审核' }}</MButton>
        </template>
      </ChapterPanel>
      <SectionPanel v-else-if="revision && lecture && selected.type === 'section' && selectedSection" :section="selectedSection" :dirty="dirty" :saving="saving || loading || createOpen" :editable="canEdit" :read-only-message="readOnlyMessage" :submitted-at="revision.submitted_at || ''" :review-status="revision.status || ''" :reviewed-at="revision.reviewed_at || ''" @save="save" @reset="discard">
        <template #actions>
          <MButton v-if="onlineConflict" size="sm" :mono="true" :disabled="saving" title="重新读取会放弃未保存的修改" @click="reloadConflictedLecture">重新读取</MButton>
          <MButton v-if="!lecture.isLocal" size="sm" :mono="true" :disabled="saving" @click="openDownload">下载到本地</MButton>
          <MButton v-if="canEditOnline && revision.status === 'draft'" size="sm" :mono="true" :disabled="saving || dirty || !!pendingSnapshotId || onlineConflict" :title="dirty ? '请先保存所有修改' : pendingSnapshotId ? '已有待审核快照' : '提交已保存的草稿'" @click="openSubmit">{{ pendingSnapshotId ? '审核中' : '提交审核' }}</MButton>
        </template>
      </SectionPanel>
      <div v-else class="workbench-empty">
        <span class="empty-label font-mono">LECTURE WORKBENCH</span>
        <h2>选择一份讲义</h2>
        <p>从左侧选择本地讲义或我创作的讲义，选择课程、章节或小节。</p>
      </div>
    </main>
    <MModal :open="submitOpen" title="确认提交审核" hide-footer show-close @close="closeSubmit">
      <p>讲义：{{ submitTarget?.title }}</p>
      <p>预计提交版本：{{ submitTarget?.expectedVersion == null ? '提交后由系统分配' : `V${submitTarget.expectedVersion}` }}</p>
      <p>已保存内容：{{ submitTarget?.chapterCount }} 章，{{ submitTarget?.sectionCount }} 小节</p>
      <p>提交会基于已保存内容创建独立且不可修改的审核快照，原草稿仍可继续编辑。</p>
      <div class="submit-actions">
        <MButton variant="ghost" size="sm" @click="closeSubmit">{{ saving ? '关闭' : '取消' }}</MButton>
        <MButton variant="primary" size="sm" :disabled="saving || submitCountdown > 0 || dirty || !!pendingSnapshotId || onlineConflict" @click="submitDraft">{{ saving ? '提交中' : submitCountdown > 0 ? `确认提交（${submitCountdown}）` : '确认提交' }}</MButton>
      </div>
    </MModal>
    <MModal :open="downloadOpen" title="下载到本地" :busy="saving" @close="!saving && (downloadOpen = false)" @confirm="downloadLecture"><MInput v-model="downloadSlug" label="本地讲义标识" hint="标识需在本浏览器的本地讲义中唯一" required /></MModal>
    <MModal :open="leaveOpen" title="放弃未保存的修改" desc="离开后当前修改将丢失" confirm-text="放弃修改" confirm-variant="danger" @close="finishLeave(false)" @confirm="finishLeave(true)" />
    <MModal :open="createOpen" :title="createSource === 'local' ? '新建本地课程' : '新建在线课程'" :busy="saving" @close="!saving && (createOpen = false)" @confirm="createLecture"><MInput v-model="createForm.title" label="标题" required /><MInput v-model="createForm.slug" label="标识" :hint="createSource === 'local' ? '需在本浏览器的本地讲义中唯一' : '创建后不能修改'" required /></MModal>
    <MModal :open="Boolean(removeTarget)" title="确认移除" :desc="removeTarget?.type === 'lecture' ? '本地课程及其章节和小节将被删除，此操作无法撤销。' : '移除将在保存草稿后生效，保存前可放弃修改。'" confirm-text="移除" confirm-variant="danger" :busy="treeBusy" @close="!treeBusy && (removeTarget = null)" @confirm="confirmRemoveTreeNode" />
  </div>
</template>

<style scoped>
.workbench-workspace { display: flex; height: 100%; min-height: 0; overflow: hidden; }
.workbench-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.workbench-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; }
.empty-label { margin-bottom: 16px; color: var(--text-muted); font-size: var(--font-size-smaller); letter-spacing: 0.08em; }
.workbench-empty h2 { margin: 0; color: var(--text-primary); font-size: var(--font-size-larger); font-weight: var(--font-weight-medium); }
.workbench-empty p { margin: 12px 0 0; color: var(--text-secondary); font-size: var(--font-size); line-height: 1.6; }
.submit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
</style>
