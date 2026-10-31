<script setup>
import '../../components/workbench/workbench.css';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { lectureApi, lectureSaveBody } from '../../api/lectures.js';
import { managementApi } from '../../api/management.js';
import MButton from '../../components/MButton.vue';
import MFilePicker from '../../components/MFilePicker.vue';
import MInput from '../../components/MInput.vue';
import MModal from '../../components/MModal.vue';
import { notify } from '../../components/MNotice.vue';
import { useWorkbenchGuard } from '../../composables/useWorkbenchGuard.js';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import {
  checkExportMetadata,
  localLectureToPortable,
  portableToLocalLecture,
  validatePortableLecture
} from '../../utils/lecture-portable.js';
import {
  createLocalLecture,
  deleteLocalLecture,
  listLocalLectures,
  saveLocalLecture
} from '../../utils/local-lectures.js';
import ArchiveLectureConfirm from './ArchiveLectureConfirm.vue';
import ChapterPanel from './ChapterPanel.vue';
import CoursePanel from './CoursePanel.vue';
import DeleteLectureConfirm from './DeleteLectureConfirm.vue';
import LectureManageSummary from './LectureManageSummary.vue';
import LectureWorkbenchTree from './LectureWorkbenchTree.vue';
import SectionPanel from './SectionPanel.vue';

const lectures = ref([]);
const managedLectures = ref([]);
const managedLoading = ref(false);
const managedError = ref('');
const summaryId = ref(null);
const summaryItem = ref(null);
const summaryLoading = ref(false);
const summaryError = ref('');
const listLoading = ref({
  local: true,
  online: true
});
const listErrors = ref({
  local: '',
  online: ''
});
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
const selected = ref({
  type: 'lecture',
  id: ''
});
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
const importOpen = ref(false);
const importSource = ref('local');
const importFile = ref(null);
const importName = ref('');
const importSlug = ref('');
const importError = ref('');
const importReading = ref(false);
const importUncertain = ref(false);
let importSequence = 0;
const createOpen = ref(false);
const downloadOpen = ref(false);
const downloadSlug = ref('');
const createSource = ref('local');
const createForm = ref({
  title: '',
  slug: ''
});
const removeTarget = ref(null);
const treeBusy = ref(false);
const archiveTarget = ref(null);
const deleteLectureTarget = ref(null);
const archiveBusy = ref(false);
let loadSequence = 0;
let listSequence = 0;
let treeEpoch = 0;
let draftRefreshSequence = 0;
let identityEpoch = 0;
let summarySequence = 0;
const versionRequests = new Map();

const snapshot = () =>
  JSON.stringify({
    revision: revision.value,
    chapters: chapters.value,
    slug: lecture.value?.isLocal ? lecture.value.slug : null
  });
const dirty = computed(() =>
  Boolean(revision.value && baseline.value && snapshot() !== baseline.value)
);
const ownsContext = computed(() =>
  Boolean(
    lecture.value?.isLocal ||
    (lecture.value &&
      lecture.value.ownerUserId === (currentUser.value?.id ?? null) &&
      (lecture.value.ownerUserId === null || authStatus.value === 'authenticated'))
  )
);
const isArchived = computed(() =>
  Boolean(
    lecture.value &&
    !lecture.value.isLocal &&
    (lectures.value.find((item) => item.id === lecture.value.id)?.publication_status ??
      lecture.value.publicationStatus) === 'archived'
  )
);
watch(isArchived, (archived) => {
  if (archived) {
    downloadOpen.value = false;
  }
});
const canEditOnline = computed(() =>
  Boolean(
    !isArchived.value &&
    ownsContext.value &&
    lecture.value &&
    !lecture.value.isLocal &&
    lecture.value.permissionValid &&
    lecture.value.canEdit &&
    authStatus.value === 'authenticated' &&
    ['editor', 'super_admin'].includes(currentUser.value?.role)
  )
);
const canEdit = computed(() =>
  Boolean(
    !loading.value &&
    !createOpen.value &&
    (lecture.value?.isLocal || (canEditOnline.value && revision.value?.status === 'draft'))
  )
);
const readOnlyMessage = computed(() =>
  isArchived.value
    ? '讲义已归档，当前内容只供查看。'
    : canEditOnline.value && revision.value?.status !== 'draft'
      ? '当前版本只供查看，请选择草稿继续编辑。'
      : '当前账号无法编辑此讲义，可下载到本地查看。'
);
const canBrowseOnline = computed(
  () => authStatus.value === 'authenticated' && Boolean(currentUser.value)
);
const canCreateOnline = computed(
  () =>
    authStatus.value === 'authenticated' &&
    ['editor', 'super_admin'].includes(currentUser.value?.role)
);
const canManageAll = computed(
  () => canBrowseOnline.value && currentUser.value?.role === 'super_admin'
);
const treeLoading = computed(() => ({
  ...listLoading.value,
  all: managedLoading.value
}));
const treeErrors = computed(() => ({
  ...listErrors.value,
  all: managedError.value
}));
const treeNodes = computed(() =>
  ['local', 'online', 'archived', ...(canManageAll.value ? ['all'] : [])].map((group) => ({
    type: 'group',
    id: group,
    label: {
      local: '本地讲义',
      online: '我创作的讲义',
      archived: '已归档讲义',
      all: '全部讲义'
    }[group],
    actions:
      group === 'local' || (group === 'online' && canCreateOnline.value)
        ? {
            add: true,
            import: true
          }
        : false,
    children: (group === 'local'
      ? localLectures.value
      : group === 'all'
        ? managedLectures.value.map((item) => ({
            ...lectures.value.find((entry) => entry.id === item.id),
            ...item,
            title: item.latest_revision?.title || '',
            canViewPrivate: true
          }))
        : lectures.value.filter(
            (item) =>
              item.owner_id === currentUser.value?.id &&
              (group === 'archived'
                ? item.publication_status === 'archived'
                : item.publication_status !== 'archived')
          )
    ).map((item) => {
      const source = group === 'local' ? 'local' : 'online';
      const key = `${source}:${item.id}`;
      const active = ownsContext.value && lecture.value?.key === key;
      const editable = active && canEdit.value && !saving.value;
      const versions = lectureVersions.value.get(key) || [];
      const canAddChapter =
        item.publication_status !== 'archived' &&
        !saving.value &&
        !treeBusy.value &&
        (source === 'local' ||
          (active
            ? canEditOnline.value && versions.some((version) => version.status === 'draft')
            : canCreateOnline.value &&
              item.canViewPrivate &&
              (currentUser.value?.role === 'super_admin' ||
                item.owner_id === currentUser.value?.id)));
      const versionTitle =
        versions.find((version) => version.status === 'draft' && version.title)?.title ||
        versions.find((version) => version.title)?.title;
      const draftTitle =
        active && revision.value?.status === 'draft' ? revision.value.title : versionTitle;
      const title =
        source === 'local'
          ? active
            ? revision.value?.title
            : item.revision?.title
          : draftTitle || item.title || (active ? revision.value?.title : '');
      const canArchive =
        source === 'online' &&
        item.publication_status !== 'archived' &&
        Boolean(title) &&
        item.canViewPrivate &&
        canBrowseOnline.value &&
        (currentUser.value?.role === 'super_admin' || item.owner_id === currentUser.value?.id) &&
        !archiveBusy.value &&
        !saving.value;
      return {
        type: 'lecture',
        id: key,
        label:
          title ||
          (versionNameErrors.value.has(key)
            ? '课程名称加载失败'
            : item.canViewPrivate && !lectureVersions.value.has(key)
              ? '正在加载课程名称'
              : '课程名称未提供'),
        item,
        source,
        group,
        loading: loadingKey.value === key || treeLoadingKeys.value.has(key),
        actions:
          source === 'local'
            ? {
                add: canAddChapter,
                addLabel: '新建章节',
                remove: !saving.value && !treeBusy.value
              }
            : canAddChapter || canArchive
              ? {
                  add: canAddChapter,
                  addLabel: '新建章节',
                  archive: canArchive
                }
              : false,
        children:
          source === 'online' && item.canViewPrivate
            ? [
                ...versions.filter((version) => version.status === 'draft'),
                ...versions.filter((version) => version.status !== 'draft')
              ].map((version) => ({
                type: 'version',
                id: `${key}:version:${version.id}`,
                courseKey: key,
                revisionId: version.id,
                item,
                source,
                version,
                label:
                  version.status === 'draft'
                    ? '草稿版本'
                    : `${version.revision_no == null ? '版本号未提供' : `V${version.revision_no}`} · ${versionStatus(version.status)}`,
                actions:
                  canAddChapter && version.status === 'draft'
                    ? {
                        add: true,
                        addLabel: '新建章节'
                      }
                    : false,
                loading: treeLoadingKeys.value.has(`${key}:version:${version.id}`),
                children: makeChapterNodes(
                  item,
                  source,
                  key,
                  ownsContext.value &&
                    lecture.value?.key === key &&
                    revision.value?.id === version.id
                    ? chapters.value
                    : lectureTrees.value.get(`${key}:version:${version.id}`) || [],
                  ownsContext.value &&
                    lecture.value?.key === key &&
                    revision.value?.id === version.id &&
                    canEdit.value &&
                    !saving.value,
                  version.id
                )
              }))
            : makeChapterNodes(
                item,
                source,
                key,
                active
                  ? chapters.value
                  : source === 'local'
                    ? item.chapters
                    : lectureTrees.value.get(key) || [],
                editable
              )
      };
    })
  }))
);

function versionStatus(status) {
  return (
    {
      draft: '草稿',
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回'
    }[status] ||
    status ||
    '状态未知'
  );
}

