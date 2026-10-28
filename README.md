# MakiMath Frontend

MakiMath 现代化结构化数学讲义与拓扑学习平台的核心前端单页应用（SPA）。

基于 Vue 3.5、Vite 8 构建，深度集成 Typlet WebAssembly 毫秒级矢量排版引擎、D3.js 知识图谱与三栏协同工作台，为学习者提供无限缩放的高保真数学阅读体验，为编者提供沉浸式 Typst 讲义创作环境。

## 官方文档与指南

完整的系统架构说明、API 接口规格、讲义编写规范及私有化部署手册，请参阅官方文档站点：

- **官方文档仓库**：[https://github.com/new-maki-math/MakiMath-Docs](https://github.com/new-maki-math/MakiMath-Docs)
- **在线文档站点**：[https://docs.maki-math.com/](https://docs.maki-math.com/)

### 推荐阅读
- [面向开发者快速上手](https://docs.maki-math.com/guide/dev-getting-started.html)
- [面向编者入驻指南](https://docs.maki-math.com/guide/editor-getting-started.html)
- [前端架构设计 (Vue 3 + WASM)](https://docs.maki-math.com/architecture/frontend.html)
- [Typst 数学排版指南](https://docs.maki-math.com/authoring/typst-guide.html)

## 本地开发快速启动

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动本地开发服务器
```bash
pnpm dev
```
本地开发服务默认运行于 `http://localhost:5173`。

### 3. 构建生产环境产物
```bash
pnpm build
```
构建产物将输出至 `dist/` 目录，可直接交由 Nginx 静态托管。

## 技术特性

- **Vue 3.5 全新特性**：全面采用 `<script setup>` 与 Composition API，响应式性能卓越。
- **毫秒级 WASM 渲染**：基于 Typlet WebAssembly 运行时在浏览器本地编译 Typst 文档，矢量直出（SVG/HTML），公式无限缩放无锯齿。
- **DAG 拓扑路线图**：基于 D3.js 动态计算并可视化呈现章节与小节之间的有向无环前置依赖。
- **自研极轻组件库**：零重型第三方 UI 库依赖，秒级冷启动与极低打包体积。
- **深浅色主题自适应**：原生 CSS 变量设计系统，数学公式对比度自适应护眼。

## 开源生态矩阵

| 仓库名称 | 职责说明 |
|---|---|
| **[MakiMath-Frontend](https://github.com/new-maki-math/MakiMath-Frontend)** | 核心前端应用（本仓库） |
| **[MakiMath-Backend](https://github.com/new-maki-math/MakiMath-Backend)** | 高性能 Fastify + PostgreSQL 后端微内核 |
| **[MakiMath-Docs](https://github.com/new-maki-math/MakiMath-Docs)** | 官方技术文档站与开发者指南 |

