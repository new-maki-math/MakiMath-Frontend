import MButton from './MButton.vue';
import MTag from './MTag.vue';
import MInput from './MInput.vue';
import MSelect from './MSelect.vue';
import MTextarea from './MTextarea.vue';
import MModal from './MModal.vue';
import MCollapse from './MCollapse.vue';
import MBackdrop from './MBackdrop.vue';
import MTable from './MTable.vue';
import MPagination from './MPagination.vue';
import MNotice, { notify } from './MNotice.vue';
import MLoadingMask from './MLoadingMask.vue';
import MDrawer from './MDrawer.vue';

export {
  MButton,
  MTag,
  MInput,
  MSelect,
  MTextarea,
  MModal,
  MCollapse,
  MBackdrop,
  MTable,
  MPagination,
  MNotice,
  MLoadingMask,
  MDrawer,
  notify
};

export default {
  install(app) {
    app.component('MButton', MButton);
    app.component('MTag', MTag);
    app.component('MInput', MInput);
    app.component('MSelect', MSelect);
    app.component('MTextarea', MTextarea);
    app.component('MModal', MModal);
    app.component('MCollapse', MCollapse);
    app.component('MBackdrop', MBackdrop);
    app.component('MTable', MTable);
    app.component('MPagination', MPagination);
    app.component('MNotice', MNotice);
    app.component('MLoadingMask', MLoadingMask);
    app.component('MDrawer', MDrawer);
  }
};

