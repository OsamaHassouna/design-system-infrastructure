# FIGMA TOKEN SYNC — ARCHITECTURE DESIGN
## Phase 8 · Part 2 — Design Document (No Implementation Code)

> **Status:** Architecture design only.  
> **Implementation:** Phase 9.  
> **Rule:** No write operations to any token file without dry-run confirmation.

---

## 1. Scope of Import Support

The sync engine accepts Figma token exports in three formats:

| Format | Description | Normalised to |
|--------|-------------|---------------|
| **Token Studio JSON** | `$value`, `$type`, `$description` envelope | Internal DS JSON schema |
| **W3C Design Tokens** | Draft spec format with `$value`/`$type` | Internal DS JSON schema |
| **Raw Figma JSON** | Flat/nested key-value export | Internal DS JSON schema |

### Supported token categories

| Category | Subtypes |
|---|---|
| **Color** | hex, rgb, rgba, hsl, hsla, alias references |
| **Typography** | family, size, weight, line-height, letter-spacing (as composite or flat) |
| **Spacing** | px values, rem values, unitless scale |
| **Radius** | px, rem, % |
| **Shadow** | x, y, blur, spread, color, inset flag |

---

## 2. Architecture Overview — Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  FIGMA (Designer)                                                   │
│                                                                     │
│  Token Studio plugin  ──or──  W3C export  ──or──  raw JSON export  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  tokens.json / tokens.zip
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FIGMA PLUGIN (Export Contract)                  figma-plugin/      │
│  • Attaches DS version tag to export payload                        │
│  • Enforces 4-segment naming before export                          │
│  • Stamps: { _meta: { dsVersion, exportDate, format } }            │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  validated export bundle
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  JSON TRANSFORMER                               sync/transform/     │
│  • Detects input format (Token Studio / W3C / raw)                  │
│  • Normalises names  →  {scope}.{category}.{group}.{token}         │
│  • Normalises units  →  px→rem, hex→hex (no implicit conversion)   │
│  • Flattens typography composites  →  individual flat tokens        │
│  • Resolves alias references to literal values for validation       │
│  • Tags each token: layer = primitive | semantic | unknown          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  normalised token map
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TOKEN VALIDATOR                                sync/validate/      │
│  • Schema validation (required fields, type checks)                 │
│  • 4-segment naming enforcement                                     │
│  • Layer integrity check (no component-layer write targets)         │
│  • Dependency graph: no missing primitive for semantic refs         │
│  • Circular reference detection                                     │
│  • Version compatibility check                                      │
│  Emits: ValidationReport { errors[], warnings[], info[] }           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  ValidationReport (must be error-free)
                                   ▼
                        ┌──────────────────┐
                        │  Errors present? │
                        └───┬──────────────┘
                       YES  │        NO
                            │         │
                     ┌──────┘         ▼
                     │    ┌──────────────────────────┐
                     │    │  CONFLICT RESOLVER       │
                     │    │  sync/conflict/          │
                     │    │  Evaluates each token:   │
                     │    │  • New → accept          │
                     │    │  • Exists + same value   │
                     │    │    → skip                │
                     │    │  • Exists + diff value   │
                     │    │    → warn + queue        │
                     │    │  • Renamed in Figma      │
                     │    │    → safe-rename propose │
                     │    │  • Deleted in Figma      │
                     │    │    → deprecation flag    │
                     │    └────────────────┬─────────┘
                     │                     │  ConflictReport + resolved token set
                     │                     ▼
                     │    ┌──────────────────────────────────┐
                     │    │  SYNC MODE ROUTER                │
                     │    │  User selects ONE sync mode:     │
                     │    │  A) Overwrite semantic layer      │
                     │    │  B) Create new theme              │
                     │    │  C) Safe merge                    │
                     │    └────────────────┬─────────────────┘
                     │                     │
                     │                     ▼
                     │    ┌──────────────────────────────────┐
                     │    │  THEME GENERATOR                 │
                     │    │  sync/generate/                  │
                     │    │  • Emits  token JSON files       │
                     │    │  • Triggers existing CSS pipeline│
                     │    │  • Writes to:                    │
                     │    │    - tokens/ (overwrite mode)    │
                     │    │    - themes/theme-{id}.json (new)│
                     │    └────────────────┬─────────────────┘
                     │                     │
                     ▼                     ▼
              ┌──────────────────────────────────────────┐
              │  SYNC REPORT ENGINE      sync/report/    │
              │  Generates: sync-report-{timestamp}.md   │
              │  Contents:                               │
              │    • Added / modified / deprecated       │
              │    • Conflicts + resolution decisions    │
              │    • Warnings + errors                   │
              │    • Version impact summary              │
              │    • Rollback instructions               │
              └──────────────────────────────────────────┘
