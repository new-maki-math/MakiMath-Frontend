# 前端开发约定

## 开发与检查

使用 Node.js 24 和仓库 `packageManager` 固定的 pnpm 版本，提交 `pnpm-lock.yaml`。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

`pnpm check` 依次执行 ESLint、Prettier 检查、Node.js 回归测试和生产构建。
需要自动修正时执行 `pnpm lint:fix` 和 `pnpm format`。
CI 对推送和 Pull Request 执行相同检查。

## 模块职责

| 位置                            | 职责                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `src/main.js`、`src/App.vue`    | 挂载应用、安装路由和根布局                           |
| `src/router`                    | 路由声明、懒加载和导航前的认证初始化                 |
| `src/layouts`                   | 桌面与移动布局、导航、主题和全局弹窗                 |
| `src/views/<业务>`              | 页面状态、业务流程和页面专用组件                     |
| `src/components`                | 基础控件和跨页面复用的组件                           |
| `src/components/workbench`      | 工作台通用树、节点、面板和布局样式                   |
| `src/components/typst`          | Monaco 编辑器、预览联动和知识引用插入                |
| `src/components/typst-renderer` | Typst 解析、教学宏和文档渲染                         |
| `src/components/knowledge`      | 知识搜索、知识详情浮层和展开动画                     |
| `src/components/roadmap`        | 讲义图谱建模、缩放、调度和 WebGL 绘制                |
| `src/composables`               | 跨模块复用的 Vue 状态和生命周期逻辑                  |
| `src/api`                       | 请求、接口参数、响应适配和内容缓存失效               |
| `src/utils`                     | 数据转换、浏览器存储、认证单例和无组件生命周期的工具 |
| `src/vendor`                    | 第三方生成代码，保持原样                             |
| `scripts`                       | 本地构建与部署入口                                   |
| `tests`                         | 关键行为的回归验证                                   |

页面入口统一采用 PascalCase：`StartView.vue`、`KnowledgeView.vue`、
`LectureHomeView.vue`、`LectureDocView.vue`、`LectureWorkbench.vue` 等。
路由地址和路由名称保持稳定，文件命名调整不改变已有访问地址。

## 业务链路

| 业务           | 入口与主要依赖                                                           |
| -------------- | ------------------------------------------------------------------------ |
| 首页与搜索     | `StartView`、`SearchBar` → `useLectureSearch` → `api/courses`            |
| 创意工坊与书架 | `RecomLectureView`、`MyLectureView` → 讲义接口或本地 IndexedDB           |
| 讲义详情与阅读 | `LectureHomeView`、`LectureDocView` → 目录适配、版本校验、Typst 渲染     |
| 知识库         | `KnowledgeLibrary`、`KnowledgeView` → 知识接口、画布、详情浮层、掌握记录 |
| 讲义编辑       | `LectureWorkbench` → 页面专用编辑面板、讲义接口、本地存储、版本冲突处理  |
| 知识点编辑     | `KnowledgeWorkbench` → 通用工作台组件、知识接口和分类管理                |
| 平台管理       | `PlatformView` → 管理认证、用户、邀请码、审计和审核面板                  |

共享组件依赖 API、工具或其他共享组件，页面通过组合它们完成业务。
两个页面出现同一能力时，将该能力放到共同目录；单个页面使用的完整业务流程留在页面目录。
拆分应有清楚的职责或复用依据，相关配置、辅助函数和调用点尽量就近维护。

## 代码与注释

- JavaScript 统一两空格缩进、单引号、分号、不保留尾随逗号，建议行宽 100。
- 非空对象统一展开，每个字段独占一行；控制流使用花括号代码块，块内语句换行。
- 多属性标签每行一个属性；CSS 每条声明独占一行，选择器与声明块展开书写。
- `pnpm format` 先执行 ESLint 修正结构换行，再执行 Prettier 排版；空对象、空代码块和简短数组保留紧凑形式。
- 导入按工具自动排序，使用相对路径和明确扩展名。
- Vue 使用 `<script setup>`，组件、组合式函数、普通模块分别采用 PascalCase、`useXxx.js`、kebab-case。
- 常量使用清楚的业务名称，具名业务流程优先使用函数声明，局部回调使用箭头函数。
- 组件均显式导入，普通属性通过 props 传入，双向表单通过 `defineModel` 和 `v-model` 声明。
- 样式优先放在组件的 scoped 样式中；全局主题变量集中在主题文件，工作台共用布局放在 `components/workbench/workbench.css`。
- 注释只写简单的一行中文，说明原因、约束和不直观的业务规则；JavaScript 注释格式由 ESLint 检查。
- 删除装饰分隔线、过时编号和重复函数名称的说明；CSS 和模板采用各自语法的一行中文注释。

```js
// 忽略切换账号前发出的请求
if (epoch !== identityEpoch) {
  return;
}
```

## 状态与异步边界

- 认证凭据的兼容读取和清理由 `utils/auth-storage.js` 负责，请求层不依赖 Vue 认证状态。
- 登录、退出、权限切换后的缓存失效仍由认证模块处理。
- 讲义目录只合并进行中的同类请求，后续读取重新请求服务端，防止草稿版本过期。
- 推荐讲义列表保留内存缓存，内容写入和账号变化后失效；封面缓存按用户和内容哈希隔离。
- 列表或内容切换时保留序列号、身份快照或清理回调，阻止旧响应覆盖新上下文。
- 本地讲义保留 IndexedDB 事务和编辑版本检查，在线保存保留服务端版本校验。
- 两个工作台使用 `useWorkbenchGuard` 统一处理离开确认、关闭页面保护和布局切换保护。
- 定时器、事件监听、动画帧和图形资源在对应生命周期中清理。
- 对故意降级的异常写清楚原因；操作失败需要给用户可执行的反馈。

## 变更验证

调整共享状态、凭据或编辑保护时运行相关回归测试，重点检查取消、重试和卸载场景。
调整目录或组件引用时完成全量构建，并验证首页、知识库、书架、讲义阅读和工作台入口。
涉及在线权限、提交和审核时，使用测试环境账号验证；本地构建通过不代表线上流程已经验证。

部署统一由 `scripts/deploy.js` 维护：`pnpm deploy` 执行普通部署，
`pnpm acl-deploy` 使用 `--acl`，在已有服务器环境中通过 sudo 完成原 ACL 流程。
部署配置和凭据留在忽略的本地文件或环境变量中。
