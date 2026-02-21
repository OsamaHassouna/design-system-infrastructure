PHASE 4 — LAYER ENFORCEMENT

We ensure SCSS/CSS layering matches architecture contract.

--------------------------------------------------------------------
PROMPT Reminder for previuos 3 steps for a new session in claude:: 

Reminder: We are building a framework-agnostic Design System with a strict layered architecture (tokens → base → utilities → components → themes → adapters). 

Phases 1–3 are completed and approved:

- Phase 1: Architecture contracts and forbidden patterns
- Phase 2: Token engine with primitive → semantic → component layers, JSON schema, merge strategy, theme override rules, deprecation
- Phase 3: Token build pipeline, deterministic CSS generation, theme separation, core.css contains registry defaults only, theme-${themeId}.css for overrides

All four previously reported critical issues were fixed:
- Architecture diagram corrected
- Naming conventions unified (4-segment)
- emitCore() fixed to write defaults only
- Theme output filenames are dynamic per theme ID

Now we want to start **Phase 4 — SCSS / Layered Enforcement and Component Style Structure**:
- Build the UI Template system with reusable components, previews, variables, and a documentation layer
- Focus on framework-agnostic CSS/SCSS, maintain strict layer separation, and prepare for theme layer integration

Please continue using the same rules, merge/fallback logic, and contracts defined in previous phases.

--------------------------------------------------------------------
PROMPT:: 

Phase 4 — SCSS Skeleton Generation (Execution)

Task:

Generate the full SCSS folder structure for the Design System, including:

1) **Folder tree** (tokens, base, utilities, components, themes, adapters, main.scss)  
2) **SCSS files** with proper `@layer` declarations per layer  
3) **Component variable files** separated from component styling (_component.variables.scss)  
4) **Placeholder content** for demonstration (e.g., colors, spacing, typography tokens)  
5) **Import order examples** in main.scss  
6) **Theme files** with primitive overrides only (theme-light.scss, theme-dark.scss)  
7) **Adapters** with isolated structure (no references outside layer)  

Requirements:

- Tokens: example primitive values for color, spacing, radius, typography  
- Components: at least 2 sample components (button and card) using token variables  
- Utilities: sample spacing and typography classes referencing tokens only  
- Themes: override primitives only with [data-theme] selectors  
- Adapters: at least Angular and PrimeNG adapter files, empty placeholder content  
- Use `@layer` in all SCSS files to enforce layer separation  
- Include inline comments explaining layer rules and allowed references  
- Ensure import order is deterministic and follows: tokens → base → utilities → components → themes → adapters  

Deliverables:

- Full SCSS folder tree with all files, properly named and organized  
- Example content for each file demonstrating the rules above  
- main.scss showing imports in correct order and @layer usage  
- Ensure everything is ready to **drop into the UI Template system** for Phase 5 (component previews and documentation)

Focus: correctness, maintainability, and strict layer enforcement. Do not generate live HTML previews or component styling yet — only SCSS skeleton with placeholders and comments for future development.