```

---

## 3. Mapping Strategy

### 3.1 Layer assignment

Figma tokens are assigned a DS layer by their name prefix:

| Figma name prefix | Mapped DS layer | Write allowed? |
|---|---|---|
| `primitive.*` | `@layer tokens` — primitives | **Yes** (create or extend) |
| `semantic.*` | `@layer tokens` — semantics | **Yes** (replace or merge) |
| `component.*` | `@layer components` | **NEVER** |
| `base.*` | `@layer base` | **NEVER** |
| `theme.*` | Generates `theme-{id}.json` | Yes (isolated only) |
| *(unrecognised)* | `unknown` | Blocked — requires manual classification |

### 3.2 Naming normalisation rules

All imported names are normalised to the 4-segment convention:

```
{scope}.{category}.{group}.{token}

Examples:
  primitive.color.blue.600
  semantic.color.brand.default
  semantic.spacing.component.sm
  semantic.font-size.ui.md
```

Normalisation steps applied in order:

1. Strip leading/trailing whitespace and special characters.
2. Convert `camelCase` and `PascalCase` → `kebab-case`.
3. Replace spaces and underscores with hyphens.
4. Collapse consecutive hyphens.
5. Split on `.` or `/` to derive segments.
6. If fewer than 4 segments: **reject** (validation error).
7. If more than 4 segments: collapse extra segments into group using hyphen join.
8. Map Figma Token Studio `$type` categories to DS category names:
   - `color` → `color`
   - `typography` → `font-size`, `font-weight`, `font-family`, `line-height`, `letter-spacing` (flattened)
   - `spacing` → `spacing`
   - `borderRadius` → `radius`
   - `boxShadow` → `shadow`

### 3.3 Unit normalisation

| From | To | Rule |
|---|---|---|
| `px` (type `spacing`, `font-size`, `radius`) | `rem` | divide by 16 |
| `px` (type `shadow` offsets, blur, spread) | `px` | keep — shadows computed in px |
| `%` (radius only) | `%` | keep as-is |
| Unitless number (font-weight, line-height) | unitless | keep as-is |
| Unitless number (spacing) | `rem` — divide by 16 | **warning emitted** |

Conversion is one-way: `px → rem`. The reverse is never applied.

### 3.4 Color format normalisation

All colors are normalised to lowercase 6-digit hex at import time:

| Input format | Output |
|---|---|
| `rgb(r, g, b)` | `#rrggbb` |
| `rgba(r, g, b, 1)` | `#rrggbb` |
| `rgba(r, g, b, a<1)` | `rgba(r, g, b, a)` — preserved for transparency |
| `hsl(h, s%, l%)` | `#rrggbb` |
| `#RGB` (3-digit) | `#RRGGBB` (expanded) |
| `#RRGGBB` | `#rrggbb` (lowercased) |
| Token alias (`{color.blue.600}`) | Resolved to literal value for validation; stored as alias reference |

### 3.5 Typography object flattening

Token Studio exports typography as composite objects:

