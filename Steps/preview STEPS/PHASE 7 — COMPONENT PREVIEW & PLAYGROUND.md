# PHASE 7 — COMPONENT PREVIEW & PLAYGROUND SYSTEM

**Status:** Complete  
**Date:** February 2026  
**Depends on:** Phases 1–6 (architecture, tokens, build pipeline, SCSS enforcement, button hardening, adapter contract)

---

## Overview

Phase 7 delivers a **framework-agnostic, self-contained preview and playground system** for the design system. It allows teams to:

- Explore all current components with every variant, size, and state.
- Switch between light and dark themes instantly with zero adapter or component changes.
- Inspect the complete token chain (primitive → semantic → component) for any CSS variable.
- Edit component tokens in real time via color pickers, sliders, and text inputs.
- Export their customisations as a `@layer themes` CSS file.
- Understand how new components are added with the full token flow demonstrated via the Badge component.

---

## Deliverables

### New files

| File | Purpose |
|------|---------|
| `preview/index.html` | Main entry point — complete preview + playground UI |
| `preview/css/ds-preview.css` | Compiled design system CSS (mirrors SCSS @layer output) |
| `preview/css/playground.css` | Preview shell chrome styles (NOT part of DS layer stack) |
| `preview/js/token-registry.js` | Structured token data: component → semantic → primitive chains |
| `preview/js/playground.js` | Playground engine: navigation, theme switching, token editing, export |
| `scss/components/badge/_badge.variables.scss` | Badge component token API |
| `scss/components/badge/_badge.scss` | Badge structural SCSS |
| `scss/components/badge/_index.scss` | Badge barrel |
| `scss/components/_index.scss` | Updated — badge added (alphabetical) |

---

## 1. Preview System Architecture

```
preview/
├── index.html              ← Shell: navigation + all component canvases
├── css/
│   ├── ds-preview.css      ← @layer tokens, base, components, themes (compiled)
│   └── playground.css      ← Shell chrome (no @layer — application styles)
└── js/
    ├── token-registry.js   ← Token data registry (DS_TOKENS, BADGE_TOKEN_FLOW, ...)
    └── playground.js       ← Playground engine
```

### Layer separation is preserved

`ds-preview.css` replicates the same `@layer` order as the SCSS source:

```css
@layer tokens, base, utilities, components, themes, adapters;
```

`playground.css` is intentionally **not** wrapped in any `@layer`. Browser default layer priority places unlayered styles above all `@layer` declarations, which is correct: shell chrome must paint on top of component styles.

### Opening the preview

Open `preview/index.html` in any modern browser — no build step, no server required. The file is fully self-contained (imports CSS and JS from relative paths).

---

## 2. Component Previews

### Button (`v1.2.0`)
- **Variants:** primary · secondary · tertiary · ghost · danger
- **Sizes:** sm (32px) · md (40px) · lg (48px)
- **States:** default · hover · active · disabled · loading
- **Modifiers:** icon + label · icon-only · full-width · `<a>` element
- **Token chain shown:** `--primitive-color-blue-600` → `--semantic-color-brand-default` → `--component-button-primary-bg`

### Card (`v1.0.0`)
- **Variants:** default · raised · flat · sunken
- **Slots:** media · header (title + subtitle) · body · footer
- **Modifiers:** `data-interactive` · `data-orientation="horizontal"`
- **Token chain shown:** `--primitive-color-neutral-300` → `--semantic-color-border-default` → `--component-card-border-color`

### Badge (`v1.0.0`) — **New in Phase 7**
- **Variants:** success · warning · danger · info · neutral
- **Style modifiers:** filled (default) · subtle
- **Sizes:** sm (20px) · md (24px)
- **Special variant:** dot (status indicator circle)
- **Inline usage demo:** badge inside card footer with status indicators
- **Token chain shown:** `--primitive-color-green-600` → `--semantic-color-feedback-success-default` → `--component-badge-success-bg`

---

## 3. Theme Awareness

### How themes update the preview

1. User clicks "Dark mode" toggle in the top bar.
2. `playground.js:toggleTheme()` sets `data-theme="dark"` on `<html>`.
3. `@layer themes` in `ds-preview.css` re-declares all primitive color tokens.
4. Every `var(--semantic-color-*)` and `var(--component-*-*)` in the cascade **resolves automatically** — zero component or adapter file changes required.
5. The preview, token swatches in the panel, and all live controls update immediately.

