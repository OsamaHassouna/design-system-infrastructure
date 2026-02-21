/**
 * TOKEN REGISTRY
 * preview/js/token-registry.js
 *
 * Purpose:
 *   Structured data describing every token in the design system:
 *   primitive → semantic → component chains.
 *   Consumed by playground.js to render token tables and editable controls.
 *
 * Structure:
 *   DS_TOKENS = {
 *     [componentId]: {
 *       label:       Human-readable component name
 *       version:     SemVer of current component spec
 *       description: Short component description
 *       tokenGroups: [
 *         {
 *           group:  Group label (e.g. "Primary variant")
 *           tokens: [
 *             {
 *               component: '--component-*'  CSS variable name
 *               semantic:  '--semantic-*'   token it maps to (or null)
 *               primitive: '--primitive-*'  ultimate resolved token (or null)
 *               type:      'color' | 'spacing' | 'radius' | 'typography' | 'shadow' | 'duration'
 *               editable:  true | false  — whether playground shows a control
 *               deprecated: false | { since, replacement }
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 */

const DS_TOKENS = {

  /* ========================================================================
     BUTTON
     ======================================================================== */
  button: {
    label:       'Button',
    version:     '1.2.0',
    description: 'Interactive element for actions. 5 variants × 3 sizes × all states.',
    tokenGroups: [
      {
        group: 'Structure',
        tokens: [
          { component: '--component-button-border-radius',    semantic: null,                                    primitive: '--primitive-radius-md',          type: 'radius',   editable: true  },
          { component: '--component-button-border-width',     semantic: null,                                    primitive: null,                             type: 'spacing',  editable: false },
          { component: '--component-button-letter-spacing',   semantic: '--semantic-letter-spacing-ui',          primitive: '--primitive-letter-spacing-normal', type: 'typography', editable: false },
        ]
      },
      {
        group: 'Primary variant',
        tokens: [
          { component: '--component-button-primary-bg',           semantic: '--semantic-color-brand-default',     primitive: '--primitive-color-blue-600',   type: 'color', editable: true  },
          { component: '--component-button-primary-bg-hover',     semantic: '--semantic-color-brand-hover',       primitive: '--primitive-color-blue-700',   type: 'color', editable: true  },
          { component: '--component-button-primary-bg-active',    semantic: '--semantic-color-brand-active',      primitive: '--primitive-color-blue-800',   type: 'color', editable: true  },
          { component: '--component-button-primary-bg-disabled',  semantic: '--semantic-color-interactive-disabled', primitive: '--primitive-color-neutral-300', type: 'color', editable: false },
          { component: '--component-button-primary-color',        semantic: '--semantic-color-brand-contrast',    primitive: '--primitive-color-neutral-0',  type: 'color', editable: true  },
        ]
      },
      {
        group: 'Secondary variant',
        tokens: [
          { component: '--component-button-secondary-bg-hover',           semantic: '--semantic-color-surface-raised',    primitive: '--primitive-color-neutral-50',  type: 'color', editable: true  },
          { component: '--component-button-secondary-color',              semantic: '--semantic-color-text-brand',        primitive: '--primitive-color-blue-600',    type: 'color', editable: true  },
          { component: '--component-button-secondary-border-color',       semantic: '--semantic-color-border-brand',      primitive: '--primitive-color-blue-600',    type: 'color', editable: true  },
          { component: '--component-button-secondary-border-color-hover', semantic: '--semantic-color-brand-hover',       primitive: '--primitive-color-blue-700',    type: 'color', editable: false },
        ]
      },
      {
        group: 'Tertiary variant',
        tokens: [
          { component: '--component-button-tertiary-bg',        semantic: '--semantic-color-brand-tonal-bg',     primitive: '--primitive-color-blue-50',    type: 'color', editable: true  },
          { component: '--component-button-tertiary-bg-hover',  semantic: '--semantic-color-brand-tonal-hover',  primitive: '--primitive-color-blue-100',   type: 'color', editable: false },
          { component: '--component-button-tertiary-color',     semantic: '--semantic-color-text-brand',         primitive: '--primitive-color-blue-600',   type: 'color', editable: false },
        ]
      },
      {
        group: 'Ghost variant',
        tokens: [
          { component: '--component-button-ghost-bg-hover',    semantic: '--semantic-color-surface-raised',   primitive: '--primitive-color-neutral-50',  type: 'color', editable: true  },
          { component: '--component-button-ghost-color',       semantic: '--semantic-color-text-default',     primitive: '--primitive-color-neutral-900', type: 'color', editable: false },
        ]
      },
      {
        group: 'Danger variant',
        tokens: [
          { component: '--component-button-danger-bg',         semantic: '--semantic-color-feedback-danger-default', primitive: '--primitive-color-red-600',     type: 'color', editable: true  },
          { component: '--component-button-danger-bg-hover',   semantic: '--semantic-color-feedback-danger-hover',   primitive: '--primitive-color-red-700',     type: 'color', editable: false },
          { component: '--component-button-danger-color',      semantic: '--semantic-color-feedback-danger-contrast',primitive: '--primitive-color-neutral-0',   type: 'color', editable: false },
        ]
      },
      {
        group: 'Focus ring',
        tokens: [
          { component: '--component-button-focus-ring-color',  semantic: null, primitive: null,                                    type: 'color',   editable: true  },
          { component: '--component-button-focus-ring-width',  semantic: null, primitive: null,                                    type: 'spacing', editable: false },
          { component: '--component-button-focus-ring-offset', semantic: null, primitive: null,                                    type: 'spacing', editable: false },
        ]
      },
      {
        group: 'Sizes — sm',
        tokens: [
          { component: '--component-button-sm-font-size',       semantic: '--semantic-font-size-ui-sm',         primitive: '--primitive-font-size-xs',   type: 'typography', editable: true },
          { component: '--component-button-sm-padding-block',   semantic: '--semantic-spacing-component-xs',    primitive: '--primitive-spacing-2',      type: 'spacing',    editable: true },
          { component: '--component-button-sm-padding-inline',  semantic: '--semantic-spacing-component-sm',    primitive: '--primitive-spacing-3',      type: 'spacing',    editable: false },
          { component: '--component-button-sm-min-height',      semantic: null,                                  primitive: '--primitive-spacing-8',      type: 'spacing',    editable: false },
        ]
      },
      {
        group: 'Sizes — md',
        tokens: [
          { component: '--component-button-md-font-size',       semantic: '--semantic-font-size-ui-md',         primitive: '--primitive-font-size-sm',   type: 'typography', editable: true },
          { component: '--component-button-md-padding-block',   semantic: '--semantic-spacing-component-sm',    primitive: '--primitive-spacing-3',      type: 'spacing',    editable: true },
          { component: '--component-button-md-padding-inline',  semantic: '--semantic-spacing-component-md',    primitive: '--primitive-spacing-4',      type: 'spacing',    editable: false },
          { component: '--component-button-md-min-height',      semantic: null,                                  primitive: '--primitive-spacing-10',     type: 'spacing',    editable: false },
        ]
      },
      {
        group: 'Sizes — lg',
        tokens: [
          { component: '--component-button-lg-font-size',       semantic: '--semantic-font-size-ui-lg',         primitive: '--primitive-font-size-md',   type: 'typography', editable: true },
          { component: '--component-button-lg-padding-block',   semantic: '--semantic-spacing-component-md',    primitive: '--primitive-spacing-4',      type: 'spacing',    editable: true },
          { component: '--component-button-lg-padding-inline',  semantic: '--semantic-spacing-component-lg',    primitive: '--primitive-spacing-6',      type: 'spacing',    editable: false },
          { component: '--component-button-lg-min-height',      semantic: null,                                  primitive: '--primitive-spacing-12',     type: 'spacing',    editable: false },
        ]
      },
    ]
  },

  /* ========================================================================
     CARD
     ======================================================================== */
  card: {
    label:       'Card',
    version:     '1.0.0',
    description: 'Container primitive with named slots: media, header, body, footer.',
    tokenGroups: [
      {
        group: 'Structure',
        tokens: [
          { component: '--component-card-border-radius', semantic: null,                                   primitive: '--primitive-radius-lg',           type: 'radius',  editable: true  },
          { component: '--component-card-border-color',  semantic: '--semantic-color-border-default',      primitive: '--primitive-color-neutral-300',    type: 'color',   editable: true  },
          { component: '--component-card-bg',            semantic: '--semantic-color-surface-base',        primitive: '--primitive-color-neutral-0',      type: 'color',   editable: true  },
          { component: '--component-card-bg-raised',     semantic: '--semantic-color-surface-raised',      primitive: '--primitive-color-neutral-50',     type: 'color',   editable: false },
          { component: '--component-card-bg-sunken',     semantic: '--semantic-color-surface-sunken',      primitive: '--primitive-color-neutral-200',    type: 'color',   editable: false },
        ]
      },
      {
        group: 'Shadow',
        tokens: [
          { component: '--component-card-shadow',    semantic: null, primitive: null, type: 'shadow', editable: false },
          { component: '--component-card-shadow-sm', semantic: null, primitive: null, type: 'shadow', editable: false },
          { component: '--component-card-shadow-md', semantic: null, primitive: null, type: 'shadow', editable: false },
          { component: '--component-card-shadow-lg', semantic: null, primitive: null, type: 'shadow', editable: false },
        ]
      },
      {
        group: 'Header slot',
        tokens: [
          { component: '--component-card-header-title-font-size',   semantic: '--semantic-font-size-heading-sm', primitive: '--primitive-font-size-xl',  type: 'typography', editable: true  },
          { component: '--component-card-header-title-font-weight', semantic: '--semantic-font-weight-heading',  primitive: null,                        type: 'typography', editable: false },
          { component: '--component-card-header-title-color',       semantic: '--semantic-color-text-default',   primitive: '--primitive-color-neutral-900', type: 'color', editable: true  },
          { component: '--component-card-header-subtitle-color',    semantic: '--semantic-color-text-subtle',    primitive: '--primitive-color-neutral-600', type: 'color', editable: false },
          { component: '--component-card-header-padding-block',     semantic: '--semantic-spacing-component-md', primitive: '--primitive-spacing-4',    type: 'spacing',    editable: true  },
          { component: '--component-card-header-padding-inline',    semantic: '--semantic-spacing-component-lg', primitive: '--primitive-spacing-6',    type: 'spacing',    editable: false },
        ]
      },
      {
        group: 'Body slot',
        tokens: [
          { component: '--component-card-body-font-size',     semantic: '--semantic-font-size-body-md',    primitive: '--primitive-font-size-md',     type: 'typography', editable: true  },
          { component: '--component-card-body-color',         semantic: '--semantic-color-text-default',   primitive: '--primitive-color-neutral-900', type: 'color',      editable: false },
          { component: '--component-card-body-padding-block', semantic: '--semantic-spacing-component-md', primitive: '--primitive-spacing-4',         type: 'spacing',    editable: false },
        ]
      },
      {
        group: 'Footer slot',
        tokens: [
          { component: '--component-card-footer-bg',     semantic: '--semantic-color-surface-raised', primitive: '--primitive-color-neutral-50',     type: 'color',   editable: true  },
          { component: '--component-card-footer-gap',    semantic: '--semantic-spacing-inline-sm',    primitive: '--primitive-spacing-2',             type: 'spacing', editable: false },
        ]
      },
      {
        group: 'Focus ring',
        tokens: [
          { component: '--component-card-focus-ring-color', semantic: null, primitive: null, type: 'color', editable: true },
        ]
      },
    ]
  },

  /* ========================================================================
     BADGE  (Phase 7 — new component)
     ======================================================================== */
  badge: {
    label:       'Badge',
    version:     '1.0.0',
    description: 'Inline status indicator. 5 variants × filled + subtle × 2 sizes. Added in Phase 7.',
    isNew: true,
    tokenGroups: [
      {
        group: 'Structure',
        tokens: [
          { component: '--component-badge-border-radius',    semantic: null,                                primitive: '--primitive-radius-full',       type: 'radius',     editable: true  },
          { component: '--component-badge-font-weight',      semantic: '--semantic-font-weight-label',      primitive: null,                            type: 'typography', editable: false },
          { component: '--component-badge-letter-spacing',   semantic: '--semantic-letter-spacing-caps',    primitive: '--primitive-letter-spacing-wider', type: 'typography', editable: false },
        ]
      },
      {
        group: 'Variant — success',
        tokens: [
          { component: '--component-badge-success-bg',             semantic: '--semantic-color-feedback-success-default', primitive: '--primitive-color-green-600', type: 'color', editable: true  },
          { component: '--component-badge-success-color',          semantic: '--semantic-color-brand-contrast',           primitive: '--primitive-color-neutral-0', type: 'color', editable: false },
          { component: '--component-badge-success-subtle-bg',      semantic: '--semantic-color-feedback-success-subtle',  primitive: '--primitive-color-green-50',  type: 'color', editable: true  },
          { component: '--component-badge-success-subtle-color',   semantic: '--semantic-color-feedback-success-text',    primitive: '--primitive-color-green-800', type: 'color', editable: false },
          { component: '--component-badge-success-subtle-border',  semantic: '--semantic-color-feedback-success-default', primitive: '--primitive-color-green-600', type: 'color', editable: false },
        ]
      },
      {
        group: 'Variant — warning',
        tokens: [
          { component: '--component-badge-warning-bg',             semantic: '--semantic-color-feedback-warning-default', primitive: '--primitive-color-yellow-500', type: 'color', editable: true  },
          { component: '--component-badge-warning-color',          semantic: '--semantic-color-feedback-warning-text',    primitive: '--primitive-color-yellow-900', type: 'color', editable: false },
          { component: '--component-badge-warning-subtle-bg',      semantic: '--semantic-color-feedback-warning-subtle',  primitive: '--primitive-color-yellow-50',  type: 'color', editable: true  },
        ]
      },
      {
        group: 'Variant — danger',
        tokens: [
          { component: '--component-badge-danger-bg',              semantic: '--semantic-color-feedback-danger-default',  primitive: '--primitive-color-red-600',    type: 'color', editable: true  },
          { component: '--component-badge-danger-color',           semantic: '--semantic-color-feedback-danger-contrast', primitive: '--primitive-color-neutral-0',  type: 'color', editable: false },
          { component: '--component-badge-danger-subtle-bg',       semantic: '--semantic-color-feedback-danger-subtle',   primitive: '--primitive-color-red-50',     type: 'color', editable: true  },
          { component: '--component-badge-danger-subtle-color',    semantic: '--semantic-color-feedback-danger-text',     primitive: '--primitive-color-red-800',    type: 'color', editable: false },
        ]
      },
      {
        group: 'Variant — info',
        tokens: [
          { component: '--component-badge-info-bg',                semantic: '--semantic-color-interactive-default',      primitive: '--primitive-color-blue-600',   type: 'color', editable: true  },
          { component: '--component-badge-info-subtle-bg',         semantic: '--semantic-color-brand-subtle',             primitive: '--primitive-color-blue-50',    type: 'color', editable: true  },
          { component: '--component-badge-info-subtle-color',      semantic: '--semantic-color-text-brand',               primitive: '--primitive-color-blue-600',   type: 'color', editable: false },
        ]
      },
      {
        group: 'Variant — neutral',
        tokens: [
          { component: '--component-badge-neutral-bg',             semantic: '--semantic-color-surface-overlay',          primitive: '--primitive-color-neutral-100', type: 'color', editable: true  },
          { component: '--component-badge-neutral-color',          semantic: '--semantic-color-text-subtle',              primitive: '--primitive-color-neutral-600', type: 'color', editable: false },
          { component: '--component-badge-neutral-border',         semantic: '--semantic-color-border-default',           primitive: '--primitive-color-neutral-300', type: 'color', editable: false },
        ]
      },
      {
        group: 'Sizes',
        tokens: [
          { component: '--component-badge-sm-font-size',       semantic: '--semantic-font-size-ui-xs',        primitive: '--primitive-font-size-2xs',  type: 'typography', editable: true  },
          { component: '--component-badge-sm-padding-inline',  semantic: '--semantic-spacing-component-xs',   primitive: '--primitive-spacing-2',      type: 'spacing',    editable: true  },
          { component: '--component-badge-md-font-size',       semantic: '--semantic-font-size-ui-sm',        primitive: '--primitive-font-size-xs',   type: 'typography', editable: false },
          { component: '--component-badge-md-padding-inline',  semantic: '--semantic-spacing-component-sm',   primitive: '--primitive-spacing-3',      type: 'spacing',    editable: false },
        ]
      },
    ]
  }
};

