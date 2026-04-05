# Proposed Architectural Improvements

## Current State Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Total JS source lines | ~11,600 | Large for a single-page app |
| Largest files | main.js (1,364), app.js (1,627), inspector.js (1,029) | Too large — violate Single Responsibility |
| Circular dependencies | 1 (engine ↔ inspector) | Blocks clean modularisation |
| Duplicated logic | ~150 lines (build-runtime vs engine) | Maintenance risk |
| CSS files | 11 files, ~2,450 lines | Reasonably well-organised |

---

## 1. ✅ COMPLETED — Eliminate the Duplicate God File (app.js)

### Problem
`app.js` (1,627 lines) appears to be an older version of `main.js` (1,364 lines). Both contain overlapping event handlers, canvas interaction code, and node management logic. Only `main.js` is imported by the application.

### Recommendation
Delete `app.js` entirely. It is not referenced by any import and adds confusion.

**Strength**: Zero risk — the file is unused.  
**Weakness**: None.

---

## 2. ✅ COMPLETED — Split main.js into Feature Modules

### Problem
`main.js` (1,364 lines) handles:
- Toolbar setup and palette buttons
- Canvas mouse/scroll/drag interactions
- Right-click context menus and node duplication
- Play/Stop/Debug button management
- Inspector/Settings tab switching
- Data panel collapse/expand and section dividers
- Variable, Enum, and Message list rendering
- Theme toggle
- Load diagram logic
- Module re-exports

### Recommendation
Split into 5–6 focused modules:

| New Module | Lines | Responsibility |
|------------|-------|----------------|
| `canvas-interactions.js` | ~300 | Mouse, scroll, drag, selection rect, panning |
| `toolbar.js` | ~100 | Button setup, palette drag-to-create |
| `play-controls.js` | ~200 | Play/Debug/Stop, debug mode, status bar, step into/over |
| `data-panel-ui.js` | ~350 | Variable/Enum/Message rendering, section toggle, dividers |
| `app-init.js` | ~100 | Initialisation, tab switching, theme, re-exports |
| `load-save.js` | ~80 | loadDiagram, JSON load button |

**Strength**: Each module has a clear, single purpose. Easier to test in isolation.  
**Weakness**: More files to navigate. Import chains grow slightly.

---

## 3. ✅ COMPLETED — Split inspector.js into Focused Modules

### Problem
`inspector.js` (1,029 lines) handles:
- Node property editing (name, description, event)
- Command list rendering (summary rows, drag reorder, action bar)
- Command field editing (30+ field builders in a giant switch)
- Command search popup
- Connection inspector
- JSON export/import modals
- Run log modal
- Diagram serialisation

### Recommendation

| New Module | Lines | Responsibility |
|------------|-------|----------------|
| `inspector-core.js` | ~200 | Node properties, event selector, update loop |
| `command-list.js` | ~250 | Summary rows, drag reorder, action bar, search |
| `command-fields.js` | ~300 | `renderCommandFields` switch, all field builder helpers |
| `serialisation.js` | ~50 | `serialiseDiagram()` |
| `modals.js` | ~200 | JSON export, run log, load project modals |

**Strength**: Adding a new command type only requires editing `command-fields.js` instead of finding the right spot in a 1,000-line file. Serialisation becomes independently testable.  
**Weakness**: The modules still need to share some state (selected command index, active node). This can be managed via a shared inspector-state module or by passing parameters.

---

## 4. ✅ COMPLETED — Break the Circular Dependency (engine ↔ inspector)

### Problem
- `engine.js` imports `updateInspector` from `inspector.js` (to refresh the UI during execution)
- `inspector.js` imports `getRunLog` from `engine.js` (to display the run log)

This creates a circular dependency that makes both modules harder to test and refactor independently.

### Recommendation
Use an **event emitter** or **callback injection** pattern:

```javascript
// engine.js — no longer imports inspector
// Instead, fires events:
engine.on('commandExecuted', () => { ... });
engine.on('executionComplete', () => { ... });

// main.js wires them:
engine.on('commandExecuted', updateInspector);
```

Alternatively, `engine.js` could accept an `onUpdate` callback via its public API, set by `main.js` at initialisation (similar to the existing `S.onStepPause` pattern).

**Strength**: Clean dependency direction (main → engine, main → inspector). Engine becomes independently testable.  
**Weakness**: Slightly more boilerplate for the wiring. The existing `S.onStepPause` / `S.onExecutionEnd` callback pattern already partially does this — extending it is natural.

---

## 5. ✅ COMPLETED — Extract Shared Logic from build-runtime.js

### Problem
`build-runtime.js` embeds ~150 lines of execution logic inside a template literal (HTML string). This duplicates:
- `coerceToType()` / `coerce()`
- `evaluateOneCondition()` / `evalCond()`
- `evaluateCondition()` / `evalFullCond()`
- Variable substitution
- All 16+ command handlers (Say, Call, Menu, If, etc.)

Bug fixes in `engine.js` must be manually replicated in the embedded runtime string.

### Recommendation

**Option A (Pragmatic)**: Accept the duplication but add a comment cross-referencing the two files, and add a test that verifies the runtime produces the same output as the engine for a sample flowchart.

