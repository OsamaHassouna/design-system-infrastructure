'use strict';
// =============================================================================
// FIGMA TOKEN SYNC ENGINE — DRY RUN
// FILE: scripts/figma-sync-dry-run.js
// PHASE: 11
//
// PURPOSE:
//   Read-only gatekeeper that compares a Figma token export against the
//   compiled CSS token set.
//
//   Validates Figma tier integrity and circular dependencies BEFORE diffing.
//   Reports NEW / MODIFIED / REMOVED / UNCHANGED tokens.
//   Never mutates files. Never writes SCSS. Never auto-merges.
//
// USAGE:
//   node scripts/figma-sync-dry-run.js [path/to/figma-export.json]
//   Default path: figma-export.json (project root)
//
//   npm run figma-sync                       ← uses default figma-export.json
//   npm run figma-sync -- tokens/export.json ← custom path
//
// EXIT CODES:
//   0 — No architectural violations  (diff may still contain changes)
//   1 — Architecture violations OR file not found
//
// INPUT FORMAT:
//   {
//     "tokens": [
//       { "name": "semantic.color.brand.default", "value": "{primitive.color.blue.600}" },
//       { "name": "primitive.color.blue.600",     "value": "#2563eb" }
//     ]
//   }
//
// NAME CONVERSION:
//   "semantic.color.brand.default"  →  "--semantic-color-brand-default"
//   "{primitive.color.blue.600}"    →  "var(--primitive-color-blue-600)"
//
// ARCHITECTURAL CONTRACT:
//   primitive.* → semantic.* → component.*
//   Any Figma token that violates this chain fails immediately.
//   This engine is a gatekeeper, not a convenience tool.
// =============================================================================

const fs   = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * CSS sources to parse. Tries dist first (fresh build), falls back to the
 * checked-in preview output for repositories that haven't run the build yet.
 */
const CSS_CANDIDATES = [
  path.resolve(__dirname, '../dist/ds-preview.css'),
  path.resolve(__dirname, '../preview/css/ds-preview.css'),
];

/**
 * Allowed referencing tiers in Figma token exports.
 *
 * Strictly enforces the 3-tier chain:  primitive → semantic → component
 *
 * --base-* tokens are code-only (focus ring, transitions, z-index) and are
 * NOT part of Figma's token domain. Referencing them from Figma is an error.
 */
const FIGMA_ALLOWED_DEPS = {
  primitive : [],            // raw values only — no var() references permitted
  semantic  : ['primitive'],
  component : ['semantic'],
};

/**
 * The set of tier prefixes recognized in Figma token names.
 * Any other prefix (including "base") is an architecture violation.
 */
const VALID_FIGMA_TIERS = new Set(['primitive', 'semantic', 'component']);

// ─── Output constants ─────────────────────────────────────────────────────────

const SEP  = '─'.repeat(60);
const PASS = '✔';
const FAIL = '✖';
const WARN = '⚠';

// ─── Name Conversion ──────────────────────────────────────────────────────────

/**
 * Convert a Figma dot-notation token name to a CSS custom property name.
 *
 *   "semantic.color.brand.default"  →  "--semantic-color-brand-default"
 *   "primitive.color.blue.600"      →  "--primitive-color-blue-600"
 *   "component.button.primary.bg"   →  "--component-button-primary-bg"
 *
 * Conversion is deterministic:
 *   1. Replace every "." with "-"
 *   2. Prepend "--"
 *   The tier prefix (first segment) is preserved verbatim.
 *
 * @param {string} dotName  Figma token name in dot notation
 * @returns {string}        CSS custom property name with -- prefix
 */
function figmaNameToCSSVar(dotName) {
  return '--' + dotName.replace(/\./g, '-');
}