```json
{
  "heading-1": {
    "$type": "typography",
    "$value": {
      "fontFamily": "Inter",
      "fontWeight": 700,
      "fontSize": "32px",
      "lineHeight": 1.2,
      "letterSpacing": "-0.01em"
    }
  }
}
```

This is flattened to individual tokens:

```
semantic.font-family.heading.1  →  "Inter"
semantic.font-weight.heading.1  →  700
semantic.font-size.heading.1    →  2rem
semantic.line-height.heading.1  →  1.2
semantic.letter-spacing.heading.1 →  -0.01em
```

The original composite key is preserved in `_meta.source` for traceability.

---

## 4. Validation Rules

### 4.1 Schema validation

Each normalised token must satisfy:

| Field | Rule |
|---|---|
| `name` | 4-segment, kebab-case, no empty segments |
| `value` | Non-null, type-compatible with declared `$type` |
| `$type` | Must be a supported DS category |
| `layer` | Must be `primitive` or `semantic` (component blocked) |

### 4.2 Dependency graph validation

Before any semantic token is accepted, all its referenced primitive tokens must exist in the current DS primitive registry OR be present in the import batch.

**Error:** Semantic token references a primitive that does not exist and is not in the import.  
**Warning:** Semantic token references a primitive that exists but is deprecated.

### 4.3 Layer integrity enforcement

The validator checks write targets against the immutable layer map:

| Attempted write target | Result |
|---|---|
| `component.*` token | **Hard error** — blocked unconditionally |
| `base.*` token | **Hard error** — blocked unconditionally |
| `adapter.*` token | **Hard error** — blocked unconditionally |
| `primitive.*` token | Allowed — warning if overwriting existing |
| `semantic.*` token | Allowed — warning if value differs from current |

### 4.4 Circular reference detection

The validator builds a directed reference graph. A depth-first traversal detects cycles:

```
A → B → C → A   →   Error: circular reference chain detected
```

All tokens in the cycle are reported by name.

### 4.5 Missing primitive dependencies

If any imported semantic token references a primitive that does not exist:

- The token is flagged with `MISSING_PRIMITIVE`.
- The sync is blocked in **Overwrite** mode.
- In **Safe Merge** mode: the token is skipped, logged.
- In **New Theme** mode: the token is written with a fallback (see §6), flagged in the report.

### 4.6 Naming convention enforcement

All token names must match:

```
/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/
```

Tokens failing this regex are rejected at the transformer stage before reaching the validator.

---

## 5. Conflict Resolution Strategy

### 5.1 Conflict types

| Situation | Classification | Action |
|---|---|---|
| Token does not exist in DS | `NEW` | Accept |
| Token exists, identical value | `DUPLICATE` | Skip silently |
| Token exists, different value | `CONFLICT_VALUE` | Warning + queue for mode decision |
| Token renamed in Figma (old name missing, new name present) | `RENAMED` | Safe-rename proposal (see §5.2) |
| Token deleted in Figma (present in DS, absent in import) | `DEPRECATED` | Deprecation flag — never auto-delete |

### 5.2 Safe rename strategy

The transformer detects renames by matching token values. If:
- An existing DS token has a value X.
- The import contains a new name with the same value X.
- The old name is absent from the import.

Then a rename proposal is generated:

```
RENAME PROPOSAL:
  old: --semantic-color-brand-primary
  new: --semantic-color-brand-default
  value: #228be6  (unchanged)
  
  Action: Add new token. Add deprecation alias for old token.
  The old token is NOT deleted.
  A migration note is added to the sync report.
```

Manual confirmation is required before the rename is applied.

### 5.3 Conflict resolution summary

| Type | Warning | Error | Behavior |
|---|---|---|---|
| `NEW` | No | No | Accept |
| `DUPLICATE` | No | No | Skip |
| `CONFLICT_VALUE` | Yes | No (in merge/theme mode) / Yes (dry-run) | Queue |
| `RENAMED` | Yes | No | Propose + manual confirm |
| `DEPRECATED` | Yes | No | Flag, never delete |
| Layer violation | N/A | **Hard error** | Block |
| Missing dependency | Yes | Error in overwrite mode | Cascade fallback |

