'use strict';
// =============================================================================
// CONTROLLED THEME SYNC & APPLICATION ENGINE
// FILE: scripts/figma-sync-apply.js
// PHASE: 12
//
// PURPOSE:
//   Applies approved Figma token changes to the user theme layer.
//   Runs the same diff engine as Phase 11, then presents each change for
//   user review before writing anything. No file is touched until the user
//   completes the approval review.
//
// USAGE:
//   node scripts/figma-sync-apply.js [figma-export.json] [options]
//   npm run figma-sync-apply [-- options]
//
// OPTIONS:
//   --yes, -y          Apply all architecturally valid changes (non-interactive)
//   --theme <name>     Theme selector name (default: "user")
//   --scope <mode>     "root"  → :root {} (global, default)
//                      "attr"  → [data-theme="<name>"] {} (scoped)
//   --out <dir>        Output directory for CSS (default: dist/)
//
// EXIT CODES:
//   0   — Applied cleanly, or nothing to apply
//   1   — Architecture violation (tokens rejected before review)
//   2   — User quit without approving anything
//   130 — Interrupted (Ctrl+C)
//
// OUTPUT FILES (written atomically after full review):
//   dist/user-theme.css                      — ready-to-link CSS
//   scss/themes/_user-theme.scss             — SCSS source (for build pipeline)
//   preview/data/user-theme.registry.json    — registry for playground/docs
//
// ARCHITECTURAL CONTRACT:
//   primitive.* → semantic.* → component.*
//   Tokens that violate this chain are blocked before review begins.
//   --base-* tokens are code-only and blocked at the validation gate.
// =============================================================================

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

const CSS_CANDIDATES = [
  path.join(ROOT, 'dist', 'ds-preview.css'),
  path.join(ROOT, 'preview', 'css', 'ds-preview.css'),
];

const USER_THEME_REGISTRY = path.join(ROOT, 'preview', 'data', 'user-theme.registry.json');
const USER_THEME_SCSS     = path.join(ROOT, 'scss', 'themes', '_user-theme.scss');

// ─── Output constants ─────────────────────────────────────────────────────────

const SEP  = '─'.repeat(60);
const PASS = '✔';
const FAIL = '✖';
const WARN = '⚠';
const INFO = '·';

// ─── Argument Parsing ─────────────────────────────────────────────────────────