/**
 * Convert a Figma token value to its CSS-ready equivalent.
 *
 *   "{primitive.color.blue.600}"  →  "var(--primitive-color-blue-600)"
 *   "#2563eb"                     →  "#2563eb"   (raw value — unchanged)
 *   "16px"                        →  "16px"
 *   "cubic-bezier(0.4, 0, 0.2, 1)" →  "cubic-bezier(0.4, 0, 0.2, 1)"
 *
 * Only exact single-reference values of the form "{...}" are converted.
 * Any value that does not match this pattern is returned verbatim.
 *
 * @param {string} figmaValue  Raw value string from Figma JSON
 * @returns {string}           CSS-ready value string
 */
function figmaValueToCSS(figmaValue) {
  const m = figmaValue.match(/^\{(.+)\}$/);
  return m ? `var(${figmaNameToCSSVar(m[1])})` : figmaValue;
}

/**
 * Extract the referenced CSS custom property name from a Figma reference value.
 * Returns null if the value is not a {dot.notation} reference.
 *
 *   "{primitive.color.blue.600}"  →  "--primitive-color-blue-600"
 *   "#2563eb"                     →  null
 *   "16px"                        →  null
 *
 * @param {string} figmaValue
 * @returns {string|null}
 */
function extractFigmaRef(figmaValue) {
  const m = figmaValue.match(/^\{(.+)\}$/);
  return m ? figmaNameToCSSVar(m[1]) : null;
}

// ─── Tier Detection ───────────────────────────────────────────────────────────

/**
 * Determine the tier of a CSS custom property from its name prefix.
 * Returns null if no recognized prefix is found.
 *
 * @param {string} cssName  e.g. "--semantic-color-brand-default"
 * @returns {'primitive'|'semantic'|'component'|'base'|null}
 */
function getTierFromCSSName(cssName) {
  if (cssName.startsWith('--primitive-')) return 'primitive';
  if (cssName.startsWith('--semantic-'))  return 'semantic';
  if (cssName.startsWith('--component-')) return 'component';
  if (cssName.startsWith('--base-'))      return 'base';
  return null;
}

/**
 * Determine the tier of a Figma token from its dot-notation name.
 * Returns null if the first segment is not a recognized Figma tier.
 *
 * @param {string} figmaName  e.g. "semantic.color.brand.default"
 * @returns {'primitive'|'semantic'|'component'|null}
 */
function getTierFromFigmaName(figmaName) {
  const prefix = figmaName.split('.')[0];
  return VALID_FIGMA_TIERS.has(prefix) ? prefix : null;
}

// ─── CSS Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse compiled CSS and extract all custom property definitions from :root
 * blocks across all @layer contexts.
 *
 * Returns Map<cssVarName, { value: string, line: number }>.
 *
 * State machine (line-by-line, no external parser):
 *   - Tracks brace depth to identify :root open/close boundaries
 *   - Extracts "--name: value;" declarations found inside :root
 *   - @layer context is irrelevant — all :root tokens are collected
 *   - Theme override selectors ([data-theme]) are NOT matched and are
 *     intentionally skipped (only canonical :root values are compared)
 *
 * Requires expanded (non-minified) CSS input. The build pipeline always
 * produces expanded output in dist/ds-preview.css.
 *
 * @param {string} css  Expanded CSS source
 * @returns {Map<string, { value: string, line: number }>}
 */
function parseCSSTokens(css) {
  const tokens = new Map();
  const lines  = css.split('\n');

  let braceDepth = 0;
  let inRoot     = false;
  let rootDepth  = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw     = lines[i];
    const trimmed = raw.trim();
    const lineNum = i + 1;

    // Detect :root block opening.
    // Check BEFORE counting this line's braces so rootDepth captures the
    // depth of the enclosing context (not including the :root { itself).
    if (!inRoot && /^:root\s*\{/.test(trimmed)) {
      inRoot    = true;
      rootDepth = braceDepth;
    }

    // Update brace depth for this line
    const opens  = (raw.match(/\{/g) || []).length;
    const closes = (raw.match(/\}/g) || []).length;
    braceDepth  += opens - closes;

    // Detect :root block closing
    // When depth returns to rootDepth, the closing } for :root was on this line.
    if (inRoot && braceDepth <= rootDepth) {
      inRoot = false;
    }

    // Extract custom property definitions inside :root
    if (inRoot) {
      const m = trimmed.match(/^(--[\w-]+)\s*:\s*(.+?)\s*;/);
      if (m) {
        tokens.set(m[1], { value: m[2], line: lineNum });
      }
    }
  }

  return tokens;
}

