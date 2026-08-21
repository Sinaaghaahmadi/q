# 0006 — Charts: hand-rolled SVG instead of Recharts

**Decision.** Sparklines and the history chart are ~150-line custom SVG
components (single series, 2 px line, recessive grid, crosshair + tooltip)
rather than a chart library.

**Why.** The needs are exactly two shapes; a library adds ~100 KB for less
control over RTL, theming via CSS vars, and the accessibility rules we
enforce (arrow+sign pairing, ink-colored value text, LTR time axis in both
locales). Revisit only if Phase 4 admin dashboards need composed charts —
`lightweight-charts` is the candidate there.
