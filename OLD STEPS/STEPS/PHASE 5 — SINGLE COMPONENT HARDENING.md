PHASE 5 — SINGLE COMPONENT HARDENING

We no longer build 3 components at once.
We build only Button first.
Because component pattern must be perfect before duplication.

--------------------------------------------------------------------
PROMPT:: 

Phase 5 — Component Preview Implementation (Button)

Task:

Implement the **Button component only** in the UI Template system, following these rules:

Rules:

1. **Token Usage Only**
   - Use `--component-button-*` variables from `_button.variables.scss`.
   - No hardcoded values anywhere.
   - Map to semantic tokens as needed (e.g., `--component-button-bg-default: var(--semantic-color-btn-bg-default)`).

2. **States & Variants**
   - Include all defined states: default, hover, focus, active, disabled.
   - Include all sizes and variants (primary, secondary, tertiary, etc.).
   - Use low specificity selectors only (avoid inline or !important).

3. **Framework-Agnostic**
   - No vendor-specific selectors (`.p-button` or Angular/PrimeNG classes forbidden).
   - Use pure class names scoped to the component (e.g., `.btn`, `.btn--primary`, `.btn--sm`).

4. **@layer Enforcement**
   - Declare component layer in `_button.scss` via `@layer components`.
   - Ensure all styles reference variables only.

5. **Output Requirements**
   - `button.scss` (structural + state styles)  
   - `_button.variables.scss` already exists — map all used tokens clearly  
   - List of all component tokens consumed in the implementation  
   - Mapping from semantic tokens to component tokens for clarity  

6. **Scalability**
   - Explain how this implementation pattern scales to **all other components** in the system.
   - Highlight variable separation, theme integration, and @layer safety.

Focus: correctness, maintainability, and strict adherence to Phase 4 SCSS structure.  
Do not implement HTML previews yet — just the component SCSS, variable mapping, and documentation notes.

--------------------------------------------------------------------

🧪 Tests

 -No hex values
 -Only var()
 -No !important
 -Clear separation from theme