import * as monaco from 'monaco-editor';

import editorWorker from 'monaco-editor/editor/editor.worker?worker';

if (typeof window !== 'undefined' && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker() {
      return new editorWorker();
    }
  };
}

export { monaco };