/**
 * Parse CLI arguments.
 *
 * @param {string[]} argv  process.argv
 * @returns {{
 *   figmaFile: string,
 *   yes:       boolean,
 *   themeName: string,
 *   scope:     'root'|'attr',
 *   outputDir: string
 * }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    figmaFile : path.join(ROOT, 'figma-export.json'),
    yes       : false,
    themeName : 'user',
    scope     : 'root',
    outputDir : path.join(ROOT, 'dist'),
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--yes' || a === '-y') {
      opts.yes = true;
    } else if ((a === '--theme') && args[i + 1]) {
      opts.themeName = args[++i];
    } else if ((a === '--scope') && args[i + 1]) {
      const s = args[++i];
      if (s === 'attr') opts.scope = 'attr';
      else if (s !== 'root') {
        console.warn(`${WARN} Unknown --scope "${s}" — using "root"`);
      }
    } else if ((a === '--out') && args[i + 1]) {
      opts.outputDir = path.resolve(process.cwd(), args[++i]);
    } else if (!a.startsWith('-')) {
      opts.figmaFile = path.resolve(process.cwd(), a);
    }
  }

  return opts;
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────
// These functions mirror figma-sync-dry-run.js (Phase 11).
// Both scripts are intentionally self-contained.
// If the shared parsing or validation logic changes, update both files.

const FIGMA_ALLOWED_DEPS = {
  primitive : [],
  semantic  : ['primitive'],
  component : ['semantic'],
};

const VALID_FIGMA_TIERS = new Set(['primitive', 'semantic', 'component']);

function figmaNameToCSSVar(dotName) {
  return '--' + dotName.replace(/\./g, '-');
}

function figmaValueToCSS(figmaValue) {
  const m = figmaValue.match(/^\{(.+)\}$/);
  return m ? `var(${figmaNameToCSSVar(m[1])})` : figmaValue;
}

function extractFigmaRef(figmaValue) {
  const m = figmaValue.match(/^\{(.+)\}$/);
  return m ? figmaNameToCSSVar(m[1]) : null;
}

function getTierFromCSSName(cssName) {
  if (cssName.startsWith('--primitive-')) return 'primitive';
  if (cssName.startsWith('--semantic-'))  return 'semantic';
  if (cssName.startsWith('--component-')) return 'component';
  if (cssName.startsWith('--base-'))      return 'base';
  return null;
}

function getTierFromFigmaName(figmaName) {
  const prefix = figmaName.split('.')[0];
  return VALID_FIGMA_TIERS.has(prefix) ? prefix : null;
}

function parseCSSTokens(css) {
  const tokens = new Map();
  const lines  = css.split('\n');
  let braceDepth = 0;
  let inRoot     = false;
  let rootDepth  = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw     = lines[i];
    const trimmed = raw.trim();

    if (!inRoot && /^:root\s*\{/.test(trimmed)) {
      inRoot    = true;
      rootDepth = braceDepth;
    }

    braceDepth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;

    if (inRoot && braceDepth <= rootDepth) {
      inRoot = false;
    }

    if (inRoot) {
      const m = trimmed.match(/^(--[\w-]+)\s*:\s*(.+?)\s*;/);
      if (m) tokens.set(m[1], { value: m[2], line: i + 1 });
    }
  }

  return tokens;
}

function parseFigmaExport(json) {
  let data;
  try { data = JSON.parse(json); }
  catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }

  if (!data || !Array.isArray(data.tokens)) {
    throw new Error('Figma export must contain a "tokens" array at root level');
  }

  return data.tokens.map((entry, idx) => {
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new Error(`Token[${idx}] missing valid "name" field`);
    }
    if (typeof entry.value !== 'string') {
      throw new Error(`Token "${entry.name}" missing valid "value" field`);
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

function validateFigmaTiers(figmaTokens) {
  const errors = [];
  for (const token of figmaTokens) {
    if (!token.tier) {
      errors.push({
        message: `Unknown tier: ${token.figmaName}`,
        detail : 'Must start with "primitive.", "semantic.", or "component."',
      });
      continue;
    }
    const ref = extractFigmaRef(token.figmaValue);
    if (!ref) continue;

    const refTier = getTierFromCSSName(ref);
    if (!refTier) {
      errors.push({ message: `Unknown ref tier: ${token.figmaName}`, detail: `"${ref}" has no recognized tier prefix` });
      continue;
    }
    if (!VALID_FIGMA_TIERS.has(refTier)) {
      errors.push({ message: `Invalid ref: ${token.figmaName} → ${ref}`, detail: `"${refTier}" tokens are code-only and off-limits to Figma` });
      continue;
    }
    const allowed = FIGMA_ALLOWED_DEPS[token.tier];
    if (!allowed.includes(refTier)) {
      const allow = allowed.length ? allowed.join(', ') : '(none — use raw values)';
      errors.push({ message: `Tier violation: ${token.figmaName} → ${ref}`, detail: `${token.tier} → ${refTier} not allowed. Allowed: ${allow}` });
    }
  }
  return errors;
}

function buildGraph(figmaTokens) {
  const graph = new Map();
  for (const t of figmaTokens) {
    const ref = extractFigmaRef(t.figmaValue);
    graph.set(t.cssName, ref ? [ref] : []);
  }
  return graph;
}

function findCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color  = new Map();
  const cycles = [];
  for (const node of graph.keys()) color.set(node, WHITE);

  function dfs(start) {
    const stack = [{ node: start, path: [start], edgeIdx: 0 }];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const deps  = graph.get(frame.node) || [];
      if (frame.edgeIdx >= deps.length) { color.set(frame.node, BLACK); stack.pop(); continue; }
      const dep = deps[frame.edgeIdx++];
      if (!color.has(dep)) color.set(dep, WHITE);
      if (color.get(dep) === GRAY) {
        cycles.push([...frame.path.slice(frame.path.indexOf(dep)), dep]);
      } else if (color.get(dep) === WHITE) {
        color.set(dep, GRAY);
        stack.push({ node: dep, path: [...frame.path, dep], edgeIdx: 0 });
      }
    }
  }

  for (const [node, c] of color) { if (c === WHITE) dfs(node); }
  return cycles;
}

function diffTokens(cssTokens, figmaTokens) {
  const figmaMap    = new Map(figmaTokens.map(t => [t.cssName, t.cssValue]));
  const cssRelevant = new Map();
  for (const [name, data] of cssTokens) {
    const tier = getTierFromCSSName(name);
    if (tier && VALID_FIGMA_TIERS.has(tier)) cssRelevant.set(name, data);
  }
  const added = [], modified = [], removed = [], unchanged = [];
  for (const [name, figmaValue] of figmaMap) {
    if (!cssRelevant.has(name)) {
      added.push({ name, figmaValue });
    } else {
      const cssValue = cssRelevant.get(name).value;
      cssValue !== figmaValue
        ? modified.push({ name, cssValue, figmaValue })
        : unchanged.push({ name });
    }
  }
  for (const [name, data] of cssRelevant) {
    if (!figmaMap.has(name)) removed.push({ name, cssValue: data.value });
  }
  return { added, modified, removed, unchanged };
}

// ─── User Theme Registry ──────────────────────────────────────────────────────

/**
 * Load the persisted user theme registry if it exists.
 * Returns an empty structure when no registry is found.
 *
 * @param {string} registryPath
 * @returns {{ tokens: Object, removed: string[], changelog: Array }}
 */
function loadUserThemeRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) {
    return { tokens: {}, removed: [], changelog: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    return {
      tokens   : data.tokens    || {},
      removed  : data.removed   || [],
      changelog: data.changelog || [],
    };
  } catch {
    console.warn(`${WARN} Could not parse existing registry — starting fresh.`);
    return { tokens: {}, removed: [], changelog: [] };
  }
}

// ─── Interactive Review ───────────────────────────────────────────────────────

/**
 * Ask the user a single approval question via readline.
 * Returns one of: 'yes' | 'no' | 'all' | 'skip' | 'quit'
 *
 * Unrecognized input and bare Enter default to 'yes'.
 */
async function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      const a = answer.trim().toLowerCase();
      if (a === 'a')                          resolve('all');
      else if (a === 's')                     resolve('skip');
      else if (a === 'q')                     resolve('quit');
      else if (a === 'n' || a === 'no')       resolve('no');
      else                                    resolve('yes');
    });
  });
}

/**
 * Walk through one diff category interactively.
 *
 * @param {readline.Interface}    rl
 * @param {'NEW'|'MODIFIED'|'REMOVED'} kind
 * @param {Array}                 items
 * @param {(item, i, total)=>void} renderItem  — called once per item before prompt
 * @returns {Promise<{ approved: Array, skipped: Array, quit: boolean }>}
 */
async function reviewCategory(rl, kind, items, renderItem) {
  if (items.length === 0) return { approved: [], skipped: [], quit: false };

  const approved = [];
  const skipped  = [];
  const verb     = kind === 'REMOVED' ? 'Remove' : 'Apply';

  console.log('');
  console.log(SEP);
  console.log(`${kind} Tokens (${items.length})`);
  console.log(SEP);

  let applyAll = false;
  let skipAll  = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log('');
    renderItem(item, i + 1, items.length);

    if (applyAll) { approved.push(item); continue; }
    if (skipAll)  { skipped.push(item);  continue; }

    const answer = await prompt(rl, `  ${verb}? [y]es  [n]o  [a]ll  [s]kip all  [q]uit > `);

    if (answer === 'quit') {
      skipped.push(item);
      for (let j = i + 1; j < items.length; j++) skipped.push(items[j]);
      return { approved, skipped, quit: true };
    } else if (answer === 'all') {
      applyAll = true;
      approved.push(item);
    } else if (answer === 'skip') {
      skipAll = true;
      skipped.push(item);
    } else if (answer === 'yes') {
      approved.push(item);
    } else {
      skipped.push(item);
    }
  }

  return { approved, skipped, quit: false };
}

// ─── Apply Engine ─────────────────────────────────────────────────────────────

/**
 * Merge approved changes into the existing user theme registry state.
 *
 * @param {{ tokens: Object, removed: string[], changelog: Array }} current
 * @param {{ added: Array, updated: Array, removedFromTheme: Array }}  changes
 * @returns {{ tokens: Object, removed: string[], changelog: Array }}
 */
