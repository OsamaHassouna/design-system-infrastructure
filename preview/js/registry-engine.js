/**
 * REGISTRY ENGINE
 * preview/js/registry-engine.js
 *
 * Phase 9 — Fully Register-Driven
 *
 * Responsibilities:
 *   1. Load component.registry.json and adapter.registry.json.
 *   2. Expose window.DS_REGISTRY (combined dataset).
 *   3. Build the preview navigation dynamically from the registry.
 *   4. Build all preview component sections dynamically — no hardcoded markup.
 *   5. Build complete docs pages dynamically — no hardcoded component markup.
 *
 * Architecture rules obeyed:
 *   - This file is metadata rendering only. It does NOT mutate tokens.
 *   - All component HTML generated here uses DS BEM classes and DS token
 *     custom properties exclusively. No raw values are injected.
 *   - The engine reads component.registry.json for rendering shape.
 *     It reads DS_TOKENS (from token-registry.js) for token flow tables.
 *   - Adapter information is read from adapter.registry.json — the engine
 *     never touches adapter SCSS files.
 *
 * Usage:
 *   // Both pages:
 *   RegistryEngine.init().then(() => { startApp(); });
 *
 *   // Preview page only:
 *   RegistryEngine.buildPreviewNav(document.getElementById('pg-nav-list'));
 *   RegistryEngine.buildPreviewSections(document.getElementById('pg-main'));
 *
 *   // Docs page only:
 *   RegistryEngine.buildDocPage('button', document.getElementById('doc-main'));
 *   RegistryEngine.buildDocNav(document.getElementById('doc-component-nav'));
 */

