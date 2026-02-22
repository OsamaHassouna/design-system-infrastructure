========================================================
ARCHITECTURE REMINDER
========================================================

We are continuing development of a Token-Driven UI Orchestration Platform.

Before implementing anything, you MUST respect the architectural constraints defined in previous phases.

TOKEN LAYERS:

1) Primitive Tokens
   - Raw scale values only.
   - Cannot reference semantic or component.
   - Immutable scale foundation.

2) Semantic Tokens
   - Reference primitives only.
   - Theme-replaceable layer.
   - Cannot reference component tokens.

3) Component Tokens
   - Reference semantic tokens only.
   - Full variant × state matrix required.
   - Additive evolution only (no breaking removal).
   - No raw values.

4) Structural SCSS
   - BEM only.
   - Use component tokens only.
   - No semantic usage.
   - No primitive usage.
   - No raw values.

5) Adapter Layer
   - Must not redefine tokens.
   - Must only map component tokens to vendor selectors.
   - Must be removable without breaking system.
   - All code inside @layer adapters.
   - No DS class selectors allowed in adapter files.

6) Docs Shell
   - Uses --doc-* namespace only.
   - Must never override DS tokens.
   - Outside DS @layer stack.

7) Figma Sync (future)
   - Can modify semantic layer only.
   - Cannot modify component or structural layers.
   - Dry-run default.
   - No silent overwrites.

========================================================
CURRENT SYSTEM STATUS (Phase 8 Complete)
========================================================

Already implemented:

- Button component (full token contract, 5 variants, sizes, states).
- Badge component (5 variants, filled + subtle, 2 sizes, dot).
- PrimeNG adapter (2-pass contract).
- Angular adapter skeleton.
- Static documentation page.
- Playground with:
    - Theme toggle
    - Token registry view
    - Live overrides
- token-registry.js
- DS preview CSS compiled.
- Figma Sync architecture documented (implementation not yet built).

Current limitation:

Preview and Docs still contain hardcoded component rendering.

This must be eliminated.

========================================================
PHASE 9 GOAL
========================================================

Make Documentation and Preview FULLY registry-driven.

No hardcoded Button or Badge markup.
No manual duplication when adding new components.

System must scale automatically.

========================================================
DELIVERABLES
========================================================

1) component.registry.json

Must include:
- component name
- description
- variants
- sizes
- states
- supported adapters
- token list (component token API surface)
- structural slots (icon, label, spinner, etc.)
- flags (hasLoading, hasIconOnly, etc.)

Schema must be extensible for unlimited components.
No schema rewrite required when adding new component types.

--------------------------------------------------------

2) adapter.registry.json

Must include:
- framework name
- version
- supported components
- adapter status (stable / beta / deprecated)

Must support:
- Multiple framework versions (e.g., primeng v17, v18, v20)
- Multiple frameworks

--------------------------------------------------------

3) Preview Engine Refactor

Replace hardcoded markup with:

- Dynamic variant grid generation
- Dynamic size grid generation
- Dynamic state matrix generation
- Dynamic loading state simulation (if supported)
- Dynamic icon-only rendering (if supported)

Preview must read from component.registry.json only.

--------------------------------------------------------

4) Docs Refactor

Documentation must dynamically render:

- Component overview
- Variant list
- Size list
- State matrix
- Token flow table (primitive → semantic → component)
- Adapter compatibility matrix

Token tables must be auto-generated from registry + token-registry.js.

--------------------------------------------------------

5) Registry Integration Rules

- Adding a new component must require:
    a) Creating component files
    b) Registering in component.registry.json
- No HTML edits allowed.

- Removing a component must remove it from registry only.

- Docs and preview must tolerate missing adapters.

--------------------------------------------------------

6) Scalability Guarantees

The registry system must:

- Support unlimited components.
- Support components without variants.
- Support components without sizes.
- Support components without states.
- Support future component categories (layout, utility, overlay).

--------------------------------------------------------

7) Safety Rules

- No token mutation.
- Registry is metadata only.
- Rendering must not change token values.
- No inline raw CSS.
- No duplication of DS token logic.

========================================================
REQUIRED OUTPUT STRUCTURE
========================================================

You must:

1) First explain the registry architecture design.
2) Define the JSON schemas clearly.
3) Show example component.registry.json (Button + Badge).
4) Show example adapter.registry.json (PrimeNG v17).
5) Show how preview rendering changes.
6) Show how docs rendering changes.
7) Provide migration steps from current hardcoded structure.
8) Provide checklist for adding a new component.

Do NOT implement Figma sync here.
Do NOT modify tokens.
Do NOT modify adapters.

This phase is registry + dynamic rendering only.

========================================================
IMPORTANT
========================================================

The system must remain deterministic, token-governed, and non-destructive.

No shortcuts.
No simplified mockups.
No partial automation.

Design it for long-term platform scale.