--------------------------------------------------------------------

# ARCHITECTURE CONTRACT — v1.0.0
# Effective: 2026-02-21
# Status: RATIFIED

--------------------------------------------------------------------

## PART I — LAYERED ARCHITECTURE

The system is composed of exactly six layers, ordered from lowest to highest abstraction.
Dependency flow is strictly unidirectional: higher layers depend on lower layers.
No layer may depend on a layer above it. No exceptions.

```
DEPENDENCY DIRECTION (each layer may depend on the layers listed to its right):

  tokens      →  (nothing)
  base        →  tokens
  utilities   →  tokens, base
  components  →  tokens, base, utilities
  themes      →  tokens only
  adapters    →  tokens, base, utilities, components, themes
               +  declared external framework/library peer dependency

CRITICAL: The dependency graph is NOT a linear chain.
  components do NOT depend on themes.
  themes do NOT depend on base, utilities, or components.
  No upward dependencies exist anywhere in the graph.
```

---

### LAYER 1 — tokens

**Responsibilities:**
- Define every raw design value in the system: color, spacing, typography, radius, shadow, motion, z-index, breakpoint.
- Serve as the single source of truth for all visual decisions.
- Expose values as platform-neutral named constants (design token format).
- Maintain a versioned, auditable registry of all token names and values.

**May depend on:** nothing.

**Must NEVER depend on:** base, utilities, components, themes, adapters, any framework, any runtime.

**Update rules:**
- Token names are immutable once published. Renaming = deprecation + new token.
- Token values may change only via a versioned release.
- Removing a token requires a major version bump and a minimum one-version deprecation window.
- Adding a token is a minor change.
- Changing a token value is a patch if cosmetic, minor if it alters layout geometry, major if it breaks existing visual contracts.

---

### LAYER 2 — base

**Responsibilities:**
- Define CSS reset and normalization rules that apply globally.
- Define typographic rhythm and root-level CSS custom property declarations that expose tokens as CSS variables.
- Establish the baseline rendering environment.

**May depend on:** tokens only.

**Must NEVER depend on:** utilities, components, themes, adapters, any JavaScript framework, any component library.

**Update rules:**
- Changes to reset rules require a minor version bump.
- Adding new CSS variable declarations derived from tokens is a patch.
- Any change that alters vertical rhythm or box-model assumptions requires a major version bump.

---

### LAYER 3 — utilities

**Responsibilities:**
- Provide atomic, single-purpose CSS utility classes and mixins.
- All values used in utilities must reference tokens via CSS custom properties or build-time token references. No raw values permitted.
- Utilities are stateless and have no knowledge of components or themes.

**May depend on:** tokens, base.

**Must NEVER depend on:** components, themes, adapters, any framework-specific construct.

**Update rules:**
- Adding a utility class is a minor change.
- Renaming or removing a utility class requires a major version bump preceded by deprecation.
- Changing the underlying token a utility references is a minor change if visually equivalent, major if not.

---

### LAYER 4 — components

**Responsibilities:**
- Define structural, semantic HTML patterns and associated CSS for UI elements.
- All style values must be derived from tokens via CSS custom properties. No hardcoded values.
- Components expose a stable public API of CSS custom property overrides scoped to their namespace (e.g., `--btn-bg`). These override slots reference tokens; they do not define new raw values.
- Components are framework-agnostic: they are defined as HTML structure + CSS. No JavaScript framework dependency at this layer.
- Components must not implement theming logic. They consume theme-provided token overrides passively.

**May depend on:** tokens, base, utilities.

**Must NEVER depend on:** themes, adapters, any JavaScript framework (React, Angular, Vue, etc.), any third-party component library.

**Update rules:**
- Adding a new component is a minor change.
- Adding a new override slot to an existing component is a minor change.
- Removing or renaming an override slot is a major change.
- Structural HTML changes that break slot or selector contracts are major changes.
- Internal refactors with no public API change are patches.

---

### LAYER 5 — themes

**Responsibilities:**
- Override token values for a specific visual context (brand, dark mode, high-contrast, tenant).
- Themes operate exclusively by reassigning CSS custom property values. They do NOT add new CSS rules. They do NOT introduce new selectors beyond the theme scope selector.
- A theme is a map of token overrides, nothing more.

**May depend on:** tokens only. (A theme overrides tokens; it must not reference components or utilities directly.)

**Must NEVER depend on:** base, utilities, components, adapters, any framework.
**Themes must NEVER:** write CSS property rules (e.g., `color: red`), override component-internal selectors, add layout rules, or reference component class names.

**Update rules:**
- Adding a theme is a minor change.
- Modifying token override values within a theme is a patch.
- Removing a theme requires a major version bump.
- A theme must remain valid against the token registry; orphaned token references (referencing a removed token) are a build error.

---

### LAYER 6 — adapters

