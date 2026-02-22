PHASE 8 — STATIC DOCUMENTATION + FIGMA TOKEN SYNC ARCHITECTURE

--------------------------------------------------------------------
STATUS: Complete
DELIVERABLES:
  docs/index.html                      Static documentation site
  docs/css/docs.css                    Documentation shell CSS
  docs/FIGMA-SYNC-ARCHITECTURE.md      Figma sync architecture design
--------------------------------------------------------------------

PART 1 — Static Documentation Site
--------------------------------------------------------------------

FILES:
  docs/index.html       →  Single-page Button documentation
  docs/css/docs.css     →  Documentation shell (--doc-* namespace only)

STRUCTURE:
  - Loads ../preview/css/ds-preview.css  (compiled DS CSS)
  - Loads docs/css/docs.css              (shell chrome only)

SECTIONS:
  1. Overview
     - Component metadata table
     - Token flow callout (primitives → semantic → component → scss)

  2. Variants
     - primary / secondary / tertiary / ghost / danger
     - Each row: class name, description, live rendered button

  3. Sizes
     - sm (32px) / md (40px default) / lg (48px)
     - Three variants shown per size

  4. States
     - Default / Hover / Focus / Active / Disabled / Loading
     - State × Variant matrix (all 5 variants × 3 states)

  5. Token flow tables
     - Primary variant: component → semantic → primitive (with swatches)
     - Danger variant: component → semantic → primitive (with swatches)
     - Sizing & typography tokens table
     - Structural exception callout (radius + min-height)

  6. Architecture rules
     - Forbidden patterns (4 rules)
     - Allowed patterns (2 rules)

CSS CONTRACT:
  docs.css uses --doc-* custom property namespace exclusively.
  It does NOT override any DS token.
  Shell layout is never part of the DS @layer stack.

--------------------------------------------------------------------

PART 2 — Figma Token Sync Architecture
--------------------------------------------------------------------

FILE:
  docs/FIGMA-SYNC-ARCHITECTURE.md

COVERS:
  1. Import scope (colors, typography, spacing, radius, shadows)
  2. Data flow diagram (textual — plugin → transformer → validator →
     conflict resolver → sync mode router → theme generator → report)
  3. Mapping strategy (layer, naming, units, colors, typography)
  4. Validation rules (schema, dependency graph, layer integrity,
     circular refs, missing primitives, naming convention)
  5. Conflict resolution (NEW / DUPLICATE / CONFLICT_VALUE / RENAMED /
     DEPRECATED — warning vs error, merge vs skip, safe rename)
  6. Missing token fallback cascade
  7. Version compatibility handling (semver matrix, breaking change
     prevention, migration report)
  8. Sync modes:
     A) Overwrite semantic layer
     B) Create new theme (theme-{id}.json)
     C) Safe merge (additive only)
  9. Component architecture (plugin, transformer, validator,
     theme generator, report engine)
  10. Security & safety guarantees (dry-run default, pre-commit
      diff, auto backup, rollback, no-op safety net)
  11. Absolute forbidden rules (COMP-LOCK, BASE-LOCK, ADAPTER-LOCK,
      NO-AUTO-DELETE, NO-SILENT-OVERWRITE, NO-PARTIAL-STATE)

IMPLEMENTATION: Deferred to Phase 9.
--------------------------------------------------------------------