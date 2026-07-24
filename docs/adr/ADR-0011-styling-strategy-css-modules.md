# 0011: Styling Strategy — CSS Modules with Design Tokens

## Status
Accepted

## Context
TaxPulse is building its React Single-Page Application (`apps/web`). The application requires a clean, maintainable, scoped styling strategy that integrates with Vite without runtime overhead or complex build-tool configuration.
The existing capstone wireframes and design prototypes ship as semantic CSS class definitions along with `--` prefixed design-token custom properties in `:root`.

## Decision
We adopt **CSS Modules** (`*.module.css`) paired with centralized design tokens in `apps/web/src/styles/tokens.css` as the primary styling strategy for `apps/web`.

- **CSS Modules**: Each component imports its locally-scoped styles object (e.g., `import styles from "./Badge.module.css"`). This prevents global CSS name collisions while keeping component styling scoped and modular.
- **Design Tokens**: Centralized custom CSS properties defined in `apps/web/src/styles/tokens.css` (e.g. `--color-bg`, `--space-4`, `--radius-md`) are referenced across all CSS Modules using `var(--token)`.
- **Zero Inline Styles**: Inline style attributes are forbidden outside of dynamic CSS custom property bindings.

## Alternatives Considered

1. **vanilla-extract (Type-Safe CSS-in-TypeScript)**:
   - *Weighed*: Provides build-time type-safe styling contracts and autocomplete for tokens.
   - *Rejected*: Requires additional Vite plugins, extra toolchain setup, and learning curve during an initial React/Vite onboarding sprint. CSS Modules require zero extra configuration in Vite.

2. **styled-components / Emotion (Runtime CSS-in-JS)**:
   - *Weighed*: Popular component-level styling libraries with dynamic props-to-style functions.
   - *Rejected*: Introduces runtime JavaScript evaluation overhead, increases bundle size, and degrades performance. CSS Modules extract to plain static CSS at build time.

3. **Tailwind CSS**:
   - *Weighed*: Utility-first CSS framework.
   - *Rejected*: The repository rules mandate Vanilla CSS / CSS Modules for maximum control unless Tailwind is explicitly requested.

## Consequences

- **Positive**: Zero extra bundler configuration (supported natively by Vite). High performance with build-time CSS extraction. Zero global class name collisions. Direct compatibility with existing wireframe semantic CSS.
- **Negative**: Requires maintaining matching `.module.css` files alongside `.tsx` components.