**Responsibilities:**
- Wrap framework-agnostic components for consumption in a specific framework (React, Angular, Vue, etc.) or a specific third-party library (PrimeNG, Material, etc.).
- Adapters handle event binding, prop mapping, slot translation, and framework lifecycle concerns.
- Adapters must not redefine tokens, base styles, utilities, or component CSS. They only bridge the API surface.
- Each adapter is versioned independently.

**May depend on:** tokens, base, utilities, components, themes. Also depends on its specific target framework/library as an explicit, declared external dependency.

**Must NEVER depend on:** other adapters. Each adapter is fully isolated from every other adapter.

**Update rules:**
- Adapter changes are versioned independently from the core system.
- An adapter update that requires a new minimum core version must declare that constraint explicitly in its manifest.
- Breaking changes in an adapter require a major bump in the adapter's own version, not in the core system version.

--------------------------------------------------------------------

## PART II — VERSIONING STRATEGY

### Token Versioning

The token registry follows Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`.

| Change Type | Version Bump |
|---|---|
| Add new token | MINOR |
| Change token value (cosmetic, no geometry impact) | PATCH |
| Change token value (geometry, spacing, layout impact) | MINOR |
| Change token value (breaks visual contract with consumers) | MAJOR |
| Deprecate token (still present, marked deprecated) | MINOR |
| Remove deprecated token | MAJOR |
| Rename token | MAJOR (old name must be aliased for one full major version) |

**Token Merge Strategy (mandatory):**

When merging a new token set (from a branch, from a Figma sync, or from a contributor PR):

1. **Collision check first.** Before merge, diff the incoming token names against the current registry. Any name collision must be resolved before merge proceeds. Merge is blocked until resolved.
2. **New tokens are additive.** New token names with no conflict are merged as a MINOR increment.
3. **Value conflicts.** If an incoming token changes the value of an existing token, the change is classified (PATCH / MINOR / MAJOR) per the table above. A MAJOR classification requires explicit ratification; it cannot be auto-merged.
4. **Deprecated tokens.** Incoming sets must not remove deprecated tokens that have not yet completed their deprecation window (one full major version). Such removals are rejected at merge time.
5. **Namespace validation.** All token names must comply with the naming convention: `{category}-{variant}-{qualifier?}-{state?}` (e.g., `color-primary-default`, `color-btn-bg-default`). Qualifier is optional. Non-compliant names are rejected at merge time.
6. **Audit log.** Every merge produces a diff entry in the token changelog with: date, author, tokens added, tokens modified, tokens deprecated, tokens removed, resulting version.

---

### Theme Backward Compatibility Strategy

- A theme is considered backward-compatible if it only references tokens present in the current registry.
- When a token is deprecated, all themes referencing it emit a build warning.
- When a deprecated token is removed (MAJOR bump), themes referencing it produce a build error and must be updated before release.
- Theme authors must never reference internal component class names or CSS properties directly. Only token custom property names are permitted as theme targets.
- Themes are tested against a snapshot of component output on every build. Any unexpected visual delta blocks release.

---

### Component Evolution Strategy

- Every component has a declared public API: its HTML structure contract, its CSS custom property override slots, and its BEM class names used externally.
- Public API members are immutable within a MAJOR version.
- Additions to the public API (new override slots, new optional elements) are MINOR changes.
- Internal implementation may change freely in PATCH releases provided the public API is unchanged.
- No component may promote an internal implementation detail to a public API surface without a MINOR version bump.
- Deprecated public API members must remain functional for one full MAJOR version before removal.

---

### Adapter Isolation Contract

- Each adapter lives in its own package with its own version.
- Adapters declare a peer dependency on the core system with a minimum compatible version.
- An adapter may wrap, proxy, or re-export public component APIs. It must not reach into component internals.
- Adapters must not apply their own visual styles. All visual output comes from the component layer.
- An adapter that conditionally disables, overrides, or suppresses core component styles is in violation of this contract.
- Third-party library adapters (e.g., PrimeNG) must list the third-party library as an explicit peer dependency, not a bundled dependency.
- Two adapters must never communicate with each other. There is no inter-adapter API.

--------------------------------------------------------------------

## PART III — FORBIDDEN PATTERNS

The following patterns are forbidden at all layers. Any instance detected in code review or automated linting is grounds for rejection.

### FP-01 — Hardcoded Values
**Forbidden:** Any raw color, spacing, radius, shadow, font size, font weight, z-index, or breakpoint value written directly in CSS, SCSS, JS, or TS at any layer above `tokens`.
**Required:** All values must be consumed via the token system (CSS custom property reference or build-time token import).
**Detection:** Linting rule enforced at build time. Non-zero exit on violation.

### FP-02 — Cross-Layer Upward Dependency
**Forbidden:** Any lower layer importing, referencing, or being aware of any higher layer.
**Example violations:** tokens importing base; base importing utilities; components importing themes; themes importing components.
**Detection:** Dependency graph analysis on every build. Non-zero exit on violation.

### FP-03 — Component Token Redefinition
**Forbidden:** A component defining a new raw token value. Components consume tokens; they do not author them.
**Clarification:** Creating a scoped CSS custom property (e.g., `--btn-bg: var(--color-primary-default)`) is permitted as an override slot. Assigning a raw value (e.g., `--btn-bg: #3366ff`) is forbidden.
**Detection:** Linting rule targeting component CSS files for raw value assignments to custom properties.

