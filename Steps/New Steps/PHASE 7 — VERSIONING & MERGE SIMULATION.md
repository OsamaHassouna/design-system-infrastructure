PHASE 7 — VERSIONING & MERGE SIMULATION

This is new and critical.

--------------------------------------------------------------------
PROMPT = > Reminder for previous steps :: 
Reminder — Framework-Agnostic Design System Context:

We are building a framework-agnostic Design System with a strict layered architecture: 
tokens → base → utilities → components → themes → adapters.

Phases 1–6 are complete:

- Phase 1: Architecture contracts, forbidden patterns, SemVer rules, critical issues fixed.
- Phase 2: Token engine (primitive → semantic → component), JSON schema, merge strategy, theme override rules, deprecation.
- Phase 3: Token build pipeline, deterministic CSS generation, theme separation, core.css = registry defaults, theme-${themeId}.css = overrides.
- Phase 4: SCSS / layered enforcement, 30 SCSS files, @layer usage, components isolated, themes override primitives only, adapters isolated.
- Phase 5: Button component implemented fully (tokens-only, all states/variants/sizes, BEM, loading/icon states, scalable pattern).
- Phase 6: Adapter layer implemented, PrimeNG button adapter completed, adapter contract codified, theme switching automatic.

--------------------------------------------------------------------
PROMPT:: 


Phase 7 — Component Preview & Playground System

Task:

1) **UI Template System**
- Build a **framework-agnostic preview system** to interactively explore components.
- Each component preview must:
  - Show **all variants, states, and sizes**.
  - Include **live display** of current theme (light/dark or any user-added theme).
  - Display **all relevant component tokens**, with copy/paste-ready CSS variables.
  - Provide **structured code snippet**: HTML + token variables (no raw values).
- Include a **playground mode**:
  - Users can modify token values (via input sliders, color pickers, toggles) in real-time.
  - Preview updates instantly.
  - Option to **export updated component CSS** or entire theme folder.

2) **Theme Awareness**
- Must respect **token → semantic → component flow**:
  - Previewed components use resolved token values based on active theme.
  - Playground edits update component tokens **without breaking theme contracts**.
  - Dark/light theme switch must update preview **without adapter changes**.
- User custom themes should integrate:
  - Merge user theme overrides with DS defaults.
  - Show conflict handling or deprecated token fallback.
  - Demonstrate version bump handling if tokens were updated.

3) **Component Addition Simulation**
- Add a **new example component** (e.g., badge or alert) using new tokens.
- Show **before and after tokens.json**, user theme, and final resolved CSS.
- Include **deprecated token handling** and version bump explanation.

4) **Output & Documentation**
- Provide structured **preview HTML/CSS** per component.
- Token table for each component with mappings: primitive → semantic → component.
- Show **theme overrides applied live**.
- Playground logic explained:
  - Input → token update → cascading component variable updates → preview refresh.
- Include usage guide for adding new components or themes in the playground system.

Rules:
- No raw values in component previews — only resolved component tokens.
- Maintain strict layer separation: tokens → base → utilities → components → themes → adapters.
- Adapter layer untouched: previews do not redefine tokens or affect adapters.
- @layer usage preserved in all generated CSS.
- Code must scale to **all existing components** and **future ones**.

Deliverables:
- Complete HTML + CSS preview system for all current components.
- Interactive playground logic and token manipulation UI.
- Example of new component addition (badge/alert) with token flow demonstration.
- Full documentation and usage guide for system preview/playground.

--------------------------------------------------------------------