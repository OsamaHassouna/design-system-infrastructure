PHASE 5 — PRIME NG ADAPTER
STEP 5 — Build Adapter Example

PROMPT:: 

Now create adapter layer for PrimeNG Button only.

Rules:

- Must live in /adapters/primeng
- Must not modify core components
- Must map design tokens to PrimeNG classes
- Must be removable without breaking system

Explain:
- Adapter contract
- How new vendor adapters will follow same pattern

-------------------------------------------------------

🧪 Required Tests

 -No token redefinition inside adapter.

 -Only vendor class mapping.

 -Core untouched.