// ─── Figma Parsing ────────────────────────────────────────────────────────────

/**
 * Parse a Figma JSON export and convert all entries to CSS-ready form.
 *
 * Expected input structure:
 *   {
 *     "tokens": [
 *       { "name": "semantic.color.brand.default", "value": "{primitive.color.blue.600}" },
 *       { "name": "primitive.color.blue.600",     "value": "#2563eb" }
 *     ]
 *   }
 *
 * @param {string} json  Raw JSON string from the Figma export file
 * @returns {Array<{
 *   cssName:    string,   // "--semantic-color-brand-default"
 *   cssValue:   string,   // "var(--primitive-color-blue-600)"
 *   figmaName:  string,   // "semantic.color.brand.default"
 *   figmaValue: string,   // "{primitive.color.blue.600}"
 *   tier:       string|null
 * }>}
 * @throws {Error}  On malformed JSON or missing required fields
 */
function parseFigmaExport(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  if (!data || !Array.isArray(data.tokens)) {
    throw new Error('Figma export must contain a "tokens" array at the root level');
  }

  return data.tokens.map((entry, idx) => {
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new Error(`Token[${idx}] is missing a valid "name" field`);
    }
    if (typeof entry.value !== 'string') {
      throw new Error(`Token "${entry.name}" is missing a valid "value" field`);
    }

    return {
      cssName   : figmaNameToCSSVar(entry.name),
      cssValue  : figmaValueToCSS(entry.value),
      figmaName : entry.name,
      figmaValue: entry.value,
      tier      : getTierFromFigmaName(entry.name),
    };
  });
}

// ─── Architecture Validation ──────────────────────────────────────────────────

/**
 * Validate tier integrity of all Figma token entries.
 *
 * Rules enforced:
 *   1. Token name must begin with a valid Figma tier: primitive, semantic,
 *      or component. Any other prefix (including "base") is rejected.
 *   2. A referenced token must also have a recognized tier prefix.
 *   3. References must follow the strict 3-tier chain:
 *        primitive  →  (nothing — raw values only)
 *        semantic   →  primitive
 *        component  →  semantic
 *   4. --base-* tokens are code-only and must never be referenced from Figma.
 *
 * @param {Array} figmaTokens
 * @returns {Array<{ message: string, detail?: string }>}
 */
function validateFigmaTiers(figmaTokens) {
  const errors = [];

  for (const token of figmaTokens) {

    // Rule 1 — token itself must have a valid Figma tier prefix
    if (!token.tier) {
      errors.push({
        message : `Unknown tier: ${token.figmaName}`,
        detail  : `Token name must start with "primitive.", "semantic.", or "component."`,
      });
      continue;  // skip dependency checks — tier context is unknown
    }

    const refCSSName = extractFigmaRef(token.figmaValue);
    if (!refCSSName) continue;  // raw value — no tier dependency to validate

    const refTier = getTierFromCSSName(refCSSName);

    // Rule 2 — reference target must have a recognized prefix
    if (!refTier) {
      errors.push({
        message : `Unknown ref tier: ${token.figmaName}`,
        detail  : `Referenced "${refCSSName}" has no recognized tier prefix`,
      });
      continue;
    }

    // Rule 4 — --base-* tokens are code-only and off-limits to Figma
    if (!VALID_FIGMA_TIERS.has(refTier)) {
      errors.push({
        message : `Invalid ref tier: ${token.figmaName} → ${refCSSName}`,
        detail  : `"${refTier}" tokens are code-only and must not be referenced from Figma exports`,
      });
      continue;
    }

    // Rule 3 — must follow the allowed tier chain
    const allowed = FIGMA_ALLOWED_DEPS[token.tier];
    if (!allowed.includes(refTier)) {
      const allowedStr = allowed.length
        ? allowed.join(', ')
        : '(nothing — primitive tokens must use raw values)';
      errors.push({
        message : `Tier violation: ${token.figmaName} → ${refCSSName}`,
        detail  : `${token.tier} token references a ${refTier} token. Allowed: ${allowedStr}`,
      });
    }
  }

  return errors;
}

