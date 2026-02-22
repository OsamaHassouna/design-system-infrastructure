--------------------------------------------------------------------

# TOKEN ENGINE CONTRACT — v1.0.0
# Effective: 2026-02-21
# Status: RATIFIED
# Depends on: PHASE 1 — ARCHITECTURE CONTRACT v1.0.0

--------------------------------------------------------------------

## PART I — TOKEN TAXONOMY

The token system has exactly three layers, ordered from lowest to highest abstraction.
Reference direction is strictly unidirectional downward. No cross-layer or upward references.

```
REFERENCE DIRECTION:

  component tokens
    └── reference semantic tokens only
          └── reference primitive tokens only
                └── raw values only (no references)
```

| Layer | Type Key | May Reference | Raw Values Allowed |
|---|---|---|---|
| 1 | `primitive` | nothing | yes — only layer where raw values are legal |
| 2 | `semantic` | `primitive` only | no |
| 3 | `component` | `semantic` only | no |

**Violation of reference direction is a build error, not a warning.**

--------------------------------------------------------------------

## PART II — JSON SCHEMA SPECIFICATION

### 2.1 — Master Token File Structure

Every token is an entry in the flat token registry. The file contains one top-level object with three required keys.

```json
{
  "$schema": "./token-schema.json",
  "$version": "1.2.0",
  "primitive": { },
  "semantic":  { },
  "component": { }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `$schema` | string | yes | Path to the JSON Schema file that validates this document |
| `$version` | string | yes | SemVer of the token registry. Must increment per Phase 1 rules |
| `primitive` | object | yes | All raw value tokens |
| `semantic` | object | yes | All alias tokens referencing primitives |
| `component` | object | yes | All component-scoped tokens referencing semantics |

---

### 2.2 — Token Entry Schema

Every token, regardless of layer, conforms to this structure:

```json
"<token-name>": {
  "value":       "<raw value> | {ref:<token-name>}",
  "type":        "color | spacing | typography | radius | shadow | motion | z-index | breakpoint",
  "layer":       "primitive | semantic | component",
  "description": "Human-readable description of the token's purpose.",
  "deprecated":  false,
  "deprecatedSince": null,
  "replacedBy":  null
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `value` | string or `{ref}` object | yes | Primitives: raw string. Semantic/Component: `{ref: "<token-name>"}` only |
| `type` | enum string | yes | Must be one of the eight defined type values |
| `layer` | enum string | yes | Must match the parent key (`primitive`, `semantic`, `component`) |
| `description` | string | yes | Must be non-empty. Tooling rejects empty descriptions |
| `deprecated` | boolean | yes | Defaults to `false`. Set `true` to begin deprecation window |
| `deprecatedSince` | string or null | yes | SemVer of the registry version when deprecated. Null if not deprecated |
| `replacedBy` | string or null | yes | Token name of the replacement. Required when `deprecated: true` |

---

### 2.3 — Reference Object Syntax

References are expressed as a structured object, never as an interpolated string (e.g., no `"{color.blue.500}"` string syntax).

```json
{ "ref": "color-blue-500" }
```

- The `ref` value must be the exact token name as it appears in the registry.
- The referenced token must exist in a lower layer.
- The referenced token must be of the same `type` as the referencing token.
- Circular references are structurally impossible when this rule is enforced (a lower-layer token cannot reference a higher-layer token).

---

### 2.4 — Token Naming Convention (mandatory)

All token names at all layers follow this pattern:

```
{category}-{variant}-{qualifier?}-{state?}
```

| Segment | Required | Examples |
|---|---|---|
| `category` | yes | `color`, `spacing`, `radius`, `shadow`, `font-size`, `font-weight`, `motion`, `z-index` |
| `variant` | yes | `primary`, `neutral`, `danger`, `blue`, `sm`, `md`, `lg` |
| `qualifier` | no | `surface`, `border`, `text`, `500`, `100` |
| `state` | no | `default`, `hover`, `active`, `disabled`, `focus` |

**Examples:**
- `color-blue-500` (primitive)
- `color-primary-default` (semantic)
- `color-btn-bg-default` (component)
- `spacing-md` (primitive)
- `spacing-component-padding-md` (component)

**Enforcement rules:**
- Names are lowercase, hyphen-separated only. No underscores, camelCase, or dots.
- Names are globally unique across all three layers.
- Non-compliant names are rejected at contribution time by linting.

--------------------------------------------------------------------

## PART III — FULL EXAMPLE: tokens.json

```json
{
  "$schema": "./token-schema.json",
  "$version": "1.0.0",

  "primitive": {

    "color-blue-100": {
      "value": "#dbeafe",
      "type": "color",
      "layer": "primitive",
      "description": "Lightest blue, used for tints and backgrounds.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-blue-500": {
      "value": "#3b82f6",
      "type": "color",
      "layer": "primitive",
      "description": "Core mid-range blue.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-blue-700": {
      "value": "#1d4ed8",
      "type": "color",
      "layer": "primitive",
      "description": "Dark blue for pressed states.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-neutral-000": {
      "value": "#ffffff",
      "type": "color",
      "layer": "primitive",
      "description": "Pure white.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-neutral-900": {
      "value": "#111827",
      "type": "color",
      "layer": "primitive",
      "description": "Near-black, primary text base.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-neutral-100": {
      "value": "#f3f4f6",
      "type": "color",
      "layer": "primitive",
      "description": "Light grey surface.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-4": {
      "value": "4px",
      "type": "spacing",
      "layer": "primitive",
      "description": "4px base unit.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-8": {
      "value": "8px",
      "type": "spacing",
      "layer": "primitive",
      "description": "8px base unit.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-12": {
      "value": "12px",
      "type": "spacing",
      "layer": "primitive",
      "description": "12px base unit.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-16": {
      "value": "16px",
      "type": "spacing",
      "layer": "primitive",
      "description": "16px base unit.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "radius-sm": {
      "value": "4px",
      "type": "radius",
      "layer": "primitive",
      "description": "Small border radius.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "radius-md": {
      "value": "8px",
      "type": "radius",
      "layer": "primitive",
      "description": "Medium border radius.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "font-size-sm": {
      "value": "14px",
      "type": "typography",
      "layer": "primitive",
      "description": "Small body text size.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "font-size-base": {
      "value": "16px",
      "type": "typography",
      "layer": "primitive",
      "description": "Base body text size.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "font-weight-normal": {
      "value": "400",
      "type": "typography",
      "layer": "primitive",
      "description": "Normal font weight.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "font-weight-semibold": {
      "value": "600",
      "type": "typography",
      "layer": "primitive",
      "description": "Semibold font weight.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    }
  },

  "semantic": {

    "color-primary-default": {
      "value": { "ref": "color-blue-500" },
      "type": "color",
      "layer": "semantic",
      "description": "Primary brand action color.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-primary-hover": {
      "value": { "ref": "color-blue-700" },
      "type": "color",
      "layer": "semantic",
      "description": "Primary brand color on hover.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-primary-subtle": {
      "value": { "ref": "color-blue-100" },
      "type": "color",
      "layer": "semantic",
      "description": "Tinted background for primary contexts.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-surface-default": {
      "value": { "ref": "color-neutral-000" },
      "type": "color",
      "layer": "semantic",
      "description": "Default page and card background.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-surface-muted": {
      "value": { "ref": "color-neutral-100" },
      "type": "color",
      "layer": "semantic",
      "description": "Muted surface for secondary backgrounds.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-text-default": {
      "value": { "ref": "color-neutral-900" },
      "type": "color",
      "layer": "semantic",
      "description": "Default body text color.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-text-on-primary": {
      "value": { "ref": "color-neutral-000" },
      "type": "color",
      "layer": "semantic",
      "description": "Text placed on primary-colored backgrounds.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-component-sm": {
      "value": { "ref": "spacing-8" },
      "type": "spacing",
      "layer": "semantic",
      "description": "Small component internal spacing.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-component-md": {
      "value": { "ref": "spacing-12" },
      "type": "spacing",
      "layer": "semantic",
      "description": "Medium component internal spacing.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-component-lg": {
      "value": { "ref": "spacing-16" },
      "type": "spacing",
      "layer": "semantic",
      "description": "Large component internal spacing.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "radius-component-default": {
      "value": { "ref": "radius-sm" },
      "type": "radius",
      "layer": "semantic",
      "description": "Default border radius for interactive components.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    }
  },

  "component": {

    "color-btn-bg-default": {
      "value": { "ref": "color-primary-default" },
      "type": "color",
      "layer": "component",
      "description": "Button background in its default resting state.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-btn-bg-hover": {
      "value": { "ref": "color-primary-hover" },
      "type": "color",
      "layer": "component",
      "description": "Button background on pointer hover.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "color-btn-text-default": {
      "value": { "ref": "color-text-on-primary" },
      "type": "color",
      "layer": "component",
      "description": "Button label text color.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-btn-padding-x": {
      "value": { "ref": "spacing-component-lg" },
      "type": "spacing",
      "layer": "component",
      "description": "Button horizontal padding.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "spacing-btn-padding-y": {
      "value": { "ref": "spacing-component-sm" },
      "type": "spacing",
      "layer": "component",
      "description": "Button vertical padding.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    },
    "radius-btn-default": {
      "value": { "ref": "radius-component-default" },
      "type": "radius",
      "layer": "component",
      "description": "Button border radius.",
      "deprecated": false,
      "deprecatedSince": null,
      "replacedBy": null
    }
  }
}
```

--------------------------------------------------------------------

## PART IV — REFERENCE VALIDATION & CIRCULAR REFERENCE PREVENTION

### 4.1 — Reference Resolution Algorithm

At validation time, the validator executes the following steps in order:

1. **Load registry.** Parse the full token file into memory. Reject on JSON syntax error.
2. **Layer index.** Build three separate maps: `primitiveMap`, `semanticMap`, `componentMap`.
3. **Primitive pass.** Iterate all primitive tokens. Assert `value` is a raw string, never a `{ref}` object. Fail on any `{ref}` found.
4. **Semantic pass.** For each semantic token with a `{ref}` value:
   a. Assert the referenced name exists in `primitiveMap`. Fail if not found.
   b. Assert the referenced token's `type` matches the current token's `type`. Fail if mismatched.
   c. Assert the referenced token is not deprecated without a `replacedBy` chain leading to a live token.
5. **Component pass.** For each component token with a `{ref}` value:
   a. Assert the referenced name exists in `semanticMap`. Fail if not found.
   b. Assert the referenced token's `type` matches. Fail if mismatched.
   c. Assert the referenced token is not deprecated without a valid replacement.
6. **Uniqueness pass.** Assert every token name is globally unique across all three maps.
7. **Naming convention pass.** Assert every token name matches the pattern `{category}-{variant}(-{qualifier})*(-{state})?` with lowercase hyphen-separated segments only.

**Circular references are architecturally impossible** because:
- Primitives have no references.
- Semantics reference only primitives (which have no references).
- Components reference only semantics (which only reference primitives).
- No token at any layer is permitted to reference its own layer or any layer above it.

No graph cycle detection is needed. Layer boundary enforcement eliminates the possibility structurally.

### 4.2 — Type Consistency Rule

A reference must preserve the `type` of the token it references. A `color` token may only reference another `color` token. A `spacing` token may only reference another `spacing` token. Mixed-type references are a validation error.

This prevents semantic corruption where a token name implies one meaning but the value resolves to a different category.

--------------------------------------------------------------------

## PART V — THEME OVERRIDE CONTRACT

### 5.1 — What a Theme File Contains

A theme file contains only value overrides for existing tokens. It has no `layer` declarations, no new token definitions, and no structural changes.

```json
{
  "$schema": "./theme-schema.json",
  "$themeId": "dark",
  "$version": "1.0.0",
  "$baseRegistryVersion": "1.0.0",
  "overrides": {
    "color-blue-500":      { "value": "#60a5fa" },
    "color-blue-700":      { "value": "#3b82f6" },
    "color-neutral-000":   { "value": "#0f172a" },
    "color-neutral-100":   { "value": "#1e293b" },
    "color-neutral-900":   { "value": "#f1f5f9" }
  }
}
```

| Field | Required | Rules |
|---|---|---|
| `$themeId` | yes | Unique identifier for the theme. Lowercase hyphen-separated |
| `$version` | yes | SemVer of this theme file |
| `$baseRegistryVersion` | yes | The registry version this theme was authored against. Used for compat validation |
| `overrides` | yes | A flat map of `token-name → {value}` pairs. Only `value` may be provided. Layer, type, description are immutable |

### 5.2 — Theme Validation Rules

1. Every key in `overrides` must exist in the token registry. Unknown token names are a build error.
2. Only primitive token names may appear in `overrides`. Themes override raw values at the primitive layer; semantic and component resolution flows naturally from there.
3. The `value` being overridden must remain the same `type` as the original token. You cannot override a `color` token with a `spacing` value.
4. Themes must not add new keys outside `overrides`. Structural additions are rejected by schema validation.
5. `$baseRegistryVersion` is compared against the current registry version. If the registry has had a MAJOR bump since the theme was authored, the build emits an error requiring a theme audit.

### 5.3 — Fallback Strategy for Missing Tokens

When a theme does not override a token, the base registry value is used automatically. This is the universal fallback.

```
resolved value = theme.overrides[token-name]?.value ?? registry[token-name].value
```

No explicit fallback declaration is needed in the theme file. The resolution is deterministic and total: every token has a value in the base registry, so no token can be undefined at runtime.

**Fallback chain for deprecated tokens:**
```
if token is deprecated and replacedBy is set:
    resolved value = resolve(replacedBy)
else if token is deprecated and replacedBy is null:
    BUILD ERROR — deprecated token has no replacement declared
else:
    resolved value = token.value
```

This ensures deprecated tokens with a declared replacement continue to resolve correctly without requiring theme authors to update immediately.

--------------------------------------------------------------------

## PART VI — ADDING NEW COMPONENT TOKENS SAFELY

### 6.1 — Rules for Safe Addition

Adding a new component token is a **MINOR** registry version increment. The following rules guarantee it does not break existing themes:

1. **New component tokens always start with a semantic reference.** They must reference an existing semantic token. They cannot introduce new raw values.
2. **New component tokens are additive only.** They do not rename, remove, or alter existing tokens.
3. **Existing themes are unaffected.** Themes override primitive values. A new component token that references existing semantics (which reference existing primitives) automatically inherits any theme overrides without any theme file modification.
4. **No theme file changes required.** An existing dark theme that overrides `color-blue-500` will automatically apply that override to any new component token that resolves through `color-primary-default → color-blue-500`.

### 6.2 — Example: Adding a new Badge component token

Adding these three component tokens to `tokens.json`:

```json
"color-badge-bg-default": {
  "value": { "ref": "color-primary-subtle" },
  "type": "color",
  "layer": "component",
  "description": "Badge background in default state.",
  "deprecated": false,
  "deprecatedSince": null,
  "replacedBy": null
},
"color-badge-text-default": {
  "value": { "ref": "color-primary-default" },
  "type": "color",
  "layer": "component",
  "description": "Badge label text color.",
  "deprecated": false,
  "deprecatedSince": null,
  "replacedBy": null
},
"spacing-badge-padding-x": {
  "value": { "ref": "spacing-component-sm" },
  "type": "spacing",
  "layer": "component",
  "description": "Badge horizontal padding.",
  "deprecated": false,
  "deprecatedSince": null,
  "replacedBy": null
}
```

**Result:** Registry version bumps from `1.0.0` → `1.1.0`. All existing themes are valid without modification. The dark theme automatically applies its `color-blue-100`, `color-blue-500` overrides to the badge tokens through the resolution chain.

--------------------------------------------------------------------

## PART VII — DEPRECATION STRATEGY

### 7.1 — Deprecation Lifecycle

```
ACTIVE  →  DEPRECATED (MINOR bump)  →  REMOVED (MAJOR bump, min 1 full major version later)
```

**Step 1 — Mark deprecated (MINOR bump):**

```json
"color-blue-500": {
  "value": "#3b82f6",
  "type": "color",
  "layer": "primitive",
  "description": "Core mid-range blue. DEPRECATED: use color-brand-500.",
  "deprecated": true,
  "deprecatedSince": "1.2.0",
  "replacedBy": "color-brand-500"
}
```

At this step:
- The token remains fully functional. All references to it continue to resolve.
- Build emits a WARNING for any token that directly references a deprecated token.
- Theme authors are notified but no immediate action is required.
- The new replacement token (`color-brand-500`) must be added in the same release.

**Step 2 — Deprecation window:** The deprecated token must remain present for at least one full MAJOR version. It cannot be removed in the same MAJOR version it was deprecated in.

**Step 3 — Remove token (MAJOR bump):**

The token entry is deleted from the registry. At this point:
- Any token still referencing the removed token produces a BUILD ERROR.
- Any theme override targeting the removed token produces a BUILD ERROR.
- The migration guide for this MAJOR release must document every affected reference and its replacement.

### 7.2 — Versioning Table for Deprecation

| Event | Version Bump | Build Behavior |
|---|---|---|
| Add replacement token + mark old as deprecated | MINOR | WARNING on references to deprecated token |
| Update references from deprecated to replacement | PATCH | WARNINGs clear |
| Remove deprecated token | MAJOR | ERROR if any references remain |

### 7.3 — Deprecation Window Enforcement

The validator checks: if a token is being removed in this release, assert that `deprecated: true` was present in the previous MAJOR version's registry. If the token was never marked deprecated before removal, the build is rejected.

--------------------------------------------------------------------

## PART VIII — MERGE SIMULATION

### Scenario

**Starting state:** Registry at `v1.0.0` with the tokens defined in Part III. Dark theme at `v1.0.0`.

**Incoming change:** A contributor branch adds the Badge component tokens from Part VI.

---

### Step 1 — Pre-Merge Collision Check

The merge pipeline diffs the incoming token names against the current registry:

```
Incoming new names:
  color-badge-bg-default     → NOT in registry → ADDITIVE ✓
  color-badge-text-default   → NOT in registry → ADDITIVE ✓
  spacing-badge-padding-x    → NOT in registry → ADDITIVE ✓

Incoming modified names:
  (none)

Incoming removed names:
  (none)
```

Result: No collisions. Merge is permitted to proceed.

---

### Step 2 — Change Classification

All three tokens are new additions with no existing name conflicts.
Classification: **MINOR** (new tokens added, no existing tokens changed or removed).
Registry version: `1.0.0` → `1.1.0`.

---

### Step 3 — Theme Compatibility Check

Dark theme `$baseRegistryVersion: "1.0.0"`. New registry is `1.1.0`. This is a MINOR bump — no audit required. Theme is automatically valid.

Verify that the new tokens resolve correctly under the dark theme:

```
color-badge-bg-default
  → ref: color-primary-subtle (semantic)
    → ref: color-blue-100 (primitive)
      → dark theme override: "#dbeafe" (no override present for color-blue-100)
      → fallback: registry value "#dbeafe"  ✓

color-badge-text-default
  → ref: color-primary-default (semantic)
    → ref: color-blue-500 (primitive)
      → dark theme override: "#60a5fa"  ✓  (applied automatically)

spacing-badge-padding-x
  → ref: spacing-component-sm (semantic)
    → ref: spacing-8 (primitive)
      → no theme override (spacing not overridden in dark theme)
      → fallback: registry value "8px"  ✓
```

All three new tokens resolve correctly under the dark theme with zero theme file changes.

---

### Step 4 — Conflict Resolution (demonstrating a conflict case)

**Hypothetical:** A second contributor branch simultaneously modified `color-badge-bg-default` with a different semantic reference.

```
Branch A: "color-badge-bg-default" → { "ref": "color-primary-subtle" }
Branch B: "color-badge-bg-default" → { "ref": "color-surface-muted"  }
```

Resolution per Phase 1 rules:
1. The merge pipeline detects a **name collision between two incoming branches**.
2. The merge is **blocked**. Neither branch may merge until the conflict is resolved.
3. The resolution must be deliberate: a human decision is required to choose or reconcile the value.
4. The resolving commit produces a MINOR bump (still additive) with the conflict documented in the token changelog.
5. An auto-merge of a token value conflict is **forbidden** regardless of tooling capability.

---

### Step 5 — Audit Log Entry

```
TOKEN CHANGELOG
Version: 1.1.0
Date: 2026-02-21
Author: contributor-branch-badge

ADDED (3):
  + color-badge-bg-default      [component / color]
  + color-badge-text-default    [component / color]
  + spacing-badge-padding-x     [component / spacing]

MODIFIED (0): —
DEPRECATED (0): —
REMOVED (0): —

Theme compatibility: all existing themes valid, no action required.
```

--------------------------------------------------------------------

## PART IX — SCHEMA EXTENSIBILITY RULES

The token schema is designed to accommodate future token categories without breaking existing tokens or tooling.

1. **New `type` values** (e.g., `border`, `opacity`, `elevation`) may be added as MINOR changes to the schema. Existing validation passes are unaffected because they check `type` only within the tokens that use them.
2. **New optional fields** on a token entry (e.g., `platforms`, `figmaId`, `a11yNote`) may be added as MINOR changes. Validators must be written to ignore unknown optional fields (open content model for reading, strict model for writing).
3. **New required fields** on a token entry are MAJOR schema changes and require a migration tool that backfills the new field across all existing tokens.
4. **New token layers** are not permitted. The three-layer taxonomy (primitive / semantic / component) is fixed in this contract. Introducing a fourth layer requires a new major architecture contract version.
5. **Namespace extensions** (adding a new `category` prefix in the naming convention) are a MINOR change provided the new prefix does not collide with any existing token names.

--------------------------------------------------------------------

## CONTRACT SIGNATURE

This document is the authoritative Token Engine specification.
All token file authoring, validation tooling, theme authoring, and merge tooling must comply with this contract.
Amendments require a version increment of this document and cross-reference update in PHASE 1 contract.

Contract version: 1.0.0
Issued: 2026-02-21
Depends on: PHASE 1 — ARCHITECTURE CONTRACT v1.0.0