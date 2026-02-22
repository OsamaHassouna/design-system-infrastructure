#!/usr/bin/env node
'use strict';
// =============================================================================
// TOKEN DEPENDENCY GRAPH VALIDATOR — PHASE 10
// FILE: scripts/validate-tokens.js
//
// PURPOSE:
//   Pre-build validation hook enforcing the 3-tier token chain contract.
//   Called automatically via: "prebuild": "node scripts/validate-tokens.js"
//   A non-zero exit aborts the build.
//
// WHAT IT VALIDATES:
//   1. Missing references    — var(--x) used but --x never defined
//   2. Circular dependencies — any token depending on itself (directly or transitively)
//   3. Tier violations       — naming-based chain enforcement:
//        primitive   → raw values only    (no var() allowed)
//        semantic    → primitive only
//        component   → semantic + base    (--base-* = base contract, allowed)
//        base        → semantic only
//   4. Orphan tokens         — defined but referenced by no token and no CSS rule  [WARNING]
//   5. Unused semantic       — semantic token not consumed by any component token
//                              AND not used directly in a CSS rule               [WARNING]
//   6. Direct primitive in rules — CSS rule (not :root) uses var(--primitive-*) [ERROR]
//
// ARCHITECTURE INVARIANTS PRESERVED:
//   - Read-only: no files written, no CSS mutated
//   - No external dependencies — Node built-ins only (fs, path)
//   - Deterministic: same input always produces same output
//   - Scales to 500+ tokens (single O(V+E) DFS pass for cycles)
//
// OUTPUTS TO: stdout
// EXIT CODES: 0 = pass (warnings only), 1 = fail (errors present)
// =============================================================================

const fs   = require('fs');
const path = require('path');

// ─── 0. CONFIGURATION ────────────────────────────────────────────────────────

/**
 * CSS files tried in order. First found wins.
 * dist/ds-preview.css is authoritative (built by npm run build).
 * preview/css/ds-preview.css is the reference fallback.
 */
const CSS_CANDIDATES = [
  path.resolve(__dirname, '../dist/ds-preview.css'),
  path.resolve(__dirname, '../preview/css/ds-preview.css'),
];

/**
 * Allowed dependency tiers per token tier.
 * Keys are the tier of the token being defined.
 * Values are the tiers that token is allowed to reference via var().
 *
 * Why --base-* is allowed for component tokens:
 *   Base contract tokens (--base-focus-ring-*, --base-transition-*, --base-z-index-*)
 *   are intentionally consumed by component tokens. They are structural/behavioural
 *   properties exposed from the base layer — conceptually analogous to semantics but
 *   for layout and interaction rather than visual design. This is a documented
 *   architectural pattern, not a bypass of the 3-tier chain.
 *
 * Why primitive has [] (empty):
 *   Primitives hold raw values only. Any var() reference in a primitive definition
 *   is a violation — primitives cannot reference anything.
 */
const ALLOWED_DEPS = {
  primitive : [],                    // raw values only
  semantic  : ['primitive'],         // intent mapped from palette
  component : ['semantic', 'base'],  // structure built from intent + base contract
  base      : ['semantic'],          // base contract coloured by semantics
  unknown   : ['primitive', 'semantic', 'component', 'base', 'unknown'],
};

// ─── 1. UTILITIES ─────────────────────────────────────────────────────────────

/**
 * Determine the tier of a CSS custom property by its name prefix.
 * @param {string} name  e.g. '--semantic-color-brand-default'
 * @returns {'primitive'|'semantic'|'component'|'base'|'unknown'}
 */
function getTier(name) {
  if (name.startsWith('--primitive-')) return 'primitive';
  if (name.startsWith('--semantic-'))  return 'semantic';
  if (name.startsWith('--component-')) return 'component';
  if (name.startsWith('--base-'))      return 'base';
  return 'unknown';
}

/**
 * Extract every var(--name) reference from a CSS value string.
 * Handles: var(--x), var(--x, fallback), var(--x, var(--y)).
 * Returns only the primary argument name of each var().
 * @param {string} value
 * @returns {string[]}
 */