// ─── Cycle Detection ──────────────────────────────────────────────────────────

/**
 * Build a directed dependency graph from Figma tokens.
 *
 * Nodes are CSS custom property names. Edges represent var() references.
 * Tokens with raw (non-reference) values have an empty edge list.
 *
 * @param {Array} figmaTokens
 * @returns {Map<string, string[]>}  cssName → [dep cssName, ...]
 */
function buildFigmaGraph(figmaTokens) {
  const graph = new Map();
  for (const token of figmaTokens) {
    const ref = extractFigmaRef(token.figmaValue);
    graph.set(token.cssName, ref ? [ref] : []);
  }
  return graph;
}

/**
 * Find all circular dependency cycles in a directed graph.
 *
 * Uses iterative DFS with WHITE / GRAY / BLACK node coloring:
 *   WHITE — unvisited
 *   GRAY  — currently on the active DFS path
 *   BLACK — fully processed; no cycle passes through this node
 *
 * A back edge to a GRAY node signals a cycle. The cycle path is
 * reconstructed by slicing the current path array from the GRAY node
 * to the current position and appending the target node.
 *
 * Iterative implementation avoids call-stack overflow on deep chains.
 * Reuses the same algorithm as the Phase 10 token validator.
 *
 * @param {Map<string, string[]>} graph
 * @returns {string[][]}  Array of cycle paths (CSS var names)
 */
function findCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color  = new Map();
  const cycles = [];

  // Seed all known nodes as WHITE
  for (const node of graph.keys()) {
    color.set(node, WHITE);
  }

  function dfs(start) {
    const stack = [{ node: start, path: [start], edgeIdx: 0 }];
    color.set(start, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const deps  = graph.get(frame.node) || [];

      if (frame.edgeIdx >= deps.length) {
        // All neighbors processed — mark fully explored and backtrack
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }

      const dep = deps[frame.edgeIdx++];
      if (!color.has(dep)) color.set(dep, WHITE);

      const depColor = color.get(dep);

      if (depColor === GRAY) {
        // Back edge to an active path node — cycle found
        const cycleStart = frame.path.indexOf(dep);
        cycles.push([...frame.path.slice(cycleStart), dep]);
      } else if (depColor === WHITE) {
        color.set(dep, GRAY);
        stack.push({ node: dep, path: [...frame.path, dep], edgeIdx: 0 });
      }
      // BLACK — already fully explored, guaranteed no cycle through this node
    }
  }

  for (const [node, clr] of color) {
    if (clr === WHITE) dfs(node);
  }

  return cycles;
}

// ─── Diff Engine ─────────────────────────────────────────────────────────────

/**
 * Diff Figma tokens against the compiled CSS token set.
 *
 * Only CSS tokens in the Figma tier universe (primitive, semantic, component)
 * are considered. Code-only tiers (--base-*, --unknown-*) are excluded — they
 * are not managed by Figma and must not appear as spurious REMOVED entries.
 *
 * Classification:
 *   NEW       — token exists in Figma but not in CSS
 *   MODIFIED  — token exists in both but values differ (string comparison)
 *   REMOVED   — token exists in CSS (within Figma's tiers) but not in Figma
 *   UNCHANGED — token exists in both and values are identical
 *
 * Value comparison is a direct string equality check after both sides have
 * been normalized to CSS format. No computed-value equivalence is attempted.
 *
 * @param {Map<string, { value: string }>} cssTokens
 * @param {Array<{ cssName: string, cssValue: string }>} figmaTokens
 * @returns {{
 *   added:     Array<{ name: string, figmaValue: string }>,
 *   modified:  Array<{ name: string, cssValue: string, figmaValue: string }>,
 *   removed:   Array<{ name: string, cssValue: string }>,
 *   unchanged: Array<{ name: string }>
 * }}
 */
