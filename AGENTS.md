# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-28
**Commit:** c1bda00
**Branch:** tests

## OVERVIEW
Tri-Clamp parametric 3D viewer SPA — generates ferrule, gasket, spool, and end-cap geometries via 2D profile revolution in Three.js. Supports mesh export (STL/OBJ), CAD solid export (STEP/BREP via OpenCascade.js Web Worker), and bulk ZIP download.

**Stack:** TypeScript (strict) · Three.js 0.170 · OpenCascade.js 1.1 · fflate · Vite 6 · Biome 2.5 · Vitest 4 · jsdom

## STRUCTURE
```
./
├── index.html              # Entry: importmap loads Three.js from CDN, links src/main.ts
├── src/
│   ├── main.ts             # Orchestrator: scene init, render loop, event wiring (~310 loc)
│   ├── parts/              # Geometry generators: ferrule, gasket, spool, endcap
│   ├── cad/                # OpenCascade bridge + Web Worker + 2D profile commands
│   ├── core/               # Shared: constants, dimension constraints, LatheGeometry factory
│   ├── scene/              # Three.js setup (lights, camera, controls) + materials
│   ├── data/               # Global mutable state + ASME BPE preset CSV loader
│   ├── export/             # Single + bulk export: STL/OBJ mesh, CAD via worker
│   ├── ui/                 # DOM read/write for sliders, presets, visibility
│   ├── types/              # Ambient module declaration for opencascade.js
│   ├── styles.css          # Plain CSS (no Tailwind)
│   └── presets.csv         # Source of truth for ASME BPE dimensions (copied to dist/)
├── biome.json              # Single source of truth: lint + format
├── tsconfig.json            # strict: true, ES2020, bundler resolution
├── vite.config.ts           # Vite build + custom plugin copies presets.csv → dist
├── vitest.config.ts         # Tests at src/**/__tests__/*.test.ts, default env: node
└── package.json             # Scripts: dev|build|preview|lint|format|test
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add new piece type | `src/parts/` + `src/cad/profileDescriptor.ts` | New generator + new profile fn + update `PieceType` in `src/data/store.ts` |
| Add new export format (mesh) | `src/export/exporter.ts` | `exportGeometryBuffer()` + update `<select>` in `index.html` |
| Add new export format (CAD) | `src/cad/worker.ts` | OCC-specific; `exportStep`/`exportBrep` pattern |
| Change dimension constraints | `src/core/constraints.ts` | Pure function; same logic mirrored in `src/export/bulkExport.ts` `clampDimensions()` |
| Add preset values | `src/presets.csv` | CSV is source of truth; fallback embedded in `src/data/presets.ts` |
| Change UI behavior | `src/ui/dom.ts` + `src/main.ts` `setupEventListeners()` | DOM functions are stateless; orchestration in main |
| Change scene/materials | `src/scene/setup.ts` + `src/scene/materials.ts` | Materials file has both material exports + `updateMaterialsColor()` |
| Global state | `src/data/store.ts` | Mutable singleton `state` with getter/setter functions to be used instead of direct access |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `state` | AppState | `src/data/store.ts:52` | 20+ | Global mutable state (use getters/setters, not direct) |
| `validateAndClampDimensions` | fn | `src/core/constraints.ts:11` | 2 | Pure dimension validation; called by main.ts + bulkExport |
| `createLatheMesh` | fn | `src/core/createLatheMesh.ts:31` | 4 | Factory: view mode → THREE.Object3D; eliminates 4× if/else chains |
| `perfilFerula` / `perfilGasket` / `perfilEndCap` / `perfilSpool` | fn | `src/cad/profileDescriptor.ts:100+` | 4+8 | 2D profile commands (used by both Three.js parts and OCC worker) |
| `ProfileCommand` | type | `src/cad/profileDescriptor.ts:5` | 10+ | Discriminated union: `MoveToCmd \| LineToCmd \| ArcCmd` |
| `obtenerPerfil` | fn | `src/cad/profileDescriptor.ts:236` | 2 | Switch dispatcher for piece type → profile commands |
| `generarGeometriaFerula` / `…Gasket` / `…Spool` / `…EndCap` | fn | `src/parts/*.ts` | 2 | Three.js geometry generators (profile → LatheGeometry → mesh) |
| `exportGeometryBuffer` | fn | `src/export/exporter.ts:82` | 1 | Mesh → bytes (STL/OBJ) for bulk export; no DOM dependency |
| `exportarCAD` / `exportarCADBlob` | fn | `src/cad/bridge.ts:84,108` | 2 | CAD export via OCC Web Worker |
| `setupBulkDownload` | fn | `src/export/bulkExport.ts:189` | 1 | Bulk ZIP export pipeline (mesh + CAD modes) |
| `renderPiece` | fn | `src/main.ts:47` | 10+ | Core render: reads DOM → validates → generates → replaces scene object |

## CONVENTIONS

**No ESLint, no Prettier, no EditorConfig.** Biome is the single authority:
- 4-space indent, 120-col line width, single quotes, semicolons always, trailing commas on multi-line
- Imports auto-organized on save (`organizeImports: "on"`)
- `noNonNullAssertion: off` — `!` assertions tolerated (needed for OCC worker's dynamic API)
- `suspicious.noExplicitAny: off` — `any` tolerated (OCC's dynamic API cannot be fully typed)
- `useConst: error` — must use `const` where possible
- Sliders auto-expand their min/max range when presets exceed current bounds (`src/ui/dom.ts:8-24`)

**Test structure:**
- Location: `src/**/__tests__/*.test.ts` — enforced by vitest.config.ts
- Default env: `node`; DOM tests override per-file with `// @vitest-environment jsdom`
- Mock pattern: Three.js modules via `vi.mock('three')`; Worker via `vi.stubGlobal('Worker')`
- Naming: describe blocks say what's tested; tests verify exact constants per piece type

**No index.ts re-exports.** Each directory is a flat collection of independent modules with direct imports.

**Piece type enumeration:** `PieceType = 'ferrula' | 'gasket' | 'spool' | 'endcap'` (string union, not enum). Adding a type means updating `PieceType`, profile descriptor, parts generator, and constraints.

## ANTI-PATTERNS (THIS PROJECT)
- **Don't access `state` directly** from outside `store.ts` — use the getter/setter functions (`getTubeHeightFijo()`, `setTubeHeightFijo()`, etc.)
- **Don't hardcode dimensions** in geometry generators — every parameter comes from `params` object
- **Don't duplicate dimension clamping** — `src/core/constraints.ts` is the single source of truth. The copy in `bulkExport.ts:73-111` is a deliberate exception (avoids DOM dependency); if you change constraints, update both
- **Don't create new toggle/select without `aria-*` attributes** — all interactive controls must be accessible
- **The `state` object is exported for backward compatibility only** (`src/data/store.ts:67`) — new code must use getters/setters

## UNIQUE STYLES
- **Profile-based geometry:** All 4 piece types define a 2D profile as `ProfileCommand[]` (moveTo/lineTo/arc discriminated union). This profile is consumed by BOTH Three.js `LatheGeometry` AND the OCC Web Worker for STEP/BREP — no duplication.
- **Self-rotating object:** `requestAnimationFrame` loop rotates the model 0.003 rad/frame. This is intentional visual feedback, not a bug.
- **Sliders auto-relax:** When a preset value exceeds a slider's current min/max, `setSliderValue()` expands the range before clamping (`src/ui/dom.ts:14-20`).
- **Color swatches:** 7 hardcoded hex colors in `index.html`; `updateMaterialsColor()` applies to points, lines, and wireframe materials only (solid materials are metal/roughness-based).

## COMMANDS
```bash
pnpm install          # Install dependencies (needs esbuild for postinstall)
pnpm dev              # Vite dev server with HMR
pnpm build            # Production build → dist/ (presets.csv auto-copied)
pnpm preview          # Serve dist/ locally
pnpm lint             # Biome check src/
pnpm format           # Biome format --write src/
pnpm lint:fix         # Biome check --write src/
pnpm test             # Vitest run (164 tests in 15 files)
pnpm test --watch     # Vitest interactive mode
```

## NOTES
- **`index.html` works standalone** (file:// or `pnpm dlx serve .`) — Three.js loads from CDN importmap. No Vite needed for basic viewing. CSV fetch may fail under file:// protocol; fallback CSV is embedded in `src/data/presets.ts`.
- **OCC Web Worker** (`src/cad/worker.ts`) is the largest file (558 loc). It auto-constructs OCC class names using numbered overload convention (`ClassName_N`). The STEP writer has extensive fallback logic because opencascade.js API surface varies by version.
- **bulkExport.ts has its own `clampDimensions()`** — deliberately copied from `core/constraints.ts` to avoid pulling DOM/slider dependencies into the bulk pipeline. Keep them synchronized.
- **`resetOccWorker()`** terminates and recreates the worker. Called between bulk CAD export batches every 10 items (MEMFS heap corruption prevention) and on error recovery.
- **`.gitignore` includes `.omo` and `.opencode`** — these are local tooling dirs, never committed.
