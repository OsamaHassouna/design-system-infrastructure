/**
 * PLAYGROUND ENGINE
 * preview/js/playground.js
 *
 * Responsibilities:
 *   1. Navigation — switch between component sections in the main pane
 *      and sync right panel (token table, playground controls, docs).
 *   2. Theme switching — toggle data-theme="dark" on the root element.
 *   3. Token table — render a searchable, copyable token table for
 *      the active component using DS_TOKENS from token-registry.js.
 *   4. Playground controls — render editable inputs for each token;
 *      on change, write CSS custom properties directly to :root so
 *      previews update in real time with zero rebuild.
 *   5. Export — generate a downloadable CSS file with all user overrides.
 *   6. Snippet copy — copy HTML snippet blocks to clipboard.
 *   7. Badge flow demo — render the component addition simulation.
 *
 * Token manipulation flow:
 *   User input → playground.setToken(name, value)
 *     → document.documentElement.style.setProperty(name, value)
 *     → CSS var() chain re-resolves
 *     → preview updates instantly (no re-render needed)
 */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────────────────── */
  const state = {
    activeComponent: 'button',
    activeTab:       'tokens',
    isDark:          false,
    overrides:       {},          // { varName: value }
    originals:       {},          // { varName: originalComputedValue }
  };

  /* ── DOM refs ───────────────────────────────────────────────────────────── */
  let root;
  let themeToggle;
  let tokenSearchInput;
  let tokenTableBody;
  let playgroundPane;
  let docsPane;
  let toast;

  /* ────────────────────────────────────────────────────────────────────────
     INIT
  ──────────────────────────────────────────────────────────────────────── */
  function init() {
    root             = document.documentElement;
    themeToggle      = document.getElementById('pg-theme-toggle');
    tokenSearchInput = document.getElementById('pg-token-search');
    tokenTableBody   = document.getElementById('pg-token-table-body');
    playgroundPane   = document.getElementById('pg-playground-pane');
    docsPane         = document.getElementById('pg-docs-pane');
    toast            = document.getElementById('pg-toast');

    // Navigation
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
    });

    // Theme toggle
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Panel tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Token search
    if (tokenSearchInput) {
      tokenSearchInput.addEventListener('input', () => filterTokenTable(tokenSearchInput.value));
    }

    // Export button
    const exportBtn = document.getElementById('pg-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportTheme);

    // Copy snippet buttons
    document.querySelectorAll('[data-copy-target]').forEach(btn => {
      btn.addEventListener('click', () => copySnippet(btn));
    });

    // Badge flow demo (renders on page load)
    renderBadgeFlowDemo();

    // Initial render — navigate to first registered component (or 'button' as fallback)
    const firstComponentId = (window.DS_REGISTRY && Object.keys(window.DS_REGISTRY.components || {})[0]) || 'button';
    navigateTo(firstComponentId);
  }

  /* ────────────────────────────────────────────────────────────────────────
     NAVIGATION
  ──────────────────────────────────────────────────────────────────────── */
  function navigateTo(componentId) {
    state.activeComponent = componentId;

    // Toggle section visibility
    document.querySelectorAll('.pg-component-section').forEach(sec => {
      sec.classList.toggle('is-active', sec.dataset.component === componentId);
    });

    // Sync nav items
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.nav === componentId);
    });

    // Re-render right panel for the new component
    renderTokenTable(componentId);
    renderPlaygroundControls(componentId);
    renderDocs(componentId);

    // Keep active tab shown
    switchTab(state.activeTab);
  }

  /* ────────────────────────────────────────────────────────────────────────
     PANEL TABS
  ──────────────────────────────────────────────────────────────────────── */
  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('[data-pane]').forEach(pane => {
      pane.classList.toggle('is-active', pane.dataset.pane === tabId);
    });
  }

  /* ────────────────────────────────────────────────────────────────────────
     THEME TOGGLE
  ──────────────────────────────────────────────────────────────────────── */
  function toggleTheme() {
    state.isDark = !state.isDark;
    root.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
    if (themeToggle) {
      const icon = themeToggle.querySelector('.pg-theme-toggle__icon');
      const label = themeToggle.querySelector('.pg-theme-toggle__label');
      if (icon)  icon.textContent  = state.isDark ? '☀️' : '🌑';
      if (label) label.textContent = state.isDark ? 'Light mode' : 'Dark mode';
    }
  }

  /* ────────────────────────────────────────────────────────────────────────
     TOKEN TABLE
  ──────────────────────────────────────────────────────────────────────── */
  function renderTokenTable(componentId) {
    if (!tokenTableBody) return;
    const def = window.DS_TOKENS?.[componentId];
    if (!def) { tokenTableBody.innerHTML = '<tr><td colspan="4">No token data.</td></tr>'; return; }

    const rows = [];
    def.tokenGroups.forEach(group => {
      // Group header row
      rows.push(`
        <tr>
          <td colspan="4" style="padding-top:0.75rem;padding-bottom:0.25rem;">
            <span style="font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--semantic-color-text-subtle);">${escHtml(group.group)}</span>
          </td>
        </tr>`);

      group.tokens.forEach(token => {
        const swatch = token.type === 'color'
          ? `<span class="pg-token-table__swatch" id="swatch-${swatchId(token.component)}" style="background:var(${token.component});"></span>`
          : '';

        const chain = token.semantic
          ? `${token.semantic}${token.primitive ? ' → ' + token.primitive : ''}`
          : (token.primitive || '—');

        const depBadge = token.deprecated
          ? `<span style="color:var(--semantic-color-feedback-warning-text);font-size:0.6em;background:var(--semantic-color-feedback-warning-subtle);padding:1px 4px;border-radius:3px;margin-left:4px;">deprecated</span>`
          : '';

        rows.push(`
          <tr data-token-name="${escHtml(token.component)}">
            <td class="pg-token-table__cell--name">
              ${swatch}${escHtml(token.component)}${depBadge}
            </td>
            <td class="pg-token-table__cell--chain" title="${escHtml(chain)}">${escHtml(chain)}</td>
            <td>
              <button class="pg-token-table__copy-btn" data-copy="${escHtml(token.component)}" title="Copy CSS variable">⎘</button>
            </td>
          </tr>`);
      });
    });

    tokenTableBody.innerHTML = rows.join('');

    // Attach copy handlers
    tokenTableBody.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(`var(${btn.dataset.copy})`).then(() => {
          showToast(`Copied var(${btn.dataset.copy})`);
        });
      });
    });
  }

  function filterTokenTable(query) {
    if (!tokenTableBody) return;
    const q = query.toLowerCase();
    tokenTableBody.querySelectorAll('tr[data-token-name]').forEach(row => {
      const name = row.dataset.tokenName.toLowerCase();
      row.style.display = name.includes(q) ? '' : 'none';
    });
  }

  function swatchId(varName) {
    return varName.replace(/[^a-z0-9]/gi, '-');
  }

  /* ────────────────────────────────────────────────────────────────────────
     PLAYGROUND CONTROLS
  ──────────────────────────────────────────────────────────────────────── */
  function renderPlaygroundControls(componentId) {
    if (!playgroundPane) return;
    const def = window.DS_TOKENS?.[componentId];
    if (!def) { playgroundPane.innerHTML = '<p class="pg-playground-intro">No playground data.</p>'; return; }

    const editableTokens = def.tokenGroups
      .flatMap(g => g.tokens.filter(t => t.editable))
      .slice(0, 20); // cap at 20 controls for readability

    if (editableTokens.length === 0) {
      playgroundPane.innerHTML = '<p class="pg-playground-intro">No editable tokens for this component.</p>';
      return;
    }

    let html = `
      <p class="pg-playground-intro">
        Edit component tokens below. Changes apply instantly via CSS custom properties.
        The cascade updates <em>all</em> component states automatically — no rebuild needed.
      </p>
      <button class="pg-reset-btn" id="pg-reset-all-btn">↺ Reset all to defaults</button>
      <hr style="border:none;border-top:1px solid var(--semantic-color-border-default);margin:0.875rem 0;">`;

    let lastGroup = null;
    editableTokens.forEach(token => {
      // Find group label
      const group = def.tokenGroups.find(g => g.tokens.includes(token));
      if (group && group.group !== lastGroup) {
        lastGroup = group.group;
        html += `<span class="pg-control-section__title">${escHtml(group.group)}</span>`;
      }

      const id = 'ctrl-' + swatchId(token.component);
      const currentValue = getTokenValue(token.component);

      html += `<div class="pg-control-group" data-ctrl-token="${escHtml(token.component)}">
        <label class="pg-control-group__label" for="${id}">${escHtml(token.component)}</label>
        <span class="pg-control-group__sublabel">
          ${token.semantic ? `via ${escHtml(token.semantic)}` : ''}
          ${token.primitive ? ` → ${escHtml(token.primitive)}` : ''}
        </span>
        <div class="pg-control">`;

      if (token.type === 'color') {
        html += `<input id="${id}" type="color" class="pg-control__color"
                   value="${resolveColorHex(token.component)}"
                   data-token="${escHtml(token.component)}">
                 <input type="text" class="pg-control__input" id="${id}-text"
                   value="${resolveColorHex(token.component)}"
                   placeholder="#000000"
                   data-token="${escHtml(token.component)}"
                   data-pair="${id}">`;
      } else if (token.type === 'spacing' || token.type === 'radius') {
        const pxVal = remToPx(currentValue);
        html += `<input id="${id}" type="range" class="pg-control__range" min="0" max="48" step="1"
                   value="${pxVal}"
                   data-token="${escHtml(token.component)}"
                   data-unit="px">
                 <span class="pg-control__value" id="${id}-val">${pxVal}px</span>`;
      } else if (token.type === 'typography') {
        html += `<input id="${id}" type="text" class="pg-control__input"
                   value="${currentValue}"
                   data-token="${escHtml(token.component)}">`;
      } else {
        html += `<input id="${id}" type="text" class="pg-control__input"
                   value="${currentValue}"
                   data-token="${escHtml(token.component)}">`;
      }

      html += `</div></div>`;
    });

    playgroundPane.innerHTML = html;

    // Bind reset
    const resetBtn = document.getElementById('pg-reset-all-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => resetAllTokens(componentId));

    // Bind color pickers
    playgroundPane.querySelectorAll('input[type="color"][data-token]').forEach(input => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        setToken(input.dataset.token, val);
        const textSibling = playgroundPane.querySelector(`[data-pair="${input.id}"]`);
        if (textSibling) textSibling.value = val;
        updateSwatches(input.dataset.token, val);
      });
    });

    // Bind text inputs (colour or freeform value)
    playgroundPane.querySelectorAll('input[type="text"][data-token]').forEach(input => {
      input.addEventListener('change', (e) => {
        const val = e.target.value;
        setToken(input.dataset.token, val);
        updateSwatches(input.dataset.token, val);
      });
    });

    // Bind range sliders
    playgroundPane.querySelectorAll('input[type="range"][data-token]').forEach(input => {
      input.addEventListener('input', (e) => {
        const val = e.target.value + (input.dataset.unit || 'px');
        setToken(input.dataset.token, val);
        const valLabel = document.getElementById(input.id + '-val');
        if (valLabel) valLabel.textContent = val;
      });
    });
  }

  /* ────────────────────────────────────────────────────────────────────────
     TOKEN MANIPULATION
  ──────────────────────────────────────────────────────────────────────── */
  function setToken(varName, value) {
    if (!(varName in state.originals)) {
      // Store original computed value before first override
      state.originals[varName] = root.style.getPropertyValue(varName) ||
        getComputedStyle(root).getPropertyValue(varName).trim();
    }
    state.overrides[varName] = value;
    root.style.setProperty(varName, value);
  }

  function resetToken(varName) {
    const original = state.originals[varName];
    if (original !== undefined) {
      root.style.setProperty(varName, original);
    } else {
      root.style.removeProperty(varName);
    }
    delete state.overrides[varName];
  }

  function resetAllTokens(componentId) {
    const def = window.DS_TOKENS?.[componentId];
    if (!def) return;
    def.tokenGroups.flatMap(g => g.tokens).forEach(t => {
      resetToken(t.component);
    });
    // Re-render controls with reset values
    renderPlaygroundControls(componentId);
    renderTokenTable(componentId);
    showToast('All tokens reset to defaults');
  }

  /* ────────────────────────────────────────────────────────────────────────
     EXPORT
  ──────────────────────────────────────────────────────────────────────── */
  function exportTheme() {
    if (Object.keys(state.overrides).length === 0) {
      showToast('No overrides to export — edit tokens in the Playground tab first.');
      return;
    }

    const themeId = 'custom';
    const lines = [
      `/* ================================================================`,
      `   EXPORTED CUSTOM THEME`,
      `   Generated by DS Preview Playground — ${new Date().toISOString()}`,
      `   Component: ${state.activeComponent}`,
      `   Override count: ${Object.keys(state.overrides).length}`,
      `   ================================================================ */`,
      ``,
      `/* Import this after your core DS CSS and apply by adding`,
      `   data-theme="${themeId}" to any ancestor element. */`,
      ``,
      `@layer themes {`,
      ``,
      `  [data-theme="${themeId}"] {`,
    ];

    Object.entries(state.overrides).forEach(([name, val]) => {
      lines.push(`    ${name}: ${val};`);
    });

    lines.push(`  }`, ``, `}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/css' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `theme-${themeId}-${state.activeComponent}.css`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Theme CSS downloaded!');
  }

  /* ────────────────────────────────────────────────────────────────────────
     DOCS PANE
  ──────────────────────────────────────────────────────────────────────── */
  function renderDocs(componentId) {
    if (!docsPane) return;
    const def = window.DS_TOKENS?.[componentId];
    if (!def) return;

    const tokenCount = def.tokenGroups.reduce((n, g) => n + g.tokens.length, 0);
    const groupCount = def.tokenGroups.length;

    docsPane.innerHTML = `
      <div class="pg-docs">
        <h3>${escHtml(def.label)} Component</h3>
        <p>${escHtml(def.description)}</p>

        <h3>Token summary</h3>
        <ul>
          <li><strong>${tokenCount}</strong> component CSS custom properties</li>
          <li><strong>${groupCount}</strong> logical token groups</li>
          <li>Version: <code>${escHtml(def.version)}</code></li>
          ${def.isNew ? '<li><strong>New in Phase 7</strong></li>' : ''}
        </ul>

        <h3>Layer contract</h3>
        <p>All <code>--component-${escHtml(componentId)}-*</code> variables are declared in
        <code>@layer components</code>. Theme overrides must be scoped to
        <code>@layer themes</code> or <code>[data-theme]</code> selectors only.</p>

        <h3>Override pattern</h3>
        <p>Themes only override <strong>primitive tokens</strong>. The semantic and
        component layers re-resolve automatically via <code>var()</code> chains.
        When a component needs a unique dark appearance that primitives alone can't
        cover, override <code>--component-${escHtml(componentId)}-*</code> variables
        inside a <code>[data-theme]</code> selector in the <code>themes</code>
        layer only.</p>

        <h3>Adapter integration</h3>
        <p>Adapters (Angular, PrimeNG, etc.) consume the same
        <code>--component-${escHtml(componentId)}-*</code> variables. Adapter files
        in <code>@layer adapters</code> remap framework-specific selectors onto DS
        variables. No raw values or semantic token references appear in adapter
        files.</p>

        <h3>Adding a new component</h3>
        <p>See the <strong>Badge Addition</strong> section in the main canvas for a
        live walk-through of the full token flow: tokens.json → theme merge →
        deprecated token handling → CSS output → version bump.</p>
      </div>`;
  }

  /* ────────────────────────────────────────────────────────────────────────
     BADGE FLOW DEMO (component addition simulation)
  ──────────────────────────────────────────────────────────────────────── */
  function renderBadgeFlowDemo() {
    const container = document.getElementById('pg-badge-flow-demo');
    if (!container || !window.BADGE_TOKEN_FLOW) return;
    const flow = window.BADGE_TOKEN_FLOW;
    const dep  = window.DEPRECATED_TOKEN_EXAMPLE;

    container.innerHTML = `
      <!-- tokens.json before / after -->
      <p style="font-size:0.8125rem;line-height:1.6;color:var(--semantic-color-text-default);margin-bottom:1rem;">
        Adding a new component requires three artefacts: a <code>tokens.json</code>
        entry, optional user-theme overrides, and the resolved CSS output.
        Below is the complete before → after diff for the Badge component added in Phase 7.
      </p>

      <div class="pg-token-diff">
        <div class="pg-token-diff__panel">
          <div class="pg-token-diff__head pg-token-diff__head--before">
            <span>−</span> ${escHtml(flow.before.title)}
          </div>
          <div class="pg-token-diff__body">${escHtml(flow.before.content)}</div>
        </div>
        <div class="pg-token-diff__panel">
          <div class="pg-token-diff__head pg-token-diff__head--after">
            <span>+</span> ${escHtml(flow.after.title)}
          </div>
          <div class="pg-token-diff__body">${escHtml(flow.after.content)}</div>
        </div>
      </div>

      <!-- User theme override -->
      <div class="pg-token-diff" style="grid-template-columns:1fr 1fr;">
        <div class="pg-token-diff__panel">
          <div class="pg-token-diff__head" style="color:var(--semantic-color-text-brand);">
            🎨 ${escHtml(flow.userThemeOverride.title)}
          </div>
          <div class="pg-token-diff__body">${escHtml(flow.userThemeOverride.content)}</div>
        </div>
        <div class="pg-token-diff__panel">
          <div class="pg-token-diff__head" style="color:var(--semantic-color-text-brand);">
            📦 ${escHtml(flow.resolvedCSS.title)}
          </div>
          <div class="pg-token-diff__body">${escHtml(flow.resolvedCSS.content)}</div>
        </div>
      </div>

      <!-- Version bump -->
      <div class="pg-token-diff__panel" style="margin-bottom:1rem;">
        <div class="pg-token-diff__head" style="color:var(--semantic-color-feedback-warning-text);">
          📋 Version bump explanation
        </div>
        <div class="pg-token-diff__body">${escHtml(flow.versionBump.description)}</div>
      </div>

      <!-- Deprecated token example -->
      <div class="pg-token-diff__panel">
        <div class="pg-token-diff__head pg-token-diff__head--before">
          ⚠️ Deprecated token handling — example
        </div>
        <div class="pg-token-diff__body">${escHtml(dep.migration)}</div>
      </div>
      <p style="font-size:0.8125rem;color:var(--semantic-color-text-subtle);margin-top:0.5rem;line-height:1.5;">
        Token <code>${escHtml(dep.tokenName)}</code> was deprecated in
        <code>v${escHtml(dep.deprecatedSince)}</code> and replaced with
        <code>${escHtml(dep.replacement)}</code>. Reason: ${escHtml(dep.reason)}
        The deprecated variable remains functional but emits a warning until
        the next major version removes it.
      </p>`;
  }

  /* ────────────────────────────────────────────────────────────────────────
     HELPERS
  ──────────────────────────────────────────────────────────────────────── */

  /** Read a computed CSS custom property value from :root */
  function getTokenValue(varName) {
    return getComputedStyle(root).getPropertyValue(varName).trim() || varName;
  }

  /**
   * Resolve a CSS variable that points to a color and return a hex string.
   * Falls back to a neutral grey if the token can't be resolved (e.g. shadow tokens).
   */
  function resolveColorHex(varName) {
    const val = getTokenValue(varName);
    // If it's already a hex value, use it
    if (/^#[0-9a-f]{3,8}$/i.test(val)) return val;
    // Otherwise try creating a canvas to get the computed colour
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = val;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return rgbToHex(r, g, b);
    } catch {
      return '#888888';
    }
  }

  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
  }

  function remToPx(remStr) {
    if (!remStr) return 0;
    const n = parseFloat(remStr);
    if (isNaN(n)) return 0;
    if (remStr.includes('rem')) return Math.round(n * 16);
    if (remStr.includes('px'))  return Math.round(n);
    return Math.round(n);
  }

  /** Update color swatches in the token table when a color is edited */
  function updateSwatches(varName, value) {
    const id = swatchId(varName);
    const swatch = document.getElementById('swatch-' + id);
    if (swatch) swatch.style.background = value;
  }

  function swatchId(varName) {
    return varName.replace(/[^a-z0-9]/gi, '-');
  }

  /** Copy a snippet block to the clipboard */
  function copySnippet(btn) {
    const targetId = btn.dataset.copyTarget;
    const el = document.getElementById(targetId);
    if (!el) return;
    const text = el.textContent;
    navigator.clipboard?.writeText(text).then(() => {
      btn.textContent = '✓ Copied!';
      btn.classList.add('is-copied');
      setTimeout(() => {
        btn.textContent = '⎘ Copy';
        btn.classList.remove('is-copied');
      }, 1800);
    });
  }

  /** Show a brief toast notification */
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  /** Escape HTML special characters */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ────────────────────────────────────────────────────────────────────────
     PUBLIC API
     Phase 9: playground.js no longer auto-initialises.
     init() and renderBadgeFlowDemo() are called by the registry init sequence
     in preview/index.html AFTER RegistryEngine has built all component sections
     and nav items.  Order: RegistryEngine.init() → buildPreviewNav() →
     buildPreviewSections() → PlaygroundEngine.init() → renderBadgeFlowDemo().
  ──────────────────────────────────────────────────────────────────────── */
  window.PlaygroundEngine = {
    init,
    renderBadgeFlowDemo,
  };

})();
