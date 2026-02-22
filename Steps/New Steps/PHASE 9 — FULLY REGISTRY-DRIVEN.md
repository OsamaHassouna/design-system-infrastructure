# Phase 9 — Fully Registry-Driven Documentation & Preview

## Objective

Make both the **Preview** (`preview/index.html`) and **Documentation** (`docs/index.html`) pages fully registry-driven. No hardcoded component markup exists in either HTML file. Adding a new component requires only a JSON entry — no HTML edits anywhere.

---

## What Changed

| Area | Before (Phase 8) | After (Phase 9) |
|---|---|---|
| `preview/index.html` | ~842 lines with hardcoded Button / Badge / Card HTML | ~251-line shell; all content injected at runtime |
| `docs/index.html` | ~870 lines with hardcoded Button documentation | ~350-line shell; all content injected at runtime |
| Component nav | Hardcoded `<li>` / `<a>` elements | Injected by `RegistryEngine.buildPreviewNav()` / `buildDocNav()` |
| Doc TOC | Hardcoded 6 links | Injected by `RegistryEngine.buildDocTOC()` |
| Token flow tables | Hardcoded in HTML | Rendered from `tokenFlow` block in component registry |
| Adapter matrix | Hardcoded or absent | Rendered from `adapter.registry.json` |
| Adding a component | Edit HTML + CSS + JSON | JSON only — zero HTML edits |

---

## New Files

### `preview/data/component.registry.json`

Single source of truth for every component's metadata.

**Top-level schema:**

```jsonc
{
  "components": {
    "{id}": {
      "id": "button",
      "name": "Button",
      "description": "...",
      "version": "1.0.0",
      "category": "interactive",       // interactive | indicator | container
      "bemBlock": "ds-btn",
      "htmlElement": "button",
      "tokenPrefix": "btn",
      "tokenRegistryKey": "button",    // maps to DS_TOKENS[key] in token-registry.js
      "supportedAdapters": ["primeng", "angular"],

      // Feature flags — engine uses these to decide which sections to render
      "flags": {
        "hasLoading": true,
        "hasIconOnly": true,
        "hasDot": false,
        "hasSubtle": false,
        "hasInteractive": false,
        "hasHorizontal": false
      },

      "variants": [
        { "id": "primary", "label": "Primary", "class": "ds-btn--primary", "description": "..." }
        // ...
      ],

      "sizes": [
        { "id": "sm",  "label": "Small",  "class": "ds-btn--sm",  "description": "..." }
        // ...
      ],

      "states": [
        { "id": "default", "label": "Default", "class": "",                  "description": "..." },
        { "id": "hover",   "label": "Hover",   "class": "doc-force-hover",   "description": "..." }
        // ...
      ],

      // Used for the State × Variant matrix grid
      "matrixStates": [
        { "id": "default", "label": "Default" },
        { "id": "hover",   "label": "Hover"   }
      ],

      // Extra demo dimensions beyond variants (e.g., badge filled vs subtle)
      "extraDimensions": [],

      "slots": [
        { "name": "default", "description": "Label text" },
        { "name": "prefix",  "description": "Optional leading icon" }
      ],

      // Hint passed to the engine to select the correct renderer
      "renderHint": "interactive",

      // Token flow data — powers the Token Flow section tables
      "tokenFlow": {
        "colorGroups": [
          {
            "title": "Color Tokens",
            "rows": [
              {
                "role":       "Background",
                "component":  "--btn-primary-bg",
                "semantic":   "--semantic-color-primary-base",
                "primitive":  "--primitive-color-brand-500",
                "rawValue":   "#7c6be8"
              }
            ]
          }
        ],
        "sizingGroup": {
          "title": "Sizing Tokens",
          "headers": ["Token", "SM", "MD", "LG"],
          "rows": [
            { "token": "--btn-height", "sm": "32px", "md": "40px", "lg": "48px" }
          ]
        },
        "structuralExceptions": [
          "Icon-only buttons remove the label slot; width collapses to height."
        ]
      },

      // Architecture rules — shown in the Architecture section of docs
      "architectureRules": {
        "forbidden": [
          "Do not use raw colour values in component SCSS",
          "Do not target .ds-btn with external CSS"
        ],
        "required": [
          "Always declare a variant modifier (e.g., ds-btn--primary)",
          "Always declare a size modifier (e.g., ds-btn--md)"
        ]
      }
    }
  }
}
```