### FP-04 — Theme CSS Rule Injection
**Forbidden:** A theme writing any CSS rule other than custom property value overrides within its scope selector.
**Example violations:** A theme adding `margin`, `padding`, `display`, or any structural CSS property.
**Detection:** Theme files are parsed at build time. Any property other than CSS custom properties inside the theme scope triggers a build error.

### FP-05 — Vendor Coupling in Core Layers
**Forbidden:** Any import of a framework or third-party library in the tokens, base, utilities, components, or themes layers.
**Permitted only in:** adapters, and only for the specific framework/library that adapter targets.
**Detection:** Dependency graph analysis. Any `import` or `require` of a non-system package in a core layer fails the build.

### FP-06 — Token Collision
**Forbidden:** Two tokens sharing the same name at the same scope.
**Prevention:** Token registry enforces uniqueness. Merge pipeline runs collision check before any merge is accepted.
**Detection:** Registry integrity check on every build.

### FP-07 — Silent Theme Breakage
**Forbidden:** Releasing a token removal (MAJOR) or rename (MAJOR) without a corresponding theme audit and migration guide.
**Required:** Every MAJOR token release ships with a changelog section listing affected themes and required update steps.

### FP-08 — Adapter Style Overrides
**Forbidden:** An adapter injecting CSS that modifies the visual output of a component beyond what the component's public override slot API permits.
**Detection:** Visual regression tests comparing adapter-rendered output to core component baseline.

### FP-09 — Undeclared Version Dependency
**Forbidden:** An adapter functioning correctly with an undeclared minimum core version.
**Required:** Every adapter manifest declares `peerDependencies` with minimum compatible core version.

### FP-10 — Token Removal Without Deprecation Window
**Forbidden:** Removing a token in any release without it having been marked deprecated in a prior MINOR release.
**Required:** Token must carry a `@deprecated` annotation for at least one full MAJOR version cycle before removal.

--------------------------------------------------------------------

## PART IV — SYSTEM INTEGRITY ENFORCEMENT

### How the system prevents Vendor Coupling
- Core layers (tokens → themes) have zero external `import` dependencies by contract.
- Build pipeline validates the dependency graph of every package. Any external import in a core layer fails the build immediately.
- Adapters are the only legal entry point for framework dependencies. They are versioned separately.

### How the system prevents Hardcoded Values
- All CSS files in base, utilities, and components are linted with a custom rule that rejects any raw value for color, spacing, radius, shadow, z-index, or breakpoint.
- Token values are the only permitted raw values, and they live exclusively in the tokens layer.
- PR review checklist includes a mandatory hardcoded value scan.

### How the system prevents Theme Breakage on Update
- Every token deprecation or removal triggers an automated theme audit that scans all themes for references to the affected token.
- Themes must be validating against the live token registry on every build. A theme referencing a non-existent token is a build error.
- Breaking token changes (MAJOR) require a migration script or documented manual steps before the release is tagged.

### How the system prevents Token Collision
- The token registry is the canonical namespace. All token names are stored in a flat map; uniqueness is enforced structurally.
- The merge pipeline performs a pre-merge collision check. Any conflicting name halts the merge.
- Token names follow a mandatory naming convention enforced by linting: violations are rejected at contribution time.

--------------------------------------------------------------------

## PART V — DEPENDENCY DIRECTION SUMMARY (Ratified)

```
tokens        →  no dependencies
base          →  tokens
utilities     →  tokens, base
components    →  tokens, base, utilities
themes        →  tokens
adapters      →  tokens, base, utilities, components, themes
              →  + declared external framework/library peer dependency
```

**Prohibited directions (non-exhaustive):**
- tokens → anything
- base → utilities, components, themes, adapters
- utilities → components, themes, adapters
- components → themes, adapters
- themes → base, utilities, components, adapters
- any core layer → any adapter
- adapter A → adapter B

--------------------------------------------------------------------

## CONTRACT SIGNATURE

This contract is the authoritative reference for all design system decisions.
Any implementation, contribution, or tooling that contradicts this contract is in violation and must be corrected before merge.
Amendments require explicit versioning of this document and ratification by the system architecture owner.

Contract version: 1.0.0
Issued: 2026-02-21