function makeChapterNodes(item, source, key, tree, editable, versionId = null) {
  const versionKey = versionId == null ? key : `${key}:version:${versionId}`;
  return tree.map((chapter) => ({
    type: 'chapter',
    id: `${versionKey}:${chapter.occurrence_id}`,
    occurrenceId: chapter.occurrence_id,
    label: chapter.title || chapter.slug || '未命名章节',
    courseKey: key,
    versionId,
    item,
    source,
    actions: editable
      ? {
          add: true,
          move: true,
          remove: true
        }
      : false,
    children: chapter.sections.map((section) => ({
      type: 'section',
      id: `${versionKey}:${section.occurrence_id}`,
      occurrenceId: section.occurrence_id,
      label: section.title || section.slug || '未命名小节',
      courseKey: key,
      versionId,
      item,
      source,
      actions: editable
        ? {
            move: true,
            remove: true
          }
        : false
    }))
  }));
}
const selectedKey = computed(() => {
  if (summaryId.value != null) {
    return `lecture:online:${summaryId.value}`;
  }
  const key = lecture.value?.key;
  const versionKey =
    lecture.value?.hasPrivateAccess && revision.value?.id
      ? `${key}:version:${revision.value.id}`
      : key;
  return selected.value.type === 'lecture'
    ? versionKey === key
      ? `lecture:${key}`
      : `version:${versionKey}`
    : `${selected.value.type}:${versionKey}:${selected.value.id}`;
});
const selectedChapter = computed({
  get: () =>
    chapters.value.find((item) => item.occurrence_id === selected.value.id) ||
    chapters.value.find((item) =>
      item.sections.some((section) => section.occurrence_id === selected.value.id)
    ),
  set: (chapter) => {
    const index = chapters.value.findIndex((item) => item.occurrence_id === chapter.occurrence_id);
    if (index >= 0) {
      chapters.value[index] = chapter;
    }
  }
});
const selectedSection = computed({
  get: () =>
    selectedChapter.value?.sections.find((item) => item.occurrence_id === selected.value.id),
  set: (section) => {
    const sections = selectedChapter.value?.sections;
    const index = sections?.findIndex((item) => item.occurrence_id === section.occurrence_id) ?? -1;
    if (index >= 0) {
      sections[index] = section;
    }
  }
});

const { leaveOpen, confirmLeave, finishLeave } = useWorkbenchGuard({
  dirty,
  saving,
  busy: () => archiveBusy.value,
  blocked: () => loading.value
});

async function loadLectures() {
  const sequence = ++listSequence;
  if (canManageAll.value) {
    loadManagedLectures(sequence);
  }
  listLoading.value = {
    local: true,
    online: true
  };
  listErrors.value = {
    local: '',
    online: ''
  };
  let publicItems = null;
  let privateItems = null;
  const updateOnline = () => {
    if (sequence !== listSequence || !privateItems) {
      return;
    }
    const publicById = new Map((publicItems || []).map((item) => [item.id, item]));
    const previousById = new Map(lectures.value.map((item) => [item.id, item]));
    lectures.value = privateItems.map((item) => ({
      ...publicById.get(item.id),
      ...item,
      isPublic: publicItems
        ? publicById.has(item.id)
        : Boolean(previousById.get(item.id)?.isPublic),
      canViewPrivate: true
    }));
  };
  const localPromise = listLocalLectures().then((items) => {
    if (sequence === listSequence) {
      localLectures.value = items;
    }
    return items;
  });
  const onlinePromise = (canBrowseOnline.value ? lectureApi.list() : Promise.resolve([])).then(
    (items) => {
      publicItems = items;
      updateOnline();
      return items;
    }
  );
  const minePromise = (canBrowseOnline.value ? lectureApi.mine() : Promise.resolve([])).then(
    (items) => {
      privateItems = items;
      updateOnline();
      if (sequence === listSequence) {
        preloadCourseVersions(items, sequence);
      }
      return items;
    }
  );
  localPromise.then(
    () => {
      if (sequence === listSequence) {
        listLoading.value = {
          ...listLoading.value,
          local: false
        };
      }
    },
    () => {
      if (sequence !== listSequence) {
        return;
      }
      listLoading.value = {
        ...listLoading.value,
        local: false
      };
      listErrors.value = {
        ...listErrors.value,
        local: '本地讲义加载失败'
      };
    }
  );
  Promise.allSettled([onlinePromise, minePromise]).then(([online, mine]) => {
    if (sequence !== listSequence) {
      return;
    }
    let error = '';
    if (online.status === 'rejected' && mine.status === 'rejected') {
      error = '我创作的讲义加载失败';
    } else if (online.status === 'rejected') {
      error = '我创作的讲义加载失败';
    } else if (mine.status === 'rejected') {
      error = '我创作的讲义加载失败';
    }
    listLoading.value = {
      ...listLoading.value,
      online: false
    };
    listErrors.value = {
      ...listErrors.value,
      online: error
    };
  });
  const [local, online, mine, categoryList] = await Promise.allSettled([
    localPromise,
    onlinePromise,
    minePromise,
    managementApi.categories('lecture')
  ]);
  if (sequence !== listSequence) {
    return;
  }
  const errors = [];
  const sectionErrors = {
    local: '',
    online: ''
  };
  if (local.status === 'fulfilled') {
    localLectures.value = local.value;
  } else {
    sectionErrors.local = '本地讲义加载失败';
    errors.push(sectionErrors.local);
  }
  if (online.status === 'rejected') {
    sectionErrors.online = '我创作的讲义加载失败';
    errors.push(sectionErrors.online);
  }
  if (mine.status === 'rejected') {
    sectionErrors.online = '我创作的讲义加载失败';
    errors.push('我创作的讲义加载失败');
  }
  listErrors.value = sectionErrors;
  listLoading.value = {
    local: false,
    online: false
  };
  if (categoryList.status === 'fulfilled') {
    categories.value = categoryList.value;
  }
  if (errors.length) {
    notify(errors.join('；'), 'error');
  }
}

async function loadManagedLectures(sequence) {
  managedLoading.value = true;
  managedError.value = '';
  try {
    const result = await lectureApi.manage();
    if (!Array.isArray(result)) {
      throw new Error('全部讲义列表格式不正确');
    }
    if (sequence === listSequence && canManageAll.value) {
      managedLectures.value = result;
    }
  } catch (error) {
    if (sequence === listSequence && canManageAll.value) {
      managedError.value = error.message || '全部讲义加载失败';
    }
  } finally {
    if (sequence === listSequence) {
      managedLoading.value = false;
    }
  }
}

async function openManageSummary(item, skipConfirm = false) {
  if (!canManageAll.value || loading.value || saving.value || createOpen.value) {
    return;
  }
  if (!skipConfirm && !(await confirmLeave())) {
    return;
  }
  if (dirty.value) {
    discard();
  }
  const current = ++summarySequence;
  summaryId.value = item.id;
  summaryItem.value = null;
  summaryError.value = '';
  summaryLoading.value = true;
  lecture.value = null;
  revision.value = null;
  chapters.value = [];
  baseline.value = '';
  try {
    const result = await lectureApi.manage();
    if (!Array.isArray(result)) {
      throw new Error('全部讲义列表格式不正确');
    }
    const found = result.find((entry) => entry.id === item.id);
    if (!found) {
      throw new Error('讲义不存在或已被删除');
    }
    if (current !== summarySequence || !canManageAll.value) {
      return;
    }
    managedLectures.value = result;
    summaryItem.value = found;
  } catch (error) {
    if (current === summarySequence) {
      summaryError.value = error.message || '讲义信息加载失败';
    }
  } finally {
    if (current === summarySequence) {
      summaryLoading.value = false;
    }
  }
}

async function openManagedEditor() {
  if (!summaryItem.value) {
    return;
  }
  const managed = summaryItem.value;
  const item = {
    ...lectures.value.find((entry) => entry.id === managed.id),
    ...managed,
    canViewPrivate: true
  };
  if (await selectLecture(item, 'online')) {
    summarySequence++;
    summaryId.value = null;
  }
}

async function getCourseVersions(item) {
  const key = `online:${item.id}`;
  if (lectureVersions.value.has(key)) {
    return lectureVersions.value.get(key);
  }
  if (versionRequests.has(key)) {
    return versionRequests.get(key);
  }
  const epoch = treeEpoch;
  const promise = lectureApi
    .revisions(item.id)
    .then((versions) => {
      if (!Array.isArray(versions)) {
        throw new Error('课程版本列表不完整');
      }
      if (epoch === treeEpoch) {
        lectureVersions.value = new Map(lectureVersions.value).set(key, versions);
        const errors = new Set(versionNameErrors.value);
        errors.delete(key);
        versionNameErrors.value = errors;
      }
      return versions;
    })
    .catch((err) => {
      if (epoch === treeEpoch) {
        versionNameErrors.value = new Set(versionNameErrors.value).add(key);
      }
      throw err;
    })
    .finally(() => {
      if (versionRequests.get(key) === promise) {
        versionRequests.delete(key);
      }
    });
  versionRequests.set(key, promise);
  return promise;
}

function preloadCourseVersions(items, sequence) {
  let index = 0;
  const loadNext = async () => {
    while (sequence === listSequence && index < items.length) {
      const item = items[index++];
      try {
        await getCourseVersions(item);
      } catch {
        // 节点会显示加载错误并允许重试
      }
    }
  };
  for (let i = 0; i < Math.min(4, items.length); i++) {
    loadNext();
  }
}

