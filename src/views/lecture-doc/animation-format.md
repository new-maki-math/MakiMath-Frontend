# 平台分步动画规范 v1

平台提供播放器、步骤控制、画布容器和 KaTeX。动画作者不需要提供播放器、KaTeX、入口 HTML，也不需要依赖某种板书外观。

## 导入

1. 在图书工作台的图书面板导入基础包文件夹，放置跨小节共用的脚本、样式、图片和字体。没有共用文件时可以不导入。
2. 在小节面板导入动画资源文件夹。资源根目录必须包含 `animation.json`，以及本小节使用的脚本和资源。
3. 两个面板可展开已导入的文件列表。图书导出时会同时包含基础包和小节资源。

基础包和小节包按相对路径合并；同名路径由小节包覆盖。`animation.json` 中的路径以合并后的资源根目录为准。单个导入文件夹上限为 22 MB、3000 个文件。 导入小节资源时会检查清单、JavaScript、CSS 和 JSON 的语法，以及清单、CSS `url(...)` 和 `MakiAnimation.asset(...)` / `api.asset(...)` 的资源引用；缺失文件会阻止导入。资源 API 必须使用固定字符串路径，动态拼接路径无法检查且不允许使用。

## 清单

```json
{
  "type": "maki-animation",
  "version": 1,
  "width": 960,
  "height": 540,
  "scripts": ["scene.js"],
  "styles": ["scene.css"]
}
```

`scripts` 按顺序加载，可引用基础包和小节包的 JavaScript；`styles` 可省略。宽高以逻辑像素表示，省略时默认为 1920 × 1080。样式中的相对 `url(...)` 按样式文件自身的路径解析。

## 注册动画

```js
const stage = MakiAnimation.stage;
stage.textContent = '动画内容';

MakiAnimation.register({
  pages: [
    { title: '第一页面', steps: [{ start: 0, end: 1 }, { start: 1, end: 2 }] }
  ],
  render(time, stage, api) {
    stage.style.opacity = String(Math.min(1, time));
  }
});
```

`pages` 描述页面和步骤的时间区间；`render` 根据时间绘制完整画面。播放器在上一步和下一步之间调用 `render`，后退时会直接回到目标步骤的结束时刻。因此绘制应只由时间和资源决定，不依赖之前的播放顺序。页面之间的第一步会从该步的 `start` 播放到 `end`。

`MakiAnimation.asset('images/example.png')` 返回包内资源地址，可用于图片、音频或字体等；路径从合并后的资源根目录起算。公式可直接使用平台提供的 `katex.renderToString(...)`。完整示例位于前端的 `examples/animation/basic`，在小节面板直接选择该文件夹即可。

动画在独立沙箱中运行，不可访问父页面；动态模块、脚本网络请求及外部图片不受支持。用户的绘制脚本应使用 `MakiAnimation.asset` 访问包内资源，不应依赖外部服务器或自行操作父页面。

字体允许通过 HTTPS CDN 加载。可以在 `animation.json` 的 `styles` 中直接填写 HTTPS 字体样式表地址，也可以在包内 CSS 中使用 `@import` 引入 HTTPS 字体样式表，或在 `@font-face` 的 `src` 中填写 HTTPS 字体文件地址。字体服务需要允许跨来源访问；无法访问时应配置备用字体。 支持跨来源读取的 CDN 字体样式和实际加载过的字体文件会进入平台统一缓存，缓存 24 小时后重新获取；浏览器按需加载未缓存的字体分片，不会预先下载整套字体。CDN 不允许跨来源读取或资源不可缓存时，播放器会回退到浏览器直接加载。

旧版 HTML 动画包仍可读取，但新配置不再要求入口 HTML。原有多文件动画需要增加符合此规范的清单与适配脚本，才能由平台播放器控制；不能直接假定旧动画已完成适配。

例如，针对现有的木框课程，可以在图书基础包放置它特有的板书绘制脚本、背景和字体，在小节包放置原场景、字幕和步骤数据，并增加适配脚本将 `__SCENES`、`STEPS` 与 `renderAt` 注册到平台。板书外观属于图书资源，平台播放器不依赖它。
