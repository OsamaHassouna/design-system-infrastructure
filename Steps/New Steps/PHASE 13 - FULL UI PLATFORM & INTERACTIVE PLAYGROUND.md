You are continuing the development of the user-driven design system platform. Below is the context and instructions for Phase 13.

--- CONTEXT & PREVIOUS STEPS ---

Phase 1–3: Base SCSS/CSS architecture (reset, base, utilities, components, themes) and token chain (primitive → semantic → component).  

Phase 4–6: Registry-driven playground + docs, component JSON metadata, live preview, animations, no HTML editing needed.  

Phase 7–8: Figma sync design with dry-run, conflict detection, name conversion, tier mapping, cycle detection.  

Phase 9: Dynamic registry-driven docs & preview.  

Phase 9.5: Build pipeline with ds-preview.scss, canonical @layer ordering, npm run build/dev workflows.  

Phase 10: Token dependency validator — cycles, tier violations, primitive misuse.  

Phase 11: Figma dry-run validator — token diff classification (NEW/MODIFIED/REMOVED/UNCHANGED), architecture validation.  

Phase 12: Controlled Figma → Theme application engine — interactive review, atomic writes, registry updates, scope modes, incremental sync.

--- PLATFORM PRINCIPLES ---

1. Layers immutable: Reset / Base / Utilities / Components. Users can modify: Themes + Page Modules.  
2. Tokens: primitives → semantic → component; semantic required.  
3. Figma sync: dry-run first, detect conflicts, user confirmation.  
4. Playground: live preview + conflict feedback.  
5. Export: downloadable theme CSS + page HTML/CSS.  
6. Future expansion: accounts, subscriptions, multi-theme support, plugin integration.

Phase 13 — Full UI Platform & Interactive Playground

Objective:
- Provide a complete UI where users can:
  1. Browse and select themes (default + user-created)
  2. Preview components using current tokens
  3. Edit token values live (color, spacing, typography)
  4. Apply validated changes incrementally
  5. Export theme CSS/SCSS
  6. Create pages with page-specific styles (@layer modules)
  7. Copy/paste HTML + export CSS/SCSS per page

Tasks:

1. Folder & File Structure
- src/
  css/
    reset.css
    base.css
    utilities.css
    components.css
    themes/
      default.css
      user-theme.css
  scss/
    themes/
      _user-theme.scss
  js/
    playground.js  (interactive token editor + preview)
    figma-sync-dry-run.js
    figma-sync-apply.js
  index.html  (dashboard + playground)
- Ensure previous Phases 1–12 tokens validate correctly before UI integration

2. Theme Playground Features
- Dropdown to select theme (default + user theme)
- Table/list of all tokens (primitive, semantic, component)
- Inline editing per token:
  - Colors → color picker
  - Spacing/size → number input
  - Font → select from allowed list
- Live component preview:
  - Buttons, cards, badges, inputs
  - Live updates via CSS variables
- Export buttons:
  - user-theme.css
  - _user-theme.scss
  - preview registry JSON

3. Page Module Integration
- Each page can define its own CSS in `@layer modules`
- User can:
  - Edit page-specific styles
  - See live preview of page components
  - Copy/paste HTML
  - Export page CSS/SCSS + HTML

4. Validation & Sync
- Token changes are validated in real-time:
  - Component tokens may reference semantic/base only
  - Prevent invalid primitive references
- Show live diff of token changes (NEW/MODIFIED/REMOVED)
- Persist approved changes in registry (incremental sync)

5. Optional Enhancements
- Light/dark mode preview
- Undo/redo token edits
- Save theme edits locally

6. Expected Outcome
- Fully interactive dashboard/playground
- Live preview for all components
- Theme and page exports match edited values
- Validator shows zero errors
- Platform ready for Phase 14 (Framework-Adaptive Components)

Notes:
- Do not proceed to Phase 14 until playground + UI fully functional
- Keep architecture modular to allow easy addition of new components
- Maintain separation between base, components, utilities, and themes