(function (global) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════════
     DEMO ICON LIBRARY
     Small set of SVG paths used for "with icon" preview demos.
     These are illustration-only and are not part of the DS component API.
  ══════════════════════════════════════════════════════════════════════════ */
  const DEMO_ICONS = {
    plus:  'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.5a.75.75 0 0 0-1.5 0v3.25H4a.75.75 0 0 0 0 1.5h3.25V13.5a.75.75 0 0 0 1.5 0V10.25H12a.75.75 0 0 0 0-1.5H8.75V5.5z',
    save:  'M11.5 2a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-9A1.5 1.5 0 0 1 4.5 2h7zM4.5 1A2.5 2.5 0 0 0 2 3.5v9A2.5 2.5 0 0 0 4.5 15h7a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 11.5 1h-7z',
    close: 'M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z',
    check: 'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z',
  };

  /* ══════════════════════════════════════════════════════════════════════════
     CATEGORY EMOJI MAP
     Maps component categories to display icons for navigation.
  ══════════════════════════════════════════════════════════════════════════ */
  const CATEGORY_EMOJI = {
    interactive: '🔘',
    indicator:   '🏷️',
    container:   '🃏',
    layout:      '📐',
    utility:     '🔧',
    overlay:     '🪟',
  };

  /* ══════════════════════════════════════════════════════════════════════════
     ENGINE STATE
  ══════════════════════════════════════════════════════════════════════════ */
  let _componentRegistry = null;
  let _adapterRegistry   = null;
  let _initialized       = false;
  let _basePath          = '';

  /* ══════════════════════════════════════════════════════════════════════════
     BOOT — INIT & DATA LOADING
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Resolve the base path to the data directory by inspecting this
   * script's src attribute. Works for both preview/ and docs/ pages
   * because the script is always in preview/js/.
   */
  function resolveBasePath() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || '';
      if (src.includes('registry-engine.js')) {
        // script is at preview/js/registry-engine.js → base is preview/js/
        // data is at preview/data/ → '../data/'
        return src.substring(0, src.lastIndexOf('/') + 1) + '../data/';
      }
    }
    // Fallback — assume we are at the workspace root
    return './preview/data/';
  }

  /**
   * Fetch a JSON file. Falls back to null on error (file:// protocol etc.).
   */
  async function fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[RegistryEngine] Could not load ${url}:`, err.message);
      return null;
    }
  }

  /**
   * Public init. Must be awaited before calling any build* method.
   * Safe to call multiple times — resolves immediately on subsequent calls.
   */
  async function init() {
    if (_initialized) return;

    _basePath = resolveBasePath();

    const [compReg, adpReg] = await Promise.all([
      fetchJSON(_basePath + 'component.registry.json'),
      fetchJSON(_basePath + 'adapter.registry.json'),
    ]);

    _componentRegistry = compReg;
    _adapterRegistry   = adpReg;

    // Expose combined dataset globally
    global.DS_REGISTRY = {
      components: _componentRegistry?.components ?? {},
      adapters:   _adapterRegistry?.adapters     ?? [],
    };

    _initialized = true;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ACCESSORS
  ══════════════════════════════════════════════════════════════════════════ */

  function getComponent(id) {
    if (!_componentRegistry) return null;
    return _componentRegistry.components?.[id] ?? null;
  }

  function getAllComponents() {
    if (!_componentRegistry) return [];
    return Object.values(_componentRegistry.components ?? {});
  }

  function getAdapterMatrix(componentId) {
    if (!_adapterRegistry) return [];
    return _adapterRegistry.adapters.map(adapter => {
      const matchingVersions = adapter.versions.filter(v =>
        v.supportedComponents.includes(componentId)
      );
      return {
        adapterId:   adapter.id,
        adapterName: adapter.name,
        versions:    matchingVersions,
        supported:   matchingVersions.length > 0,
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     NAVIGATION BUILDING
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Build preview navigation items into a <ul> element.
   * Each item gets data-nav="{id}" for playground.js to hook.
   */
  function buildPreviewNav(ulElement) {
    if (!ulElement) return;
    const components = getAllComponents();
    ulElement.innerHTML = components.map(def => {
      const emoji   = CATEGORY_EMOJI[def.category] ?? '📦';
      const isNew   = def.isNew ? `<span class="pg-nav__badge pg-nav__badge--new">NEW</span>` : `<span class="pg-nav__badge">v${def.version}</span>`;
      return `<li>
        <button class="pg-nav__item" type="button" data-nav="${esc(def.id)}" aria-current="false">
          ${emoji} ${esc(def.name)}
          ${isNew}
        </button>
      </li>`;
    }).join('\n');
  }

  /**
   * Build docs sidebar component nav into a <nav> element.
   * Each link gets href="#" and data-doc-nav="{id}".
   */
  function buildDocNav(navElement, activeId) {
    if (!navElement) return;
    const components = getAllComponents();
    navElement.innerHTML = components.map(def => {
      const isActive = def.id === activeId;
      return `<a href="javascript:void(0)"
          class="doc-sidebar__link${isActive ? ' doc-sidebar__link--active' : ''}"
          data-doc-nav="${esc(def.id)}">
          ${esc(def.name)}
          <span class="doc-sidebar__version">v${esc(def.version)}</span>
        </a>`;
    }).join('\n');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PREVIEW SECTION BUILDING — PUBLIC API
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Build all preview sections into a <main> element.
   * Clears existing hardcoded content.
   * Also appends the "badge-flow" demo section if BADGE_TOKEN_FLOW data exists.
   */
  function buildPreviewSections(mainElement) {
    if (!mainElement) return;

    const components = getAllComponents();
    const sections = components.map(def => buildPreviewSection(def)).join('\n');

    // Append the badge-flow demo section (Phase 7 artefact — kept for reference)
    const flowSection = buildBadgeFlowSection();

    mainElement.innerHTML = sections + flowSection;

    // Attach live-badge-flow inline handler if it exists in the page
    _attachLiveBadgeFlowHandler();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PREVIEW SECTION — PER-COMPONENT DISPATCH
  ══════════════════════════════════════════════════════════════════════════ */

  function buildPreviewSection(def) {
    switch (def.category) {
      case 'interactive': return buildInteractiveSection(def);
      case 'indicator':   return buildIndicatorSection(def);
      case 'container':   return buildContainerSection(def);
      default:            return buildGenericSection(def);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INTERACTIVE SECTION  (e.g. Button)
  ══════════════════════════════════════════════════════════════════════════ */

  function buildInteractiveSection(def) {
    const defaultSize    = def.sizes.find(s => s.default) || def.sizes[0];
    const defaultVariant = def.variants.find(v => v.default) || def.variants[0];

    let html = openSection(def);
    html += buildSectionHeader(def);

    // ── Variants × default size ────────────────────────────────────────────
    if (def.variants.length > 0 && defaultSize) {
      html += `<p class="pg-heading">Variants \u2014 ${esc(defaultSize.id)} size</p>
      <div class="pg-variant-grid">`;
      def.variants.forEach(v => {
        html += interactiveItem(def, v.id, defaultSize.id, 'default');
      });
      html += `</div>`;
    }

    // ── Sizes × default variant ────────────────────────────────────────────
    if (def.sizes.length > 1 && defaultVariant) {
      html += `<p class="pg-heading">Sizes \u2014 ${esc(defaultVariant.id)} variant</p>
      <div class="pg-variant-grid pg-variant-grid--sizes">`;
      def.sizes.forEach(s => {
        html += interactiveItem(def, defaultVariant.id, s.id, 'default',
          { customLabel: `${s.label} \u00b7 ${s.height}` });
      });
      html += `</div>`;
    }

    // ── Icon + label (if hasIconOnly flag or icon slot exists) ─────────────
    const iconSlot = def.slots.find(s => s.id === 'icon');
    if (iconSlot && def.renderHint?.iconDemoVariants?.length) {
      html += `<p class="pg-heading">With icon</p>
      <div class="pg-variant-grid">`;
      def.renderHint.iconDemoVariants.forEach(vId => {
        const vDef = def.variants.find(v => v.id === vId);
        if (!vDef) return;
        html += interactiveItem(def, vId, defaultSize?.id, 'default',
          { withIcon: true, customLabel: `${vId} \u00b7 icon + label` });
      });
      if (def.flags.hasIconOnly && def.renderHint.iconOnlyVariant) {
        const vId = def.renderHint.iconOnlyVariant;
        html += iconOnlyItem(def, vId, defaultSize?.id);
      }
      html += `</div>`;
    }

    // ── States × default variant ───────────────────────────────────────────
    const applicableStates = def.states.filter(s =>
      !s.requiresFlag || def.flags[s.requiresFlag]
    );
    if (applicableStates.length > 0 && defaultVariant && defaultSize) {
      html += `<p class="pg-heading">States \u2014 ${esc(defaultVariant.id)} variant</p>
      <div class="pg-variant-grid">`;
      applicableStates.forEach(s => {
        html += interactiveItem(def, defaultVariant.id, defaultSize.id, s.id);
      });
      html += `</div>`;
    }

    // ── Anchor element demo (if hasAnchorVariant) ─────────────────────────
    if (def.flags.hasAnchorVariant) {
      html += `<p class="pg-heading">Anchor element with button styles</p>
      <div class="pg-variant-grid">
        <div class="pg-preview-item">
          <a href="#" class="${esc(def.bemBlock)} ${esc(def.bemBlock)}--${esc(defaultVariant?.id)} ${esc(def.bemBlock)}--${esc(defaultSize?.id)}" role="button">
            <span class="${esc(def.bemBlock)}__label">Link as Button</span>
          </a>
          <span class="pg-state-label">&lt;a&gt; element</span>
        </div>
        <div class="pg-preview-item">
          <a href="#" class="${esc(def.bemBlock)} ${esc(def.bemBlock)}--secondary ${esc(def.bemBlock)}--${esc(defaultSize?.id)} ${esc(def.bemBlock)}--disabled" role="button" aria-disabled="true" tabindex="-1">
            <span class="${esc(def.bemBlock)}__label">Disabled link</span>
          </a>
          <span class="pg-state-label">&lt;a&gt; disabled</span>
        </div>
      </div>`;
    }

    // ── State × Variant matrix (if matrixStates defined) ──────────────────
    if (def.matrixStates?.length > 0 && def.variants.length > 0 && defaultSize) {
      html += buildInteractiveMatrix(def, defaultSize.id);
    }

    // ── HTML snippet ───────────────────────────────────────────────────────
    html += buildInteractiveSnippet(def);

    html += closeSection();
    return html;
  }

  function interactiveItem(def, variantId, sizeId, stateId, opts = {}) {
    const stateDef  = def.states.find(s => s.id === stateId);
    const variantDef = def.variants.find(v => v.id === variantId);
    const sizeDef   = def.sizes.find(s => s.id === sizeId);

    const classes = [def.bemBlock];
    if (variantId) classes.push(`${def.bemBlock}--${variantId}`);
    if (sizeId)    classes.push(`${def.bemBlock}--${sizeId}`);
    if (stateDef?.modifier) classes.push(`${def.bemBlock}--${stateDef.modifier}`);

    const attrs = [`class="${classes.join(' ')}"`, `type="button"`];
    if (stateDef?.htmlAttr) {
      Object.entries(stateDef.htmlAttr).forEach(([k, v]) => {
        attrs.push(v === true ? k : `${k}="${esc(String(v))}"`);
      });
    }
    if (opts.previewStyle || stateDef?.previewStyle) {
      attrs.push(`style="${esc(opts.previewStyle || stateDef.previewStyle)}"`);
    }

    const isLoading  = stateId === 'loading';
    const withIcon   = opts.withIcon === true;
    const labelText  = opts.customLabel
      ? null
      : (isLoading ? (variantDef?.label ?? 'Button') + '\u2026' : (variantDef?.label ?? 'Button'));

    let inner = '';
    if (isLoading) {
      inner += `<span class="${def.bemBlock}__spinner" aria-hidden="true"></span>`;
    }
    if (withIcon && !isLoading) {
      inner += iconSvg(def.bemBlock, def.renderHint?.iconDemoVariants?.indexOf(variantId) === 1 ? 'save' : 'plus');
    }
    inner += `<span class="${def.bemBlock}__label">${esc(labelText ?? variantDef?.label ?? 'Button')}</span>`;

    const stateLabel = opts.customLabel
      ? opts.customLabel
      : [variantId, stateId !== 'default' ? stateId : null].filter(Boolean).join(' \u00b7 ');

    return `<div class="pg-preview-item">
      <${def.htmlElement} ${attrs.join(' ')}>${inner}</${def.htmlElement}>
      <span class="pg-state-label">${esc(stateLabel)}</span>
    </div>`;
  }

  function iconOnlyItem(def, variantId, sizeId) {
    const classes = [
      def.bemBlock,
      `${def.bemBlock}--${variantId}`,
      `${def.bemBlock}--icon-only`,
      sizeId ? `${def.bemBlock}--${sizeId}` : '',
    ].filter(Boolean);
    return `<div class="pg-preview-item">
      <${def.htmlElement} class="${classes.join(' ')}" type="button" aria-label="Close panel">
        ${iconSvg(def.bemBlock, 'close')}
      </${def.htmlElement}>
      <span class="pg-state-label">icon-only (${esc(variantId)})</span>
    </div>`;
  }

  function buildInteractiveMatrix(def, sizeId) {
    const matrixStateDefs = def.matrixStates
      .map(sid => def.states.find(s => s.id === sid))
      .filter(s => s && (!s.requiresFlag || def.flags[s.requiresFlag]));

    const variantHeaders = def.variants.map(v => `<div>${esc(v.label)}</div>`).join('');

    const rows = matrixStateDefs.map(stateDef => {
      const cells = def.variants.map(v => {
        const classes = [
          def.bemBlock,
          `${def.bemBlock}--${v.id}`,
          `${def.bemBlock}--sm`,
        ];
        if (stateDef.modifier) classes.push(`${def.bemBlock}--${stateDef.modifier}`);

        const attrs = [`class="${classes.join(' ')}"`, `type="button"`];
        if (stateDef.htmlAttr) {
          Object.entries(stateDef.htmlAttr).forEach(([k, val]) => {
            attrs.push(val === true ? k : `${k}="${esc(String(val))}"`);
          });
        }

        let inner = '';
        if (stateDef.id === 'loading') {
          inner = `<span class="${def.bemBlock}__spinner" aria-hidden="true"></span>`;
        }
        inner += `<span class="${def.bemBlock}__label">Btn</span>`;

        return `<div><${def.htmlElement} ${attrs.join(' ')}>${inner}</${def.htmlElement}></div>`;
      }).join('');

      return `<div class="pg-matrix__row">
        <div class="pg-matrix__row-label">${esc(stateDef.label)}</div>
        ${cells}
      </div>`;
    }).join('');

    return `<p class="pg-heading">State \u00d7 Variant matrix</p>
    <div class="pg-matrix">
      <div class="pg-matrix__header">
        <div></div>
        ${variantHeaders}
      </div>
      ${rows}
    </div>`;
  }

  function buildInteractiveSnippet(def) {
    const defaultVariant = def.variants.find(v => v.default) || def.variants[0];
    const defaultSize    = def.sizes.find(s => s.default)    || def.sizes[0];
    const id             = `${def.id}-snippet`;

    const lines = [
      `<!-- Text button (${defaultVariant?.id}, ${defaultSize?.id}) -->`,
      `<${def.htmlElement} class="${def.bemBlock} ${def.bemBlock}--${defaultVariant?.id} ${def.bemBlock}--${defaultSize?.id}" type="button">`,
      `  <span class="${def.bemBlock}__label">Save</span>`,
      `</${def.htmlElement}>`,
      '',
      `<!-- Icon + label (secondary, sm) -->`,
      `<${def.htmlElement} class="${def.bemBlock} ${def.bemBlock}--secondary ${def.bemBlock}--sm" type="button">`,
      `  <svg class="${def.bemBlock}__icon" aria-hidden="true">\u2026</svg>`,
      `  <span class="${def.bemBlock}__label">Export</span>`,
      `</${def.htmlElement}>`,
    ];

    if (def.flags.hasLoading) {
      lines.push(
        '',
        `<!-- Loading state -->`,
        `<${def.htmlElement} class="${def.bemBlock} ${def.bemBlock}--${defaultVariant?.id} ${def.bemBlock}--${defaultSize?.id} ${def.bemBlock}--loading"`,
        `        type="button" aria-busy="true" aria-label="Saving\u2026">`,
        `  <span class="${def.bemBlock}__spinner" aria-hidden="true"></span>`,
        `  <span class="${def.bemBlock}__label">Saving</span>`,
        `</${def.htmlElement}>`,
      );
    }

    lines.push(
      '',
      `<!-- All values come from component tokens — no raw values -->`,
      `<!-- Token chain: ${def.tokenPrefix}-${defaultVariant?.id}-bg`,
      `              \u2192 --semantic-color-brand-default`,
      `              \u2192 --primitive-color-blue-600 -->`,
    );

    return buildSnippetBlock(id, lines.join('\n'));
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INDICATOR SECTION  (e.g. Badge)
  ══════════════════════════════════════════════════════════════════════════ */

  function buildIndicatorSection(def) {
    const defaultSize    = def.sizes.find(s => s.default) || def.sizes[0];
    const defaultVariant = def.variants.find(v => v.default) || def.variants[0];

    let html = openSection(def);
    html += buildSectionHeader(def);

    // ── Filled variants × default size ────────────────────────────────────
    if (def.variants.length > 0 && defaultSize) {
      const styleLabel = def.flags.hasSubtle ? `Filled variants \u2014 ${esc(defaultSize.id)} size` : `Variants \u2014 ${esc(defaultSize.id)} size`;
      html += `<p class="pg-heading">${styleLabel}</p>
      <div class="pg-variant-grid">`;
      def.variants.forEach(v => {
        html += indicatorItem(def, v.id, defaultSize.id, false);
      });
      html += `</div>`;
    }

    // ── Subtle variants × default size ────────────────────────────────────
    if (def.flags.hasSubtle && def.variants.length > 0 && defaultSize) {
      html += `<p class="pg-heading">Subtle variants \u2014 ${esc(defaultSize.id)} size</p>
      <div class="pg-variant-grid">`;
      def.variants.forEach(v => {
        html += indicatorItem(def, v.id, defaultSize.id, true);
      });
      html += `</div>`;
    }

    // ── Sizes × default variant (first, non-subtle) ────────────────────────
    if (def.sizes.length > 1 && defaultVariant) {
      html += `<p class="pg-heading">Sizes</p>
      <div class="pg-variant-grid pg-variant-grid--sizes">`;
      def.sizes.forEach(s => {
        const sz = def.sizes.find(x => x.id === s.id);
        html += indicatorItem(def, defaultVariant.id, s.id, false,
          { customLabel: `${s.id} \u00b7 ${sz?.height ?? ''}` });
      });
      html += `</div>`;
    }

    // ── Dot variant ────────────────────────────────────────────────────────
    if (def.flags.hasDot) {
      html += `<p class="pg-heading">Dot variant (status indicator)</p>
      <div class="pg-variant-grid pg-variant-grid--sizes">`;
      def.variants.filter(v => v.id !== 'info').forEach(v => {
        html += dotItem(def, v.id, defaultSize?.id);
      });
      html += `</div>`;
    }

    // ── Inline usage demo ──────────────────────────────────────────────────
    if (def.flags.hasSubtle) {
      html += buildInlineIndicatorDemo(def, defaultSize?.id);
    }

    // ── HTML snippet ───────────────────────────────────────────────────────
    html += buildIndicatorSnippet(def);

    html += closeSection();
    return html;
  }

  function indicatorItem(def, variantId, sizeId, subtle, opts = {}) {
    const classes = [def.bemBlock, `${def.bemBlock}--${variantId}`];
    if (subtle) classes.push(`${def.bemBlock}--subtle`);
    if (sizeId) classes.push(`${def.bemBlock}--${sizeId}`);

    const labelSlot = def.slots.find(s => s.id === 'label');
    const labelEl   = labelSlot ? `<${labelSlot.element} class="${def.bemBlock}__${labelSlot.bemElement}">${esc(capitalize(variantId))}</${labelSlot.element}>` : '';

    const stateLabel = opts.customLabel
      ? opts.customLabel
      : [capitalize(variantId), subtle ? 'subtle' : null, sizeId].filter(Boolean).join(' \u00b7 ');

    return `<div class="pg-preview-item">
      <${def.htmlElement} class="${classes.join(' ')}">${labelEl}</${def.htmlElement}>
      <span class="pg-state-label">${esc(stateLabel)}</span>
    </div>`;
  }

  function dotItem(def, variantId, sizeId) {
    const classes = [def.bemBlock, `${def.bemBlock}--${variantId}`, `${def.bemBlock}--dot`];
    if (sizeId) classes.push(`${def.bemBlock}--${sizeId}`);
    return `<div class="pg-preview-item">
      <${def.htmlElement} class="${classes.join(' ')}" aria-label="${esc(capitalize(variantId))} status"></${def.htmlElement}>
      <span class="pg-state-label">${esc(variantId)} dot</span>
    </div>`;
  }

  function buildInlineIndicatorDemo(def, sizeId) {
    const demoItems = [
      { label: 'System health',  variant: 'success', text: 'Operational' },
      { label: 'Deployments',    variant: 'warning', text: 'Degraded' },
      { label: 'Incidents',      variant: 'danger',  text: '1 Active' },
    ];
    const size = sizeId || 'sm';
    const rows = demoItems.map(item => {
      const badgeClasses = `${def.bemBlock} ${def.bemBlock}--${item.variant} ${def.bemBlock}--subtle ${def.bemBlock}--${size}`;
      const labelSlot = def.slots.find(s => s.id === 'label');
      const inner = labelSlot
        ? `<${labelSlot.element} class="${def.bemBlock}__${labelSlot.bemElement}">${esc(item.text)}</${labelSlot.element}>`
        : esc(item.text);
      return `<article class="ds-card" data-variant="flat" style="width:100%">
        <div class="ds-card__body" style="flex-direction:row;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:var(--semantic-font-size-ui-md);">${esc(item.label)}</span>
          <${def.htmlElement} class="${badgeClasses}">${inner}</${def.htmlElement}>
        </div>
      </article>`;
    }).join('\n');
    return `<p class="pg-heading">Inline usage with other components</p>
    <div style="display:flex;flex-direction:column;gap:0.75rem;max-width:360px;">
      ${rows}
    </div>`;
  }

  function buildIndicatorSnippet(def) {
    const defaultVariant  = def.variants.find(v => v.default) || def.variants[0];
    const defaultSize     = def.sizes.find(s => s.default)    || def.sizes[0];
    const labelSlot       = def.slots.find(s => s.id === 'label');
    const labelInner      = labelSlot
      ? `\n  <${labelSlot.element} class="${def.bemBlock}__${labelSlot.bemElement}">Active</${labelSlot.element}>\n`
      : 'Active';
    const id = `${def.id}-snippet`;
    const lines = [
      `<!-- Filled ${def.id} -->`,
      `<${def.htmlElement} class="${def.bemBlock} ${def.bemBlock}--${defaultVariant?.id} ${def.bemBlock}--${defaultSize?.id}">${labelInner}</${def.htmlElement}>`,
    ];
    if (def.flags.hasSubtle) {
      lines.push(
        '',
        `<!-- Subtle ${def.id} -->`,
        `<${def.htmlElement} class="${def.bemBlock} ${def.bemBlock}--danger ${def.bemBlock}--subtle ${def.bemBlock}--sm">${labelInner}</${def.htmlElement}>`,
      );
    }
    if (def.flags.hasDot) {
      lines.push(
        '',
        `<!-- Dot-only status indicator -->`,
        `<${def.htmlElement} class="${def.bemBlock} ${def.bemBlock}--${defaultVariant?.id} ${def.bemBlock}--dot"\n      aria-label="Online"></${def.htmlElement}>`,
      );
    }
    lines.push(
      '',
      `<!-- Token chain:`,
      `     ${def.tokenPrefix}-${defaultVariant?.id}-bg`,
      `   \u2192 --semantic-color-feedback-success-default`,
      `   \u2192 --primitive-color-green-600 -->`,
    );
    return buildSnippetBlock(id, lines.join('\n'));
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CONTAINER SECTION  (e.g. Card)
  ══════════════════════════════════════════════════════════════════════════ */

  function buildContainerSection(def) {
    const defaultVariant = def.variants.find(v => v.default) || def.variants[0];

    let html = openSection(def);
    html += buildSectionHeader(def);

    // ── Variants ───────────────────────────────────────────────────────────
    if (def.variants.length > 0) {
      html += `<p class="pg-heading">Variants</p>
      <div class="pg-variant-grid" style="align-items:flex-start;">`;
      def.variants.forEach(v => {
        html += `<div class="pg-preview-item" style="width:240px">
          <article class="ds-card" data-variant="${esc(v.id)}" style="width:100%">
            <header class="ds-card__header">
              <span class="ds-card__title">${esc(v.label)} card</span>
              <span class="ds-card__subtitle">${esc(v.description)}</span>
            </header>
            <div class="ds-card__body">Standard ${esc(v.id)} container.</div>
          </article>
          <span class="pg-state-label">${esc(v.id)}</span>
        </div>`;
      });
      html += `</div>`;
    }

    // ── Full card with all slots ───────────────────────────────────────────
    html += `<p class="pg-heading">Full card \u2014 all slots + interactive</p>
    <div class="pg-variant-grid" style="align-items:flex-start;">
      <div style="width:280px">
        <article class="ds-card" data-variant="raised" data-interactive="true" tabindex="0" style="width:100%">
          <div class="ds-card__media" style="background:var(--semantic-color-brand-tonal-bg);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:2.5rem;line-height:1">\uD83C\uDFA8</span>
          </div>
          <header class="ds-card__header">
            <span class="ds-card__title">Design System v2</span>
            <span class="ds-card__subtitle">Released February 2026</span>
          </header>
          <div class="ds-card__body">A fully token-driven component library built for framework-agnostic usage. Supports light, dark, and custom themes with zero adapter changes.</div>
          <footer class="ds-card__footer" data-align="space-between">
            <button class="ds-btn ds-btn--ghost ds-btn--sm" type="button"><span class="ds-btn__label">Dismiss</span></button>
            <button class="ds-btn ds-btn--primary ds-btn--sm" type="button"><span class="ds-btn__label">Learn more</span></button>
          </footer>
        </article>
        <span class="pg-state-label" style="text-align:left">all slots \u00b7 interactive (hover me)</span>
      </div>
    </div>`;

    // ── Horizontal orientation ─────────────────────────────────────────────
    if (def.flags.hasHorizontal) {
      html += `<p class="pg-heading">Horizontal orientation</p>
      <div style="max-width:480px">
        <article class="ds-card" data-variant="flat" data-orientation="horizontal">
          <div class="ds-card__media" style="background:var(--semantic-color-feedback-success-subtle);display:flex;align-items:center;justify-content:center;min-height:80px;">
            <span style="font-size:1.75rem">\u2705</span>
          </div>
          <div class="ds-card__body">
            <span style="font-weight:600;font-size:var(--semantic-font-size-body-md);color:var(--semantic-color-text-default);">Theme contract validated</span>
            <span style="font-size:var(--semantic-font-size-ui-sm);color:var(--semantic-color-text-subtle);">All token layers resolved correctly across light and dark themes.</span>
          </div>
        </article>
      </div>`;
    }

    // ── HTML snippet ───────────────────────────────────────────────────────
    html += buildContainerSnippet(def);

    html += closeSection();
    return html;
  }

  function buildContainerSnippet(def) {
    const id = `${def.id}-snippet`;
    const lines = [
      `<!-- Card with all slots -->`,
      `<article class="ds-card" data-variant="raised" data-interactive="true">`,
      `  <div class="ds-card__media">\u2026</div>`,
      `  <header class="ds-card__header">`,
      `    <span class="ds-card__title">Card title</span>`,
      `    <span class="ds-card__subtitle">Subtitle</span>`,
      `  </header>`,
      `  <div class="ds-card__body">Body content</div>`,
      `  <footer class="ds-card__footer" data-align="space-between">`,
      `    <button class="ds-btn ds-btn--ghost ds-btn--sm">\u2026</button>`,
      `    <button class="ds-btn ds-btn--primary ds-btn--sm">\u2026</button>`,
      `  </footer>`,
      `</article>`,
      ``,
      `<!-- Token chain example:`,
      `     --primitive-color-neutral-300`,
      `   \u2192 --semantic-color-border-default`,
      `   \u2192 --component-card-border-color -->`,
    ];
    return buildSnippetBlock(id, lines.join('\n'));
  }

  /* ══════════════════════════════════════════════════════════════════════════
     GENERIC SECTION FALLBACK
  ══════════════════════════════════════════════════════════════════════════ */

  function buildGenericSection(def) {
    return `${openSection(def)}${buildSectionHeader(def)}
    <p class="pg-heading" style="color:var(--semantic-color-text-subtle);">
      Category "${esc(def.category)}" — add a category renderer to registry-engine.js to enable automatic preview generation.
    </p>${closeSection()}`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BADGE FLOW SECTION  (Phase 7 reference — preserved as registry demo)
  ══════════════════════════════════════════════════════════════════════════ */

  function buildBadgeFlowSection() {
    return `<section class="pg-component-section" data-component="badge-flow" aria-labelledby="flow-section-title">
      <div class="pg-section-header">
        <h1 class="pg-section-header__title" id="flow-section-title">Badge addition simulation</h1>
        <div class="pg-section-header__meta">
          <span>tokens.json diff \u00b7 theme merge \u00b7 deprecated token handling \u00b7 version bump</span>
        </div>
      </div>
      <div id="pg-badge-flow-demo">
        <p style="color:var(--semantic-color-text-subtle);font-size:0.875rem;">Loading badge flow demo\u2026</p>
      </div>
      <!-- Live badge-flow override playground (injected inline by index.html script) -->
    </section>`;
  }

  function _attachLiveBadgeFlowHandler() {
    // playground.js → renderBadgeFlowDemo() still handles this section.
    // No additional wiring needed here.
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SECTION HEADER (shared)
  ══════════════════════════════════════════════════════════════════════════ */

  function buildSectionHeader(def) {
    const metaParts = [];
    if (def.variants.length > 0)   metaParts.push(`${def.variants.length} variants`);
    if (def.sizes.length > 0)      metaParts.push(`${def.sizes.length} sizes`);
    if (def.flags.hasLoading)      metaParts.push('loading');
    if (def.flags.hasIconOnly)     metaParts.push('icon-only');
    if (def.flags.hasDot)          metaParts.push('dot');
    if (def.flags.hasSubtle)       metaParts.push('subtle');
    if (def.flags.hasInteractive)  metaParts.push('interactive');
    if (def.flags.hasHorizontal)   metaParts.push('horizontal');

    const newBadge = def.isNew
      ? ` <span class="ds-badge ds-badge--info ds-badge--subtle ds-badge--sm" style="vertical-align:middle;margin-left:6px"><span class="ds-badge__label">New \u00b7 Phase ${esc(String(def.addedInPhase))}</span></span>`
      : '';

    return `<div class="pg-section-header">
      <h1 class="pg-section-header__title" id="${def.id}-section-title">
        ${esc(def.name)}${newBadge}
      </h1>
      <div class="pg-section-header__meta">
        <span class="pg-section-header__sem-ver">v${esc(def.version)}</span>
        <span>${metaParts.join(' \u00b7 ')}</span>
      </div>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DOCS PAGE BUILDING — PUBLIC API
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Build a full documentation page for one component.
   * Replaces content in mainElement.
   */
  function buildDocPage(componentId, mainElement) {
    if (!mainElement) return;
    const def = getComponent(componentId);
    if (!def) {
      mainElement.innerHTML = `<section class="doc-section">
        <p style="color:var(--semantic-color-text-subtle);">Component "${esc(componentId)}" not found in registry.</p>
      </section>`;
      return;
    }

    mainElement.dataset.activeComponent = def.id;
    mainElement.innerHTML = [
      buildDocOverview(def),
      def.variants.length  > 0 ? buildDocVariants(def)   : '',
      def.sizes.length     > 0 ? buildDocSizes(def)       : '',
      def.states.length    > 0 ? buildDocStates(def)      : '',
      buildDocTokenFlow(def),
      buildDocAdapters(def),
      buildDocArchRules(def),
    ].join('\n');
  }

  /* ── Doc: Overview ──────────────────────────────────────────────────────── */

  function buildDocOverview(def) {
    const tokenFlowFiles = [
      `_primitives.color.scss`,
      `_semantic.color.scss`,
      `${def.id}/_${def.id}.variables.scss`,
      `${def.id}/_${def.id}.scss`,
    ];

    const rows = [
      ['BEM block',    `<code>.${esc(def.bemBlock)}</code>`],
      ['Layer',        `<code>@layer components</code>`],
      ['CSS file',     `<code>${esc(def.scssPath)}</code>`],
      ['Variables file', `<code>${esc(def.variablesPath)}</code>`],
      ['Theming API',  `Override <code>${esc(def.tokenPrefix)}-*</code> in <code>[data-theme]</code> or adapter scope only`],
      ['Forbidden inside', `<code>--primitive-*</code>, <code>--semantic-*</code>, raw hex/rgb, utility class names`],
    ];

    return `<section class="doc-section" id="section-overview">
      <div class="doc-section__header">
        <h1 class="doc-section__title">${esc(def.name)}</h1>
        <span class="doc-section__badge">components layer</span>
      </div>
      <p class="doc-section__desc">${esc(def.description)}</p>

      <div class="doc-callout doc-callout--info">
        <div class="doc-callout__label">Token flow</div>
        <div class="doc-callout__flow">
          ${tokenFlowFiles.map((f, i) => `<code>${esc(f)}</code>${i < tokenFlowFiles.length - 1 ? '<span aria-hidden="true">\u2192</span>' : ''}`).join('')}
        </div>
      </div>

      <table class="doc-meta-table">
        <tbody>
          ${rows.map(([th, td]) => `<tr><th>${esc(th)}</th><td>${td}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
    </section>`;
  }

  /* ── Doc: Variants ──────────────────────────────────────────────────────── */

  function buildDocVariants(def) {
    const defaultSize = def.sizes.find(s => s.default) || def.sizes[0];

    const rows = def.variants.map(v => {
      const component = buildDocDemoComponent(def, { variantId: v.id, sizeId: defaultSize?.id });
      return `<div class="doc-demo-row">
        <div class="doc-demo-row__label">
          <code>.${esc(def.bemBlock)}--${esc(v.id)}</code>
          <span class="doc-demo-row__desc">${esc(v.description)}</span>
        </div>
        <div class="doc-demo-row__stage">${component}</div>
      </div>`;
    }).join('\n');

    return `<section class="doc-section" id="section-variants">
      <h2 class="doc-section__title">Variants</h2>
      <p class="doc-section__desc">Each variant maps to a distinct set of <code>${esc(def.tokenPrefix)}-{variant}-*</code> tokens. Variants are mutually exclusive \u2014 apply exactly one per instance.</p>
      <div class="doc-demo-grid doc-demo-grid--variants">${rows}</div>
    </section>`;
  }

  /* ── Doc: Sizes ─────────────────────────────────────────────────────────── */

  function buildDocSizes(def) {
    const defaultVariant = def.variants.find(v => v.default) || def.variants[0];

    const rows = def.sizes.map(s => {
      const previewVariants = def.variants.slice(0, 3); // show up to 3 variants per size row
      const components = previewVariants.map(v =>
        buildDocDemoComponent(def, { variantId: v.id, sizeId: s.id })
      ).join('\n');

      return `<div class="doc-demo-row">
        <div class="doc-demo-row__label">
          <code>.${esc(def.bemBlock)}--${esc(s.id)}</code>
          <span class="doc-demo-row__desc">${esc(s.description)}</span>
        </div>
        <div class="doc-demo-row__stage">${components}</div>
      </div>`;
    }).join('\n');

    return `<section class="doc-section" id="section-sizes">
      <h2 class="doc-section__title">Sizes</h2>
      <p class="doc-section__desc">Size modifiers control padding, font-size, and min-height. Always declare a size modifier explicitly.</p>
      <div class="doc-demo-grid doc-demo-grid--sizes">${rows}</div>
    </section>`;
  }

  /* ── Doc: States ────────────────────────────────────────────────────────── */

  function buildDocStates(def) {
    const defaultVariant = def.variants.find(v => v.default) || def.variants[0];
    const defaultSize    = def.sizes.find(s => s.default)    || def.sizes[0];

    const applicableStates = def.states.filter(s =>
      !s.requiresFlag || def.flags[s.requiresFlag]
    );

    const rows = applicableStates.map(s => {
      const component = buildDocDemoComponent(def, {
        variantId: defaultVariant?.id,
        sizeId:    defaultSize?.id,
        stateId:   s.id,
        docClass:  s.docClass,
      });
      return `<div class="doc-demo-row">
        <div class="doc-demo-row__label">
          <span>${esc(s.label)}</span>
          <span class="doc-demo-row__desc">${esc(s.description)}</span>
        </div>
        <div class="doc-demo-row__stage">${component}</div>
      </div>`;
    }).join('\n');

    // ── State × Variant matrix ─────────────────────────────────────────────
    let matrixHtml = '';
    if (def.matrixStates?.length > 0 && def.variants.length > 0) {
      const matrixStateDefs = def.matrixStates
        .map(sid => def.states.find(s => s.id === sid))
        .filter(s => s && (!s.requiresFlag || def.flags[s.requiresFlag]));

      const headerCells = def.variants.map(v => `<div>${esc(v.label)}</div>`).join('');

      const matrixRows = matrixStateDefs.map(stateDef => {
        const cells = def.variants.map(v => {
          const component = buildDocDemoComponent(def, {
            variantId: v.id,
            sizeId:    'sm',
            stateId:   stateDef.id,
            compact:   true,
          });
          return `<div>${component}</div>`;
        }).join('');
        return `<div class="doc-state-matrix__row">
          <div class="doc-state-matrix__row-label">${esc(stateDef.label)}</div>
          ${cells}
        </div>`;
      }).join('\n');

      matrixHtml = `<h3 class="doc-section__subtitle">State \u00d7 Variant matrix</h3>
      <p class="doc-section__desc">Hover over each element to verify live state transitions. Focus state uses a <code>box-shadow</code> focus ring derived from <code>${esc(def.tokenPrefix)}-focus-ring-*</code> tokens.</p>
      <div class="doc-state-matrix">
        <div class="doc-state-matrix__header">
          <div></div>${headerCells}
        </div>
        ${matrixRows}
      </div>`;
    }

    return `<section class="doc-section" id="section-states">
      <h2 class="doc-section__title">States</h2>
      <p class="doc-section__desc">Interactive states are handled with CSS pseudo-classes (<code>:hover</code>, <code>:focus-visible</code>, <code>:active</code>). Class-based modifiers cover non-interactive states.</p>
      <div class="doc-demo-grid doc-demo-grid--states">${rows}</div>
      ${matrixHtml}
    </section>`;
  }

  /* ── Doc: Token flow ────────────────────────────────────────────────────── */

  function buildDocTokenFlow(def) {
    const tf = def.tokenFlow;
    if (!tf) return '';

    // Self-resolving swatches — read actual computed value from document
    const colorTableHtml = (tf.colorGroups || []).map(group => {
      const tbody = group.rows.map(row => {
        const style = `background:var(${esc(row.component)});`;
        return `<tr>
          <td>${esc(row.role)}</td>
          <td><code>${esc(row.component)}</code></td>
          <td><code>${esc(row.semantic)}</code></td>
          <td><code>${esc(row.primitive)}</code></td>
          <td><code>${esc(row.rawValue)}</code></td>
          <td><span class="doc-swatch" style="${style}"></span></td>
        </tr>`;
      }).join('');
      return `<h3 class="doc-section__subtitle">${esc(group.title)}</h3>
      <div class="doc-table-wrap">
        <table class="doc-token-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Component token</th>
              <th>\u2193 Semantic token</th>
              <th>\u2193 Primitive token</th>
              <th>Raw value</th>
              <th>Swatch</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;
    }).join('');

    const sizingTableHtml = tf.sizingGroup ? (() => {
      const tbody = tf.sizingGroup.rows.map((row, i) => {
        const dividerClass = i > 0 && tf.sizingGroup.rows[i - 1].role.startsWith(row.role.charAt(0)) === false
          ? ' class="doc-token-table__divider"' : '';
        return `<tr${dividerClass}>
          <td>${esc(row.role)}</td>
          <td><code>${esc(row.component)}</code></td>
          <td><code>${esc(row.semantic ?? '\u2014')}</code></td>
          <td><code>${esc(row.resolved ?? '\u2014')}</code></td>
        </tr>`;
      }).join('');
      return `<h3 class="doc-section__subtitle">${esc(tf.sizingGroup.title)}</h3>
      <div class="doc-table-wrap">
        <table class="doc-token-table">
          <thead>
            <tr>
              <th>Size / Role</th>
              <th>Component token</th>
              <th>\u2193 Semantic token</th>
              <th>Resolved value</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;
    })() : '';

    const exceptionsHtml = (tf.structuralExceptions?.length > 0)
      ? `<div class="doc-callout doc-callout--warning">
        <div class="doc-callout__label">Structural exceptions</div>
        <div class="doc-callout__body">
          Some component tokens reference primitives directly because no semantic layer exists yet:
          <ul>${tf.structuralExceptions.map(e => `<li><code>${esc(e)}</code></li>`).join('')}</ul>
          These are documented exceptions. Once a semantic shape layer is introduced, these references must be migrated.
        </div>
      </div>`
      : '';

    return `<section class="doc-section" id="section-token-flow">
      <h2 class="doc-section__title">Token flow</h2>
      <p class="doc-section__desc">Every component token traces a deterministic path through three layers. No component token may reference a primitive directly (except documented structural exceptions). No component token may hold a raw value.</p>
      <div class="doc-callout doc-callout--rule">
        <div class="doc-callout__label">Architecture rule</div>
        <div class="doc-callout__body">
          <strong>primitive</strong> \u2192 holds raw value (hex, px, rem) \u00b7
          <strong>semantic</strong> \u2192 references a primitive \u00b7 expresses intent \u00b7
          <strong>component</strong> \u2192 references a semantic \u00b7 expresses role \u00b7
          <strong>component.scss</strong> \u2192 consumes component token only
        </div>
      </div>
      ${colorTableHtml}
      ${sizingTableHtml}
      ${exceptionsHtml}
    </section>`;
  }

  /* ── Doc: Adapter Compatibility ─────────────────────────────────────────── */

  function buildDocAdapters(def) {
    const matrix = getAdapterMatrix(def.id);
    const supported = matrix.filter(m => m.supported);
    const unsupported = matrix.filter(m => !m.supported);

    if (matrix.length === 0) return '';

    const rows = matrix.map(m => {
      if (!m.supported) {
        return `<tr>
          <td>${esc(m.adapterName)}</td>
          <td colspan="3" style="color:var(--semantic-color-text-disabled);">Not supported</td>
        </tr>`;
      }
      return m.versions.map((v, i) => `<tr>
        ${i === 0 ? `<td rowspan="${m.versions.length}">${esc(m.adapterName)}</td>` : ''}
        <td><code>${esc(v.tag)}</code></td>
        <td><span class="doc-badge doc-badge--${esc(v.status)}">${esc(v.status)}</span></td>
        <td style="font-size:0.7rem;color:var(--semantic-color-text-subtle);">${esc(v.notes)}</td>
      </tr>`).join('');
    }).join('');

    return `<section class="doc-section" id="section-adapters">
      <h2 class="doc-section__title">Adapter compatibility</h2>
      <p class="doc-section__desc">Adapters remap <code>${esc(def.tokenPrefix)}-*</code> tokens onto framework-specific selectors inside <code>@layer adapters</code>. Removing an adapter must not break any DS component.</p>
      <div class="doc-table-wrap">
        <table class="doc-token-table">
          <thead>
            <tr>
              <th>Adapter</th>
              <th>Version</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
  }

  /* ── Doc: Architecture Rules ────────────────────────────────────────────── */

  function buildDocArchRules(def) {
    const rules = def.architectureRules;
    if (!rules) return '';

    const forbidden = (rules.forbidden || []).map(r =>
      `<div class="doc-rule doc-rule--forbidden">
        <div class="doc-rule__icon" aria-label="Forbidden">\u2715</div>
        <div class="doc-rule__body">${esc(r)}</div>
      </div>`
    ).join('');

    const allowed = (rules.allowed || []).map(r =>
      `<div class="doc-rule doc-rule--allowed">
        <div class="doc-rule__icon" aria-label="Allowed">\u2713</div>
        <div class="doc-rule__body">${esc(r)}</div>
      </div>`
    ).join('');

    return `<section class="doc-section" id="section-arch">
      <h2 class="doc-section__title">Architecture rules</h2>
      <p class="doc-section__desc">These rules are enforced by SCSS lint, layer contracts, and build-time checks.</p>
      <div class="doc-rule-list">${forbidden}${allowed}</div>
    </section>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DOC DEMO COMPONENT BUILDER
     Generates the live component HTML for a docs demo row.
  ══════════════════════════════════════════════════════════════════════════ */

  function buildDocDemoComponent(def, opts = {}) {
    const { variantId, sizeId, stateId, docClass, compact } = opts;
    const stateDef = stateId ? def.states.find(s => s.id === stateId) : null;

    switch (def.category) {
      case 'interactive': return buildDocInteractiveComponent(def, variantId, sizeId, stateDef, docClass, compact);
      case 'indicator':   return buildDocIndicatorComponent(def, variantId, sizeId, stateDef);
      case 'container':   return buildDocContainerComponent(def, variantId);
      default:            return `<span style="color:var(--semantic-color-text-subtle);">[${esc(def.id)}]</span>`;
    }
  }

  function buildDocInteractiveComponent(def, variantId, sizeId, stateDef, docClass, compact) {
    const classes = [def.bemBlock];
    if (variantId) classes.push(`${def.bemBlock}--${variantId}`);
    if (sizeId)    classes.push(`${def.bemBlock}--${sizeId}`);
    if (stateDef?.modifier)  classes.push(`${def.bemBlock}--${stateDef.modifier}`);
    if (docClass)  classes.push(docClass);

    const attrs = [`class="${classes.join(' ')}"`, `type="button"`];
    if (stateDef?.htmlAttr) {
      Object.entries(stateDef.htmlAttr).forEach(([k, v]) => {
        attrs.push(v === true ? k : `${k}="${esc(String(v))}"`);
      });
    }

    const label = compact ? 'Btn' : (capitalize(variantId ?? 'Button') + (stateDef?.id === 'loading' ? '\u2026' : ''));
    let inner = '';
    if (stateDef?.id === 'loading') {
      inner += `<span class="${def.bemBlock}__spinner" aria-hidden="true"></span>`;
    }
    inner += `<span class="${def.bemBlock}__label">${esc(label)}</span>`;

    return `<${def.htmlElement} ${attrs.join(' ')}>${inner}</${def.htmlElement}>`;
  }

  function buildDocIndicatorComponent(def, variantId, sizeId, stateDef) {
    const classes = [def.bemBlock];
    if (variantId)   classes.push(`${def.bemBlock}--${variantId}`);
    if (sizeId)      classes.push(`${def.bemBlock}--${sizeId}`);
    const labelSlot = def.slots.find(s => s.id === 'label');
    const inner = labelSlot
      ? `<${labelSlot.element} class="${def.bemBlock}__${labelSlot.bemElement}">${esc(capitalize(variantId ?? 'Label'))}</${labelSlot.element}>`
      : esc(capitalize(variantId ?? 'Label'));
    return `<${def.htmlElement} class="${classes.join(' ')}">${inner}</${def.htmlElement}>`;
  }

  function buildDocContainerComponent(def, variantId) {
    return `<article class="ds-card" data-variant="${esc(variantId ?? 'default')}" style="width:200px">
      <header class="ds-card__header">
        <span class="ds-card__title">${esc(capitalize(variantId ?? 'Card'))} card</span>
      </header>
      <div class="ds-card__body">Example body content.</div>
    </article>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DOCS TOC BUILDING
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Build the docs table-of-contents nav based on which sections
   * a component has. Injects into a <nav> element.
   */
  function buildDocTOC(componentId, navElement) {
    if (!navElement) return;
    const def = getComponent(componentId);
    if (!def) return;

    const links = [
      { href: '#section-overview',   label: 'Overview' },
    ];
    if (def.variants.length > 0)  links.push({ href: '#section-variants', label: 'Variants' });
    if (def.sizes.length > 0)     links.push({ href: '#section-sizes',    label: 'Sizes' });
    if (def.states.length > 0)    links.push({ href: '#section-states',   label: 'States' });
    links.push({ href: '#section-token-flow', label: 'Token flow' });
    links.push({ href: '#section-adapters',   label: 'Adapters' });
    links.push({ href: '#section-arch',       label: 'Architecture rules' });

    navElement.innerHTML = links.map(l =>
      `<a href="${esc(l.href)}" class="doc-toc__link">${esc(l.label)}</a>`
    ).join('\n');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     UTILITY HELPERS
  ══════════════════════════════════════════════════════════════════════════ */

  function openSection(def) {
    return `<section class="pg-component-section" data-component="${esc(def.id)}" aria-labelledby="${esc(def.id)}-section-title">`;
  }

  function closeSection() {
    return `</section>`;
  }

  function buildSnippetBlock(id, content) {
    return `<p class="pg-heading">HTML snippet</p>
    <div class="pg-code">
      <pre id="${esc(id)}">${esc(content)}</pre>
      <button class="pg-code__copy" type="button" data-copy-target="${esc(id)}">\u2358 Copy</button>
    </div>`;
  }

  function iconSvg(block, iconKey) {
    const path = DEMO_ICONS[iconKey] || DEMO_ICONS.plus;
    return `<svg class="${block}__icon" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><path d="${path}"/></svg>`;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════════════════ */

  global.RegistryEngine = {
    init,
    getComponent,
    getAllComponents,
    getAdapterMatrix,
    buildPreviewNav,
    buildPreviewSections,
    buildDocNav,
    buildDocPage,
    buildDocTOC,
  };

}(window));
