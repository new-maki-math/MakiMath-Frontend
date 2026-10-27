import { createMsdfgen } from '@playcanvas/msdfgen-wasm';
import msdfgenWasmUrl from '@playcanvas/msdfgen-wasm/msdfgen.wasm?url';

let font = null;

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'initialize') {
      const generator = await createMsdfgen({ moduleOverrides: { locateFile: (path) => path.endsWith('.wasm') ? msdfgenWasmUrl : path } });
      font = generator.loadFont(new Uint8Array(data.bytes));
      if (!font) throw new Error('无法加载字体文件');
      self.postMessage({ id });
    } else if (type === 'generate') {
      const result = font.generateGlyph(data.codepoint, data.size, data.range);
      if (result) self.postMessage({ id, result }, [result.rgba.buffer]);
      else self.postMessage({ id, result: null });
    }
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
