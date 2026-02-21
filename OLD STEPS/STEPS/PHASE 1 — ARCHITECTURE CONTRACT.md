PHASE 1 — ARCHITECTURE CONTRACT

We demand strict contracts between layers.

We define:

 -Who can depend on whom

 -What is forbidden

 -How updates propagate

 -How backward compatibility works
 
--------------------------------------------------------------------

 PROMPT:: 

 We are building a framework-agnostic Design System Infrastructure.

This is not UI first.
This is system first.

Before writing any files:

Define a strict architectural contract for the entire system.

You must define:

1) Layered Architecture with:
   - tokens
   - base
   - utilities
   - components
   - themes
   - adapters

2) For each layer define:
   - Responsibilities
   - What it can depend on
   - What it must NEVER depend on
   - Update rules

3) Define:
   - Token versioning strategy
   - Theme backward compatibility strategy
   - Component evolution strategy
   - Adapter isolation contract

4) Define forbidden patterns explicitly.

5) Define how system prevents:
   - Vendor coupling
   - Hardcoded values
   - Theme breakage on update
   - Token collision

Do NOT generate code.
Only architecture contract.

Think like you are designing a system that must survive 5 years.
Be strict.


--------------------------------------------------------------------

🧪 Phase 1 Tests

Claude must:

 -Define allowed dependency directions

 -Prevent themes from overriding CSS rules

 -Prevent components from redefining tokens

 -Define version increment rules (major/minor/patch)

 -Define merge strategy for new tokens

If he doesn’t define merge strategy → reject.