---

## 6. Missing Token Fallback Strategy

### 6.1 Semantic token with no primitive match

**Scenario:** Figma provides `semantic.color.accent.default: var(--primitive-color-purple-500)` but `primitive.color.purple.500` does not exist in the DS.

**Fallback cascade:**
1. Check if a value-equivalent primitive exists (same hex value). If yes → remap the reference.
2. If no equivalent: add the required primitive to the import batch as an auto-generated token. Mark as `AUTO_GENERATED`.
3. If primitive cannot be resolved: block the semantic token. Log as `UNRESOLVABLE`. Skip token.

### 6.2 Missing primitive

**Scenario:** Import contains only semantic tokens for a new category with no accompanying primitives.

**Policy:** Block all semantic tokens that depend on the missing primitives. Emit errors listing each missing primitive. The designer must either:
- Add primitives to the Figma export, or
- Manually map to existing DS primitives via the conflict resolver CLI prompt.

### 6.3 Missing shadow tokens

**Scenario:** Shadow token is partially defined (e.g., color provided but blur missing).

**Policy:** Reject the incomplete shadow token. Emit a structured error listing the missing sub-properties. Partial shadows are not emitted.

### 6.4 Missing typography tokens

**Scenario:** Typography composite is missing `fontFamily` but has `fontSize` and `fontWeight`.

**Policy:** Incomplete composites are flattened partially — only complete sub-tokens are imported. Missing sub-properties are listed in the sync report as `PARTIAL_COMPOSITE`. The import continues for the valid sub-tokens.

---

## 7. Version Compatibility Handling

### 7.1 Version detection

The Figma plugin stamps every export with:

```json
{
  "_meta": {
    "dsVersion": "1.2.0",
    "exportDate": "2026-02-22T10:00:00Z",
    "format": "token-studio"
  }
}
```

The sync engine reads `dsVersion` and compares it to the current DS version.

### 7.2 Version compatibility matrix

| DS Version | Import Version | Action |
|---|---|---|
| `1.2.0` | `1.2.x` | Accept — patch diff permitted |
| `1.2.0` | `1.1.x` | Warning — minor downgrade, inspect report |
| `1.2.0` | `1.0.x` | Warning — minor downgrade; require `--force-minor` flag |
| `1.2.0` | `2.x.x` | **Error** — major version mismatch; blocked by default |
| `1.2.0` | `0.x.x` | **Error** — pre-release mismatch; blocked |

### 7.3 Deprecated token handling

Any token in the DS registry tagged with `@deprecated` will:

1. Accept incoming values without error.
2. Emit a warning: "Token is deprecated. Avoid new dependencies."
3. Include a `migration_note` in the sync report pointing to the replacement token.

### 7.4 Breaking change prevention

The sync engine enforces a **breaking change rule**:

- Deleting a semantic token that is referenced by any component token → **Hard error**.
- Renaming a semantic token without providing a deprecation alias → **Hard error**.
- Changing a primitive value referenced directly by a structural exception in a component → **Warning**.

These errors block the sync. They cannot be bypassed without a major version bump.

### 7.5 Migration report auto-generation

Every sync produces a `sync-report-{timestamp}.md` file:

```
sync-report-20260222-1430.md
├── Summary: 12 added, 3 modified, 1 deprecated, 0 errors, 4 warnings
├── Added tokens (12)
├── Modified tokens (3)  ← includes before/after values
├── Deprecated tokens (1)
├── Conflicts queued (0)
├── Warnings (4)
├── Errors (0)
├── Version impact: MINOR bump recommended (new tokens added)
└── Rollback: git stash  OR  restore from backup/tokens-pre-sync-{timestamp}/
```

---

## 8. Sync Modes

