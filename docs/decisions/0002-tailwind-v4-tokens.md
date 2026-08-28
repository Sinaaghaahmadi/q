# 0002 — Tailwind CSS v4 with CSS-variable tokens

**Decision.** Tailwind v4 (`@theme inline`) with the §2.3 palette defined as
plain CSS variables on `:root`/`.dark`, mapped into Tailwind color tokens.
Dark mode via `next-themes` class strategy.

**Why.** One source of truth for tokens usable from Tailwind utilities, raw
CSS, and inline SVG (`var(--up)`), with zero config file. Logical properties
(`ps/pe/ms/me`) used exclusively — RTL is first-class, not mirrored (§0.2).

**Trade-off.** shadcn components are hand-rolled on Radix primitives against
these tokens instead of CLI-generated — smaller surface, full token control.
