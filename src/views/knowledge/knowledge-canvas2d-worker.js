// 知识地图画布后台绘制
import { clearCanvasTextCache, drawKnowledgeCanvas } from './knowledge-canvas2d.js';

let canvas;
let layout = { groups: [], tiles: [] };
let mastered = new Set();
let palette;
let sceneVersion = -1;

self.onmessage = ({ data }) => {
  if (data.type === 'init') canvas = data.canvas;
  else if (data.type === 'scene') {
    if (sceneVersion !== data.version) {
      layout = data.layout;
      sceneVersion = data.version;
      clearCanvasTextCache();
    } else {
      const states = new Map(data.layout.tiles.map((tile) => [tile.node.id, tile.node.state]));
      for (const tile of layout.tiles) tile.node.state = states.get(tile.node.id) || '';
    }
    mastered = new Set(data.mastered);
    palette = data.palette;
  } else if (data.type === 'frame' && canvas && palette) {
    drawKnowledgeCanvas(canvas, layout, mastered, data.transform, palette, data.width, data.height, data.dpr, data.time);
    self.postMessage({ type: 'frame' });
  }
};
