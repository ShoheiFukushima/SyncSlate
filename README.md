# AutoEditTATE (skeleton)

Electron + React + TypeScript + Rust (napi-rs placeholder) skeleton to reach Milestone 1 (app launches, open video dialog, native greet stub).

Repository layout
- app/
  - main/ (Electron main process TypeScript)
  - preload/ (contextBridge-safe API)
  - renderer/ (React + Vite)
- native/
  - rust-core/ (reserved for napi-rs crate; to be added)
- electron-builder.yml (packaging targets)
- package.json (root orchestrator)

Getting started
1) Install Node deps (root + renderer)
   - cd AutoEditTATE
   - npm install
   - cd app/renderer && npm install
   - cd ../..

2) Dev run (Vite + Electron main via ts-node)
   - npm run dev
   Vite runs on http://localhost:5173 and Electron loads it.

3) Build
   - npm run build
   Builds renderer, compiles main/preload TS, and packages with electron-builder.

Notes
- Type errors "Cannot find module 'electron'/'vite'/react types" will resolve once you run npm install in root and in app/renderer.
- Preload exposes window.api with:
  - openVideoDialog(): Promise<string | null>
  - native.greet(): Promise<string> (loads from native/rust-core when available)

Next steps (Milestones)
- Native: add napi-rs crate under native/rust-core with greet() and generate_thumbnails() stub, then wire dynamic import path in preload to built .node/.js entry.
- CI: add Node + Rust lint/test workflows (kept separate from existing policy-check).
- Renderer: add thumbnail grid and scene marker visualization.

Security
- contextIsolation enabled, no nodeIntegration in renderer; all privileged calls via preload.
- Basic CSP is set in app/renderer/index.html (relaxed for dev HMR).