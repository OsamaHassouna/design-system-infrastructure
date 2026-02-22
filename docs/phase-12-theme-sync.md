# Phase 12 — Controlled Theme Sync & Application Engine

## Overview

Phase 12 is the application layer on top of the Phase 11 dry-run. Where Phase 11
**reports** what would change, Phase 12 **asks** the user which changes to accept
and then **writes** them to the user theme layer.

No file is touched until the user completes the full approval review.
Architecture violations abort the process before the first prompt is shown.

---

## Workflow

```
npm run figma-sync           ← Phase 11: read-only diff report
npm run figma-sync-apply     ← Phase 12: interactive approval → write
```

```
figma-export.json
       │
       ▼
[Architecture gate]  ─── tier violations? cycles?  ──→  exit 1 (blocked)
       │ valid
       ▼
[Diff engine]        ─── NEW / MODIFIED / REMOVED (vs compiled CSS)
       │
       ▼
[Review loop]        ─── user approves / skips each token
       │
       ▼
[Merge + write]      ─── atomic: all three files written together
       │
       ├── dist/user-theme.css
       ├── scss/themes/_user-theme.scss
       └── preview/data/user-theme.registry.json
```

---

## Input: Figma Export JSON

```json
{
  "tokens": [
    { "name": "primitive.color.blue.700",      "value": "#1d4ed8"                        },
    { "name": "semantic.color.brand.default",   "value": "{primitive.color.blue.700}"    },
    { "name": "semantic.color.accent",          "value": "{primitive.color.purple.500}"  },
    { "name": "component.button.primary.bg",    "value": "{semantic.color.brand.default}"}
  ]
}
```

### Name conversion (deterministic)

| Figma dot notation            | CSS custom property              |
|-------------------------------|----------------------------------|
| `semantic.color.brand.default`| `--semantic-color-brand-default` |
| `primitive.color.blue.700`    | `--primitive-color-blue-700`     |
| `{primitive.color.blue.700}`  | `var(--primitive-color-blue-700)`|

Rules:
1. Replace every `.` with `-`
2. Prepend `--`
3. References wrapped in `{...}` become `var(--...)`
4. Raw values (hex, px, etc.) pass through unchanged

---

## Token Tier Rules

The engine enforces the strict 3-tier chain for all Figma input:

```
primitive.*  →  (raw values only — no references permitted)
semantic.*   →  may reference primitive only
component.*  →  may reference semantic only
```

Violations are **hard errors** that block the entire sync:

| Violation | Example | Result |
|-----------|---------|--------|
| Unknown tier | `brand.color.red` | `exit 1` — must start with primitive/semantic/component |
| Skip semantic | `component.button.bg → primitive.color.blue` | `exit 1` — must go through semantic |
| Code-only ref | `semantic.color.focus → base.focus.ring.color` | `exit 1` — `--base-*` is code-only |
| Circular dep | `A → B → A` | `exit 1` — cycle detected |

> **Why is the gate so strict?**
> Allowing Figma to skip the semantic layer would break the token chain contract
> for the entire design system. A theme that imports semantic tokens guarantees
> that any future design change at the primitive level cascades correctly. A token
> that bypasses semantic becomes an unmanaged hard-code.

---

## Diff Categories

After the architecture gate passes, the engine diffs Figma tokens against the
compiled CSS (`dist/ds-preview.css`). Tokens in `@layer tokens` and `@layer themes`
are extracted from `:root {}` blocks.

| Category | Meaning | Interactive action |
|----------|---------|--------------------|
| **NEW** | In Figma, not in compiled CSS | Offer to add to user theme |
| **MODIFIED** | In both; values differ | Offer to update in user theme |
| **REMOVED** | In compiled CSS, not in Figma | Informational only (see note) |
| **UNCHANGED** | In both; values identical | Silent — no action |

> **REMOVED note:** Tokens that exist in the compiled CSS but not in Figma
> are shown in the diff summary but do not receive an approval prompt — unless
> the user previously overrode them in their user theme (the engine asks whether
> to revert those specific overrides to the system default).

---

## User Approval Workflow

### Interactive mode (default)