function extractVarRefs(value) {
  const refs  = [];
  const regex = /var\(\s*(--[\w-]+)/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

/**
 * Find and return the path to the CSS file to validate.
 * Returns null if no candidate exists.
 * @returns {string|null}
 */
function resolveCSSFile() {
  for (const candidate of CSS_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ─── 2. CSS PARSER (STATE MACHINE) ───────────────────────────────────────────

/**
 * Parse the CSS file into three data structures:
 *
 *   tokenDefs    — Map<name, { value, refs, line, layer }>
 *                  Token *definitions* found inside :root {} blocks.
 *
 *   ruleUsages   — Set<tokenName>
 *                  Token names referenced via var() inside non-:root CSS rules.
 *
 *   primInRules  — Array<{ token, line, context }>
 *                  Instances of var(--primitive-*) inside non-:root CSS rules.
 *                  Each is an error (rule 6).
 *
 * PARSING STRATEGY:
 *   Process the CSS line by line with a brace-depth counter.
 *   Track when we enter/exit :root {} blocks.
 *   All --name: value; lines inside :root are token definitions.
 *   All var(--name) occurrences outside :root are rule usages.
 *
 * LIMITATIONS:
 *   - Brace counting assumes well-formed CSS (no unmatched braces in comments
 *     or string values). The compiled Sass output satisfies this.
 *   - Multi-line token definitions (semicolon on next line) are not supported.
 *     The compiled Sass output places each declaration on one line.
 *
 * @param {string} css
 */
function parseCSS(css) {
  /** @type {Map<string, { value: string, refs: string[], line: number, layer: string|null }>} */
  const tokenDefs  = new Map();

  /** @type {Set<string>} */
  const ruleUsages = new Set();

  /** @type {Array<{ token: string, line: number, context: string }>} */
  const primInRules = [];

  let braceDepth = 0;   // current nesting depth
  let inRoot     = false;
  let rootDepth  = -1;  // braceDepth when :root { } was entered

  // Layer name stack — each entry: { name: string, depth: number }
  // depth = braceDepth AFTER the @layer { opening brace was counted
  const layerStack = [];

  const lines = css.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Ignore blank lines and pure-comment lines early for speed.
    if (trimmed === '' || trimmed.startsWith('/*') || trimmed.startsWith('//')) {
      // Still need to count braces in multi-line comments that happen to have {/}
      // But Sass-compiled CSS does not embed { or } inside comment blocks that
      // span multiple lines — safe to skip.
      continue;
    }

    const opens  = (line.match(/{/g)  || []).length;
    const closes = (line.match(/}/g) || []).length;

    // ── a) Detect @layer NAME { (before depth update) ───────────────────────
    const layerMatch = trimmed.match(/^@layer\s+([\w-]+)\s*\{/);

    // ── b) Detect :root { (before depth update; must not already be in root) ─
    const isRootOpen = !inRoot && /^:root\s*\{/.test(trimmed);

    // ── c) Update brace depth ────────────────────────────────────────────────
    braceDepth += opens - closes;

    // ── d) Push @layer to stack (depth is now post-open) ────────────────────
    if (layerMatch) {
      layerStack.push({ name: layerMatch[1], depth: braceDepth });
    }

    // ── e) Pop expired @layer entries ───────────────────────────────────────
    while (layerStack.length > 0 && braceDepth < layerStack[layerStack.length - 1].depth) {
      layerStack.pop();
    }

    // ── f) Enter :root ───────────────────────────────────────────────────────
    if (isRootOpen) {
      inRoot    = true;
      rootDepth = braceDepth;   // depth after entering :root
    }

    // ── g) Exit :root ────────────────────────────────────────────────────────
    if (inRoot && braceDepth < rootDepth) {
      inRoot    = false;
      rootDepth = -1;
    }

    // ── h) Extract content ───────────────────────────────────────────────────
    const currentLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1].name : null;

    if (inRoot) {
      // Inside :root {} — token definition
      const defMatch = trimmed.match(/^(--[\w-]+)\s*:\s*(.+?)\s*;/);
      if (defMatch) {
        const name  = defMatch[1];
        const value = defMatch[2];
        // Keep first definition (tokens layer is processed first and is canonical)
        if (!tokenDefs.has(name)) {
          tokenDefs.set(name, {
            value,
            refs  : extractVarRefs(value),
            line  : lineNum,
            layer : currentLayer,
          });
        }
      }
    } else if (braceDepth > 0) {
      // Inside a non-:root rule — extract var() usages
      const varRegex = /var\(\s*(--[\w-]+)/g;
      let match;
      while ((match = varRegex.exec(trimmed)) !== null) {
        const tokenName = match[1];
        ruleUsages.add(tokenName);
        if (tokenName.startsWith('--primitive-')) {
          primInRules.push({
            token   : tokenName,
            line    : lineNum,
            context : trimmed.length > 100 ? trimmed.slice(0, 97) + '…' : trimmed,
          });
        }
      }
    }
  }

  return { tokenDefs, ruleUsages, primInRules };
}

// ─── 3. GRAPH BUILDER ────────────────────────────────────────────────────────

/**
 * Build a directed dependency graph from token definitions.
 * Edge: token → dep means the token's value contains var(--dep).
 * @param {Map<string, { refs: string[] }>} tokenDefs
 * @returns {Map<string, string[]>}
 */
function buildGraph(tokenDefs) {
  const graph = new Map();
  for (const [name, { refs }] of tokenDefs) {
    graph.set(name, refs);
  }
  return graph;
}

// ─── 4. VALIDATION RULES ─────────────────────────────────────────────────────

/**
 * RULE 1 — Missing references.
 * Finds every var(--x) where --x has no definition anywhere.
 *
 * Checks both token-to-token references (in definitions) and
 * rule usages (in CSS selectors).
 *
 * @param {Map<string, { refs: string[], line: number }>} tokenDefs
 * @param {Set<string>} ruleUsages
 * @returns {Array<{ consumer: string, missing: string, line: number|null }>}
 */
function findMissingRefs(tokenDefs, ruleUsages) {
  const defined = new Set(tokenDefs.keys());
  const errors  = [];

  for (const [name, { refs, line }] of tokenDefs) {
    for (const dep of refs) {
      if (!defined.has(dep)) {
        errors.push({ consumer: name, missing: dep, line });
      }
    }
  }

  for (const used of ruleUsages) {
    if (!defined.has(used)) {
      errors.push({ consumer: '(css rule)', missing: used, line: null });
    }
  }

  return errors;
}

/**
 * RULE 2 — Circular dependencies.
 * Iterative DFS with white / gray / black colouring.
 *
 * WHITE (0) = unvisited
 * GRAY  (1) = in current DFS path (on the stack)
 * BLACK (2) = fully explored
 *
 * A cycle is detected when we reach a GRAY node.
 * The cycle path is reconstructed by reading the current DFS path.
 *
 * Complexity: O(V + E) — visits each node and edge once.
 *
 * @param {Map<string, string[]>} graph
 * @returns {string[][]}  each element is an array of token names forming a cycle
 */
function findCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color  = new Map();
  const cycles = [];

  for (const name of graph.keys()) color.set(name, WHITE);

  /**
   * Iterative DFS from `start`.
   * Uses a call-stack simulation: each frame = { node, childIdx }.
   * The `path` array mirrors the current DFS path for cycle reconstruction.
   */
  function dfs(start) {
    // frame: { node: string, childIdx: number }
    const callStack = [{ node: start, childIdx: 0 }];
    const path      = [start];
    color.set(start, GRAY);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      const deps  = graph.get(frame.node) || [];

      let advanced = false;

      while (frame.childIdx < deps.length) {
        const dep      = deps[frame.childIdx++];
        const depColor = color.get(dep);

        // dep is not in our graph (undefined reference — caught by rule 1)
        if (depColor === undefined) continue;

        if (depColor === GRAY) {
          // ── Cycle detected ──────────────────────────────────────────────
          // dep is already on the current path. The cycle is the subpath
          // from dep's first occurrence to the current node, plus dep again.
          const startIdx = path.indexOf(dep);
          cycles.push([...path.slice(startIdx), dep]);
          // Do NOT recurse — continue looking for further edges.
        } else if (depColor === WHITE) {
          // ── Recurse ─────────────────────────────────────────────────────
          color.set(dep, GRAY);
          callStack.push({ node: dep, childIdx: 0 });
          path.push(dep);
          advanced = true;
          break;  // resume outer loop from the new frame
        }
        // BLACK = already explored, skip
      }

      if (!advanced) {
        // All edges from this node have been examined — mark done and pop
        color.set(frame.node, BLACK);
        callStack.pop();
        path.pop();
      }
    }
  }

  for (const name of graph.keys()) {
    if (color.get(name) === WHITE) dfs(name);
  }

  return cycles;
}

/**
 * RULE 3 — Tier violations in token definitions.
 * Checks every var() reference inside :root token definitions.
 *
 * Primitive → no var() allowed (raw values only)
 * Semantic  → may only reference --primitive-*
 * Component → may only reference --semantic-* and --base-*
 * Base      → may only reference --semantic-*
 *
 * @param {Map<string, { refs: string[], line: number }>} tokenDefs
 * @returns {Array<{ token: string, dep: string, tokenTier: string, depTier: string, line: number }>}
 */
function findTierViolations(tokenDefs) {
  const violations = [];

  for (const [name, { refs, line }] of tokenDefs) {
    const tokenTier = getTier(name);
    if (tokenTier === 'unknown') continue;

    const allowed = ALLOWED_DEPS[tokenTier];

    // Primitives must never use var() — they hold raw values only
    if (tokenTier === 'primitive') {
      for (const dep of refs) {
        violations.push({ token: name, dep, tokenTier, depTier: getTier(dep), line });
      }
      continue;
    }

    // All other tiers: check if the referenced token's tier is in allowed list
    for (const dep of refs) {
      const depTier = getTier(dep);
      if (!allowed.includes(depTier)) {
        violations.push({ token: name, dep, tokenTier, depTier, line });
      }
    }
  }

  return violations;
}

/**
 * RULE 4 — Orphan tokens.
 * A token is an orphan if it is neither:
 *   a) referenced by any other token definition (not in graph edges), NOR
 *   b) referenced in any CSS rule (not in ruleUsages).
 *
 * Note: --base-z-index-* tokens are often orphaned within the DS itself
 * because they are provided as a public contract for external consumers.
 * These are still reported so the team is aware.
 *
 * @param {Map<string, any>} tokenDefs
 * @param {Map<string, string[]>} graph
 * @param {Set<string>} ruleUsages
 * @returns {string[]}
 */
function findOrphans(tokenDefs, graph, ruleUsages) {
  // Collect every token name that is referenced as a dep by some other token
  const referencedByTokens = new Set();
  for (const deps of graph.values()) {
    for (const dep of deps) referencedByTokens.add(dep);
  }

  const orphans = [];
  for (const name of tokenDefs.keys()) {
    if (!referencedByTokens.has(name) && !ruleUsages.has(name)) {
      orphans.push(name);
    }
  }
  return orphans;
}

/**
 * RULE 5 — Unused semantic tokens.
 * Semantic tokens that are not consumed by any component token AND are not
 * referenced directly in any CSS rule.
 *
 * "Used in CSS rule" covers intentional cases: base-layer rules
 * (body, heading resets) reference semantic tokens directly — that is
 * correct architecture, not a violation.
 *
 * @param {Map<string, any>} tokenDefs
 * @param {Map<string, string[]>} graph
 * @param {Set<string>} ruleUsages
 * @returns {string[]}
 */
function findUnusedSemantics(tokenDefs, graph, ruleUsages) {
  // Build the set of semantic tokens consumed by component tokens
  const usedByComponents = new Set();
  for (const [name, deps] of graph) {
    if (getTier(name) === 'component') {
      for (const dep of deps) {
        if (getTier(dep) === 'semantic') usedByComponents.add(dep);
      }
    }
  }

  const unused = [];
  for (const name of tokenDefs.keys()) {
    if (getTier(name) !== 'semantic')      continue;
    if (usedByComponents.has(name))        continue;
    if (ruleUsages.has(name))              continue;  // used in base/utility rules
    unused.push(name);
  }
  return unused;
}

// ─── 5. REPORT PRINTER ───────────────────────────────────────────────────────

const SEP  = '─'.repeat(60);
const PASS = '✔';
const FAIL = '✖';
const WARN = '⚠';

/**
 * Print a structured validation report to stdout.
 *
 * noCycles is passed separately so the cycle check always renders an explicit
 * ✔ / ✖ line — even when other errors are present — matching the spec format.
 *
 * @param {{ cssFile: string, tokenCount: number, ruleUsageCount: number,
 *           noCycles: boolean,
 *           errors: Array<{message:string,detail?:string}>,
 *           warnings: Array<{message:string,detail?:string}> }} results
 */
function printReport({ cssFile, tokenCount, ruleUsageCount, noCycles, errors, warnings }) {
  const relPath    = path.relative(process.cwd(), cssFile);
  const errorCount = errors.length;
  const warnCount  = warnings.length;

  console.log('');
  console.log(SEP);
  console.log('Token Validation Report');
  console.log(`Source  : ${relPath}`);
  console.log(`Tokens  : ${tokenCount} defined    Rule usages: ${ruleUsageCount}`);
  console.log(SEP);
  console.log('');

  // ── Always show the cycle check result first ─────────────────────────────
  if (noCycles) {
    console.log(`${PASS} No circular dependencies`);
  }
  // Cycle errors (if any) are in the errors array and print below with others.

  // ── Errors ───────────────────────────────────────────────────────────────
  if (errorCount > 0) {
    if (noCycles) console.log('');  // blank line after the ✔ before errors
    for (const e of errors) {
      console.log(`${FAIL} ${e.message}`);
      if (e.detail) console.log(`     ${e.detail}`);
    }
    console.log('');
  } else {
    console.log('');
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  if (warnCount > 0) {
    for (const w of warnings) {
      console.log(`${WARN} ${w.message}`);
      if (w.detail) console.log(`     ${w.detail}`);
    }
    console.log('');
  }

  console.log(SEP);

  if (errorCount > 0) {
    console.log(`Build FAILED  — ${errorCount} error(s)  ${warnCount} warning(s)`);
    console.log('Fix errors above before building.');
  } else if (warnCount > 0) {
    console.log(`Build PASSED  — 0 errors  ${warnCount} warning(s)`);
  } else {
    console.log('Build PASSED  — 0 errors  0 warnings');
  }

  console.log(SEP);
  console.log('');
}

// ─── 6. MAIN ─────────────────────────────────────────────────────────────────

function main() {
  // ── a) Resolve CSS file ─────────────────────────────────────────────────
  const cssFile = resolveCSSFile();

  if (!cssFile) {
    console.log('');
    console.log('[prebuild] No compiled CSS found to validate.');
    console.log('[prebuild] Checked:');
    CSS_CANDIDATES.forEach(c => console.log(`           ${path.relative(process.cwd(), c)}`));
    console.log('[prebuild] Run `npm run build:css` first, or validate after build.');
    console.log('[prebuild] Skipping validation — build will continue.');
    console.log('');
    process.exit(0);
  }

  console.log(`[prebuild] Validating token chain in: ${path.relative(process.cwd(), cssFile)}`);

  // ── b) Read and parse ───────────────────────────────────────────────────
  let css;
  try {
    css = fs.readFileSync(cssFile, 'utf8');
  } catch (err) {
    console.error(`[prebuild] ERROR: Could not read CSS file: ${err.message}`);
    process.exit(1);
  }

  const { tokenDefs, ruleUsages, primInRules } = parseCSS(css);

  // ── c) Build graph ──────────────────────────────────────────────────────
  const graph = buildGraph(tokenDefs);

  // ── d) Run all validation checks ────────────────────────────────────────
  const missingRefs    = findMissingRefs(tokenDefs, ruleUsages);
  const cycles         = findCycles(graph);
  const tierViolations = findTierViolations(tokenDefs);
  const orphans        = findOrphans(tokenDefs, graph, ruleUsages);
  const unusedSemantics = findUnusedSemantics(tokenDefs, graph, ruleUsages);

  // ── e) Compile error and warning lists ──────────────────────────────────
  const errors   = [];
  const warnings = [];

  // Rule 1 — Missing references
  for (const { consumer, missing, line } of missingRefs) {
    const where = line ? ` (line ${line})` : '';
    errors.push({
      message : `Missing reference: ${missing}`,
      detail  : `Referenced by ${consumer}${where} but not defined anywhere`,
    });
  }

  // Rule 2 — Circular dependencies
  // The ✔ / ✖ cycle-check line is always rendered by printReport via `noCycles`.
  for (const cycle of cycles) {
    errors.push({
      message : `Circular dependency: ${cycle.join(' → ')}`,
    });
  }

  // Rule 3 — Tier violations in token definitions
  for (const { token, dep, tokenTier, depTier, line } of tierViolations) {
    const allowedStr = ALLOWED_DEPS[tokenTier].join(', ') || 'nothing (raw values only)';
    errors.push({
      message : `Tier violation: ${token} (${tokenTier}) references ${dep} (${depTier})`,
      detail  : `line ${line} — ${tokenTier} tokens may only reference: ${allowedStr}`,
    });
  }

  // Rule 6 — Direct primitive usage in CSS rules
  for (const { token, line, context } of primInRules) {
    errors.push({
      message : `Direct primitive in CSS rule: var(${token})`,
      detail  : `line ${line} — use a --component-* token instead\n     context: ${context}`,
    });
  }

  // Rule 4 — Orphan tokens (warnings)
  for (const name of orphans) {
    warnings.push({
      message : `Orphan token: ${name}`,
      detail  : `Defined but not referenced by any token or CSS rule`,
    });
  }

  // Rule 5 — Unused semantic tokens (warnings)
  for (const name of unusedSemantics) {
    warnings.push({
      message : `Unused semantic: ${name}`,
      detail  : `Not consumed by any component token or CSS rule`,
    });
  }

  // ── f) Print report ─────────────────────────────────────────────────────
  printReport({
    cssFile,
    tokenCount     : tokenDefs.size,
    ruleUsageCount : ruleUsages.size,
    noCycles       : cycles.length === 0,
    errors,
    warnings,
  });

  // ── g) Exit with correct code ────────────────────────────────────────────
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