function diffTokens(cssTokens, figmaTokens) {
  const figmaMap = new Map(figmaTokens.map(t => [t.cssName, t.cssValue]));

  // Filter CSS tokens to only those in Figma's tier universe
  const cssRelevant = new Map();
  for (const [name, data] of cssTokens) {
    const tier = getTierFromCSSName(name);
    if (tier && VALID_FIGMA_TIERS.has(tier)) {
      cssRelevant.set(name, data);
    }
  }

  const added     = [];
  const modified  = [];
  const removed   = [];
  const unchanged = [];

  // Classify each Figma token relative to CSS
  for (const [name, figmaValue] of figmaMap) {
    if (!cssRelevant.has(name)) {
      added.push({ name, figmaValue });
    } else {
      const cssValue = cssRelevant.get(name).value;
      if (cssValue !== figmaValue) {
        modified.push({ name, cssValue, figmaValue });
      } else {
        unchanged.push({ name });
      }
    }
  }

  // CSS-only tokens in the Figma tier universe
  for (const [name, data] of cssRelevant) {
    if (!figmaMap.has(name)) {
      removed.push({ name, cssValue: data.value });
    }
  }

  return { added, modified, removed, unchanged };
}

// ─── Report ───────────────────────────────────────────────────────────────────

/**
 * Print the structured sync dry-run report to stdout.
 *
 * When archErrors are present the report always ends with "Sync BLOCKED".
 * When no violations exist the report shows the full diff and "Sync SAFE".
 *
 * The cycle-check result (PASS or FAIL) is always rendered as the first
 * status line — even when other errors are also present — so it is never
 * silently omitted from the output.
 *
 * @param {{
 *   figmaFile:  string,
 *   cssFile:    string,
 *   archErrors: Array<{ message: string, detail?: string }>,
 *   noCycles:   boolean,
 *   diff:       { added, modified, removed, unchanged } | null
 * }} params
 */
