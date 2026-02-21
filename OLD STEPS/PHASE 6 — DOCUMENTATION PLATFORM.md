PHASE 6 — ADAPTER CONTRACT VALIDATION

Only after Button is stable.

--------------------------------------------------------------------
PROMPT => reminder for previous 5 steps:: 

Reminder — Framework-Agnostic Design System Context:

We are building a framework-agnostic Design System with a strict layered architecture: 
tokens → base → utilities → components → themes → adapters.

Phases 1–5 are completed:

Phase 1 — Architecture Contracts
- Strict layered architecture enforced.
- Forbidden patterns defined: no hardcoded values, upward dependencies, component token redefinition, theme CSS injection, vendor coupling in core layers, etc.
- SemVer rules for components, themes, tokens.
- Critical issues fixed: dependency diagram corrected, 4-segment token naming, core.css writes defaults only, dynamic theme filenames.

Phase 2 — Token Engine
- Three layers: primitive → semantic → component.
- JSON schema with reference rules: semantic → primitives only, component → semantic only.
- Circular reference prevention, validation rules.
- Theme override contract: only primitives overridden.
- Safe component token addition.
- Deprecation strategy and merge simulation.
- Example tokens.json, dark theme override, component addition simulation delivered.

Phase 3 — Token Build Pipeline
- Node.js pipeline: validate → transform → emit.
- Deterministic CSS generation: core.css (registry defaults), component-tokens.css, theme-${themeId}.css (overrides).
- @layer usage enforced for CSS layer isolation.
- Build errors/warnings defined, deterministic output.

Phase 4 — SCSS / Layered Enforcement
- 30 SCSS files across 10 directories: tokens, base, utilities, components, themes, adapters.
- Components have _variables.scss + structural _component.scss.
- @layer usage enforced in all SCSS files.
- Theme overrides only primitives; adapters isolated.

Phase 5 — Button Component Implementation
- Button component fully implemented:
  - Semantic tokens integrated.
  - Variables-only _button.variables.scss with full mapping table.
  - Structural BEM _button.scss, all states, sizes, tertiary variant.
- Scalable pattern documented for future components.
- Ready for component previews, variable playground, and theme switching.

--------------------------------------------------------------------
PROMPT:: 

Phase 6 — Adapter Contract & PrimeNG Button Adapter

Task:

1) Adapter Contract
- Define rules for any adapter to integrate the design system with a third-party framework/library.
- Must never redefine tokens.
- Must only map token values to vendor classes or selectors.
- Must be fully removable without breaking the core system.
- Define structure for each adapter (folder, index.scss, optional mapping files).

2) PrimeNG Button Adapter Implementation
- Map existing --component-button-* variables to PrimeNG `.p-button` classes.
- Include all states, sizes, and variants.
- Maintain BEM/scoped naming in combination with vendor selectors.
- Ensure overrides still come from token pipeline; do not hardcode colors, spacing, typography.
- Include placeholder for spinner/icon classes if needed.
- Keep theme switching fully compatible.

3) Documentation & Guidance
- Explain the adapter contract clearly.
- Show how new adapters (Angular, React, other frameworks) can follow the same pattern.
- Include inline comments for rules and references.

Deliverables:
- `_primeng.adapter.scss` with fully mapped button styles.
- Adapter folder structure example (`adapters/primeng/_index.scss`).
- Documentation comments explaining token → vendor mapping.
- Explanation of how new adapters can extend the contract without violating layer rules.

Focus:
- Maintain strict layer separation, theme readiness, and framework-agnostic principle.
- Avoid any raw values.
- Ensure scalability: pattern should work for every component and future adapters.

--------------------------------------------------------------------
