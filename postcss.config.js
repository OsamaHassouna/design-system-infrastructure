// =============================================================================
// POSTCSS CONFIGURATION
// FILE: postcss.config.js
//
// PURPOSE:
//   Post-processes compiled CSS output from Dart Sass.
//   Runs after SCSS compilation, before final dist write.
//
// PLUGINS (intentionally minimal):
//   autoprefixer — adds vendor prefixes for browser compatibility
//
// EXPLICITLY EXCLUDED:
//   - postcss-nesting         (SCSS handles nesting; CSS nesting is not needed)
//   - postcss-preset-env      (no experimental transforms)
//   - cssnano                 (minification handled by Sass --style=compressed)
//   - postcss-import          (imports handled by Sass @use)
//   - Any plugin that mutates @layer order or transforms custom properties
//
// LAYER ORDER GUARANTEE:
//   PostCSS does not reorder @layer declarations.
//   Autoprefixer only adds vendor-prefixed properties alongside existing ones.
//   The compiled @layer stack from Sass passes through unchanged.
// =============================================================================

/** @type {import('postcss').Config} */
module.exports = {
  plugins: [
    require('autoprefixer')
  ]
};