```
Review queue:
  · 2 NEW token(s) to add
  · 1 MODIFIED token(s) to update

  At each prompt: [y]es  [n]o  [a]ll  [s]kip all  [q]uit

────────────────────────────────────────────────────────────
NEW Tokens (2)
────────────────────────────────────────────────────────────

  [1 of 2]  + --semantic-color-accent
              value: var(--primitive-color-purple-500)
  Apply? [y]es  [n]o  [a]ll  [s]kip all  [q]uit > y

  [2 of 2]  + --semantic-color-accent-hover
              value: var(--primitive-color-purple-600)
  Apply? [y]es  [n]o  [a]ll  [s]kip all  [q]uit > a

────────────────────────────────────────────────────────────
MODIFIED Tokens (1)
────────────────────────────────────────────────────────────

  [1 of 1]  ~ --semantic-color-brand-default
              current:  var(--primitive-color-blue-600)
              proposed: var(--primitive-color-blue-700)
  Apply? [y]es  [n]o  [a]ll  [s]kip all  [q]uit > y
```

### Prompt keys

| Key | Action |
|-----|--------|
| `y` or Enter | Apply this token |
| `n` | Skip this token |
| `a` | Apply this token and all remaining in this category |
| `s` | Skip this token and all remaining in this category |
| `q` | Quit review; apply anything already approved |

If `q` is pressed with zero approvals, nothing is written and the process exits
with code `2`. If approvals already exist, they are written before exiting.

### Non-interactive mode (`--yes`)

```bash
npm run figma-sync-apply -- --yes
npm run figma-sync-apply -- --yes tokens/export.json
```

Applies all NEW and MODIFIED tokens without prompting.
Removal of existing user theme overrides is **always skipped** in `--yes` mode —
removals are considered destructive and require explicit interactive confirmation.

---

## CLI Reference

```bash
node scripts/figma-sync-apply.js [figma-export.json] [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| (positional) | `figma-export.json` | Path to Figma JSON export |
| `--yes`, `-y` | off | Apply all valid changes without prompting |
| `--theme <name>` | `user` | Theme name (used in selector and metadata) |
| `--scope root` | **default** | Apply tokens globally to `:root {}` |
| `--scope attr` | — | Scope tokens to `[data-theme="<name>"] {}` |
| `--out <dir>` | `dist/` | CSS output directory |

**Scope examples:**

```bash
# Global (always-on brand customization)
npm run figma-sync-apply

# Scoped to [data-theme="user"] (activatable theme)
npm run figma-sync-apply -- --scope attr --theme user

# Named brand theme
npm run figma-sync-apply -- --scope attr --theme acme
```

---

## Output Files

### `dist/user-theme.css`

Ready to link directly after the base stylesheet. Self-contained — no Sass
compilation needed after generation.

```html
<link rel="stylesheet" href="dist/ds-preview.css">
<link rel="stylesheet" href="dist/user-theme.css">
```

Both files use `@layer themes`. Because `user-theme.css` is linked after
`ds-preview.css`, its declarations appear later within the same named layer
and correctly override the system defaults.

```css
/* Design System — User Theme
 * Generated : 2026-02-22T10:30:00.000Z
 * Source    : figma-export.json
 * Tokens    : 3
 * Scope     : :root
 *
 * DO NOT EDIT MANUALLY — regenerate with: npm run figma-sync-apply
 */