### Mode A — Overwrite Semantic Layer

**What it does:**  
Replaces all semantic tokens in the DS token registry with the imported values.

**Write targets:**  
`scss/tokens/_semantic.*.scss` (or equivalent JSON source files)

**Primitive layer:**  
Untouched unless import includes new primitives.

**Component tokens:**  
**Never touched.**

**Requirements before execution:**
- Validation report must be error-free.
- Conflict report must have zero unresolved `CONFLICT_VALUE` entries.
- Dry-run diff must be confirmed by operator.

**Risks:**
- Overwrites all current semantic token values.
- If semantic tokens are renamed, component token resolution may break until pipeline rebuild confirms no dangling references.
- Highest risk mode — all theme-sensitive UI changes immediately.

**Appropriate use cases:**  
Major design system refresh. Brand rebrand. Intentional full semantic layer replacement.

---

### Mode B — Create New Theme

**What it does:**  
Generates an isolated `theme-{id}.json` file. Does not touch the existing token registry.

**Write targets:**  
`tokens/themes/theme-{id}.json` (new file only)

**Existing files:**  
**Never modified.**

**Requirements before execution:**  
Validation report error-free. No confirmation of conflicts required — conflicts are irrelevant (isolated file).

**Risks:**  
Near-zero risk. The new theme file is not active until explicitly loaded.

**Appropriate use cases:**  
Brand variants. White-label themes. A/B design experiments. Client-specific theming.

---

### Mode C — Safe Merge

**What it does:**  
Adds only net-new tokens. Skips any token that already exists in the registry regardless of value difference.

**Write targets:**  
Appends to existing `_semantic.*.scss` / `_primitives.*.scss` source files.

**Overwrite:**  
Never. Existing tokens are immutable in this mode.

**Logged:**  
All skipped tokens are listed in the sync report with reason `SKIPPED_EXISTS`.

**Requirements before execution:**  
Validation report error-free.

**Risks:**  
Low. Additive only. No existing token values change. The only risk is namespace pollution from poorly named new tokens.

**Appropriate use cases:**  
Adding a new token category (e.g., new `semantic.shadow.*` scale). Adding new primitives for a new palette. Conservative incremental sync.

---

## 9. Component Architecture Design

### 9.1 Figma Plugin — Export Contract

**Responsibilities:**
- Present token selection UI to the designer.
- Validate naming convention before export (4-segment enforcement in plugin UI).
- Attach `_meta` block: `dsVersion`, `exportDate`, `format`.
- Export as `tokens.json` (flat structure) or `tokens.zip` (grouped by category).

**Required metadata per token:**
```
name         : string  — 4-segment kebab
value        : any     — literal or alias reference {group.name}
$type        : string  — color | typography | spacing | radius | shadow
$description : string  — optional, passed through to sync report
$deprecated  : boolean — optional, flags token in import
```

**Version tagging:**  
The plugin reads the `dsVersion` from a published manifest endpoint or config file. It cannot inject an arbitrary version.

---

### 9.2 JSON Transformer

**Responsibilities:**
1. Detect input format (Token Studio / W3C / raw).
2. Traverse the token tree, normalise each token.
3. Flatten typography composites.
4. Resolve alias references for dependency validation.
5. Output a flat normalised token map with `layer` classification.

**Key internal modules:**
- `FormatDetector` — identifies input format from structure heuristics.
- `NameNormaliser` — applies 4-segment normalisation rules.
- `UnitNormaliser` — px→rem, format standardisation.
- `ColorNormaliser` — hex/rgb/hsl unification.
- `TypographyFlattener` — composite → flat.
- `AliasResolver` — resolves `{token.name}` references to values.
- `LayerClassifier` — assigns `primitive | semantic | unknown` based on name prefix.

---

### 9.3 Token Validator