async function selectLecture(item, source, force = false, discardConfirmed = false) {
  if (source === 'online' && !canBrowseOnline.value) {
    return false;
  }
  if (loading.value || saving.value || createOpen.value) {
    return false;
  }
  const key = `${source}:${item.id}`;
  if (
    !force &&
    ownsContext.value &&
    lecture.value?.key === key &&
    revision.value &&
    (source === 'local' || lecture.value.hasPrivateAccess || !item.canViewPrivate)
  ) {
    return true;
  }
  if (!discardConfirmed && !(await confirmLeave())) {
    return false;
  }
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
      data.revision.metadata = {
        ...(data.revision.metadata || {})
      };
      if (typeof data.cover === 'string') {
        if (data.cover) {
          data.revision.metadata.cover = data.cover;
        } else {
          delete data.revision.metadata.cover;
        }
      }
      for (const chapter of data.chapters) {
        for (const section of chapter.sections) {
          if (typeof section.source === 'string') {
            continue;
          }
          const blocks = section.blocks;
          if (
            !Array.isArray(blocks) ||
            blocks.length > 1 ||
            blocks.some(
              (block) =>
                block.block_type !== 'author' ||
                block.animation != null ||
                typeof block.source !== 'string'
            )
          ) {
            throw new Error('本地课程包含旧版引用或动画，暂不能安全转换，原数据已保留');
          }
          section.source = blocks[0]?.source || '';
          delete section.blocks;
        }
      }
    } else if (item.canViewPrivate && authStatus.value === 'authenticated') {
      const [versions, collaborators] = await Promise.all([
        force ? lectureApi.revisions(item.id) : getCourseVersions(item),
        lectureApi.collaborators(item.id)
      ]);
      if (!versions.length) {
        throw new Error('该在线课程暂无版本');
      }
      if (sequence !== loadSequence) {
        return false;
      }
      lectureVersions.value = new Map(lectureVersions.value).set(key, versions);
      pending = versions.find((version) => version.status === 'pending')?.id || null;
      canEditLecture =
        currentUser.value?.role === 'super_admin' ||
        item.owner_id === currentUser.value?.id ||
        collaborators.some(
          (entry) => entry.user_id === currentUser.value?.id && entry.permission === 'edit'
        );
      if (!canEditLecture && item.isPublic) {
        data = await lectureApi.outline(item.slug);
      } else {
        data = await lectureApi.outline(
          item.slug,
          (canEditLecture
            ? versions.find((version) => version.status === 'draft') || versions[0]
            : versions[0]
          ).id
        );
      }
    } else {
      data = await lectureApi.outline(item.slug);
    }
    if (sequence !== loadSequence) {
      return false;
    }
    lecture.value = {
      id: item.id,
      slug: item.slug || data.lecture?.slug,
      key,
      isLocal: source === 'local',
      ownerUserId: source === 'online' ? (currentUser.value?.id ?? null) : null,
      lectureOwnerId: item.owner_id,
      publicationStatus: item.publication_status,
      editVersion: item.editVersion,
      canEdit: canEditLecture,
      permissionValid: true,
      hasPrivateAccess: source === 'online' && Boolean(item.canViewPrivate)
    };
    revision.value = JSON.parse(JSON.stringify(data.revision));
    pendingSnapshotId.value = pending;
    chapters.value = JSON.parse(JSON.stringify(data.chapters));
    const treeKey =
      source === 'online' && item.canViewPrivate ? `${key}:version:${data.revision.id}` : key;
    lectureTrees.value = new Map(lectureTrees.value).set(
      treeKey,
      JSON.parse(JSON.stringify(data.chapters))
    );
    selected.value = {
      type: 'lecture',
      id: ''
    };
    baseline.value = snapshot();
    onlineConflict.value = false;
    return true;
  } catch (err) {
    if (sequence === loadSequence) {
      notify(err.message || '讲义加载失败', 'error');
    }
    return false;
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
      loadingKey.value = '';
    }
  }
}

async function selectRevision(node) {
  if (!canBrowseOnline.value) {
    return false;
  }
  if (loading.value || saving.value || createOpen.value) {
    return false;
  }
  if (
    ownsContext.value &&
    lecture.value?.key === node.courseKey &&
    revision.value?.id === node.revisionId
  ) {
    return true;
  }
  if (!(await confirmLeave())) {
    return false;
  }
  const sequence = ++loadSequence;
  draftRefreshSequence++;
  loading.value = true;
  loadingKey.value = node.courseKey;
  try {
    const [data, collaborators] = await Promise.all([
      lectureApi.outline(node.item.slug, node.revisionId),
      lectureApi.collaborators(node.item.id)
    ]);
    if (sequence !== loadSequence) {
      return false;
    }
    if (
      data.revision?.id !== node.revisionId ||
      data.revision?.lecture_id !== node.item.id ||
      !Array.isArray(data.chapters)
    ) {
      throw new Error('版本数据不匹配');
    }
    const editable =
      currentUser.value?.role === 'super_admin' ||
      node.item.owner_id === currentUser.value?.id ||
      collaborators.some(
        (entry) => entry.user_id === currentUser.value?.id && entry.permission === 'edit'
      );
    lecture.value = {
      id: node.item.id,
      slug: node.item.slug,
      key: node.courseKey,
      isLocal: false,
      ownerUserId: currentUser.value?.id ?? null,
      lectureOwnerId: node.item.owner_id,
      publicationStatus: node.item.publication_status,
      canEdit: editable,
      permissionValid: true,
      hasPrivateAccess: true
    };
    revision.value = data.revision;
    chapters.value = data.chapters;
    lectureTrees.value = new Map(lectureTrees.value).set(
      node.id,
      JSON.parse(JSON.stringify(data.chapters))
    );
    pendingSnapshotId.value =
      (lectureVersions.value.get(node.courseKey) || []).find(
        (version) => version.status === 'pending'
      )?.id || null;
    selected.value = {
      type: 'lecture',
      id: ''
    };
    baseline.value = snapshot();
    onlineConflict.value = false;
    return true;
  } catch (err) {
    if (sequence === loadSequence) {
      notify(err.message || '版本加载失败', 'error');
    }
    return false;
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
      loadingKey.value = '';
    }
  }
}

