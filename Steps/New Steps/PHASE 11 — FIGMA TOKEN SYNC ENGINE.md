You are implementing Phase 11 of a production-grade Design System platform.

This phase introduces a Figma → Code Sync Engine in READ-ONLY DRY-RUN MODE.

You must NOT break any architectural guarantees described below.

------------------------------------------------------------
CONTEXT — EXISTING SYSTEM (PHASE 1–10 COMPLETE)
------------------------------------------------------------

The system already has:

1) Strict cascade layers:
@layer tokens, base, utilities, components, themes, adapters;

2) Enforced 3-tier token chain:
--primitive-* 
   → --semantic-* 
      → --component-*

Validator (Phase 10) enforces:
- No missing references
- No circular dependencies
- Tier constraints
- No primitive usage in CSS rules
- Orphan detection

3) Deterministic build pipeline:
npm run build
  → prebuild (validate-tokens.js)
  → clean
  → compile SCSS
  → autoprefixer
  → dist output

4) Registry-driven system (unchanged)

------------------------------------------------------------
PHASE 11 OBJECTIVE
------------------------------------------------------------

Implement a Figma Token Sync Engine that:

1) Reads a JSON token export file
2) Compares it against compiled CSS tokens
3) Produces a diff report
4) Enforces architectural constraints
5) DOES NOT modify any files
6) DOES NOT write to SCSS
7) DOES NOT auto-merge
8) Runs as a CLI script
9) Is deterministic and read-only

This is DRY RUN ONLY.

------------------------------------------------------------
INPUT FORMAT
------------------------------------------------------------

Assume Figma export JSON structure:

{
  "tokens": [
    {
      "name": "semantic.color.brand.default",
      "value": "{primitive.color.blue.600}"
    },
    {
      "name": "component.button.primary.bg",
      "value": "{semantic.color.brand.default}"
    }
  ]
}

Rules:
- Figma references use {dot.notation.path}
- These must convert to CSS variable format:
  semantic.color.brand.default
    → --semantic-color-brand-default

  primitive.color.blue.600
    → --primitive-color-blue-600

Implement deterministic conversion:
- dot → hyphen
- prepend --
- preserve tier prefix

------------------------------------------------------------
ENGINE RESPONSIBILITIES
------------------------------------------------------------

1) Read dist/ds-preview.css
2) Extract all existing tokens (reuse logic from validator if possible)
3) Read Figma JSON file (e.g., figma-export.json)
4) Convert Figma tokens to CSS variable names
5) Build a dependency graph for Figma tokens
6) Validate Figma tier structure BEFORE diffing

------------------------------------------------------------
VALIDATIONS (STRICT)
------------------------------------------------------------

1) Tier integrity:
   - semantic must reference primitive only
   - component must reference semantic only
   - primitive must not reference anything

2) No circular dependencies in Figma input

3) No unknown tier prefixes allowed
   (only primitive, semantic, component)

If Figma input violates architecture:
  → Report ERROR
  → exit(1)
  → do not continue diff

------------------------------------------------------------
DIFF REPORT REQUIREMENTS
------------------------------------------------------------

Compare Figma tokens vs Code tokens.

Classify each token into:

1) NEW
   Token exists in Figma but not in CSS

2) MODIFIED
   Token exists in both but value differs

3) REMOVED
   Token exists in CSS but not in Figma

4) UNCHANGED
   Exists in both and value matches

Output structured report:

------------------------------------------------------------
Figma Sync Dry Run Report
------------------------------------------------------------

New Tokens (3)
  + --semantic-color-accent

Modified Tokens (2)
  ~ --semantic-color-brand-default
      code: var(--primitive-color-blue-600)
      figma: var(--primitive-color-blue-700)

Removed Tokens (1)
  - --semantic-color-muted

------------------------------------------------------------
Sync BLOCKED (architecture violations detected)
or
Sync SAFE (no architectural violations)
------------------------------------------------------------

If architectural violation → exit(1)
If diff only → exit(0)

------------------------------------------------------------
IMPLEMENTATION REQUIREMENTS
------------------------------------------------------------

File:
scripts/figma-sync-dry-run.js

Must:

- Use Node built-ins only
- Reuse dependency validation logic where possible
- Not duplicate cycle detection logic unnecessarily
- Not mutate CSS
- Not write any files
- Not auto-update SCSS
- Not require network calls

------------------------------------------------------------
CONSTRAINTS
------------------------------------------------------------

This is DRY RUN ONLY.

No:
- File writes
- Auto merge
- Token injection
- SCSS generation
- CSS rewriting

This phase is purely analytical.

------------------------------------------------------------
OUTPUT REQUIREMENTS
------------------------------------------------------------

Provide:

1) Full implementation of figma-sync-dry-run.js
2) Explanation of:
   - Name conversion logic
   - Tier validation
   - Diff classification
   - Cycle detection reuse
3) Example output for:
   - Clean sync
   - Tier violation
   - Circular dependency
   - Token diff case

------------------------------------------------------------
CRITICAL DESIGN PRINCIPLE
------------------------------------------------------------

The Design System must NEVER accept tokens that violate:

primitive → semantic → component

If Figma tries to bypass semantic layer,
the sync must fail immediately.

This engine is a gatekeeper, not a convenience tool.

Implement Phase 11 correctly and defensively.