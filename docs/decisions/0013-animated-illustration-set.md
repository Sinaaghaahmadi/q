# 0013 — Animated illustration as SVG + Framer Motion, not imported Lottie

**Decision.** The ten narrative scenes (§13: onboarding, KYC upload, liveness,
waiting, success, empty states) are built from one shared rig in
`src/components/brand/scene.tsx` and drawn as SVG animated with Framer Motion.

**Why.** §2.6 asks for illustration that is unmistakably ours: the same disc,
contact shadow, stroke weight and coin silhouette as the logo and the currency
icons. Bought or borrowed Lottie files would neither match that language nor
be safe to ship. Hand-built scenes are a few KB each, take their colors from
the CSS variables so light/dark and RTL come free, and collapse to a static
frame under `prefers-reduced-motion` by construction rather than by a separate
asset.

**Trade-off.** Less painterly than a designed Lottie composition. Revisit when
a motion designer produces the real set; the component boundary
(`<OtpScene />`, `<ReviewScene />`, …) stays the same either way.