@layer themes {

  :root {
    --semantic-color-accent:        var(--primitive-color-purple-500);
    --semantic-color-accent-hover:  var(--primitive-color-purple-600);
    --semantic-color-brand-default: var(--primitive-color-blue-700);
  }

}
```

### `scss/themes/_user-theme.scss`

SCSS source for the user theme. Can be compiled as part of the SCSS build
pipeline by adding one line to `scss/themes/_index.scss`:

```scss
// scss/themes/_index.scss
@use 'theme-light';
@use 'theme-dark';
@use 'user-theme';   // ← add this line after running figma-sync-apply
```

After adding it, run `npm run build` to compile the updated SCSS into
`dist/ds-preview.css`.

> **When to use SCSS vs CSS:**
> - Link `dist/user-theme.css` for quick prototyping or when the SCSS
>   build pipeline is not in use.
> - Add `@use 'user-theme'` to the SCSS pipeline for production — this
>   ensures the user theme is bundled into the single `dist/ds-preview.css`
>   output.

### `preview/data/user-theme.registry.json`

Machine-readable record of the current user theme state. Used by the
playground and docs for live preview integration.

```json
{
  "meta": {
    "generatedAt": "2026-02-22T10:30:00.000Z",
    "source": "figma-export.json",
    "cssFile": "dist/ds-preview.css",
    "themeName": "user",
    "scope": "root",
    "selector": ":root"
  },
  "tokens": {
    "--semantic-color-accent":        "var(--primitive-color-purple-500)",
    "--semantic-color-accent-hover":  "var(--primitive-color-purple-600)",
    "--semantic-color-brand-default": "var(--primitive-color-blue-700)"
  },
  "removed": [],
  "changelog": [
    { "action": "add",    "token": "--semantic-color-accent",        "value": "var(--primitive-color-purple-500)", "prev": null },
    { "action": "add",    "token": "--semantic-color-accent-hover",  "value": "var(--primitive-color-purple-600)", "prev": null },
    { "action": "update", "token": "--semantic-color-brand-default", "value": "var(--primitive-color-blue-700)",   "prev": "var(--primitive-color-blue-600)" }
  ]
}
```

---

## Integration with Build Pipeline

Phase 12 is a **manual workflow** — it is not wired into `npm run build`
automatically. The intended integration sequence is:

```
1. npm run figma-sync-apply          # review + apply
2. (optionally) add @use 'user-theme' to scss/themes/_index.scss
3. npm run build                     # validate + compile + autoprefixer
4. npm run figma-sync                # verify Figma and CSS now match
```

If you want to validate the user theme tokens after apply, the Phase 10
validator (`npm run build` prebuild hook) will catch any tier violations
that slipped through — providing a second safety net at compile time.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Applied successfully (or nothing to apply) |
| `1` | Architecture violation — process blocked before review |
| `2` | User quit without approving any changes |
| `130` | Interrupted (Ctrl+C) |

---

## Example: Full Workflow

### Figma export (`figma-export.json`)

```json
{
  "tokens": [
    { "name": "primitive.color.purple.500", "value": "#8b5cf6" },
    { "name": "primitive.color.blue.700",   "value": "#1d4ed8" },
    { "name": "semantic.color.accent",      "value": "{primitive.color.purple.500}" },
    { "name": "semantic.color.brand.default", "value": "{primitive.color.blue.700}" }
  ]
}
```

### Run Phase 11 first (optional but recommended)

```bash
npm run figma-sync

# Output:
# ✔ No circular dependencies in Figma tokens
#
# New Tokens (1)
#   + --semantic-color-accent
#
# Modified Tokens (1)
#   ~ --semantic-color-brand-default
#       code : var(--primitive-color-blue-600)
#       figma: var(--primitive-color-blue-700)
#
# Sync SAFE — no architectural violations
# Changes pending: 2  (new: 1  modified: 1  removed: 0)
```

### Run Phase 12 to apply

```bash
npm run figma-sync-apply

# Output:
# ✔ Architecture valid
#
# NEW Tokens (1)
#   [1 of 1]  + --semantic-color-accent
#               value: var(--primitive-color-purple-500)
#   Apply? [y]es  [n]o  [a]ll  [s]kip all  [q]uit > y
#
# MODIFIED Tokens (1)
#   [1 of 1]  ~ --semantic-color-brand-default
#               current:  var(--primitive-color-blue-600)
#               proposed: var(--primitive-color-blue-700)
#   Apply? [y]es  [n]o  [a]ll  [s]kip all  [q]uit > y
#
# ✔ dist/user-theme.css
# ✔ scss/themes/_user-theme.scss
# ✔ preview/data/user-theme.registry.json
#
#   Added (1)
#     + --semantic-color-accent
#
#   Updated (1)
#     ~ --semantic-color-brand-default
#
# ✔ Theme sync complete — 2 token(s) applied
#
#   Next steps:
#     1. Link  dist/user-theme.css  after  dist/ds-preview.css  in HTML
#     2. Run   npm run build   to compile SCSS changes into dist/
#     3. Run   npm run figma-sync   to verify tokens match Figma
```

### Tier violation (blocked before review)

```bash
npm run figma-sync-apply -- tokens/bad-export.json

# Output:
# ✖ Architecture violations detected — sync blocked
#
#   ✖ Tier violation: component.button.bg → --primitive-color-blue-600
#        component → primitive not allowed. Allowed: semantic
#
# Fix the above issues in your Figma token structure, then re-run.
# (exit code: 1)
```

### Circular dependency (blocked before review)

```bash
npm run figma-sync-apply -- tokens/cycle-export.json

# Output:
# ✖ Architecture violations detected — sync blocked
#
#   ✖ Circular dependency: --semantic-color-a → --semantic-color-b → --semantic-color-a
#
# Fix the above issues in your Figma token structure, then re-run.
# (exit code: 1)
```
