PHASE 2 — TOKEN ENGINE HARDENING

 -Enforce schema validation
 -Enforce dependency direction inside tokens
 -Simulate evolution scenario

--------------------------------------------------------------------

 PROMPT:: 

We are now designing the Token Engine for our framework-agnostic Design System.

Requirements:

- JSON as the single source of truth for all tokens.
- Three strictly layered types of tokens:
   1) Primitive
   2) Semantic (may reference Primitive only)
   3) Component (may reference Semantic only)

Define:

1) A strict JSON schema structure for all token types.
2) Clear rules for referencing:
   - Semantic may reference Primitive only.
   - Component may reference Semantic only.
   - No upward or circular references are allowed.
3) Mechanisms to prevent circular references and invalid dependency chains.
4) Validation rules for token values, names, and structure.
5) How themes can override tokens safely without breaking the system:
   - Themes can only override values, never structure.
   - Show fallback strategy for missing tokens.
6) How to safely add new component tokens without breaking existing themes.
7) Token deprecation strategy:
   - How to phase out old tokens with fallback.
   - How versioning handles deprecated tokens.
8) Merge simulation:
   - Include an example where a new component token is added.
   - Show how it merges with an existing theme.
   - Show how conflicts are resolved according to Phase 1 rules.
   
Provide:

- A full example `tokens.json` with Primitive, Semantic, and Component tokens.
- Example of a dark theme override using the schema.
- Example of a new component addition and the resulting merged theme.
- Explanations of merge behavior, conflict resolution, and fallback.

Do NOT write any build scripts yet.
Focus only on correctness, schema rigor, and compliance with Phase 1 architecture.
 
--------------------------------------------------------------------

🧪 Phase 2 Tests

Must include:
 -Circular reference prevention logic
 -Safe fallback mechanism
 -Clear token naming standard
 -Clear schema extensibility