function mergeRegistryChanges(current, changes) {
  const tokens    = { ...current.tokens };
  const removedSet = new Set(current.removed || []);
  const changelog  = [];

  for (const item of changes.added) {
    const prev = tokens[item.name] || null;
    tokens[item.name] = item.figmaValue;
    removedSet.delete(item.name);
    changelog.push({ action: 'add', token: item.name, value: item.figmaValue, prev });
  }

  for (const item of changes.updated) {
    const prev = tokens[item.name] || item.cssValue;
    tokens[item.name] = item.figmaValue;
    changelog.push({ action: 'update', token: item.name, value: item.figmaValue, prev });
  }

  for (const item of changes.removedFromTheme) {
    const prev = tokens[item.name] || null;
    delete tokens[item.name];
    removedSet.add(item.name);
    changelog.push({ action: 'remove', token: item.name, prev });
  }

  return { tokens, removed: [...removedSet], changelog };
}

/**
 * Build the CSS selector for the user theme block.
 *
 * @param {'root'|'attr'} scope
 * @param {string}        themeName
 * @returns {string}
 */
function buildSelector(scope, themeName) {
  return scope === 'attr' ? `[data-theme="${themeName}"]` : ':root';
}

/**
 * Generate the user-theme.css content.
 * Produces a self-contained @layer themes { <selector> { ... } } block.
 *
 * @param {Object} tokens     { '--token-name': 'css-value' }
 * @param {string} selector   ':root' or '[data-theme="user"]'
 * @param {string} sourceFile Figma export path (for comment header)
 * @returns {string}
 */
function generateThemeCSS(tokens, selector, sourceFile) {
  const now     = new Date().toISOString();
  const relSrc  = path.basename(sourceFile);
  const entries = Object.entries(tokens);

  const header = [
    `/* Design System — User Theme`,
    ` * Generated : ${now}`,
    ` * Source    : ${relSrc}`,
    ` * Tokens    : ${entries.length}`,
    ` * Scope     : ${selector}`,
    ` *`,
    ` * DO NOT EDIT MANUALLY — regenerate with: npm run figma-sync-apply`,
    ` */`,
  ].join('\n');

  if (entries.length === 0) {
    return header + '\n\n/* (no token overrides — all tokens use system defaults) */\n';
  }

  const maxLen  = entries.reduce((m, [k]) => Math.max(m, k.length), 0);
  const decls   = entries.map(([name, value]) => {
    const pad = ' '.repeat(maxLen - name.length + 1);
    return `    ${name}:${pad}${value};`;
  });

  return [
    header,
    '',
    `@layer themes {`,
    '',
    `  ${selector} {`,
    ...decls,
    `  }`,
    '',
    `}`,
    '',
  ].join('\n');
}

/**
 * Generate the _user-theme.scss content.
 * Structurally identical to the CSS output; SCSS comment style.
 *
 * @param {Object} tokens
 * @param {string} selector
 * @param {string} sourceFile
 * @returns {string}
 */
function generateThemeSCSS(tokens, selector, sourceFile) {
  const now     = new Date().toISOString();
  const relSrc  = path.basename(sourceFile);
  const entries = Object.entries(tokens);
  const maxLen  = entries.reduce((m, [k]) => Math.max(m, k.length), 0);

  const decls = entries.length > 0
    ? entries.map(([name, value]) => {
        const pad = ' '.repeat(maxLen - name.length + 1);
        return `    ${name}:${pad}${value};`;
      })
    : ['    // (no token overrides — all tokens use system defaults)'];

  return [
    `// =============================================================================`,
    `// USER THEME`,
    `// FILE: scss/themes/_user-theme.scss`,
    `// LAYER: themes`,
    `//`,
    `// Generated : ${now}`,
    `// Source    : ${relSrc}`,
    `// Tokens    : ${entries.length}`,
    `// Scope     : ${selector}`,
    `//`,
    `// To include in the SCSS build pipeline, add to scss/themes/_index.scss:`,
    `//   @use 'user-theme';`,
    `//`,
    `// DO NOT EDIT MANUALLY — regenerate with: npm run figma-sync-apply`,
    `// =============================================================================`,
    '',
    `@layer themes {`,
    '',
    `  ${selector} {`,
    ...decls,
    `  }`,
    '',
    `}`,
    '',
  ].join('\n');
}