**Registry is read-only at runtime.** The engine reads it; no script mutates it.

---

### `preview/data/adapter.registry.json`

Registry of all framework adapters with per-version status.

```jsonc
{
  "adapters": {
    "{id}": {
      "id": "primeng",
      "name": "PrimeNG",
      "description": "...",
      "versions": [
        {
          "tag": "v17",
          "semver": "17.x",
          "status": "stable",   // stable | beta | planned | deprecated
          "adapterFile": "scss/adapters/primeng/_primeng.adapter.scss",
          "supportedComponents": ["button", "badge"],
          "notes": "...",
          "knownLimitations": ["..."]
        }
      ]
    }
  },
  "$adapterRules": {
    "forbidden": ["Redefine DS component tokens", "Use DS class selectors directly"],
    "allowed":   ["Map component tokens to vendor custom-property variables"]
  }
}
```

---

### `preview/js/registry-engine.js`

Core rendering engine (~700 lines). Exposes `window.RegistryEngine`.

**Public API:**

| Method | Signature | Description |
|---|---|---|
| `init` | `async () => void` | Fetches both JSON files, populates `window.DS_REGISTRY` |
| `buildPreviewNav` | `(ulElement) => void` | Injects `<li><button data-nav="{id}">` per component |
| `buildPreviewSections` | `(mainElement) => void` | Builds all component preview sections |
| `buildDocPage` | `(componentId, mainElement) => void` | Builds full doc page for one component |
| `buildDocNav` | `(navElement, activeId) => void` | Builds docs sidebar component links |
| `buildDocTOC` | `(navElement, componentId) => void` | Builds TOC based on which sections the component has |

**Category renderers (internal):**

| Category | Renderer | Used by |
|---|---|---|
| `interactive` | `buildInteractiveSection` | Button, any action component |
| `indicator` | `buildIndicatorSection` | Badge, chip, tag |
| `container` | `buildContainerSection` | Card, panel |
| fallback | `buildGenericSection` | Any unrecognised category |

**Base path resolution:**

The engine scans `document.getElementsByTagName('script')` for the first tag whose `src` ends with `registry-engine.js` to auto-compute the `../data/` path. This works identically from `preview/` and `docs/`.

---

## Preview Page — Runtime Init Flow

```
preview/index.html loads
  ↓
token-registry.js  → window.DS_TOKENS
  ↓
registry-engine.js → window.RegistryEngine (not yet loaded)
  ↓
playground.js      → window.PlaygroundEngine (not yet init'd)
  ↓
<script> async block:
  1. await RegistryEngine.init()          → fetches JSON, sets window.DS_REGISTRY
  2. remove #pg-loading-scaffold
  3. RegistryEngine.buildPreviewNav(ulEl) → nav items injected
  4. RegistryEngine.buildPreviewSections(mainEl)  → all component sections injected
  5. PlaygroundEngine.init()              → token table, playground controls wired
  6. PlaygroundEngine.renderBadgeFlowDemo()
  7. _initLiveBadgeOverride()
```

---

## Docs Page — Runtime Init Flow

```
docs/index.html loads
  ↓
token-registry.js  → window.DS_TOKENS
  ↓
registry-engine.js → window.RegistryEngine
  ↓
<script type="module"> (Motion.js):
  - runPageEntrance()   → animates static shell (header, sidebar, badges) — runs once
  - document.addEventListener('ds:doc-ready', runDocAnimations)
  ↓
<script> async block:
  1. await RegistryEngine.init()
  2. remove #doc-loading-scaffold
  3. loadDocComponent(firstId):
       a. RegistryEngine.buildDocNav(navEl, id)     → component sidebar links
       b. RegistryEngine.buildDocPage(id, mainEl)   → full doc page HTML
       c. RegistryEngine.buildDocTOC(id, tocNavEl)  → TOC links
       d. dispatch CustomEvent('ds:doc-ready')      → triggers Motion.js animations
  4. wire delegated click on #doc-component-nav → loadDocComponent(id)
```