/**
 * BADGE TOKEN FLOW DEMO
 * Demonstrates the before/after state of tokens.json when adding a new
 * component. Used in the "Component addition simulation" section.
 */
const BADGE_TOKEN_FLOW = {
  before: {
    title: 'tokens.json — BEFORE (Phase 6)',
    content: `{
  "components": {
    "button": { ... },
    "card":   { ... }
    /* badge does not exist yet */
  }
}`,
  },
  after: {
    title: 'tokens.json — AFTER (Phase 7)',
    content: `{
  "components": {
    "badge": {
      "$schema": "https://ds.example.com/schemas/component.json",
      "$version": "1.0.0",
      "description": "Inline status indicator pill",
      "tokens": {
        "border-radius":  { "$value": "{primitive.radius.full}" },
        "font-weight":    { "$value": "{semantic.font-weight.label}" },
        "success-bg":     { "$value": "{semantic.color.feedback.success.default}" },
        "success-color":  { "$value": "{semantic.color.brand.contrast}" },
        "warning-bg":     { "$value": "{semantic.color.feedback.warning.default}" },
        "warning-color":  { "$value": "{semantic.color.feedback.warning.text}" },
        "danger-bg":      { "$value": "{semantic.color.feedback.danger.default}" },
        "info-bg":        { "$value": "{semantic.color.interactive.default}" },
        "neutral-bg":     { "$value": "{semantic.color.surface.overlay}" }
      }
    },
    "button": { ... },
    "card":   { ... }
  }
}`,
  },
  userThemeOverride: {
    title: 'user-theme.json — badge customisation',
    content: `{
  "$schema": "https://ds.example.com/schemas/theme.json",
  "$version": "1.0.0",
  "overrides": {
    "badge.success-bg": "#0ea5e9",
    "badge.success-color": "#ffffff"
  }
}`,
  },
  resolvedCSS: {
    title: 'Resolved CSS output (theme applied)',
    content: `:root {
  /* primitive → semantic → component chain */
  --primitive-color-green-600:              #40c057;
  --semantic-color-feedback-success-default: var(--primitive-color-green-600);
  --component-badge-success-bg:             var(--semantic-color-feedback-success-default);
}

/* user theme override in @layer themes */
[data-theme="custom"] {
  --component-badge-success-bg: #0ea5e9;  /* user override wins */
}`,
  },
  versionBump: {
    description: `Adding a new component (badge) is a MINOR version bump.
  • No existing tokens were changed → not a BREAKING change
  • New tokens are additions only → MINOR: 1.0.0 → 1.1.0
  • User themes that don't reference badge tokens are unaffected
  • If a semantic token badge relies on changes in a future release,
    that semantic token change must be reviewed separately.`
  }
};

/**
 * DEPRECATED TOKEN EXAMPLE
 * Shows how deprecated tokens are handled across versions.
 */
const DEPRECATED_TOKEN_EXAMPLE = {
  tokenName: '--component-button-primary-bg-brand',
  deprecatedSince: '1.1.0',
  replacement: '--component-button-primary-bg',
  reason: 'Token renamed for consistency with variant-prefixed naming convention.',
  migration: `/* OLD (deprecated since v1.1.0, remove in v2.0.0) */
--component-button-primary-bg-brand: var(--semantic-color-brand-default);

/* NEW */
--component-button-primary-bg: var(--semantic-color-brand-default);

/* Migration: replace all usages of the old variable name in adapters/themes */`
};

// Make available globally
window.DS_TOKENS = DS_TOKENS;
window.BADGE_TOKEN_FLOW = BADGE_TOKEN_FLOW;
window.DEPRECATED_TOKEN_EXAMPLE = DEPRECATED_TOKEN_EXAMPLE;