/**
 * Write all three output files atomically.
 * Directories are created if they don't exist.
 * Nothing is written until all content has been generated in memory.
 *
 * @param {{ tokens: Object, removed: string[], changelog: Array }} merged
 * @param {Object} opts
 * @param {string} cssSourceFile  Path to compiled CSS (for registry metadata)
 * @returns {{ cssPath: string, scssPath: string, registryPath: string }}
 */
function writeOutputFiles(merged, opts, cssSourceFile) {
  const { figmaFile, themeName, scope, outputDir } = opts;
  const selector = buildSelector(scope, themeName);

  // Generate all content in memory before touching disk
  const cssContent      = generateThemeCSS(merged.tokens, selector, figmaFile);
  const scssContent     = generateThemeSCSS(merged.tokens, selector, figmaFile);
  const registryContent = JSON.stringify({
    meta: {
      generatedAt : new Date().toISOString(),
      source      : path.relative(ROOT, figmaFile),
      cssFile     : path.relative(ROOT, cssSourceFile),
      themeName,
      scope,
      selector,
    },
    tokens   : merged.tokens,
    removed  : merged.removed,
    changelog: merged.changelog,
  }, null, 2) + '\n';

  const cssOutPath  = path.join(outputDir, 'user-theme.css');
  const scssOutPath = USER_THEME_SCSS;
  const regOutPath  = USER_THEME_REGISTRY;

  for (const p of [cssOutPath, scssOutPath, regOutPath]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }

  fs.writeFileSync(cssOutPath,  cssContent,      'utf8');
  fs.writeFileSync(scssOutPath, scssContent,     'utf8');
  fs.writeFileSync(regOutPath,  registryContent, 'utf8');

  return { cssPath: cssOutPath, scssPath: scssOutPath, registryPath: regOutPath };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  // Before readline opens, trap Ctrl+C at the process level.
  // Once readline is active it will handle SIGINT itself.
  process.on('SIGINT', () => {
    console.log('\n\nInterrupted — no changes were written.');
    process.exit(130);
  });

  // ── Header ────────────────────────────────────────────────────────────────
  console.log('');
  console.log(SEP);
  console.log('Phase 12 — Theme Sync Apply');
  console.log(SEP);

  // ── a) Resolve CSS source ─────────────────────────────────────────────────
  let cssFile = null;
  for (const c of CSS_CANDIDATES) { if (fs.existsSync(c)) { cssFile = c; break; } }

  if (!cssFile) {
    console.error(`\n${FAIL} No compiled CSS found.`);
    console.error('    Run \`npm run build\` first to produce dist/ds-preview.css');
    process.exit(1);
  }

  // ── b) Resolve Figma export ───────────────────────────────────────────────
  if (!fs.existsSync(opts.figmaFile)) {
    console.error(`\n${FAIL} Figma export not found: ${path.relative(ROOT, opts.figmaFile)}`);
    console.error('    Usage: npm run figma-sync-apply -- [path/to/figma-export.json]');
    console.error('    Default: figma-export.json (project root)');
    process.exit(1);
  }

  console.log(`  Figma source : ${path.relative(ROOT, opts.figmaFile)}`);
  console.log(`  CSS source   : ${path.relative(ROOT, cssFile)}`);
  console.log(`  Theme name   : ${opts.themeName}`);
  console.log(`  Token scope  : ${buildSelector(opts.scope, opts.themeName)}`);
  console.log(`  Mode         : ${opts.yes ? 'non-interactive (--yes)' : 'interactive'}`);
  console.log('');

  // ── c) Parse inputs ───────────────────────────────────────────────────────
  const cssTokens = parseCSSTokens(fs.readFileSync(cssFile, 'utf8'));

  let figmaTokens;
  try {
    figmaTokens = parseFigmaExport(fs.readFileSync(opts.figmaFile, 'utf8'));
  } catch (e) {
    console.error(`${FAIL} Figma parse error: ${e.message}`);
    process.exit(1);
  }

  // ── d) Architecture validation gate ──────────────────────────────────────
  // Violated tokens are blocked entirely — they cannot be approved or applied.
  const archErrors = validateFigmaTiers(figmaTokens);
  const cycles     = findCycles(buildGraph(figmaTokens));
  for (const cycle of cycles) {
    archErrors.push({ message: `Circular dependency: ${cycle.join(' → ')}` });
  }

  if (archErrors.length > 0) {
    console.log(`${FAIL} Architecture violations detected — sync blocked`);
    console.log('');
    for (const e of archErrors) {
      console.log(`  ${FAIL} ${e.message}`);
      if (e.detail) console.log(`       ${e.detail}`);
    }
    console.log('');
    console.log('Fix the above issues in your Figma token structure, then re-run.');
    process.exit(1);
  }

  console.log(`${PASS} Architecture valid`);
  console.log('');

  // ── e) Build diff ─────────────────────────────────────────────────────────
  const { added, modified, removed, unchanged } = diffTokens(cssTokens, figmaTokens);

  console.log('Diff against compiled CSS:');
  console.log(`  ${INFO} NEW        ${added.length}      (in Figma, not in CSS)`);
  console.log(`  ${INFO} MODIFIED   ${modified.length}      (in both, value differs)`);
  console.log(`  ${INFO} REMOVED    ${removed.length}      (in CSS, not in Figma — informational)`);
  console.log(`  ${INFO} UNCHANGED  ${unchanged.length}`);
  console.log('');

  if (added.length === 0 && modified.length === 0) {
    console.log(`${PASS} No new or modified tokens — nothing to apply.`);
    if (removed.length > 0) {
      console.log(`${INFO} ${removed.length} token(s) exist in system CSS but not Figma. No action required.`);
    }
    process.exit(0);
  }

  // ── f) Load existing user theme registry ─────────────────────────────────
  const currentRegistry = loadUserThemeRegistry(USER_THEME_REGISTRY);
  const existingCount   = Object.keys(currentRegistry.tokens).length;

  if (existingCount > 0) {
    console.log(`${INFO} Existing user theme: ${existingCount} token(s) will be merged`);
    console.log('');
  }

  // Tokens the user previously overrode that Figma no longer has
  // → offer to remove the override and revert to system default
  const removableFromTheme = removed.filter(r => r.name in currentRegistry.tokens);

  // ── g) Review ─────────────────────────────────────────────────────────────
  let approvedAdded   = [];
  let approvedUpdated = [];
  let approvedRemoved = [];
  let skippedCount    = 0;

  if (opts.yes) {
    // ── Non-interactive path ─────────────────────────────────────────────
    approvedAdded   = added;
    approvedUpdated = modified;
    // Removals always require explicit confirmation even in --yes mode
    approvedRemoved = [];
    skippedCount    = removableFromTheme.length;

    console.log(`${INFO} --yes: applying ${added.length + modified.length} change(s) without prompts`);
    if (removableFromTheme.length > 0) {
      console.log(`${WARN} ${removableFromTheme.length} removal(s) skipped — rerun without --yes to review them`);
    }
    console.log('');

  } else {
    // ── Interactive path ─────────────────────────────────────────────────
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.on('SIGINT', () => {
      rl.close();
      console.log('\n\nInterrupted — no changes were written.');
      process.exit(130);
    });

    // Show what's coming before the first prompt
    console.log('Review queue:');
    if (added.length > 0)            console.log(`  ${INFO} ${added.length} NEW token(s) to add`);
    if (modified.length > 0)         console.log(`  ${INFO} ${modified.length} MODIFIED token(s) to update`);
    if (removableFromTheme.length > 0) console.log(`  ${INFO} ${removableFromTheme.length} override(s) to remove from user theme`);
    console.log('');
    console.log('  At each prompt: [y]es  [n]o  [a]ll  [s]kip all  [q]uit');

    let quit = false;

    // Review: NEW
    if (!quit && added.length > 0) {
      const result = await reviewCategory(rl, 'NEW', added, (item, i, total) => {
        console.log(`  [${i} of ${total}]  + ${item.name}`);
        console.log(`              value: ${item.figmaValue}`);
      });
      approvedAdded = result.approved;
      skippedCount += result.skipped.length;
      if (result.quit) quit = true;
    }

    // Review: MODIFIED
    if (!quit && modified.length > 0) {
      const result = await reviewCategory(rl, 'MODIFIED', modified, (item, i, total) => {
        console.log(`  [${i} of ${total}]  ~ ${item.name}`);
        console.log(`              current:  ${item.cssValue}`);
        console.log(`              proposed: ${item.figmaValue}`);
      });
      approvedUpdated = result.approved;
      skippedCount += result.skipped.length;
      if (result.quit) quit = true;
    }

    // Review: REMOVED from user theme (only tokens the user previously overrode)
    if (!quit && removableFromTheme.length > 0) {
      console.log('');
      console.log(SEP);
      console.log('User theme overrides not present in Figma');
      console.log('Removing will revert each token to its system default.');
      const result = await reviewCategory(rl, 'REMOVED', removableFromTheme, (item, i, total) => {
        console.log(`  [${i} of ${total}]  - ${item.name}`);
        console.log(`              your override:   ${currentRegistry.tokens[item.name]}`);
        console.log(`              system default:  ${item.cssValue}`);
      });
      approvedRemoved = result.approved;
      skippedCount += result.skipped.length;
      if (result.quit) quit = true;
    }

    rl.close();

    const totalApprovedSoFar = approvedAdded.length + approvedUpdated.length + approvedRemoved.length;
    if (quit && totalApprovedSoFar === 0) {
      console.log('\nQuit — no changes approved. Nothing was written.');
      process.exit(2);
    }
    if (quit) {
      console.log(`\nQuit after partial review. ${totalApprovedSoFar} approved change(s) will be applied.`);
    }
  }

  const totalApproved = approvedAdded.length + approvedUpdated.length + approvedRemoved.length;

  if (totalApproved === 0) {
    console.log(`\n${INFO} No changes approved — nothing to write.`);
    process.exit(0);
  }

  // ── h) Merge and write ────────────────────────────────────────────────────
  console.log('');
  console.log(SEP);
  console.log(`Applying ${totalApproved} change(s)...`);
  console.log('');

  const merged = mergeRegistryChanges(currentRegistry, {
    added           : approvedAdded,
    updated         : approvedUpdated,
    removedFromTheme: approvedRemoved,
  });

  const outPaths = writeOutputFiles(merged, opts, cssFile);

  // ── i) Summary ────────────────────────────────────────────────────────────
  console.log(`${PASS} ${path.relative(ROOT, outPaths.cssPath)}`);
  console.log(`${PASS} ${path.relative(ROOT, outPaths.scssPath)}`);
  console.log(`${PASS} ${path.relative(ROOT, outPaths.registryPath)}`);
  console.log('');

  if (approvedAdded.length > 0) {
    console.log(`  Added (${approvedAdded.length})`);
    for (const t of approvedAdded)   console.log(`    + ${t.name}`);
    console.log('');
  }
  if (approvedUpdated.length > 0) {
    console.log(`  Updated (${approvedUpdated.length})`);
    for (const t of approvedUpdated) console.log(`    ~ ${t.name}`);
    console.log('');
  }
  if (approvedRemoved.length > 0) {
    console.log(`  Removed from user theme (${approvedRemoved.length})`);
    for (const t of approvedRemoved) console.log(`    - ${t.name}`);
    console.log('');
  }
  if (skippedCount > 0) {
    console.log(`  ${WARN} Skipped: ${skippedCount} token(s)`);
    console.log('');
  }

  console.log(SEP);
  console.log(`${PASS} Theme sync complete — ${totalApproved} token(s) applied`);
  console.log('');
  console.log('  Next steps:');
  console.log(`    1. Link  dist/user-theme.css  after  dist/ds-preview.css  in HTML`);
  console.log(`       OR add  @use 'user-theme';  to  scss/themes/_index.scss  and rebuild`);
  console.log('    2. Run   npm run build   to compile SCSS changes into dist/');
  console.log(`    3. Run   npm run figma-sync   to verify tokens match Figma`);
  console.log(SEP);
  console.log('');

  process.exit(0);
}

main().catch(e => {
  console.error(`\n${FAIL} Unexpected error: ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
