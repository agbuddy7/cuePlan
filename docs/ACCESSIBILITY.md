# Accessibility implementation and verification

The interface uses semantic landmarks, native form controls, associated labels and meaningful heading structure. Tables have captions and scoped header cells. Vendor names, notes, provider replies and imported content are rendered through React text escaping.

## Keyboard behavior

- Skip link moves directly to the main workspace.
- Tab buttons implement roving tab index with ArrowLeft, ArrowRight, Home and End.
- Focus remains visible with an outlined state.
- Native numeric/date/select controls preserve platform keyboard behavior.
- Import uses a real labeled file input and supports keyboard focus.
- Locked controls are visibly disabled and status is expressed in text.

## Dynamic information

Workspace status is exposed through a live status region. Coordinator results expose live updates and a busy state. Validation errors use alerts. Task readiness, accepted quote provenance, overdue work and funding gaps have textual labels rather than relying only on color.

## Layout and media

Responsive grids reflow at narrow widths; data tables scroll within their container. Targets have a 44px minimum height. Reduced-motion settings are respected. Forced-colors users receive visible component borders. The print stylesheet hides editing controls and renders a dedicated operating summary.

## Evidence

Playwright uses axe with WCAG A/AA tags on Budget, Vendors, Timeline, Decisions and Activity for desktop and mobile. It separately verifies keyboard tab movement and absence of page-level horizontal overflow. Automated results cover tested states; manual assistive-technology review remains a separate release activity.
