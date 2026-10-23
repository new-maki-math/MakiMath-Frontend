# Typst Web Runtime Assets (`/public/typst`)

This directory contains pre-compiled standalone assets for client-side Typst compilation and CodeMirror 6 integration, powered by [typst-web](https://github.com/Enter-tainer/typst-web).

## Files & Components

| File | Description | Source / License |
| :--- | :--- | :--- |
| `typst-editor.js` | CodeMirror 6 editor wrapper with Typst syntax highlighting, diagnostics, and project synchronization | Upstream `typst-web` bundle (Apache-2.0 / MIT) |
| `typsten-worker.js` | Web Worker hosting the WebAssembly compilation engine off the main thread | Comlink + Typst WASM glue (Apache-2.0) |
| `typsten_bg.wasm` | Pre-compiled Typst compiler engine running in WebAssembly | Upstream `typsten` / Typst compiler (Apache-2.0) |
| `fonts/NotoSansSC.otf` | Noto Sans SC (思源黑体) CJK font for Chinese typesetting | SIL Open Font License (OFL 1.1) |
| `fonts/NotoSerifSC.ttf` | Noto Serif SC (思源宋体) CJK font for Chinese typesetting | SIL Open Font License (OFL 1.1) |

## Font Extensibility
The editor template defines a standard fallback chain (`Noto Serif SC`, `Noto Sans SC`, `SimSun`, `Songti SC`, `Microsoft YaHei`, `SimHei`, `KaiTi`, `FangSong`, `DengXian`, etc.).
If deployers or users wish to add additional local font files, simply place `.ttf`/`.otf`/`.ttc` files into `public/typst/fonts/`; the engine dynamically registers and loads all detected font families.
