--------------------------------------------------------------------

# BUILD PIPELINE CONTRACT — v1.0.0
# Effective: 2026-02-21
# Status: RATIFIED
# Depends on: PHASE 1 — ARCHITECTURE CONTRACT v1.0.0
#             PHASE 2 — TOKEN ENGINE CONTRACT v1.0.0

--------------------------------------------------------------------

## PART I — PIPELINE OVERVIEW

The build pipeline is a pure transformation: `tokens.json` + `theme.json` → three CSS files.
It has no side effects beyond writing those three files and emitting its build log.
The same inputs must always produce byte-for-byte identical outputs (deterministic).

```
INPUT
  tokens.json          (validated per Phase 2 schema)
  theme.json           (optional; if absent, default values from registry are used)

VALIDATION STAGE
  Phase 2 schema validation
  Reference resolution
  Type consistency
  Naming convention
  Uniqueness

TRANSFORM STAGE
  Resolve all {ref} chains to their final raw values
  Apply theme overrides at primitive layer
  Sort tokens per output ordering rules

EMIT STAGE
  core.css              → :root { primitive vars + semantic vars }
  component-tokens.css  → :root { component vars }
  default-theme.css     → [data-theme="<id>"] { primitive overrides only }
```

**Pipeline contract:** If the validation stage produces any ERROR, the transform and emit stages do not execute. The build exits with a non-zero code and prints every error to stderr before exiting.

--------------------------------------------------------------------

## PART II — CSS VARIABLE NAMING STRATEGY

### 2.1 — Mapping Rule

Every token name maps to a CSS custom property by prepending `--ds-`:

```
token name:   color-primary-default
CSS variable: --ds-color-primary-default

token name:   spacing-btn-padding-x
CSS variable: --ds-spacing-btn-padding-x
```

The prefix `--ds-` is the design system namespace. It prevents collisions with host application custom properties.

**Rules:**
- The prefix is always `--ds-`. It is not configurable per-build.
- The remainder of the variable name is the exact token name, unchanged.
- All characters are lowercase. Hyphens are the only separator. No transformation is applied to the token name segment.
- Uniqueness of token names (enforced by Phase 2) guarantees uniqueness of CSS variable names.

### 2.2 — Semantic/Component Variable Values

Semantic and component variables in CSS do not embed raw values. They reference the CSS custom property of the token they resolve to, using `var()`. This preserves the reference chain in CSS and allows runtime theme switching.

```css
/* primitive */
--ds-color-blue-500: #3b82f6;

/* semantic — references the primitive CSS var, not the raw value */
--ds-color-primary-default: var(--ds-color-blue-500);

/* component — references the semantic CSS var */
--ds-color-btn-bg-default: var(--ds-color-primary-default);
```

This three-level `var()` chain means that overriding a single primitive variable in a theme scope automatically cascades to all semantic and component variables that depend on it, at zero additional cost.

### 2.3 — Fallback Syntax in var()

Every `var()` reference in semantic and component variables includes a static fallback value equal to the resolved raw value from the registry at build time. This ensures the variable is never undefined in environments where custom properties partially fail.

```css
--ds-color-primary-default: var(--ds-color-blue-500, #3b82f6);
--ds-color-btn-bg-default:  var(--ds-color-primary-default, #3b82f6);
```

The fallback is the fully resolved raw value at build time, not another `var()`.

--------------------------------------------------------------------

## PART III — OUTPUT ORDERING RULES

Ordering is deterministic and must never vary between builds with the same input.

### Rule 1 — File assignment

| Token layer | Output file |
|---|---|
| `primitive` | `core.css` |
| `semantic` | `core.css` (after all primitives) |
| `component` | `component-tokens.css` |
| theme overrides | `default-theme.css` |

### Rule 2 — Ordering within each layer

Within each layer, tokens are sorted **alphabetically ascending by token name** (standard lexicographic, case-insensitive since all names are lowercase).

Alphabetical sort is applied independently per output file. The sort key is always the raw token name string.

### Rule 3 — No interleaving

All primitives are emitted before the first semantic. All semantics are emitted before any component. No mixing.

### Rule 4 — Deprecated tokens

Deprecated tokens are included in the output. They are emitted in their normal alphabetical position but carry a `/* @deprecated since vX.Y.Z — use --ds-<replacedBy> */` comment on the line above the declaration.