**Responsibilities:**
1. Schema validation on normalised token map.
2. Layer integrity check — blocks component/base/adapter writes.
3. Dependency graph build + circular reference check.
4. Missing primitive detection.
5. Version compatibility check.
6. Emit `ValidationReport`.

**Validation is always run before any file write.**  
**Sync cannot proceed past the validator with any hard error present.**

---

### 9.4 Theme Generator

**Responsibilities (Mode-dependent):**

| Mode | Action |
|---|---|
| A — Overwrite | Write normalised token map into existing token source files |
| B — New Theme | Write `theme-{id}.json` to themes/ directory |
| C — Safe Merge | Append new-only tokens to existing source files |

**After write:**  
Triggers the existing DS build pipeline (Sass compile → CSS output).  
Build failure is treated as a **sync error** — the generated files are rolled back.

---

### 9.5 Sync Report Engine

**Output:** `sync-report-{timestamp}.md` — committed alongside token changes.

**Sections:**
1. **Summary** — counts by category.
2. **Added tokens** — name, layer, value, source.
3. **Modified tokens** — name, old value, new value.
4. **Deprecated tokens** — name, replacement pointer.
5. **Skipped tokens** — name, reason.
6. **Conflicts** — name, conflict type, resolution decision.
7. **Warnings** — full list with context.
8. **Errors** — full list with blocking reason.
9. **Version impact** — PATCH / MINOR / MAJOR recommendation.
10. **Rollback instructions** — exact command to restore pre-sync state.

---

## 10. Security & Safety Guarantees

### 10.1 Dry-run mode (default)

**All sync runs are dry-run by default.**  
No file is written, no pipeline is triggered.

Dry-run output:
- `ValidationReport`
- `ConflictReport`
- Full diff preview (before/after for every affected token)
- Version impact assessment

Write operations require explicit `--commit` flag.

### 10.2 Pre-commit diff

Before any file write, the engine generates a structured diff:

```
[MODIFIED]  --semantic-color-brand-default
  before:  var(--primitive-color-blue-600)  →  #228be6
  after:   var(--primitive-color-blue-700)  →  #1c7ed6

[ADDED]     --semantic-color-brand-tonal-hover-strong
  value:   var(--primitive-color-blue-200)  →  #a5d8ff
```

The operator must inspect and confirm this diff before the `--commit` flag is accepted.

### 10.3 Automatic backup

Before any write, the engine creates:

```
backup/tokens-pre-sync-{timestamp}/
├── _primitives.color.scss
├── _semantic.color.scss
├── _semantic.spacing.scss
├── _semantic.typography.scss
└── (all token source files)
```

### 10.4 Rollback

Rollback restores the backup directory to its original path:

```
sync rollback --timestamp 20260222-1430
```

This is a file-copy operation — no git required, though git stash/revert is also documented as an alternative.

### 10.5 No-op safety net

If the build pipeline fails after a Theme Generator write:
- All written files are reverted from the pre-sync backup automatically.
- The sync report records the build failure.
- The operator is notified. No partial state is left.

---

## 11. Forbidden Operations — Absolute Rules

These rules cannot be overridden by any flag, mode, or operator confirmation:

| Rule | Description |
|---|---|
| **COMP-LOCK** | Component tokens (`--component-*`) are never written by the sync engine. |
| **BASE-LOCK** | Base contract tokens (`--base-*`) are never written. |
| **ADAPTER-LOCK** | Adapter files are never touched. |
| **NO-RAW-COMPONENT** | The sync engine never writes raw values into component SCSS files. |
| **NO-AUTO-DELETE** | Tokens are never deleted automatically. Only flagged as deprecated. |
| **NO-SILENT-OVERWRITE** | Value changes are never written without warning + explicit confirmation. |
| **NO-PARTIAL-STATE** | On build failure, all writes are reverted. No partial token state is persisted. |

---

*Document: Phase 8 · Figma Token Sync Architecture*  
*Design System — Framework-Agnostic*  
*Status: Design complete. Implementation deferred to Phase 9.*
