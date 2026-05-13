# Design System Infrastructure

**Live demo:** https://design-system-infrastructure.vercel.app

A framework-agnostic design system with a deterministic CSS build pipeline. Define tokens once, generate CSS for any framework.

## What it is

A layered design-system foundation with strict separation between immutable infrastructure and user-customizable theming. The build pipeline is a pure transformation: `tokens.json` plus `theme.json` produces three deterministic CSS files (core, component tokens, default theme).

Designed to support multi-theme rollouts, Figma-driven token sync, and per-framework adapters (Angular, PrimeNG).

## Architecture

Six layers, override-safe by design:

```
Tokens -> Base -> Utilities -> Components -> Themes -> Page Modules
```

- **Tokens** (primitives + semantic): color, radius, spacing, typography.
- **Base, utilities, components**: framework-agnostic SCSS.
- **Themes**: light, dark, and user-defined. Override only at the primitive layer.
- **Page modules**: user-authored, scoped per page.
- **Adapters**: optional bridges to Angular or PrimeNG.

Users touch Themes and Page Modules only. Base layers are immutable.

## Build pipeline

Inputs:
- `tokens.json` (validated against schema)
- `theme.json` (optional; defaults applied if absent)

Stages:
1. **Validate**: schema, reference resolution, type consistency, naming, uniqueness.
2. **Transform**: resolve `{ref}` chains, apply theme overrides at the primitive layer, sort per ordering rules.
3. **Emit**: `core.css`, `component-tokens.css`, `default-theme.css`.

The same inputs always produce byte-for-byte identical outputs. Validation errors halt the build before any file is written.

## CSS variable strategy

Every token name maps to a CSS custom property with a `--ds-` namespace:

```
color-primary-default      ->  --ds-color-primary-default
spacing-btn-padding-x      ->  --ds-spacing-btn-padding-x
```

The `--ds-` prefix prevents collisions with host application variables.

## Figma sync

Two-phase integration: a dry-run pass that surfaces conflicts, circular references, and tier violations, then an apply pass that commits user-approved changes only.

```bash
npm run figma-sync         # dry-run
npm run figma-sync-apply   # apply approved changes
```

User approval is required before any theme mutation is committed.

## Setup

```bash
npm install
npm run build         # produces dist/ds-preview.css and dist/ds-preview.min.css
npm run dev           # watch mode
npm run prebuild      # validate tokens only
```

## Status

Active, in development. The token-engine and Figma-sync logic here feeds into a separate token migration engine (in progress).

## Stack

SCSS, Sass, PostCSS, autoprefixer. Node scripts for token validation and Figma sync.

## License

MIT. See [LICENSE](./LICENSE).
