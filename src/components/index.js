import MButton from './MButton.vue';
import MTag from './MTag.vue';
import MInput from './MInput.vue';
import MSelect from './MSelect.vue';
import MTextarea from './MTextarea.vue';
import MModal from './MModal.vue';
import MCodeEditor from './MCodeEditor.vue';
import ProgressBar from './ProgressBar.vue';
import SearchBar from './SearchBar.vue';
import ViewportHeader from './ViewportHeader.vue';
import TypstDoc from './TypstDoc.vue';
import MCollapse from './MCollapse.vue';
import RoadmapGraph from './RoadmapGraph.vue';
import MBackdrop from './MBackdrop.vue';
import MSelectionToolbar from './MSelectionToolbar.vue';
import MUserModal from './MUserModal.vue';
import MTable from './MTable.vue';
import MPagination from './MPagination.vue';
import MNotice, { notify, useNotice } from './MNotice.vue';

export {
  MButton,
  MTag,
  MInput,
  MSelect,
  MTextarea,
  MModal,
  MCodeEditor,
  ProgressBar,
  SearchBar,
  ViewportHeader,
  TypstDoc,
  MCollapse,
  RoadmapGraph,
  MBackdrop,
  MSelectionToolbar,
  MUserModal,
  MTable,
  MPagination,
  MNotice,
  notify,
  useNotice
};

export default {
  install(app) {
    app.component('MButton', MButton);
    app.component('MTag', MTag);
    app.component('MInput', MInput);
    app.component('MSelect', MSelect);
    app.component('MTextarea', MTextarea);
    app.component('MModal', MModal);
    app.component('MCodeEditor', MCodeEditor);
    app.component('ProgressBar', ProgressBar);
    app.component('SearchBar', SearchBar);
    app.component('ViewportHeader', ViewportHeader);
    app.component('TypstDoc', TypstDoc);
    app.component('MCollapse', MCollapse);
    app.component('RoadmapGraph', RoadmapGraph);
    app.component('MRoadmap', RoadmapGraph);
    app.component('MBackdrop', MBackdrop);
    app.component('MOverlay', MBackdrop);
    app.component('MSelectionToolbar', MSelectionToolbar);
    app.component('MUserModal', MUserModal);
    app.component('MTable', MTable);
    app.component('MPagination', MPagination);
    app.component('MNotice', MNotice);
  }
};