**On every component switch:** steps 3a–3d re-run. Motion.js re-animates the new content.

---

## Docs Page — Generated Sections

Each section is rendered only if the component's registry entry has the relevant data.

| Section ID | Rendered when |
|---|---|
| `section-overview` | Always |
| `section-variants` | `variants.length > 0` |
| `section-sizes` | `sizes.length > 0` |
| `section-states` | `states.length > 0` |
| `section-token-flow` | `tokenFlow` is defined |
| `section-adapters` | `supportedAdapters.length > 0` |
| `section-arch-rules` | `architectureRules` is defined |

---

## CSS — New Styles Added (Phase 9)

`docs/css/docs.css` additions:

| Class | Purpose |
|---|---|
| `.doc-badge` | Base pill style for adapter status labels |
| `.doc-badge--stable` | Purple tint — stable adapter version |
| `.doc-badge--beta` | Amber tint — beta adapter version |
| `.doc-badge--planned` | Muted — planned adapter version |
| `.doc-badge--deprecated` | Red tint — deprecated adapter version |
| `.doc-adapter-table` | Adapter support matrix table |

---

## Adding a New Component — Checklist

1. **Create SCSS files**
   ```
   scss/components/{name}/
     _{name}.scss
     _{name}.variables.scss
   ```
   Register in `scss/components/_index.scss`.

2. **Add a registry entry** to `preview/data/component.registry.json`:
   ```jsonc
   "mycomponent": {
     "id": "mycomponent",
     "name": "My Component",
     "category": "interactive",   // or indicator / container
     "bemBlock": "ds-mycomp",
     // ... full schema
   }
   ```

3. **Add adapter entries** (optional) to `preview/data/adapter.registry.json` — add `"mycomponent"` to `supportedComponents` arrays for each applicable adapter version.

4. **Add token group** (optional) to `preview/js/token-registry.js` if you want the component to appear in the token inspector playground tab.

5. **No HTML edits required anywhere.**

---

## Safety Rules

| Rule | Reason |
|---|---|
| Registry JSON is metadata only — no CSS values emitted directly | Token mutation is forbidden in Phase 9 |
| Component tokens (`--btn-*`) must trace to semantic tokens | Preserves theme-ability |
| Engine does not write to `window.DS_TOKENS` | Single-owner rule for token registry |
| `esc()` sanitises all registry strings before HTML injection | Prevents XSS from registry data |
| Adapter registry encodes `$adapterRules.forbidden` | Enforced by contract, not by runtime guard |

---

## File Map

```
preview/
  data/
    component.registry.json    ← single source of truth for components
    adapter.registry.json      ← adapter support & version matrix
  js/
    registry-engine.js         ← rendering engine (exposes window.RegistryEngine)
    playground.js              ← token inspector / playground (exposes window.PlaygroundEngine)
    token-registry.js          ← DS_TOKENS global (unchanged)
  index.html                   ← ~251-line shell (Phase 9 refactor)

docs/
  index.html                   ← ~350-line shell (Phase 9 refactor)
  css/
    docs.css                   ← doc-badge + doc-adapter-table added

scss/
  components/
    button/   badge/   card/   ← component SCSS (unchanged in Phase 9)
```

---

## Phase 9 Completion Checklist

- [x] `component.registry.json` — Button, Badge, Card with full schemas
- [x] `adapter.registry.json` — PrimeNG v17/v18/v20, Angular v17/v18, React v18, Vue v3
- [x] `registry-engine.js` — complete rendering engine
- [x] `preview/index.html` — refactored to registry-driven shell
- [x] `playground.js` — exposes `PlaygroundEngine` API, registry-driven first nav item
- [x] `docs/index.html` — refactored to registry-driven shell
- [x] Motion.js — `runPageEntrance()` + `runDocAnimations()` event-driven via `ds:doc-ready`
- [x] `docs/css/docs.css` — `doc-badge` and `doc-adapter-table` styles added
- [x] Phase 9 Step Doc — this file