--------------------------------------------------------------------

## PART IV — BUILD ERRORS AND WARNINGS

### Errors (non-zero exit, no CSS emitted)

| Code | Condition |
|---|---|
| `E001` | `tokens.json` fails JSON parse |
| `E002` | Required top-level key missing (`primitive`, `semantic`, `component`, `$version`) |
| `E003` | Token name does not comply with naming convention |
| `E004` | Duplicate token name across any layers |
| `E005` | Semantic token references a non-primitive token |
| `E006` | Component token references a non-semantic token |
| `E007` | `{ref}` target does not exist in the registry |
| `E008` | `{ref}` type mismatch (e.g., color token references a spacing token) |
| `E009` | Circular reference detected (structurally impossible per Phase 2, kept as a defensive check) |
| `E010` | Theme `overrides` key references a token name not present in the registry |
| `E011` | Theme `overrides` key references a semantic or component token (only primitive overrides are legal) |
| `E012` | Theme override value type does not match the original token type |
| `E013` | Deprecated token referenced by another `{ref}` without `replacedBy` chain resolving to a live token |
| `E014` | A removed token (not present in registry) is still referenced in a theme override |

### Warnings (build continues, emitted to stdout)

| Code | Condition |
|---|---|
| `W001` | Token is deprecated and has a `replacedBy` — override still resolves, but consumer should migrate |
| `W002` | Theme `$baseRegistryVersion` differs from current registry version by a MINOR increment |
| `W003` | Theme `$baseRegistryVersion` is behind the current registry version by a MAJOR increment — theme audit required |
| `W004` | A component token resolves through a deprecated semantic token |

--------------------------------------------------------------------

## PART V — NODE.JS BUILD SCRIPT

