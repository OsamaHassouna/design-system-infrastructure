You are continuing development of a production-grade Design System platform.

Before implementing anything, understand the architectural context below.
You must NOT break any of these guarantees.

------------------------------------------------------------
CONTEXT — WHAT IS ALREADY BUILT (PHASE 1–9)
------------------------------------------------------------

This is NOT a simple component library.
It is a layered design system platform with strict architecture.

Current guarantees:

1) CSS Architecture

We use explicit cascade layers in this exact order:

@layer tokens, base, utilities, components, themes, adapters;

Rules:
- tokens = primitive + semantic + component tokens only
- base = reset + element defaults
- utilities = small helpers (spacing, typography)
- components = structural component styles
- themes = data-theme overrides
- adapters = framework mapping (PrimeNG, Angular, etc.)

This layer order must never change.

------------------------------------------------------------

2) 3-Tier Token Chain

Every component token resolves like this:

--primitive-* 
   → --semantic-* 
      → --component-*
         → used in .ds-* class

Hard rules:
- Components NEVER reference primitives directly.
- Themes override semantic tokens only.
- Adapters NEVER modify tokens.
- No token mutation at runtime except via CSS var().

------------------------------------------------------------

3) Registry-Driven System

We have:
- component.registry.json
- registry-engine.js
- token-registry.js
- dynamic docs + preview rendering
- no hardcoded component markup in HTML

All docs and preview UI are generated from registry metadata.

------------------------------------------------------------

4) Playground

The playground:
- Updates CSS variables live using document.documentElement.style.setProperty()
- Requires zero rebuild
- Depends on compiled CSS output

------------------------------------------------------------

5) Current Major Gap

There is NO build pipeline.

Current problems:
- SCSS must be manually compiled
- ds-preview.css may become stale
- No watch mode
- No autoprefixer
- No validation before build
- No deterministic output process
- No separation between dev and production CSS

This is dangerous.

------------------------------------------------------------
PHASE 9.5 OBJECTIVE
------------------------------------------------------------

Implement a minimal but production-correct build system that:

1. Compiles SCSS → CSS deterministically
2. Enforces layer ordering
3. Supports watch mode
4. Runs PostCSS + Autoprefixer
5. Outputs to a clean /dist folder
6. Prevents stale CSS commits
7. Prepares for future Phase 10 validator hook
8. Does NOT introduce heavy frameworks
9. Does NOT break existing registry or playground
10. Does NOT restructure architecture

We want discipline, not complexity.

------------------------------------------------------------
REQUIREMENTS
------------------------------------------------------------

1) Create package.json

Include:
- sass (Dart Sass)
- postcss
- autoprefixer
- postcss-cli
- chokidar (optional)
- rimraf (for clean builds)

NO webpack.
NO storybook.
NO large bundlers.

Keep it minimal.

------------------------------------------------------------

2) Folder Structure

Define:

/src
  /scss
    ds-preview.scss
    /tokens
    /base
    /utilities
    /components
    /themes
    /adapters

/dist
  ds-preview.css
  ds-preview.min.css

Do NOT move registry files.

------------------------------------------------------------

3) Sass Entry File

ds-preview.scss must:
- Explicitly declare layer order at top
- Import layers in correct order
- Not duplicate layer declarations

------------------------------------------------------------

4) PostCSS Config

Create postcss.config.js:
- Autoprefixer only
- No nesting plugins
- No experimental transforms

------------------------------------------------------------

5) NPM Scripts

Define scripts:

{
  "clean": "...",
  "build:css": "...",
  "build:css:min": "...",
  "watch:css": "...",
  "build": "...",
  "dev": "..."
}

Rules:
- build must clean dist first
- build must compile SCSS
- then run postcss
- then produce minified version
- watch must recompile automatically

------------------------------------------------------------

6) Deterministic Output

Requirements:
- No source maps in production build
- Optional source maps in dev
- Output file names must remain stable
- Do NOT implement hashing yet
- Do NOT bundle JS

------------------------------------------------------------

7) Future Hook Placeholder

Prepare for:

"prebuild": "node scripts/validate-tokens.js"

But DO NOT implement validator yet.
Just scaffold scripts/ folder.

------------------------------------------------------------

8) Documentation

Provide:
- Full package.json content
- Full postcss.config.js
- Example ds-preview.scss entry
- Folder structure tree
- Explanation of script flow
- Confirmation that layer order is preserved
- Explanation of how this prevents stale CSS
- Optional improvements for future CI

Be explicit.
Be production-minded.
Be minimal.

------------------------------------------------------------

FINAL NOTE

This build system must respect:
- 3-tier token chain
- Cascade layer isolation
- Adapter removability
- Registry-driven rendering
- Zero runtime CSS compilation

If any of those are compromised, stop and explain.

Implement Phase 9.5 now.