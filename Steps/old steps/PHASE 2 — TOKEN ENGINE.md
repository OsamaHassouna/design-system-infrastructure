🟢 PHASE 2 — TOKEN ENGINE
STEP 2 — Design Token JSON Schema

🎯 Goal:: Define single source of truth.

Step 2: PROMPT::

Now we define the Token Engine.

Requirements:

- JSON as single source of truth.
- Support:
   Primitive tokens
   Semantic tokens
   Component tokens
- Support multiple themes.
- Support versioning.
- Support future Figma sync.
- Support export to CSS and JS.

Tasks:
1) Design token JSON schema structure.
2) Define naming convention.
3) Define theme extension model.
4) Define how tokens reference other tokens.
5) Define validation rules.
6) Define future compatibility rules.

Then:
- Provide example tokens.json
- Provide example dark theme override
- Explain how merging works when new components are added


------------------------------------------

🧪 Required Tests

Claude must:

 -Avoid circular references.

 -Ensure semantic tokens reference primitives.

 -Ensure components reference semantic.

 -Provide extensible schema.

📊 Required Summary

Claude must summarize:

 -Token hierarchy

 -Merge strategy

 -Validation strategy

 -Backward compatibility plan