You are implementing Phase 10 of a production-grade Design System platform.

This phase introduces a Token Dependency Graph Validator.

You must NOT break any architectural guarantees described below.

------------------------------------------------------------
CONTEXT — EXISTING SYSTEM (PHASE 1–9.5 COMPLETE)
------------------------------------------------------------

The Design System has:

1) Strict CSS Cascade Layers (must never change order)

@layer tokens, base, utilities, components, themes, adapters;

Layer rules:
- tokens: primitive + semantic + component tokens only
- base: resets + element defaults
- utilities: small helpers
- components: structural component styles
- themes: data-theme overrides (semantic only)
- adapters: framework mapping (no token mutation)

------------------------------------------------------------

2) 3-Tier Token Chain (Hard Rule)

All tokens must follow:

--primitive-* 
   → --semantic-* 
      → --component-*

Rules:
- Components NEVER reference primitives directly.
- Semantic tokens reference primitives only.
- Component tokens reference semantic only.
- Themes override semantic only.
- Adapters NEVER modify tokens.
- No circular references allowed.
- No undefined references allowed.

------------------------------------------------------------

3) Registry-Driven System

We have:
- component.registry.json
- token-registry.js
- registry-engine.js
- dynamic docs + preview
- playground that modifies CSS variables live

Build pipeline exists (Phase 9.5):

npm run build:
  prebuild → node scripts/validate-tokens.js
  clean → compile SCSS → autoprefixer → dist output

Currently validate-tokens.js is a stub.
You will now implement it.

------------------------------------------------------------
PHASE 10 OBJECTIVE
------------------------------------------------------------

Build a deterministic Token Dependency Graph Validator that:

1) Parses compiled CSS (dist/ds-preview.css)
2) Extracts all CSS custom properties (--*)
3) Builds a dependency graph based on var(--token-name) references
4) Validates architectural rules
5) Outputs a human-readable report
6) Fails build (process.exit(1)) on violations
7) Has zero side effects (read-only validation)
8) Runs in Node (no browser APIs)
9) Has no external dependencies beyond Node built-ins

Do NOT modify SCSS.
Do NOT modify registry.
Do NOT change build pipeline.
Only implement validator logic.

------------------------------------------------------------
VALIDATION RULES (STRICT)
------------------------------------------------------------

The validator must detect:

1) Missing References
If a token references var(--x) but --x is not defined anywhere → ERROR

2) Circular Dependencies
If any token depends on itself directly or indirectly → ERROR

3) Tier Violations
Enforce naming-based tier constraints:

Primitive tokens:
--primitive-*

Semantic tokens:
--semantic-*

Component tokens:
--component-*

Rules:
- primitive must not reference semantic or component
- semantic must reference only primitive
- component must reference only semantic
- no cross-tier backward references

If violated → ERROR

4) Orphan Tokens
Any token defined but never referenced by:
- another token
- OR a CSS rule (outside :root)
→ WARNING (not build-breaking)

5) Unused Semantic Tokens
Semantic tokens not consumed by any component token → WARNING

6) Direct Primitive Usage in Components
If a component CSS rule (not token definition) directly uses var(--primitive-*) → ERROR

------------------------------------------------------------
IMPLEMENTATION REQUIREMENTS
------------------------------------------------------------

File: scripts/validate-tokens.js

The script must:

1) Read dist/ds-preview.css
2) Parse using regex (no CSS parser library)
3) Extract:
   - Token definitions (inside :root or layer tokens)
   - Token references (var(--...))
4) Build a directed graph:
   token → dependencies

5) Perform:
   - DFS for cycle detection
   - Tier validation
   - Missing reference detection
   - Usage tracking

6) Output formatted console report:

Example:

----------------------------------------
Token Validation Report
----------------------------------------

✔ No circular dependencies
✖ Missing token: --semantic-color-accent
✖ Tier violation: --component-btn-bg references --primitive-blue-500
⚠ Unused semantic token: --semantic-color-muted

----------------------------------------
Build FAILED
----------------------------------------

If any ERROR exists:
process.exit(1)

If only warnings:
process.exit(0)

------------------------------------------------------------
OUTPUT STRUCTURE
------------------------------------------------------------

Provide:

1) Full validate-tokens.js implementation
2) Explanation of:
   - How tokens are extracted
   - How graph is built
   - How cycles are detected
   - How tier validation works
3) Example output for:
   - Valid system
   - System with errors
4) Confirmation it integrates with npm run build prebuild hook

------------------------------------------------------------
CRITICAL CONSTRAINTS
------------------------------------------------------------

- No third-party packages
- No CSS AST parsers
- No mutation of CSS
- No writing files
- Pure validation only
- Must be deterministic
- Must scale to 500+ tokens

------------------------------------------------------------
FINAL NOTE

This validator is the foundation for:

Phase 11 — Figma Sync
Phase 12 — Theme Ingestion
Phase 13 — Multi-brand scaling

If it is weak, future phases become unsafe.

Implement Phase 10 correctly and defensively.