**Option B (Ideal)**: Extract shared pure functions (condition evaluation, variable coercion, variable substitution) into a `runtime-core.js` module. Both `engine.js` and `build-runtime.js` import from it. The build runtime still needs its own command execution loop (since it runs standalone in a browser), but the shared math/logic is centralised.

**Strength of Option B**: Single source of truth for condition logic. Easier to add new operators.  
**Weakness of Option B**: The build runtime generates a self-contained HTML file, so the shared module would need to be inlined at build time. This adds complexity to the ZIP generation.

---

## 6. ✅ COMPLETED — Introduce a Command Registration Pattern

### Problem
Adding a new command currently requires changes in **three separate files**:
1. `commands.js` — add to `COMMAND_TYPES` and `createCommand()` switch
2. `inspector.js` — add to `cmdDetail()` switch and `renderCommandFields()` switch
3. `engine.js` — add to `executeCommand()` switch and create `exec*()` function

Plus CSS colour in `inspector.css`, and optionally in `build-runtime.js`.

### Recommendation
Create a **command registry** where each command is a self-contained definition:

```javascript
// commands/say.js
export default {
  key: 'say',
  label: 'Say',
  category: 'Narrative',
  create: () => ({ character: '', text: 'Hello!', ... }),
  detail: (cmd) => `"${cmd.text.substring(0, 24)}..."`,
  renderFields: (container, cmd) => { /* inspector fields */ },
  execute: (cmd, engine) => { /* runtime execution */ },
  color: { dark: '#3b1f4a', light: '#f3e8ff' },
};
```

A central registry collects all commands and the inspector/engine iterate over it.

**Strength**: Adding a command = adding one file. No switch statements to update. Self-documenting.  
**Weakness**: Significant refactor effort. The inspector field rendering currently relies on shared helper functions (`labeledInput`, `labeledSelect`, etc.) which would need to be importable by individual command modules.

---

## 7. Improve State Management

### Problem
The central `S` object (state.js) is a mutable god object with 30+ properties. It mixes:
- **View state** (zoom, pan, active tool)
- **Data model** (nodes, connections, variables)
- **Interaction state** (dragging flags, selection)
- **Execution state** (executing node, command index)

Anyone can mutate any property at any time. There is no undo/redo, no change tracking, and no way to know when state changes.

### Recommendation

**Phase 1 (Low effort)**: Split `S` into logical sub-objects:
```javascript
export const view = { zoom, panX, panY, activeTool };
export const model = { nodes, connections, variables, messages, enums };
export const interaction = { activeNode, draggingNode, ... };
export const execution = { executingNode, executingCommandIdx, ... };
```

**Phase 2 (Medium effort)**: Add a simple event system:
```javascript
model.onChange(() => { refreshMinimap(); applyFungusStyles(); });
```

**Phase 3 (High effort)**: Implement command pattern for undo/redo:
```javascript
execute(new AddNodeCommand(type, x, y));
undo(); // reverses the last command
```

**Strength**: Phase 1 is almost free. Phase 2 eliminates scattered `updateInspector()` calls. Phase 3 enables a major UX feature (undo/redo).  
**Weakness**: Phase 3 is a large refactor and requires wrapping every mutation in a command object.

---

## 8. CSS Organisation

### Problem
`styles.css` (641 lines) is a catch-all for node styling, execution output, debug UI, run stage, and load project modals. Class names are not namespaced.

### Recommendation
- Move Say dialog / Menu overlay styles into a new `execution-ui.css`
- Move debug status bar into `debug.css`
- Move run stage + load project modal into `modals.css`
- Consider BEM naming convention (e.g. `.cmd-search__input` instead of `.cmd-search-input`)

**Strength**: Easier to find and modify styles. Smaller files.  
**Weakness**: More CSS files to load (though Vite bundles them anyway).

---

## Priority Matrix

| # | Improvement | Effort | Impact | Risk |
|---|------------|--------|--------|------|
| 1 | Delete app.js | Trivial | Low | None |
| 2 | Split main.js | Medium | High | Low |
| 3 | Split inspector.js | Medium | High | Low |
| 4 | Break circular dep | Low | Medium | Low |
| 5 | Extract shared runtime logic | Medium | Medium | Low |
| 6 | Command registry pattern | High | High | Medium |
| 7 | State management (Phase 1) | Low | Medium | Low |
| 7 | State management (Phase 2) | Medium | High | Low |
| 7 | State management (Phase 3) | High | Very High | Medium |
| 8 | CSS reorganisation | Low | Low | None |

### Recommended Order
1. Delete `app.js` (5 minutes)
2. State split — Phase 1 (1 hour)
3. Break circular dependency (1 hour)
4. Split `inspector.js` (half day)
5. Split `main.js` (half day)
6. Extract shared runtime logic (2 hours)
7. Command registry pattern (1–2 days)
8. CSS reorganisation (1 hour)

---

## What NOT to Change

Some things that are working well and should be preserved:

- **Node/connection module structure** — the `nodes/` and `connections/` folders are well-factored at ~70 lines per file
- **Fungus-mode.js** — clean, focused, 143 lines with clear responsibility
- **Config.js** — minimal and appropriate
- **Theme system** — CSS custom properties are clean and extensible
- **Test infrastructure** — Vitest + Playwright combination is solid
- **Build system** — Vite is appropriate and well-configured
