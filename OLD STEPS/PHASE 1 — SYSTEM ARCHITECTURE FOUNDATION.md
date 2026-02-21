PHASE 1 — SYSTEM ARCHITECTURE FOUNDATION
STEP 1 — Define System Architecture & Folder Structure
🎯 Goal:: Design the full architecture before writing any files.

Step 1: PROMPT:

You are building a production-grade, framework-agnostic Design System Platform.

This is infrastructure, not a styling refactor.

Before writing any code:

1) Design full system architecture including:
   - Core design-system folder
   - Token system
   - Component structure
   - Theme layer
   - Adapter layer
   - Documentation platform
   - Theme export/import engine
   - Future SaaS-ready layer

2) Define folder structure in detail.
3) Define strict layer responsibilities.
4) Define dependency rules between layers.
5) Define naming conventions.
6) Define versioning strategy for tokens.

DO NOT generate files yet.
Explain architecture decisions first.
Be opinionated.
Prevent future technical debt.

After explanation, provide:
- Final approved folder structure
- Clear layer contract rules
- Update strategy rules

------------------------------------

🧪 Required Tests

Claude must:

Separate tokens from components.

Isolate adapters completely.

Avoid vendor coupling.

Define versioning strategy.

Define theme merging strategy.

📊 Required Summary

Claude must output:

Final architecture diagram

Layer dependency rules

Versioning logic

Risk prevention strategy

If he skips versioning or merging logic → Stop him.