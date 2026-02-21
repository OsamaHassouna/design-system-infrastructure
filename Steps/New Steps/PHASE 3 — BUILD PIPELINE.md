PHASE 3 — BUILD PIPELINE

 -Enforce deterministic output
 -Enforce separation of root and theme
 -Enforce stable output ordering
  
--------------------------------------------------------------------

PROMPT:: 

Phase 3 — Token Build Pipeline

We are now designing the Token Build Pipeline for our framework-agnostic Design System.

Requirements:

- Input: fully validated `tokens.json` (from Phase 2)
- Generate the following CSS outputs:
   1) `core.css` → contains primitive + semantic variables only
   2) `component-tokens.css` → contains component token variables only
   3) `default-theme.css` → contains theme overrides only
- No component styling beyond variables
- Deterministic output required (ordering and naming must never change across builds with the same input)

Define:

1) Variable naming strategy:
   - Follow Phase 2 token naming conventions
   - Ensure uniqueness
   - Map clearly to JSON tokens
2) Output ordering rules:
   - Primitive → Semantic → Component → Theme
   - Alphabetical within each layer
3) Theme override safety:
   - Themes can only override primitive values
   - Fallback resolution must be deterministic: `theme.overrides[name]?.value ?? registry[name].value`
4) Missing tokens handling:
   - Build must fail if required tokens are missing
   - Warnings only for optional tokens
5) Build error behavior:
   - Clear, descriptive errors for violations of Phase 1 contracts or Phase 2 schema rules
6) Versioning metadata embedding:
   - Include `tokens.json` version
   - Include timestamp
   - Include applied theme version
   - Embed deprecation info for tokens if applicable

Provide:

- Node.js build script example implementing the above rules
- Example of generated CSS output for `core.css`, `component-tokens.css`, and `default-theme.css`
- Explain how updates to `tokens.json` propagate to CSS outputs and how merge/fallback resolution works
- Demonstrate deterministic output across repeated builds

Do NOT add component styling yet — only variable generation and theme overrides. Focus on correctness, safety, and compliance with Phase 1 & 2 rules.

--------------------------------------------------------------------

🧪 Phase 3 Tests

 -No duplicate variables
 -No component CSS leakage
 -Theme overrides only semantic/component
 -Root variables isolated