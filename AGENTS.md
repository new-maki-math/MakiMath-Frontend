# 前端协作约定

本仓库的目录职责、命名、注释和验证方式以 [CONTRIBUTING.md](./CONTRIBUTING.md) 为准。

- 使用 Vue 3、JavaScript ESM 和原生 CSS，沿用当前技术栈。
- Vue 文件使用 PascalCase，组合式函数文件使用 `useXxx.js`，其他模块使用 kebab-case。
- 组件统一使用 `<script setup>`，按 script、template、style 排列。
- 显式导入使用的组件，本地 JavaScript 导入写出 `.js` 后缀。
- JavaScript 使用两空格缩进、单引号和分号，由 ESLint 和 Prettier 统一处理。
- 非空对象统一展开，字段逐行书写；控制流统一使用展开的花括号代码块；多属性标签每行一个属性，CSS 每条声明独占一行。
- 使用 `pnpm format` 先修正结构换行，再执行 Prettier，避免紧凑写法和展开写法混用。
- 注释写简单的一行中文；JavaScript 使用 `//`，CSS 使用 `/* 中文 */`，模板使用 `<!-- 中文 -->`。
- 说明业务原因、边界和限制，删除重复代码含义的注释、装饰分隔线和历史编号。
- 页面专用逻辑放在页面目录，共享组件放在 `components`，跨模块的组合式逻辑放在 `composables`。
- 避免页面之间互相引用内部组件，避免仅转发导出的文件和只有一次简单调用的包装函数。
- 表单的双向编辑通过 `defineModel` 和父组件的 `v-model` 明确声明，普通 props 保持只读。
- 保留认证隔离、异步响应过期检查、编辑版本冲突和未保存内容保护。
- 调整模块前检查全部引用，保留用户已有的未提交修改，不修改 `src/vendor` 中的第三方产物。
- 完成后运行 `pnpm check`，有 UI 行为变化时再验证相关页面。
- 部署脚本通过语法检查即可；代码整理不包含执行部署或操作远端数据。