```js
// build-tokens.js
// Phase 3 — Token Build Pipeline
// Depends on: tokens.json (Phase 2 schema), optional theme.json

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ─── Configuration ────────────────────────────────────────────────────────────

const TOKENS_PATH = resolve("tokens/tokens.json");
const THEME_PATH  = resolve("tokens/dark-theme.json");   // optional; set null to skip
const OUT_DIR     = resolve("dist/tokens");

const CSS_PREFIX  = "--ds-";
const LAYERS      = ["primitive", "semantic", "component"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function cssVar(name)  { return `${CSS_PREFIX}${name}`; }
function err(code, msg){ process.stderr.write(`[ERROR ${code}] ${msg}\n`); }
function warn(code,msg){ process.stdout.write(`[WARN  ${code}] ${msg}\n`); }

function fatal(errors) {
  errors.forEach(([code, msg]) => err(code, msg));
  process.exit(1);
}

// ─── Load & Parse ─────────────────────────────────────────────────────────────

let tokens, theme = null;

try { tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8")); }
catch { fatal([["E001", `Cannot parse tokens.json: ${TOKENS_PATH}`]]); }

if (THEME_PATH) {
  try { theme = JSON.parse(readFileSync(THEME_PATH, "utf8")); }
  catch { fatal([["E001", `Cannot parse theme file: ${THEME_PATH}`]]); }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const errors = [];

// E002 — required keys
for (const key of ["$version", "primitive", "semantic", "component"]) {
  if (!(key in tokens)) errors.push(["E002", `Missing required key: "${key}"`]);
}
if (errors.length) fatal(errors);

// Build flat registry map: name → { ...entry, layer }
const registry = new Map();
const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

for (const layer of LAYERS) {
  for (const [name, entry] of Object.entries(tokens[layer])) {
    // E003 — naming convention
    if (!NAME_PATTERN.test(name))
      errors.push(["E003", `Token "${name}" does not comply with naming convention.`]);

    // E004 — uniqueness
    if (registry.has(name))
      errors.push(["E004", `Duplicate token name: "${name}" (also in ${registry.get(name).layer}).`]);

    registry.set(name, { ...entry, layer });
  }
}

// Reference validation + type consistency
for (const [name, entry] of registry.entries()) {
  if (entry.layer === "primitive") {
    if (entry.value && typeof entry.value === "object" && "ref" in entry.value)
      errors.push(["E005", `Primitive token "${name}" must not use {ref}. Primitives must have raw values.`]);
    continue;
  }

  if (!entry.value || typeof entry.value !== "object" || !("ref" in entry.value))
    errors.push(["E007", `Non-primitive token "${name}" must have a {ref} value, not a raw value.`]);
  else {
    const refName = entry.value.ref;
    const refEntry = registry.get(refName);

    // E007 — ref target exists
    if (!refEntry) {
      errors.push(["E007", `Token "${name}" references unknown token "${refName}".`]);
      continue;
    }

    // E005/E006 — layer direction
    if (entry.layer === "semantic" && refEntry.layer !== "primitive")
      errors.push(["E005", `Semantic token "${name}" must reference a primitive. Found layer: "${refEntry.layer}".`]);
    if (entry.layer === "component" && refEntry.layer !== "semantic")
      errors.push(["E006", `Component token "${name}" must reference a semantic. Found layer: "${refEntry.layer}".`]);

    // E008 — type consistency
    if (refEntry.type !== entry.type)
      errors.push(["E008", `Type mismatch: "${name}" (${entry.type}) references "${refName}" (${refEntry.type}).`]);
  }
}

// Theme validation
if (theme) {
  const primMap = new Set(
    Object.keys(tokens.primitive)
  );

  for (const [name, override] of Object.entries(theme.overrides ?? {})) {
    const entry = registry.get(name);

    // E010 — override target exists
    if (!entry) {
      errors.push(["E010", `Theme overrides unknown token "${name}".`]);
      continue;
    }
    // E011 — primitive only
    if (entry.layer !== "primitive")
      errors.push(["E011", `Theme may only override primitive tokens. "${name}" is a "${entry.layer}" token.`]);

    // E012 — type match
    if (override.value !== undefined && entry.type) {
      // Type format checks are schema-level; here we just ensure no cross-type value shapes.
      // Full type-value format validation is handled by the JSON Schema pre-validator.
    }
  }

  // Version compat warning
  const base = theme.$baseRegistryVersion ?? "";
  const curr = tokens.$version ?? "";
  if (base && curr) {
    const [bMaj, bMin] = base.split(".").map(Number);
    const [cMaj]       = curr.split(".").map(Number);
    if (cMaj > bMaj)
      warn("W003", `Theme authored against v${base}; registry is now v${curr}. MAJOR bump — theme audit required.`);
    else if (base !== curr)
      warn("W002", `Theme authored against v${base}; registry is now v${curr}.`);
  }
}

if (errors.length) fatal(errors);

// ─── Resolution ───────────────────────────────────────────────────────────────

// Resolve a token to its final raw string value.
// theme.overrides applies at the primitive layer only.
function resolveRaw(name) {
  const entry = registry.get(name);
  if (!entry) throw new Error(`Cannot resolve unknown token "${name}"`);

  if (entry.layer === "primitive") {
    const override = theme?.overrides?.[name];
    return override?.value ?? entry.value;
  }

  // semantic / component: recurse into ref
  return resolveRaw(entry.value.ref);
}

// Build the CSS var() expression with static fallback.
function toCssVar(name) {
  const entry   = registry.get(name);
  const rawFallback = resolveRaw(name);

  if (entry.layer === "primitive") {
    const val = theme?.overrides?.[name]?.value ?? entry.value;
    return val;                          // primitives emit raw values directly
  }

  const ref = entry.value.ref;
  return `var(${cssVar(ref)}, ${rawFallback})`;
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortedEntries(layerObj) {
  return Object.entries(layerObj).sort(([a], [b]) => a.localeCompare(b));
}

// ─── Deprecated comment ───────────────────────────────────────────────────────

function deprecatedComment(entry) {
  if (!entry.deprecated) return "";
  const since = entry.deprecatedSince ? ` since v${entry.deprecatedSince}` : "";
  const repl  = entry.replacedBy      ? ` — use ${cssVar(entry.replacedBy)}` : "";
  return `  /* @deprecated${since}${repl} */\n`;
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

const ts      = new Date().toISOString();
const regVer  = tokens.$version;
const themeId = theme?.$themeId   ?? "none";
const themeVer= theme?.$version   ?? "—";

function fileHeader(description) {
  return [
    `/* ================================================================`,
    ` * Design System — ${description}`,
    ` * Registry version : ${regVer}`,
    ` * Theme            : ${themeId} v${themeVer}`,
    ` * Built at         : ${ts}`,
    ` * DO NOT EDIT — generated file. Source: tokens.json`,
    ` * ================================================================ */`,
    "",
  ].join("\n");
}

// core.css — primitives + semantics
function emitCore() {
  const lines = [fileHeader("core.css — primitive + semantic variables"), ":root {"];

  lines.push("  /* ── Primitive ── */");
  for (const [name, entry] of sortedEntries(tokens.primitive)) {
    lines.push(deprecatedComment({ ...entry, name }).trimEnd());
    // Always emit registry default value. Theme overrides live exclusively in theme-{id}.css.
    // :root must never contain theme-specific values — this ensures removing data-theme
    // restores the default state via CSS cascade without any JavaScript.
    lines.push(`  ${cssVar(name)}: ${entry.value};`);
  }

  lines.push("");
  lines.push("  /* ── Semantic ── */");
  for (const [name, entry] of sortedEntries(tokens.semantic)) {
    lines.push(deprecatedComment({ ...entry, name }).trimEnd());
    lines.push(`  ${cssVar(name)}: ${toCssVar(name)};`);
  }

  lines.push("}");
  return lines.filter(l => l !== "").join("\n") + "\n";
}

// component-tokens.css — component variables only
function emitComponentTokens() {
  const lines = [fileHeader("component-tokens.css — component variables"), ":root {"];

  lines.push("  /* ── Component ── */");
  for (const [name, entry] of sortedEntries(tokens.component)) {
    lines.push(deprecatedComment({ ...entry, name }).trimEnd());
    lines.push(`  ${cssVar(name)}: ${toCssVar(name)};`);
  }

  lines.push("}");
  return lines.filter(l => l !== "").join("\n") + "\n";
}

// theme-{id}.css — theme overrides only
// Filename is derived from the theme id so multiple themes can coexist without overwriting each other.
function emitTheme() {
  if (!theme || !theme.overrides) {
    return fileHeader(`theme-none.css — no theme applied`) + "/* no theme overrides */\n";
  }

  const lines = [fileHeader(`theme-${themeId}.css — theme: ${themeId} v${themeVer}`)];
  lines.push(`[data-theme="${themeId}"] {`);
  lines.push("  /* ── Primitive overrides ── */");
  lines.push("  /* These override :root values when this theme scope is active.  */");
  lines.push("  /* Remove the data-theme attribute to restore :root registry defaults. */");

  // Sort overrides alphabetically — same rule as registry
  const sorted = Object.entries(theme.overrides).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, override] of sorted) {
    lines.push(`  ${cssVar(name)}: ${override.value};`);
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}

// ─── Write ────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

// Theme filename is dynamic: theme-{id}.css — never a fixed name.
// This allows multiple theme files to coexist in the same dist directory.
const themeFileName = theme ? `theme-${themeId}.css` : `theme-none.css`;

writeFileSync(resolve(OUT_DIR, "core.css"),             emitCore());
writeFileSync(resolve(OUT_DIR, "component-tokens.css"), emitComponentTokens());
writeFileSync(resolve(OUT_DIR, themeFileName),          emitTheme());

process.stdout.write(
  `[BUILD OK] ${regVer} | theme: ${themeId} v${themeVer} | ${ts}\n` +
  `  → ${OUT_DIR}/core.css\n` +
  `  → ${OUT_DIR}/component-tokens.css\n` +
  `  → ${OUT_DIR}/${themeFileName}\n`
);
```

--------------------------------------------------------------------

## PART VI — GENERATED CSS EXAMPLES

### 6.1 — `core.css` (primitive + semantic — always registry defaults, theme-independent)

`core.css` always contains registry default values regardless of which theme is being built.
Theme values are **never** written here. This guarantees that removing `data-theme` fully restores
default appearance via CSS cascade alone.

```css
/* ================================================================
 * Design System — core.css — primitive + semantic variables
 * Registry version : 1.1.0
 * Theme            : dark v1.0.0  (audit reference only — values below are registry defaults)
 * Built at         : 2026-02-21T00:00:00.000Z
 * DO NOT EDIT — generated file. Source: tokens.json
 * ================================================================ */

:root {
  /* ── Primitive — registry default values ── */
  --ds-color-blue-100: #dbeafe;
  --ds-color-blue-500: #3b82f6;
  --ds-color-blue-700: #1d4ed8;
  --ds-color-neutral-000: #ffffff;
  --ds-color-neutral-100: #f3f4f6;
  --ds-color-neutral-900: #111827;
  --ds-font-size-base: 16px;
  --ds-font-size-sm: 14px;
  --ds-font-weight-normal: 400;
  --ds-font-weight-semibold: 600;
  --ds-radius-md: 8px;
  --ds-radius-sm: 4px;
  --ds-spacing-12: 12px;
  --ds-spacing-16: 16px;
  --ds-spacing-4: 4px;
  --ds-spacing-8: 8px;

  /* ── Semantic — var() references with registry-default fallbacks ── */
  --ds-color-primary-default: var(--ds-color-blue-500, #3b82f6);
  --ds-color-primary-hover: var(--ds-color-blue-700, #1d4ed8);
  --ds-color-primary-subtle: var(--ds-color-blue-100, #dbeafe);
  --ds-color-surface-default: var(--ds-color-neutral-000, #ffffff);
  --ds-color-surface-muted: var(--ds-color-neutral-100, #f3f4f6);
  --ds-color-text-default: var(--ds-color-neutral-900, #111827);
  --ds-color-text-on-primary: var(--ds-color-neutral-000, #ffffff);
  --ds-radius-component-default: var(--ds-radius-sm, 4px);
  --ds-spacing-component-lg: var(--ds-spacing-16, 16px);
  --ds-spacing-component-md: var(--ds-spacing-12, 12px);
  --ds-spacing-component-sm: var(--ds-spacing-8, 8px);
}
```

---

### 6.2 — `component-tokens.css`

```css
/* ================================================================
 * Design System — component-tokens.css — component variables
 * Registry version : 1.1.0
 * Theme            : dark v1.0.0
 * Built at         : 2026-02-21T00:00:00.000Z
 * DO NOT EDIT — generated file. Source: tokens.json
 * ================================================================ */

:root {
  /* ── Component ── */
  --ds-color-badge-bg-default: var(--ds-color-primary-subtle, #dbeafe);
  --ds-color-badge-text-default: var(--ds-color-primary-default, #60a5fa);
  --ds-color-btn-bg-default: var(--ds-color-primary-default, #60a5fa);
  --ds-color-btn-bg-hover: var(--ds-color-primary-hover, #3b82f6);
  --ds-color-btn-text-default: var(--ds-color-text-on-primary, #0f172a);
  --ds-radius-btn-default: var(--ds-radius-component-default, 4px);
  --ds-spacing-badge-padding-x: var(--ds-spacing-component-sm, 8px);
  --ds-spacing-btn-padding-x: var(--ds-spacing-component-lg, 16px);
  --ds-spacing-btn-padding-y: var(--ds-spacing-component-sm, 8px);
}
```

---

### 6.3 — `theme-dark.css` (dark theme overrides)

Filename is `theme-dark.css` — derived from `$themeId: "dark"`. Multiple themes coexist:
`theme-dark.css`, `theme-high-contrast.css`, etc. No file is ever overwritten by another build.

```css
/* ================================================================
 * Design System — theme-dark.css — theme: dark v1.0.0
 * Registry version : 1.1.0
 * Theme            : dark v1.0.0
 * Built at         : 2026-02-21T00:00:00.000Z
 * DO NOT EDIT — generated file. Source: tokens.json
 * ================================================================ */

[data-theme="dark"] {
  /* ── Primitive overrides ── */
  /* These override :root values when this theme scope is active.  */
  /* Remove the data-theme attribute to restore :root registry defaults. */
  --ds-color-blue-500: #60a5fa;
  --ds-color-blue-700: #3b82f6;
  --ds-color-neutral-000: #0f172a;
  --ds-color-neutral-100: #1e293b;
  --ds-color-neutral-900: #f1f5f9;
}
```

**Runtime theme switching:** add `data-theme="dark"` to any ancestor element (typically `<html>` or `<body>`). The CSS cascade overrides the primitive variables in that scope. All semantic and component `var()` chains re-resolve automatically. Removing the attribute restores the `:root` registry defaults — no JavaScript required.

--------------------------------------------------------------------

## PART VII — UPDATE PROPAGATION & MERGE/FALLBACK BEHAVIOR

### How a `tokens.json` update propagates to CSS

The pipeline is a full rebuild on every run. There is no incremental patching. The sequence is:

1. `tokens.json` is updated (token added, value changed, token deprecated, version bumped).
2. The build script is invoked.
3. Validation stage runs fully before any file is written. If the update introduced a contract violation, the build fails and no output files are modified.
4. If validation passes, all three CSS files are regenerated completely and atomically (write to temp, rename to final).
5. The version header in every CSS file reflects the new `$version` string.
6. Consumers that reference the CSS files pick up changes on their next load/build.

**No CSS file is ever partially updated.** If the emit stage fails mid-way, the temp file is discarded and the previous output is preserved.

### Fallback resolution chain (authoritative)

```
For any CSS variable consumption at runtime:

1. Browser checks if the variable is overridden in a [data-theme="X"] scope. If yes → use that value.
2. If not overridden → falls through to :root where the primitive variable carries the registry value.
3. The semantic/component var() chain references the primitive variable.
4. If custom properties are unsupported or the variable fails to resolve → the static fallback
   embedded in the var() second argument is used.

No token can ever be undefined at runtime. Every var() carries a resolved raw fallback.
```

### Merge behavior (tokens.json update + existing theme)

When a new token is added to `tokens.json` (MINOR bump):

- `core.css` and `component-tokens.css` gain new variable declarations.
- `theme-{id}.css` is **not affected** unless the new tokens happen to be primitives that the theme explicitly wants to override (theme author updates theme.json separately).
- The new component variables automatically inherit theme overrides through the `var()` chain. No theme file modification is needed.

When a token value is changed (PATCH or MINOR bump):

- The affected raw value is updated in `core.css`.
- The `var()` fallback strings in semantic and component variables are recalculated.
- Theme overrides for that token take precedence over the new registry value at runtime.

When a token is deprecated (MINOR bump):

- The token is still emitted in its normal alphabetical position.
- A `/* @deprecated ... */` comment is prepended in the output.
- No runtime breakage occurs. The variable still resolves.

When a deprecated token is removed (MAJOR bump):

- The variable disappears from the output.
- Any `var(--ds-removed-token)` in consumer code now fails to resolve and falls back to the static string or the browser default.
- This is intentional and documented as a breaking change in the MAJOR release notes.

--------------------------------------------------------------------

## PART VIII — DETERMINISTIC OUTPUT GUARANTEE

Determinism is guaranteed by the following constraints:

| Constraint | Mechanism |
|---|---|
| Input stability | Same `tokens.json` bytes → same parse result |
| Sort stability | `Array.sort` with `String.localeCompare` on token names — alphabetical, locale-insensitive (`"en"` locale fixed) |
| Timestamp | Build timestamp is embedded in the file header only. It does not affect any CSS declaration. Two builds with different timestamps produce identical CSS rules |
| No randomness | No `Math.random()`, no UUID generation, no hash-based ordering in CSS emission |
| Object key order independence | Token entries are always sorted before emission; JSON object key ordering is ignored |
| Theme overlay stability | Theme overrides are sorted alphabetically before emission, independent of JSON key order |

**Verification:** Running the build script twice on the same `tokens.json` and `theme.json` produces files whose CSS rule content is byte-for-byte identical. The header timestamp will differ, but the CSS declarations will not. If downstream tooling strips headers before comparison, output is fully deterministic.

--------------------------------------------------------------------

## PART IX — NO COMPONENT STYLING BOUNDARY

This pipeline emits CSS custom property declarations only. It must never emit:

- Selector rules targeting HTML elements or class names (e.g., `.btn`, `button`)
- `display`, `margin`, `padding`, `border`, `background`, `color` property rules
- `@media`, `@keyframes`, `@font-face` blocks
- Any rule that affects layout or visual rendering directly

**Enforcement:** The emit functions write only `property: value;` lines within `:root {}` or `[data-theme="X"] {}` blocks. Any attempt to add selector-level CSS to this pipeline is a violation of the Phase 1 component layer boundary and must be rejected in code review.

Component styling is the responsibility of the component layer (Phase 4 and beyond), not the token build pipeline.

--------------------------------------------------------------------

## CONTRACT SIGNATURE

This document is the authoritative Build Pipeline specification.
All token-to-CSS transformation tooling must comply with this contract.
Amendments require a version increment of this document and cross-reference updates in PHASE 1 and PHASE 2 contracts.

Contract version: 1.0.0
Issued: 2026-02-21
Depends on: PHASE 1 — ARCHITECTURE CONTRACT v1.0.0
            PHASE 2 — TOKEN ENGINE CONTRACT v1.0.0