function printSyncReport({ figmaFile, cssFile, archErrors, noCycles, diff }) {
  const relFigma = path.relative(process.cwd(), figmaFile);
  const relCSS   = path.relative(process.cwd(), cssFile);

  console.log('');
  console.log(SEP);
  console.log('Figma Sync Dry Run Report');
  console.log(`Figma source : ${relFigma}`);
  console.log(`CSS source   : ${relCSS}`);
  console.log(SEP);
  console.log('');

  // ── Cycle check — always rendered explicitly ────────────────────────────
  if (noCycles) {
    console.log(`${PASS} No circular dependencies in Figma tokens`);
  } else {
    console.log(`${FAIL} Circular dependencies detected in Figma tokens`);
  }
  console.log('');

  // ── Architecture errors — block the sync ────────────────────────────────
  if (archErrors.length > 0) {
    console.log(`Architecture Violations (${archErrors.length})`);
    for (const e of archErrors) {
      console.log(`  ${FAIL} ${e.message}`);
      if (e.detail) console.log(`       ${e.detail}`);
    }
    console.log('');
    console.log(SEP);
    console.log('Sync BLOCKED — architecture violations detected');
    console.log('Fix Figma token structure before syncing.');
    console.log(SEP);
    console.log('');
    return;
  }

  // ── Diff section ────────────────────────────────────────────────────────
  const { added, modified, removed, unchanged } = diff;

  if (added.length > 0) {
    console.log(`New Tokens (${added.length})`);
    for (const t of added) {
      console.log(`  + ${t.name}`);
    }
    console.log('');
  }

  if (modified.length > 0) {
    console.log(`Modified Tokens (${modified.length})`);
    for (const t of modified) {
      console.log(`  ~ ${t.name}`);
      console.log(`      code : ${t.cssValue}`);
      console.log(`      figma: ${t.figmaValue}`);
    }
    console.log('');
  }

  if (removed.length > 0) {
    console.log(`Removed Tokens (${removed.length})`);
    for (const t of removed) {
      console.log(`  - ${t.name}`);
    }
    console.log('');
  }

  const totalChanges = added.length + modified.length + removed.length;

  if (totalChanges === 0) {
    console.log(`${PASS} All ${unchanged.length} tokens match — no changes`);
    console.log('');
  } else {
    console.log(`Unchanged: ${unchanged.length} tokens`);
    console.log('');
  }

  // ── Summary footer ──────────────────────────────────────────────────────
  console.log(SEP);
  if (totalChanges === 0) {
    console.log('Sync SAFE — tokens are in sync');
  } else {
    console.log('Sync SAFE — no architectural violations');
    console.log(
      `Changes pending: ${totalChanges}` +
      `  (new: ${added.length}  modified: ${modified.length}  removed: ${removed.length})`
    );
  }
  console.log(SEP);
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {

  // ── a) Locate compiled CSS ────────────────────────────────────────────────
  let cssFile = null;
  for (const candidate of CSS_CANDIDATES) {
    if (fs.existsSync(candidate)) { cssFile = candidate; break; }
  }

  if (!cssFile) {
    console.warn('');
    console.warn(`${WARN} No compiled CSS found. Run \`npm run build\` first.`);
    console.warn('    Candidates checked:');
    for (const c of CSS_CANDIDATES) console.warn(`      ${c}`);
    process.exit(0);  // not a hard failure — skip validation, allow the build
  }

  // ── b) Locate Figma export file ───────────────────────────────────────────
  const figmaArg  = process.argv[2];
  const figmaFile = figmaArg
    ? path.resolve(process.cwd(), figmaArg)
    : path.resolve(process.cwd(), 'figma-export.json');

  if (!fs.existsSync(figmaFile)) {
    console.error('');
    console.error(`${FAIL} Figma export file not found: ${path.relative(process.cwd(), figmaFile)}`);
    console.error('    Usage: node scripts/figma-sync-dry-run.js [path/to/figma-export.json]');
    console.error('    Default: figma-export.json  (project root)');
    process.exit(1);
  }

  // ── c) Parse CSS tokens ────────────────────────────────────────────────────
  const css       = fs.readFileSync(cssFile, 'utf8');
  const cssTokens = parseCSSTokens(css);

  // ── d) Parse Figma tokens ─────────────────────────────────────────────────
  const figmaJSON = fs.readFileSync(figmaFile, 'utf8');
  let figmaTokens;
  try {
    figmaTokens = parseFigmaExport(figmaJSON);
  } catch (e) {
    console.error(`${FAIL} Failed to parse Figma export: ${e.message}`);
    process.exit(1);
  }

  // ── e) Validate Figma architecture ────────────────────────────────────────
  const archErrors = validateFigmaTiers(figmaTokens);
  const figmaGraph = buildFigmaGraph(figmaTokens);
  const cycles     = findCycles(figmaGraph);
  const noCycles   = cycles.length === 0;

  for (const cycle of cycles) {
    archErrors.push({
      message : `Circular dependency: ${cycle.join(' → ')}`,
    });
  }

  // Architecture violations block the sync entirely — diff is skipped
  if (archErrors.length > 0) {
    printSyncReport({ figmaFile, cssFile, archErrors, noCycles, diff: null });
    process.exit(1);
  }

  // ── f) Diff ───────────────────────────────────────────────────────────────
  const diff = diffTokens(cssTokens, figmaTokens);

  // ── g) Report + exit ─────────────────────────────────────────────────────
  printSyncReport({ figmaFile, cssFile, archErrors, noCycles, diff });

  // Diff changes are informational — they do not fail the run.
  // A developer must deliberately apply them to SCSS.
  process.exit(0);
}

main();