function closeLectureImport() {
  importSequence++;
  importOpen.value = false;
  importFile.value = null;
  importName.value = '';
  importSlug.value = '';
  importError.value = '';
  importReading.value = false;
  importUncertain.value = false;
}
function openLectureImport(node) {
  if (
    node.type !== 'group' ||
    !['local', 'online'].includes(node.id) ||
    (node.id === 'online' && !canCreateOnline.value) ||
    saving.value
  ) {
    return;
  }
  closeLectureImport();
  importSource.value = node.id;
  importOpen.value = true;
}
async function readLectureImport(event) {
  if (saving.value || importUncertain.value) {
    return;
  }
  const sequence = ++importSequence;
  try {
    const file = event?.target?.files?.[0];
    if (!file) {
      return;
    }
    importFile.value = null;
    importName.value = file.name;
    importSlug.value = '';
    importError.value = '';
    importReading.value = true;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('文件不是有效的 JSON，请选择讲义导出文件');
      }
      throw error;
    }
    if (sequence !== importSequence) {
      return;
    }
    importFile.value = validatePortableLecture(data);
    importSlug.value = data.lecture.slug;
  } catch (error) {
    if (sequence === importSequence) {
      importFile.value = null;
      importError.value = `无法导入讲义：${error?.message || '文件读取失败'}`;
    }
  } finally {
    if (sequence === importSequence) {
      importReading.value = false;
    }
  }
}
async function submitLectureImport() {
  if (
    !importOpen.value ||
    !importFile.value ||
    importReading.value ||
    importUncertain.value ||
    saving.value
  ) {
    return;
  }
  if (importSource.value === 'online' && !canCreateOnline.value) {
    return;
  }
  const data = {
    ...importFile.value,
    lecture: {
      ...importFile.value.lecture,
      slug: importSlug.value.trim()
    }
  };
  try {
    validatePortableLecture(data);
  } catch (error) {
    importError.value = error.message;
    return;
  }
  const source = importSource.value;
  const epoch = identityEpoch;
  saving.value = true;
  importError.value = '';
  try {
    if (source === 'local') {
      await createLocalLecture(portableToLocalLecture(data));
      closeLectureImport();
      notify('本地讲义已导入', 'success');
      await loadLectures();
    } else {
      const result = await lectureApi.importLecture(data);
      if (epoch !== identityEpoch) {
        notify('导入请求已完成，账号已变化，请核对讲义列表', 'warn', 0);
        return;
      }
      if (!result?.lecture?.id || !result?.revision?.id) {
        importUncertain.value = true;
        importError.value = '导入结果未确认，请刷新列表核对后再操作';
        return;
      }
      closeLectureImport();
      notify('讲义已导入为新草稿', 'success');
      await loadLectures();
    }
    treeRef.value?.expand('group', source);
  } catch (error) {
    if (source === 'online' && epoch !== identityEpoch) {
      notify('导入结果未确认，请重新核对讲义列表', 'warn', 0);
    } else if (source === 'online' && ![400, 401, 403, 404, 409, 413, 422].includes(error.status)) {
      importUncertain.value = true;
      importError.value = '导入结果未确认，请刷新列表核对后再操作';
    } else {
      importError.value =
        error.status === 409 ? '课程标识已存在，请修改后重试' : error.message || '导入失败';
    }
  } finally {
    saving.value = false;
  }
}
async function exportLecture() {
  if (
    !lecture.value ||
    !revision.value ||
    !ownsContext.value ||
    isArchived.value ||
    saving.value ||
    loading.value
  ) {
    return;
  }
  if (dirty.value) {
    notify('请先保存所有修改，再导出讲义', 'warn');
    return;
  }
  const context = lecture.value;
  const revisionId = revision.value.id;
  const epoch = identityEpoch;
  saving.value = true;
  try {
    let data;
    if (context.isLocal) {
      const stored = (await listLocalLectures()).find((item) => item.id === context.id);
      if (!stored || stored.editVersion !== context.editVersion) {
        throw new Error('本地讲义已发生变化，请重新读取后导出');
      }
      data = localLectureToPortable(stored);
    } else {
      data = validatePortableLecture(await lectureApi.exportRevision(revisionId));
    }
    checkExportMetadata(data.lecture.metadata);
    if (epoch !== identityEpoch || lecture.value !== context || dirty.value) {
      throw new Error('讲义状态已变化，请重新确认后导出');
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      })
    );
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.lecture.slug}.json`;
      link.click();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (error) {
    notify(error.message || '导出失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function openCreate(source) {
  if (source === 'online' && !canCreateOnline.value) {
    return;
  }
  if (!(await confirmLeave())) {
    return;
  }
  createSource.value = source;
  createForm.value = {
    title: '',
    slug: ''
  };
  createOpen.value = true;
}

async function createLecture() {
  if (saving.value) {
    return;
  }
  if (createSource.value === 'online' && !canCreateOnline.value) {
    notify('当前账号无权新建在线课程', 'warn');
    return;
  }
  const title = createForm.value.title.trim();
  const slug = createForm.value.slug.trim();
  if (!title || !slug) {
    notify('请填写课程名称和课程标识', 'warn');
    return;
  }
  saving.value = true;
  const source = createSource.value;
  const epoch = identityEpoch;
  listSequence++;
  try {
    let item;
    if (source === 'local') {
      item = {
        id: crypto.randomUUID(),
        slug,
        editVersion: 1,
        sourceLectureId: null,
        sourceRevisionId: null,
        revision: {
          title,
          subtitle: '',
          descr: '',
          category_id: null,
          typst_version: '0.15.1',
          metadata: {},
          change_note: ''
        },
        chapters: []
      };
      await createLocalLecture(item);
      localLectures.value = [...localLectures.value, item];
    } else {
      const result = await lectureApi.create({
        title,
        slug
      });
      if (epoch !== identityEpoch) {
        notify('课程已创建，账号状态已变化，请重新加载列表', 'warn');
        return;
      }
      item = {
        ...result.lecture,
        title: result.revision.title,
        canViewPrivate: true
      };
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
  } finally {
    saving.value = false;
  }
}

function openDownload() {
  if (
    !lecture.value ||
    !ownsContext.value ||
    lecture.value.isLocal ||
    isArchived.value ||
    saving.value ||
    loading.value ||
    createOpen.value
  ) {
    return;
  }
  downloadSlug.value = lecture.value.slug || '';
  downloadOpen.value = true;
}

async function downloadLecture() {
  if (
    !downloadOpen.value ||
    !lecture.value ||
    !ownsContext.value ||
    lecture.value.isLocal ||
    isArchived.value ||
    saving.value ||
    loading.value ||
    createOpen.value
  ) {
    return;
  }
  if (dirty.value) {
    notify('请先保存所有修改，再下载讲义', 'warn');
    return;
  }
  const context = lecture.value;
  const revisionId = revision.value.id;
  saving.value = true;
  try {
    const data = await lectureApi.exportRevision(revisionId);
    if (lecture.value !== context || revision.value?.id !== revisionId || dirty.value) {
      throw new Error('讲义状态已变化，请重新确认后下载');
    }
    const record = portableToLocalLecture(data);
    record.slug = downloadSlug.value.trim();
    record.sourceLectureId = context.id;
    record.sourceRevisionId = revisionId;
    await createLocalLecture(record);
    localLectures.value = await listLocalLectures();
    downloadOpen.value = false;
    treeRef.value?.expand('group', 'local');
    notify('已下载到本地，可选择本地课程进行修改', 'success');
  } catch (err) {
    notify(err.message || '下载讲义失败', 'error');
  } finally {
    saving.value = false;
  }
}

function validateDraft() {
  const issues = [];
  const value = (input) => (typeof input === 'string' ? input.trim() : '');
  const counts = (items) => {
    const result = new Map();
    for (const item of items) {
      const slug = value(item.slug);
      if (slug) {
        result.set(slug, (result.get(slug) || 0) + 1);
      }
    }
    return result;
  };
  if (!value(revision.value.title)) {
    issues.push('课程：请填写课程名称');
  }
  if (!value(revision.value.typst_version)) {
    issues.push('课程：请填写 Typst 版本');
  }
  if (lecture.value?.isLocal && !value(lecture.value.slug)) {
    issues.push('课程：请填写课程标识');
  }
  const chapterCounts = counts(chapters.value);
  chapters.value.forEach((chapter, chapterIndex) => {
    const chapterTitle = value(chapter.title);
    const chapterName = `第 ${chapterIndex + 1} 章${chapterTitle ? `「${chapterTitle}」` : ''}`;
    const chapterSlug = value(chapter.slug);
    const missing = [];
    if (!chapterTitle) {
      missing.push('章节名称');
    }
    if (!chapterSlug) {
      missing.push('章节标识');
    }
    if (missing.length) {
      issues.push(`${chapterName}：请填写${missing.join('、')}`);
    }
    if (chapterSlug && chapterCounts.get(chapterSlug) > 1) {
      issues.push(`${chapterName}：章节标识「${chapterSlug}」重复`);
    }
    const sectionCounts = counts(chapter.sections);
    chapter.sections.forEach((section, sectionIndex) => {
      const sectionTitle = value(section.title);
      const sectionName = `${chapterName} / 第 ${sectionIndex + 1} 小节${sectionTitle ? `「${sectionTitle}」` : ''}`;
      const sectionSlug = value(section.slug);
      const sectionMissing = [];
      if (!sectionTitle) {
        sectionMissing.push('小节标题');
      }
      if (!sectionSlug) {
        sectionMissing.push('小节标识');
      }
      if (sectionMissing.length) {
        issues.push(`${sectionName}：请填写${sectionMissing.join('、')}`);
      }
      if (sectionSlug && sectionCounts.get(sectionSlug) > 1) {
        issues.push(`${sectionName}：小节标识「${sectionSlug}」在本章节中重复`);
      }
    });
  });
  return issues;
}

async function save() {
  if (!canEdit.value || saving.value || !dirty.value) {
    return;
  }
  if (!lecture.value.isLocal && selected.value.type === 'section') {
    await saveCurrentSection();
    return;
  }
  const issues = validateDraft();
  if (issues.length) {
    notify(
      `保存会检查整份讲义，请补齐所有必填项并解决课程、章节或小节标识重复：\n${issues.join('\n')}`,
      'warn',
      0
    );
    return;
  }
  const submitted = snapshot();
  const data = JSON.parse(submitted);
  const epoch = identityEpoch;
  draftRefreshSequence++;
  saving.value = true;
  try {
    if (lecture.value.isLocal) {
      const current = localLectures.value.find((item) => item.id === lecture.value.id);
      if (!current) {
        throw new Error('本地课程不存在，请先备份当前内容');
      }
      const record = {
        ...current,
        slug: data.slug,
        cover:
          typeof data.revision.metadata?.cover === 'string' ? data.revision.metadata.cover : '',
        revision: data.revision,
        chapters: data.chapters
      };
      const version = await saveLocalLecture(record, lecture.value.editVersion);
      lecture.value.editVersion = version;
      localLectures.value = localLectures.value.map((item) =>
        item.id === record.id
          ? {
              ...record,
              editVersion: version
            }
          : item
      );
      baseline.value = submitted;
    } else {
      if (onlineConflict.value) {
        throw new Error('请先备份并重新读取在线版本');
      }
      const payload = lectureSaveBody(data.revision, data.chapters);
      const saved = JSON.parse(baseline.value);
      const savedSections = new Map(
        saved.chapters
          .flatMap((chapter) => chapter.sections)
          .map((section) => [section.occurrence_id, section])
      );
      for (const chapter of payload.chapters) {
        for (const section of chapter.sections) {
          const previous = savedSections.get(section.occurrence_id);
          if (previous && section.source === previous.source) {
            delete section.source;
          }
        }
      }
      const result = await lectureApi.saveRevision(data.revision.id, payload);
      if (epoch !== identityEpoch) {
        onlineConflict.value = true;
        notify('账号状态已变化，当前修改已保留，请重新核对保存结果', 'warn', 0);
        return;
      }
      if (
        !Number.isInteger(result?.revision?.edit_version) ||
        !Array.isArray(result.chapters) ||
        result.chapters.some(
          (chapter) =>
            !chapter.occurrence_id ||
            !Array.isArray(chapter.sections) ||
            chapter.sections.some((section) => !section.occurrence_id)
        )
      ) {
        onlineConflict.value = true;
        notify('保存请求已成功，但响应不完整，请先备份当前修改并重新读取', 'warn', 0);
        return;
      }
      lectureTrees.value = new Map(lectureTrees.value).set(
        `${lecture.value.key}:version:${result.revision.id}`,
        JSON.parse(JSON.stringify(result.chapters))
      );
      const versions = lectureVersions.value.get(lecture.value.key);
      if (versions) {
        lectureVersions.value = new Map(lectureVersions.value).set(
          lecture.value.key,
          versions.map((version) =>
            version.id === result.revision.id
              ? {
                  ...version,
                  ...result.revision
                }
              : version
          )
        );
      }
      if (snapshot() === submitted) {
        const sources = new Map(
          data.chapters
            .flatMap((chapter) => chapter.sections)
            .filter((section) => typeof section.source === 'string')
            .map((section) => [section.occurrence_id, section.source])
        );
        for (const chapter of result.chapters) {
          for (const section of chapter.sections) {
            if (sources.has(section.occurrence_id)) {
              section.source = sources.get(section.occurrence_id);
            }
          }
        }
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
    if (err.status === 409 && !lecture.value.isLocal) {
      onlineConflict.value = true;
    }
    notify(
      err.status === 409
        ? `${err.message || '保存冲突'}，当前修改已保留，请核对后重新读取版本`
        : err.message || '保存失败，当前修改已保留',
      'error'
    );
  } finally {
    saving.value = false;
  }
}

async function saveCurrentSection() {
  const section = selectedSection.value;
  const saved = JSON.parse(baseline.value);
  const oldChapter = saved.chapters.find((chapter) =>
    chapter.sections.some((item) => item.occurrence_id === section?.occurrence_id)
  );
  const oldSection = oldChapter?.sections.find(
    (item) => item.occurrence_id === section?.occurrence_id
  );
  if (!section || !oldSection) {
    notify('请先保存新建的小节目录', 'warn');
    return;
  }
  if (selectedChapter.value?.occurrence_id !== oldChapter.occurrence_id) {
    notify('请先保存小节目录的调整', 'warn');
    return;
  }
  if (!section.slug?.trim() || !section.title?.trim()) {
    notify('请填写小节标识和名称', 'warn');
    return;
  }
  if (onlineConflict.value) {
    notify('请先备份并重新读取在线版本', 'warn');
    return;
  }
  const sent = JSON.parse(JSON.stringify(section));
  const epoch = identityEpoch;
  saving.value = true;
  draftRefreshSequence++;
  try {
    const result = await lectureApi.saveSection(revision.value.id, sent.occurrence_id, {
      edit_version: revision.value.edit_version,
      slug: sent.slug,
      tag: sent.tag || '',
      title: sent.title,
      summary: sent.summary || '',
      source: sent.source
    });
    if (
      epoch !== identityEpoch ||
      !Number.isInteger(result?.edit_version) ||
      result?.section?.occurrence_id !== sent.occurrence_id
    ) {
      onlineConflict.value = true;
      notify('保存结果需要重新核对，请先备份当前修改', 'warn', 0);
      return;
    }
    revision.value.edit_version = result.edit_version;
    saved.revision.edit_version = result.edit_version;
    Object.assign(oldSection, result.section);
    if (JSON.stringify(section) === JSON.stringify(sent)) {
      Object.assign(section, result.section);
    }
    baseline.value = JSON.stringify(saved);
    notify('当前小节已保存', 'success');
  } catch (err) {
    if (err.status === 409) {
      onlineConflict.value = true;
    }
    notify(
      err.status === 409
        ? `${err.message || '保存冲突'}，当前修改已保留，请核对后重新读取版本`
        : err.message || '保存失败，当前修改已保留',
      'error'
    );
  } finally {
    saving.value = false;
  }
}

async function updateOnlineCover(cover) {
  if (!canEditOnline.value || revision.value?.status !== 'draft' || saving.value || loading.value) {
    return;
  }
  if (dirty.value) {
    notify('请先保存或放弃讲义修改，再修改封面', 'warn');
    return;
  }
  if (onlineConflict.value) {
    notify('请先备份并重新读取在线版本', 'warn');
    return;
  }
  const context = lecture.value;
  const currentRevision = revision.value;
  const epoch = identityEpoch;
  const version = currentRevision.edit_version;
  saving.value = true;
  draftRefreshSequence++;
  try {
    const result = cover
      ? await lectureApi.setCover(currentRevision.id, version, cover)
      : await lectureApi.removeCover(currentRevision.id, version);
    if (
      epoch !== identityEpoch ||
      lecture.value !== context ||
      revision.value !== currentRevision ||
      String(result?.revision_id) !== String(currentRevision.id) ||
      !Number.isInteger(result?.edit_version) ||
      result.edit_version <= version ||
      result.has_cover !== Boolean(cover)
    ) {
      onlineConflict.value = true;
      notify('封面保存结果需要重新核对，请重新读取讲义', 'warn', 0);
      return;
    }
    currentRevision.edit_version = result.edit_version;
    currentRevision.has_cover = result.has_cover;
    currentRevision.cover_hash = result.cover_hash || '';
    if (currentRevision.metadata?.cover !== undefined) {
      const metadata = {
        ...currentRevision.metadata
      };
      delete metadata.cover;
      currentRevision.metadata = metadata;
    }
    baseline.value = snapshot();
    notify(cover ? '封面已保存' : '封面已删除', 'success');
  } catch (error) {
    if (error.status === 409 || !error.status) {
      onlineConflict.value = true;
    }
    notify(
      error.status === 409
        ? '讲义已发生变化，请重新读取后再修改封面'
        : !error.status
          ? '封面保存结果未能确认，请重新读取讲义'
          : error.message || '封面保存失败，请重试',
      'error'
    );
  } finally {
    saving.value = false;
  }
}

async function reloadConflictedLecture() {
  const item = lectures.value.find((entry) => entry.id === lecture.value?.id);
  if (item) {
    await selectLecture(item, 'online', true);
  }
}

function discard() {
  if (!baseline.value) {
    return;
  }
  const saved = JSON.parse(baseline.value);
  revision.value = saved.revision;
  chapters.value = saved.chapters;
  if (lecture.value?.isLocal) {
    lecture.value.slug = saved.slug;
  }
  selected.value = {
    type: 'lecture',
    id: ''
  };
}

function closeSubmit() {
  submitOpen.value = false;
  clearInterval(submitTimer);
  submitTimer = null;
}

function openSubmit() {
  if (
    !canEditOnline.value ||
    !canEdit.value ||
    saving.value ||
    pendingSnapshotId.value ||
    onlineConflict.value
  ) {
    return;
  }
  if (dirty.value) {
    notify('请先保存所有修改，再提交审核', 'warn');
    return;
  }
  const versions = lectureVersions.value.get(lecture.value.key);
  const versionNumbers = versions?.map((version) => version.revision_no);
  const expectedVersion =
    versionNumbers?.length &&
    versionNumbers.every((number) => Number.isSafeInteger(number) && number > 0)
      ? Math.max(...versionNumbers) + 1
      : null;
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
    if (!submitCountdown.value) {
      clearInterval(submitTimer);
      submitTimer = null;
    }
  }, 200);
}

async function submitDraft() {
  if (
    !submitOpen.value ||
    Date.now() < submitDeadline ||
    !submitTarget.value ||
    !canEditOnline.value ||
    !canEdit.value ||
    dirty.value ||
    saving.value ||
    pendingSnapshotId.value ||
    onlineConflict.value
  ) {
    return;
  }
  if (
    revision.value.id !== submitTarget.value.id ||
    revision.value.edit_version !== submitTarget.value.editVersion
  ) {
    closeSubmit();
    notify('草稿状态已变化，请重新检查后提交', 'warn');
    return;
  }
  draftRefreshSequence++;
  const epoch = identityEpoch;
  saving.value = true;
  try {
    const result = await lectureApi.submitRevision(revision.value.id, revision.value.edit_version);
    if (epoch !== identityEpoch) {
      onlineConflict.value = true;
      notify('账号状态已变化，请重新核对提交结果', 'warn', 0);
      return;
    }
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
    lectureVersions.value = new Map(lectureVersions.value).set(lecture.value.key, [
      submittedRevision,
      ...versions.filter((item) => item.id !== submittedRevision.id)
    ]);
    revision.value.edit_version = result.draft_edit_version;
    baseline.value = snapshot();
    closeSubmit();
    try {
      const updated = await lectureApi.revisions(lecture.value.id);
      lectureVersions.value = new Map(lectureVersions.value).set(lecture.value.key, updated);
      const versionLabel = Number.isSafeInteger(submittedRevision.revision_no)
        ? ` V${submittedRevision.revision_no}`
        : '';
      notify(`审核快照${versionLabel}已提交，草稿可继续编辑`, 'success');
    } catch {
      const versionLabel = Number.isSafeInteger(submittedRevision.revision_no)
        ? ` V${submittedRevision.revision_no}`
        : '';
      notify(`审核快照${versionLabel}已提交，但版本列表刷新失败，请稍后刷新`, 'warn');
    }
  } catch (err) {
    notify(err.message || '提交审核失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function refreshDraftOnVisible() {
  if (
    document.visibilityState !== 'visible' ||
    !ownsContext.value ||
    !lecture.value?.hasPrivateAccess ||
    authStatus.value !== 'authenticated' ||
    saving.value ||
    loading.value
  ) {
    return;
  }
  const id = revision.value.id;
  const courseKey = lecture.value.key;
  const sequence = ++draftRefreshSequence;
  try {
    const [latest, versions] = await Promise.all([
      canEditOnline.value && revision.value?.status === 'draft'
        ? lectureApi.outline(lecture.value.slug, id)
        : Promise.resolve(null),
      lectureApi.revisions(lecture.value.id)
    ]);
    if (
      sequence !== draftRefreshSequence ||
      lecture.value?.key !== courseKey ||
      revision.value?.id !== id ||
      saving.value
    ) {
      return;
    }
    lectureVersions.value = new Map(lectureVersions.value).set(courseKey, versions);
    pendingSnapshotId.value = versions.find((version) => version.status === 'pending')?.id || null;
    if (!latest) {
      return;
    }
    if (latest.revision.edit_version === revision.value.edit_version) {
      return;
    }
    if (dirty.value) {
      onlineConflict.value = true;
      notify('在线草稿已更新，当前修改已保留，请备份后重新读取', 'warn', 0);
      return;
    }
    revision.value = latest.revision;
    chapters.value = latest.chapters;
    baseline.value = snapshot();
    lectureTrees.value = new Map(lectureTrees.value).set(
      `${courseKey}:version:${latest.revision.id}`,
      JSON.parse(JSON.stringify(latest.chapters))
    );
    selected.value = {
      type: 'lecture',
      id: ''
    };
    notify('在线草稿已更新', 'info');
  } catch (err) {
    if (sequence === draftRefreshSequence) {
      notify(err.message || '检查在线草稿更新失败', 'error');
    }
  }
}

async function refreshTree() {
  await loadLectures();
  if (lecture.value?.hasPrivateAccess && authStatus.value === 'authenticated') {
    await refreshDraftOnVisible();
  }
}

function addChapter() {
  treeRef.value?.expand('group', lecture.value.isLocal ? 'local' : 'online');
  treeRef.value?.expand('lecture', lecture.value.key);
  if (lecture.value.hasPrivateAccess) {
    treeRef.value?.expand('version', `${lecture.value.key}:version:${revision.value.id}`);
  }
  const item = {
    occurrence_id: crypto.randomUUID(),
    slug: '',
    title: '',
    tag: '',
    summary: '',
    sections: []
  };
  chapters.value.push(item);
  selected.value = {
    type: 'chapter',
    id: item.occurrence_id
  };
}
function addSection(chapter) {
  const key = lecture.value.hasPrivateAccess
    ? `${lecture.value.key}:version:${revision.value.id}`
    : lecture.value.key;
  treeRef.value?.expand('chapter', `${key}:${chapter.occurrence_id}`);
  const item = {
    occurrence_id: crypto.randomUUID(),
    slug: '',
    title: '',
    tag: '',
    summary: '',
    source: ''
  };
  chapter.sections.push(item);
  selected.value = {
    type: 'section',
    id: item.occurrence_id
  };
}
function showImportedSections() {
  if (!lecture.value || !selectedChapter.value) {
    return;
  }
  const key = lecture.value.hasPrivateAccess
    ? `${lecture.value.key}:version:${revision.value.id}`
    : lecture.value.key;
  treeRef.value?.expand('chapter', `${key}:${selectedChapter.value.occurrence_id}`);
}
function move(list, index, offset) {
  const target = index + offset;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) {
    return;
  }
  [list[index], list[target]] = [list[target], list[index]];
}
function removeChapter(chapter) {
  chapters.value.splice(chapters.value.indexOf(chapter), 1);
  selected.value = {
    type: 'lecture',
    id: ''
  };
}
function removeSection(chapter, section) {
  chapter.sections.splice(chapter.sections.indexOf(section), 1);
  selected.value = {
    type: 'chapter',
    id: chapter.occurrence_id
  };
}

async function selectTreeNode(node) {
  if (loading.value || saving.value || createOpen.value) {
    return;
  }
  if (node.type === 'lecture' && node.group === 'all') {
    await openManageSummary(node.item);
    return;
  }
  if (node.type === 'lecture') {
    if (await selectLecture(node.item, node.source)) {
      summarySequence++;
      summaryId.value = null;
      selected.value = {
        type: 'lecture',
        id: ''
      };
    }
  } else if (node.type === 'version') {
    if (await selectRevision(node)) {
      summarySequence++;
      summaryId.value = null;
    }
  } else if (node.type === 'chapter' || node.type === 'section') {
    if (node.versionId != null) {
      if (
        !(await selectRevision({
          ...node,
          id: `${node.courseKey}:version:${node.versionId}`,
          revisionId: node.versionId
        }))
      ) {
        return;
      }
    } else if (!(await selectLecture(node.item, node.source))) {
      return;
    }
    if (node.type === 'section' && !lecture.value.isLocal) {
      const section = chapters.value
        .flatMap((chapter) => chapter.sections)
        .find((item) => item.occurrence_id === node.occurrenceId);
      if (section && typeof section.source !== 'string') {
        const saved = JSON.parse(baseline.value);
        const chapter = saved.chapters.find((item) =>
          item.sections.some((entry) => entry.occurrence_id === node.occurrenceId)
        );
        const original = chapter?.sections.find((item) => item.occurrence_id === node.occurrenceId);
        if (!original) {
          notify('小节目录已变化，请先保存目录', 'warn');
          return;
        }
        loading.value = true;
        try {
          const result = await lectureApi.section(
            lecture.value.slug,
            revision.value.id,
            chapter.slug,
            original.slug,
            revision.value.edit_version
          );
          if (
            result.occurrence_id !== node.occurrenceId ||
            result.edit_version !== revision.value.edit_version ||
            typeof result.source !== 'string'
          ) {
            throw new Error('小节内容与目录不一致');
          }
          section.source = result.source;
          original.source = result.source;
          baseline.value = JSON.stringify(saved);
        } catch (err) {
          if (err.status === 409) {
            onlineConflict.value = true;
          }
          notify(err.message || '小节加载失败', 'error');
          return;
        } finally {
          loading.value = false;
        }
      }
    }
    selected.value = {
      type: node.type,
      id: node.occurrenceId
    };
    summarySequence++;
    summaryId.value = null;
  }
}

function expandTreeNode(node) {
  if (!canBrowseOnline.value) {
    return;
  }
  if (
    !['lecture', 'version'].includes(node.type) ||
    node.source !== 'online' ||
    treeLoadingKeys.value.has(node.id)
  ) {
    return;
  }
  if (node.type === 'lecture' && node.item.canViewPrivate && lectureVersions.value.has(node.id)) {
    return;
  }
  if (
    node.type === 'lecture' &&
    !node.item.canViewPrivate &&
    (lecture.value?.key === node.id || lectureTrees.value.has(node.id))
  ) {
    return;
  }
  if (
    node.type === 'version' &&
    ((lecture.value?.key === node.courseKey && revision.value?.id === node.revisionId) ||
      lectureTrees.value.has(node.id))
  ) {
    return;
  }
  const epoch = treeEpoch;
  treeLoadingKeys.value = new Set(treeLoadingKeys.value).add(node.id);
  requestAnimationFrame(async () => {
    if (epoch !== treeEpoch) {
      return;
    }
    try {
      if (node.type === 'lecture' && node.item.canViewPrivate) {
        const versions = await getCourseVersions(node.item);
        if (epoch === treeEpoch) {
          lectureVersions.value = new Map(lectureVersions.value).set(node.id, versions);
        }
      } else {
        const data = await lectureApi.outline(
          node.item.slug,
          node.type === 'version' ? node.revisionId : undefined
        );
        if (epoch === treeEpoch) {
          lectureTrees.value = new Map(lectureTrees.value).set(node.id, data.chapters);
        }
      }
    } catch (err) {
      if (epoch === treeEpoch) {
        notify(err.message || '加载在线课程目录失败', 'error');
      }
    } finally {
      if (epoch === treeEpoch) {
        const next = new Set(treeLoadingKeys.value);
        next.delete(node.id);
        treeLoadingKeys.value = next;
      }
    }
  });
}

function openDeleteLecture() {
  const item = lectures.value.find((entry) => entry.id === lecture.value?.id);
  if (
    !item ||
    item.publication_status !== 'archived' ||
    !canBrowseOnline.value ||
    currentUser.value?.role !== 'super_admin' ||
    saving.value
  ) {
    return;
  }
  if (lecture.value?.id === item.id && dirty.value) {
    notify('请先保存或放弃该讲义的未保存修改，再删除', 'warn');
    return;
  }
  deleteLectureTarget.value = {
    id: item.id,
    title: revision.value?.title || item.title || item.slug,
    userId: currentUser.value.id
  };
}

async function confirmDeleteLecture() {
  const target = deleteLectureTarget.value;
  const item = lectures.value.find((entry) => entry.id === target?.id);
  if (
    !target ||
    !item ||
    item.publication_status !== 'archived' ||
    !canBrowseOnline.value ||
    currentUser.value?.role !== 'super_admin' ||
    currentUser.value?.id !== target.userId ||
    archiveBusy.value ||
    saving.value
  ) {
    return;
  }
  if (lecture.value?.id === target.id && dirty.value) {
    notify('当前讲义有未保存的修改，请先处理后再删除', 'warn');
    return;
  }
  const epoch = identityEpoch;
  archiveBusy.value = true;
  try {
    await lectureApi.remove(target.id);
    deleteLectureTarget.value = null;
    if (epoch !== identityEpoch) {
      notify('删除请求已完成，账号状态已变化，请重新核对讲义列表', 'warn', 0);
      return;
    }
    listSequence++;
    treeEpoch++;
    versionRequests.clear();
    treeLoadingKeys.value = new Set();
    lectureTrees.value = new Map();
    lectureVersions.value = new Map();
    versionNameErrors.value = new Set();
    lectures.value = lectures.value.filter((entry) => entry.id !== target.id);
    if (lecture.value?.id === target.id && !lecture.value.isLocal) {
      lecture.value = null;
      revision.value = null;
      chapters.value = [];
      baseline.value = '';
      selected.value = {
        type: 'lecture',
        id: ''
      };
      pendingSnapshotId.value = null;
      onlineConflict.value = false;
    }
    notify('讲义已永久删除', 'success');
    await loadLectures();
  } catch (err) {
    if (epoch !== identityEpoch) {
      notify('删除结果未能确认，请重新核对讲义列表', 'warn', 0);
    } else if (err.status === 404 || err.status === 409) {
      deleteLectureTarget.value = null;
      notify(
        err.status === 404 ? '讲义不存在，正在刷新列表' : '讲义不再处于归档状态，正在刷新列表',
        'warn'
      );
      await loadLectures();
    } else {
      notify(err.message || '删除失败，请稍后重试', 'error');
    }
  } finally {
    archiveBusy.value = false;
  }
}

async function restoreLecture() {
  const context = lecture.value;
  const item = lectures.value.find((entry) => entry.id === context?.id);
  if (
    !context ||
    !item ||
    !isArchived.value ||
    !canBrowseOnline.value ||
    archiveBusy.value ||
    saving.value
  ) {
    return;
  }
  if (currentUser.value?.role !== 'super_admin' && item.owner_id !== currentUser.value?.id) {
    return;
  }
  const epoch = identityEpoch;
  archiveBusy.value = true;
  try {
    const result = await lectureApi.restore(item.id);
    if (epoch !== identityEpoch) {
      notify('恢复请求已完成，账号状态已变化，请重新核对讲义列表', 'warn', 0);
      return;
    }
    if (
      result?.id === item.id &&
      ['withdrawn', 'unpublished'].includes(result.publication_status)
    ) {
      context.publicationStatus = result.publication_status;
      lectures.value = lectures.value.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              ...result,
              isPublic: false
            }
          : entry
      );
      notify('讲义已恢复，当前未公开', 'success');
    } else {
      notify('恢复请求已完成，正在重新读取讲义状态', 'warn', 0);
    }
    await loadLectures();
  } catch (err) {
    notify(
      epoch === identityEpoch
        ? err.message || '恢复失败，请稍后重试'
        : '恢复结果未能确认，请重新核对讲义列表',
      'error'
    );
  } finally {
    archiveBusy.value = false;
  }
}

function openArchive(node) {
  const item = lectures.value.find((entry) => entry.id === node.item?.id);
  if (
    !item ||
    item.publication_status === 'archived' ||
    !canBrowseOnline.value ||
    archiveBusy.value
  ) {
    return;
  }
  if (currentUser.value?.role !== 'super_admin' && item.owner_id !== currentUser.value?.id) {
    return;
  }
  if (lecture.value?.key === node.id && dirty.value) {
    notify('请先保存或放弃该讲义的未保存修改，再归档', 'warn');
    return;
  }
  archiveTarget.value = {
    id: item.id,
    title: node.label,
    ownerId: item.owner_id,
    userId: currentUser.value.id
  };
}

async function confirmArchive() {
  const target = archiveTarget.value;
  if (
    !target ||
    archiveBusy.value ||
    !canBrowseOnline.value ||
    currentUser.value?.id !== target.userId
  ) {
    return;
  }
  if (currentUser.value?.role !== 'super_admin' && currentUser.value?.id !== target.ownerId) {
    return;
  }
  if (lecture.value?.key === `online:${target.id}` && dirty.value) {
    notify('请先保存或放弃该讲义的未保存修改，再归档', 'warn');
    return;
  }
  const epoch = identityEpoch;
  archiveBusy.value = true;
  try {
    const result = await lectureApi.setPublication(target.id, {
      publication_status: 'archived'
    });
    if (epoch !== identityEpoch) {
      archiveTarget.value = null;
      notify('归档请求已完成，账号状态已变化，请重新核对讲义列表', 'warn', 0);
      return;
    }
    listSequence++;
    archiveTarget.value = null;
    if (result?.id !== target.id || result?.publication_status !== 'archived') {
      notify('归档请求已成功，但返回数据不完整，正在重新读取讲义列表', 'warn', 0);
      await loadLectures();
      return;
    }
    if (lecture.value?.id === target.id && !lecture.value.isLocal) {
      lecture.value.publicationStatus = 'archived';
    }
    lectures.value = lectures.value.map((item) =>
      item.id === target.id
        ? {
            ...item,
            ...result,
            isPublic: false
          }
        : item
    );
    treeRef.value?.expand('group', 'archived');
    if (lecture.value?.key === `online:${target.id}`) {
      treeRef.value?.expand('lecture', lecture.value.key);
      if (lecture.value.hasPrivateAccess && revision.value?.id) {
        treeRef.value?.expand('version', `${lecture.value.key}:version:${revision.value.id}`);
      }
    }
    notify('讲义已归档', 'success');
    await loadLectures();
  } catch (err) {
    if (epoch === identityEpoch) {
      notify(err.message || '归档失败，请稍后重试', 'error');
    } else {
      notify('归档结果未能确认，账号状态已变化，请重新核对讲义列表', 'warn', 0);
    }
  } finally {
    if (epoch !== identityEpoch) {
      archiveTarget.value = null;
    }
    archiveBusy.value = false;
  }
}

async function addTreeNode(node) {
  if (node.type === 'group') {
    openCreate(node.id);
    return;
  }
  if (node.type === 'lecture' && lecture.value?.key !== node.id) {
    if (!(await selectLecture(node.item, node.source))) {
      return;
    }
  }
  if (node.type === 'lecture' && node.source === 'online' && revision.value?.status !== 'draft') {
    const draft = (lectureVersions.value.get(node.id) || []).find(
      (version) => version.status === 'draft'
    );
    if (!draft) {
      notify('该课程暂无可编辑的草稿', 'warn');
      return;
    }
    if (
      !(await selectRevision({
        id: `${node.id}:version:${draft.id}`,
        courseKey: node.id,
        revisionId: draft.id,
        item: node.item
      }))
    ) {
      return;
    }
  }
  if (
    node.type === 'version' &&
    node.version?.status === 'draft' &&
    (lecture.value?.key !== node.courseKey || revision.value?.id !== node.revisionId)
  ) {
    if (!(await selectRevision(node))) {
      return;
    }
  }
  if (!canEdit.value || saving.value || lecture.value?.key !== (node.courseKey || node.id)) {
    return;
  }
  if (node.versionId != null && node.versionId !== revision.value?.id) {
    return;
  }
  summarySequence++;
  summaryId.value = null;
  if (node.type === 'lecture' || node.type === 'version') {
    treeRef.value?.expand(
      'group',
      node.group === 'all' ? 'all' : lecture.value.isLocal ? 'local' : 'online'
    );
    treeRef.value?.expand('lecture', lecture.value.key);
    addChapter();
  } else if (node.type === 'chapter') {
    const chapter = chapters.value.find((item) => item.occurrence_id === node.occurrenceId);
    if (chapter) {
      treeRef.value?.expand('chapter', node.id);
      addSection(chapter);
    }
  }
}

function moveTreeNode({ node, delta }) {
  if (!canEdit.value || saving.value || lecture.value?.key !== node.courseKey) {
    return;
  }
  if (node.versionId != null && node.versionId !== revision.value?.id) {
    return;
  }
  if (node.type === 'chapter') {
    move(
      chapters.value,
      chapters.value.findIndex((item) => item.occurrence_id === node.occurrenceId),
      delta
    );
  } else if (node.type === 'section') {
    const chapter = chapters.value.find((item) =>
      item.sections.some((section) => section.occurrence_id === node.occurrenceId)
    );
    if (chapter) {
      move(
        chapter.sections,
        chapter.sections.findIndex((item) => item.occurrence_id === node.occurrenceId),
        delta
      );
    }
  }
}

async function askRemoveTreeNode(node) {
  if (treeBusy.value || saving.value || loading.value || createOpen.value || removeTarget.value) {
    return;
  }
  if (node.versionId != null && node.versionId !== revision.value?.id) {
    return;
  }
  if (node.type === 'lecture' && node.source === 'local') {
    if (lecture.value?.key === node.id && !(await confirmLeave())) {
      return;
    }
    removeTarget.value = node;
  } else if (canEdit.value && lecture.value?.key === node.courseKey) {
    removeTarget.value = node;
  }
}

async function confirmRemoveTreeNode() {
  const node = removeTarget.value;
  if (!node || treeBusy.value) {
    return;
  }
  if (node.type === 'lecture' && node.source === 'local') {
    treeBusy.value = true;
    try {
      await deleteLocalLecture(node.item.id);
      localLectures.value = localLectures.value.filter((item) => item.id !== node.item.id);
      if (lecture.value?.key === node.id) {
        lecture.value = null;
        revision.value = null;
        chapters.value = [];
        baseline.value = '';
      }
      removeTarget.value = null;
    } catch (err) {
      notify(err.message || '删除本地课程失败', 'error');
    } finally {
      treeBusy.value = false;
    }
    return;
  }
  if (!canEdit.value || saving.value || lecture.value?.key !== node.courseKey) {
    removeTarget.value = null;
    return;
  }
  if (node.versionId != null && node.versionId !== revision.value?.id) {
    removeTarget.value = null;
    return;
  }
  const chapter = chapters.value.find(
    (item) =>
      item.occurrence_id === node.occurrenceId ||
      item.sections.some((section) => section.occurrence_id === node.occurrenceId)
  );
  if (chapter && node.type === 'chapter') {
    removeChapter(chapter);
  } else if (chapter && node.type === 'section') {
    const section = chapter.sections.find((item) => item.occurrence_id === node.occurrenceId);
    if (section) {
      removeSection(chapter, section);
    }
  }
  removeTarget.value = null;
}

async function revalidatePermission(epoch) {
  const context = lecture.value;
  if (!context?.hasPrivateAccess || !ownsContext.value || !canBrowseOnline.value) {
    return;
  }
  try {
    const [items, collaborators] = await Promise.all([
      lectureApi.mine(),
      lectureApi.collaborators(context.id)
    ]);
    if (epoch !== identityEpoch || lecture.value !== context || !ownsContext.value) {
      return;
    }
    const item = items.find((entry) => entry.id === context.id);
    if (!item) {
      throw new Error('讲义访问权限已变化');
    }
    context.publicationStatus = item.publication_status;
    context.canEdit =
      currentUser.value?.role === 'super_admin' ||
      item.owner_id === currentUser.value?.id ||
      collaborators.some(
        (entry) => entry.user_id === currentUser.value?.id && entry.permission === 'edit'
      );
    context.permissionValid = true;
  } catch {
    if (epoch === identityEpoch && lecture.value === context) {
      notify('无法确认讲义编辑权限，请重新读取讲义', 'error');
    }
  }
}

watch(
  [authStatus, () => currentUser.value?.id, () => currentUser.value?.role],
  () => {
    identityEpoch++;
    loadSequence++;
    listSequence++;
    draftRefreshSequence++;
    loading.value = false;
    loadingKey.value = '';
    lectures.value = [];
    managedLectures.value = [];
    managedLoading.value = false;
    managedError.value = '';
    summarySequence++;
    summaryId.value = null;
    summaryItem.value = null;
    closeSubmit();
    closeLectureImport();
    removeTarget.value = null;
    deleteLectureTarget.value = null;
    if (!archiveBusy.value) {
      archiveTarget.value = null;
    }
    if (createSource.value === 'online') {
      createOpen.value = false;
    }
    downloadOpen.value = false;
    if (lecture.value && !lecture.value.isLocal) {
      lecture.value.permissionValid = false;
    }
    treeEpoch++;
    treeLoadingKeys.value = new Set();
    lectureTrees.value = new Map();
    lectureVersions.value = new Map();
    versionNameErrors.value = new Set();
    versionRequests.clear();
    loadLectures();
    revalidatePermission(identityEpoch);
  },
  {
    immediate: true,
    flush: 'sync'
  }
);
onMounted(() => {
  initAuth();
  document.addEventListener('visibilitychange', refreshDraftOnVisible);
});
onUnmounted(() => {
  summarySequence++;
  importSequence++;
  loadSequence++;
  listSequence++;
  treeEpoch++;
  closeSubmit();
  draftRefreshSequence++;
  document.removeEventListener('visibilitychange', refreshDraftOnVisible);
});
</script>

<template>
  <div class="workbench-workspace">
    <LectureWorkbenchTree
      :inert="loading || saving || createOpen || downloadOpen || importOpen || archiveBusy"
      ref="treeRef"
      :nodes="treeNodes"
      :show-online="canBrowseOnline"
      :selected-key="selectedKey"
      :list-loading="treeLoading"
      :list-errors="treeErrors"
      @select="selectTreeNode"
      @expand="expandTreeNode"
      @refresh="refreshTree"
      @add="addTreeNode"
      @import="openLectureImport"
      @archive="openArchive"
      @move="moveTreeNode"
      @remove="askRemoveTreeNode"
    />
    <main
      class="workbench-main"
      :inert="archiveBusy"
    >
      <LectureManageSummary
        v-if="summaryId != null && canManageAll"
        :item="summaryItem"
        :loading="summaryLoading"
        :error="summaryError"
        @retry="
          openManageSummary(
            {
              id: summaryId
            },
            true
          )
        "
        @open="openManagedEditor"
      />
      <div
        v-else-if="revision && lecture && !ownsContext"
        class="workbench-empty"
      >
        <h2>当前账号无法访问此编辑内容</h2>
        <p>请使用原账号重新登录，或离开后选择其他讲义。</p>
      </div>
      <CoursePanel
        v-else-if="revision && lecture && selected.type === 'lecture'"
        v-model:revision="revision"
        v-model:lecture="lecture"
        :categories="categories"
        :dirty="dirty"
        :saving="saving || loading || createOpen"
        :editable="canEdit"
        :read-only-message="readOnlyMessage"
        @save="save"
        @reset="discard"
        @cover-change="updateOnlineCover"
      >
        <template #actions>
          <MButton
            v-if="!isArchived"
            size="sm"
            :mono="true"
            :disabled="saving || loading"
            @click="exportLecture"
            >导出 JSON</MButton
          >
          <MButton
            v-if="
              isArchived &&
              (currentUser?.role === 'super_admin' || lecture.lectureOwnerId === currentUser?.id)
            "
            size="sm"
            :mono="true"
            :disabled="archiveBusy || saving"
            @click="restoreLecture"
            >恢复归档</MButton
          >
          <MButton
            v-if="isArchived && currentUser?.role === 'super_admin'"
            variant="danger"
            size="sm"
            :mono="true"
            :disabled="saving || loading"
            @click="openDeleteLecture"
            >永久删除</MButton
          >
          <MButton
            v-if="onlineConflict"
            size="sm"
            :mono="true"
            :disabled="saving"
            title="重新读取会放弃未保存的修改"
            @click="reloadConflictedLecture"
            >重新读取</MButton
          >
          <MButton
            v-if="!lecture.isLocal && !isArchived"
            size="sm"
            :mono="true"
            :disabled="saving"
            @click="openDownload"
            >下载到本地</MButton
          >
          <MButton
            v-if="canEditOnline && revision.status === 'draft'"
            size="sm"
            :mono="true"
            :disabled="saving || dirty || !!pendingSnapshotId || onlineConflict"
            :title="
              dirty ? '请先保存所有修改' : pendingSnapshotId ? '已有待审核快照' : '提交已保存的草稿'
            "
            @click="openSubmit"
            >{{ pendingSnapshotId ? '审核中' : '提交审核' }}</MButton
          >
        </template>
      </CoursePanel>
      <ChapterPanel
        v-else-if="revision && lecture && selected.type === 'chapter' && selectedChapter"
        v-model:chapter="selectedChapter"
        :dirty="dirty"
        :saving="saving || loading || createOpen"
        :editable="canEdit"
        :read-only-message="readOnlyMessage"
        :submitted-at="revision.submitted_at || ''"
        :review-status="revision.status || ''"
        :reviewed-at="revision.reviewed_at || ''"
        @save="save"
        @reset="discard"
        @imported="showImportedSections"
      >
        <template #actions>
          <MButton
            v-if="onlineConflict"
            size="sm"
            :mono="true"
            :disabled="saving"
            title="重新读取会放弃未保存的修改"
            @click="reloadConflictedLecture"
            >重新读取</MButton
          >
          <MButton
            v-if="!lecture.isLocal && !isArchived"
            size="sm"
            :mono="true"
            :disabled="saving"
            @click="openDownload"
            >下载到本地</MButton
          >
          <MButton
            v-if="canEditOnline && revision.status === 'draft'"
            size="sm"
            :mono="true"
            :disabled="saving || dirty || !!pendingSnapshotId || onlineConflict"
            :title="
              dirty ? '请先保存所有修改' : pendingSnapshotId ? '已有待审核快照' : '提交已保存的草稿'
            "
            @click="openSubmit"
            >{{ pendingSnapshotId ? '审核中' : '提交审核' }}</MButton
          >
        </template>
      </ChapterPanel>
      <SectionPanel
        v-else-if="revision && lecture && selected.type === 'section' && selectedSection"
        v-model:section="selectedSection"
        :dirty="dirty"
        :saving="saving || loading || createOpen"
        :editable="canEdit"
        :read-only-message="readOnlyMessage"
        :submitted-at="revision.submitted_at || ''"
        :review-status="revision.status || ''"
        :reviewed-at="revision.reviewed_at || ''"
        @save="save"
        @reset="discard"
      >
        <template #actions>
          <MButton
            v-if="onlineConflict"
            size="sm"
            :mono="true"
            :disabled="saving"
            title="重新读取会放弃未保存的修改"
            @click="reloadConflictedLecture"
            >重新读取</MButton
          >
          <MButton
            v-if="!lecture.isLocal && !isArchived"
            size="sm"
            :mono="true"
            :disabled="saving"
            @click="openDownload"
            >下载到本地</MButton
          >
          <MButton
            v-if="canEditOnline && revision.status === 'draft'"
            size="sm"
            :mono="true"
            :disabled="saving || dirty || !!pendingSnapshotId || onlineConflict"
            :title="
              dirty ? '请先保存所有修改' : pendingSnapshotId ? '已有待审核快照' : '提交已保存的草稿'
            "
            @click="openSubmit"
            >{{ pendingSnapshotId ? '审核中' : '提交审核' }}</MButton
          >
        </template>
      </SectionPanel>
      <div
        v-else
        class="workbench-empty"
      >
        <span class="empty-label font-mono">LECTURE WORKBENCH</span>
        <h2>选择一份讲义</h2>
        <p>从左侧选择本地讲义或我创作的讲义，选择课程、章节或小节。</p>
      </div>
    </main>
    <MModal
      :open="importOpen"
      :title="importSource === 'local' ? '导入本地讲义' : '导入在线讲义'"
      width="480px"
      hide-footer
      :show-close="!saving"
      @close="!saving && closeLectureImport()"
    >
      <div class="lecture-import">
        <MFilePicker
          :title="importName || '讲义 JSON 文件'"
          :detail="importReading ? '正在读取文件…' : '选择一份完整讲义文件'"
          :action="importName ? '重新选择' : '选择文件'"
          accept=".json,application/json"
          :disabled="saving || importUncertain"
          @choose="$event.target.value = ''"
          @change="readLectureImport"
        />
        <MInput
          v-if="importFile"
          v-model="importSlug"
          label="课程标识"
          hint="导入将新建讲义，标识不能与已有讲义重复"
          required
          :disabled="saving || importUncertain"
        />
        <p
          v-if="importFile"
          class="lecture-import-note"
        >
          {{ importFile.lecture.title }} ·
          {{ importFile.chapters.length }} 个章节。讲义分类需要导入后重新选择。
        </p>
        <p
          v-if="importError"
          class="lecture-import-error"
          role="alert"
        >
          {{ importError }}
        </p>
        <div class="lecture-import-actions">
          <MButton
            variant="secondary"
            :disabled="saving"
            @click="closeLectureImport"
            >{{ importUncertain ? '关闭并核对' : '取消' }}</MButton
          ><MButton
            variant="primary"
            :disabled="saving || importReading || importUncertain || !importFile"
            @click="submitLectureImport"
            >{{ saving ? '导入中…' : '确认导入' }}</MButton
          >
        </div>
      </div>
    </MModal>
    <DeleteLectureConfirm
      :open="Boolean(deleteLectureTarget)"
      :title="deleteLectureTarget?.title || ''"
      :busy="archiveBusy"
      @close="deleteLectureTarget = null"
      @confirm="confirmDeleteLecture"
    />
    <ArchiveLectureConfirm
      :open="Boolean(archiveTarget)"
      :title="archiveTarget?.title || ''"
      :busy="archiveBusy"
      impact="归档后讲义只供查看，各版本及内容会保留，推荐状态会清除。归档期间不能提交、审核或上架；恢复后也不会自动公开。"
      @close="archiveTarget = null"
      @confirm="confirmArchive"
    />
    <MModal
      :open="submitOpen"
      title="确认提交审核"
      hide-footer
      show-close
      @close="closeSubmit"
    >
      <p>讲义：{{ submitTarget?.title }}</p>
      <p>
        预计提交版本：{{
          submitTarget?.expectedVersion == null
            ? '提交后由系统分配'
            : `V${submitTarget.expectedVersion}`
        }}
      </p>
      <p>已保存内容：{{ submitTarget?.chapterCount }} 章，{{ submitTarget?.sectionCount }} 小节</p>
      <p>提交会基于已保存内容创建独立且不可修改的审核快照，原草稿仍可继续编辑。</p>
      <div class="submit-actions">
        <MButton
          variant="ghost"
          size="sm"
          @click="closeSubmit"
          >{{ saving ? '关闭' : '取消' }}</MButton
        >
        <MButton
          variant="primary"
          size="sm"
          :disabled="
            saving || submitCountdown > 0 || dirty || !!pendingSnapshotId || onlineConflict
          "
          @click="submitDraft"
          >{{
            saving ? '提交中' : submitCountdown > 0 ? `确认提交（${submitCountdown}）` : '确认提交'
          }}</MButton
        >
      </div>
    </MModal>
    <MModal
      :open="downloadOpen"
      title="下载到本地"
      :busy="saving"
      @close="!saving && (downloadOpen = false)"
      @confirm="downloadLecture"
      ><MInput
        v-model="downloadSlug"
        label="本地讲义标识"
        hint="本地讲义标识需在本浏览器中唯一"
        required
    /></MModal>
    <MModal
      :open="leaveOpen"
      title="放弃未保存的修改"
      desc="离开后当前修改将丢失"
      confirm-text="放弃修改"
      confirm-variant="danger"
      @close="finishLeave(false)"
      @confirm="finishLeave(true)"
    />
    <MModal
      :open="createOpen"
      :title="createSource === 'local' ? '新建本地课程' : '新建在线课程'"
      :busy="saving"
      @close="!saving && (createOpen = false)"
      @confirm="createLecture"
      ><MInput
        v-model="createForm.title"
        label="课程名称"
        required /><MInput
        v-model="createForm.slug"
        label="课程标识"
        :hint="createSource === 'local' ? '需在本浏览器的本地讲义中唯一' : '创建后不能修改'"
        required
    /></MModal>
    <MModal
      :open="Boolean(removeTarget)"
      title="确认移除"
      :desc="
        removeTarget?.type === 'lecture'
          ? '本地课程及其章节和小节将被删除，此操作无法撤销。'
          : '移除将在保存草稿后生效，保存前可放弃修改。'
      "
      confirm-text="移除"
      confirm-variant="danger"
      :busy="treeBusy"
      @close="!treeBusy && (removeTarget = null)"
      @confirm="confirmRemoveTreeNode"
    />
  </div>
</template>

<style scoped>
.workbench-workspace {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.workbench-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.workbench-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
}
.empty-label {
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  letter-spacing: 0.08em;
}
.workbench-empty h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-medium);
}
.workbench-empty p {
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size);
  line-height: 1.6;
}
.submit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.lecture-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.lecture-import-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.lecture-import-error {
  margin: 0;
  color: var(--tag-red);
  font-size: var(--font-size-smaller);
  overflow-wrap: anywhere;
}
.lecture-import-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