### Token → semantic → component flow (enforced at every layer)

```
[data-theme="dark"] in @layer themes
    ↓ overrides
--primitive-color-neutral-0: #0d1117   (was #ffffff in light)
    ↓ resolves via
--semantic-color-surface-base: var(--primitive-color-neutral-0)
    ↓ resolves via
--component-card-bg: var(--semantic-color-surface-base)
    ↓ applied to
.ds-card { background: var(--component-card-bg); }
```

**No semantic or component token overrides are needed in the dark theme**. Primitives drive everything. This is the Phase 2 contract working as designed.

### User custom themes

When a user customises a component token in the Playground tab and exports it:

```css
/* Exported theme — @layer themes ensures correct cascade priority */
@layer themes {
  [data-theme="custom"] {
    --component-button-primary-bg: #7c3aed;  /* user override */
  }
}
```

Apply by adding `data-theme="custom"` to any ancestor element. The override cascades down to all `.ds-btn--primary` elements under that ancestor with no adapter changes.

---

## 4. Badge Component — New Component Addition Simulation

The Badge demonstrates the **complete token addition workflow** required for every new component.

### Step 1 — Add primitive tokens (if needed)
Badge uses existing primitive tokens (colors, spacing, radius) — no new primitives required.

### Step 2 — Verify semantic coverage
Badge maps to existing semantic feedback tokens:
- `--semantic-color-feedback-success-*` → success variant
- `--semantic-color-feedback-warning-*` → warning variant
- `--semantic-color-feedback-danger-*` → danger variant
- `--semantic-color-interactive-default` → info variant
- `--semantic-color-surface-*` → neutral variant

### Step 3 — Declare component tokens
`_badge.variables.scss` defines all `--component-badge-*` variables mapping to semantic tokens:

```scss
// primitive → semantic → component
--primitive-color-green-600
  → --semantic-color-feedback-success-default
    → --component-badge-success-bg
```

### Step 4 — Write structural SCSS
`_badge.scss` consumes **only** `--component-badge-*` variables. No raw values, no semantic or primitive references in structural rules.

### Step 5 — Register component
Added to `scss/components/_index.scss` in alphabetical order:
```scss
@use 'badge';   // B — before button
@use 'button';
@use 'card';
```

### Step 6 — Version bump
Adding Badge is a **MINOR** change (`1.0.0 → 1.1.0`):
- No existing tokens modified → not BREAKING
- New `--component-badge-*` namespace → purely additive
- User themes not referencing badge tokens → completely unaffected

### tokens.json diff (before → after)

**Before (Phase 6):** `components: { button, card }`  
**After (Phase 7):** `components: { badge, button, card }` — Badge entry added with full `$schema`, `$version`, and token mappings referencing semantic token paths.

### Deprecated token handling

If a token is renamed between releases, the old name is preserved but flagged:

```css
/* DEPRECATED since v1.1.0 — remove in v2.0.0 */
/* OLD: */ --component-button-primary-bg-brand: var(--semantic-color-brand-default);
/* NEW: */ --component-button-primary-bg: var(--semantic-color-brand-default);
```

- Both names remain functional for one major version.
- Build tooling emits a warning on use of the deprecated name.
- Adapters/themes referencing the old name continue to work — they are updated in a non-urgent migration window before the v2.0.0 BREAKING removal.

---

## 5. Playground Logic

### Token manipulation flow

```
User interacts with control
  → playground.js:setToken(varName, value)
    → document.documentElement.style.setProperty(varName, value)
      → CSS var() chain re-resolves in browser
        → All elements using that variable update instantly
          → No rebuild, no stylesheet reload
```

`setToken()` stores the original computed value on first call, enabling full reset.

### Control types by token type

| Token type | Control rendered |
|-----------|-----------------|
| `color` | `<input type="color">` + text field (hex) |
| `spacing` / `radius` | `<input type="range">` (0–48px) + value label |
| `typography` | `<input type="text">` (free value) |
| `shadow` / `duration` | Read-only (too complex for simple inputs) |

### Export

The Export button in the top bar generates a complete `@layer themes` CSS file containing all in-session overrides for the active component:

```css
/* Exported to: theme-custom-button.css */
@layer themes {
  [data-theme="custom"] {
    --component-button-primary-bg: #7c3aed;
    --component-button-primary-bg-hover: #6d28d9;
  }
}
```

Import after `ds-core.css` and apply `data-theme="custom"` on any container.

### Code copy

Every HTML snippet panel has a "⎘ Copy" button. It uses the `Clipboard API` to copy the raw HTML text. After copying it briefly shows "✓ Copied!" and reverts after 1.8s.

### Reset

The "↺ Reset all" button in the Playground tab restores all tokens to their original computed values by removing inline `style.setProperty()` overrides.

---

## 6. Token Registry (`token-registry.js`)

`DS_TOKENS` is a structured JavaScript object containing all token metadata:

```js
DS_TOKENS.button.tokenGroups[0] = {
  group: 'Primary variant',
  tokens: [
    {
      component: '--component-button-primary-bg',
      semantic:  '--semantic-color-brand-default',
      primitive: '--primitive-color-blue-600',
      type:      'color',
      editable:  true,
      deprecated: false
    }
  ]
}
```

This registry drives:
1. **Token table** — columns: CSS variable · chain · copy button
2. **Playground controls** — only `editable: true` tokens render controls
3. **Docs pane** — token counts, group counts, version
4. **Export** — all `state.overrides` keys come from this registry

To add a new component, add a matching entry to `DS_TOKENS` and the playground automatically supports it — no HTML or CSS changes needed.

---

## 7. Adding New Components to the Playground

### Checklist

1. **SCSS artefacts** (following established pattern):
   - `scss/components/{name}/_index.scss`
   - `scss/components/{name}/_{name}.variables.scss` — `--component-{name}-*` variables
   - `scss/components/{name}/_{name}.scss` — structural styles
   - Register in `scss/components/_index.scss` (alphabetical)

2. **Preview CSS** (`preview/css/ds-preview.css`):
   - Add all `--component-{name}-*` variables inside `@layer components : root {}`
   - Add all structural CSS rules inside `@layer components {}`

3. **Token registry** (`preview/js/token-registry.js`):
   - Add `DS_TOKENS['{name}']` with `tokenGroups`, `version`, `description`
   - Mark `editable: true` on tokens suitable for playground controls

4. **Preview HTML** (`preview/index.html`):
   - Add `<section class="pg-component-section" data-component="{name}">` in main
   - Add `<button data-nav="{name}">` in sidebar nav
   - Populate section with variant/size/state grids and HTML snippet

5. **Version bump**: always MINOR for new components, MAJOR only when breaking token renames occur.

---

## 8. Scaling Guarantees

The preview system is designed to scale to any number of components with no architectural changes:

| Concern | How it scales |
|---------|--------------|
| **Token editing** | `DS_TOKENS` registry drives all controls — add an entry, controls appear |
| **Theme switching** | Primitive overrides in `@layer themes` cover all components simultaneously |
| **New adapters** | `@layer adapters` has highest cascade priority — adapter CSS loads on top |
| **Component interdependencies** | No component references another component's variables |
| **Deprecations** | Tracked in `DS_TOKENS[].tokens[].deprecated` — playground shows warnings |
| **SemVer** | `DS_TOKENS[].version` displayed in section headers and docs pane |

---

## 9. Rules Maintained Through Phase 7

| Rule | Status |
|------|--------|
| No raw values in component CSS | ✅ All values via `var()` chains |
| `@layer` order preserved | ✅ `tokens < base < utilities < components < themes < adapters` |
| Adapter layer untouched | ✅ Preview does not modify any adapter file |
| Themes override primitives only | ✅ Dark theme overrides `--primitive-color-*` exclusively |
| Component tokens reference semantics only | ✅ Badge, button, card all compliant |
| Playground modifies only `:root` inline styles | ✅ Never modifies `@layer` declarations |
| BEM naming on all components | ✅ `.ds-badge`, `.ds-badge--{variant}`, `.ds-badge__{element}` |

---

## Phase 8 Forward Reference

Phase 8 will cover **Minimal Static Documentation** — a generated docs site pulling from the same `DS_TOKENS` registry, SCSS source comments, and the preview system's component sections to produce versioned, searchable, static HTML documentation.
