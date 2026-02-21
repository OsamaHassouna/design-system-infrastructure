PHASE 3 — TOKEN → CSS GENERATOR
STEP 3 — Build Token Build Engine

PROMPT::

Now implement token build pipeline.

Requirements:

- Read tokens.json
- Generate:
   core.css (CSS variables)
   default-theme.css
   optional JS export
- Maintain layer separation.

Define:
- Build script architecture
- Output structure
- Naming pattern for CSS variables
- Theme override generation strategy

Provide:
- Build script example (Node-based)
- Example generated CSS
- Explanation of update flow when tokens change


 --------------------------------------------------------

🧪 Required Tests

Claude must:

 -Generate only CSS variables (no component CSS).

 -Keep root + theme selectors separated.

 -Prevent value duplication.

📊 Required Summary

Claude must summarize:

 -Build flow

 -How themes override tokens

 -How system updates safely