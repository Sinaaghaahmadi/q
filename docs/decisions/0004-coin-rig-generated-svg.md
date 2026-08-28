# 0004 — 3D coin set: generated SVG rig now, rendered assets later

**Decision.** The 20-currency 3D coin set is produced by a single
parameterized SVG generator (one lighting rig: 45° camera, top-left key
light, contact shadow, embossed glyph, four metal tones), rendered inline
in-app and exported to `.svg` + 1×/2×/3× `.webp` sprites.

**Why.** Guarantees §2.6's "single coherent set" property by construction,
stays crisp at every size, weighs ~2 KB per coin, and needs no asset
pipeline to add a currency. True 3D renders (Blender/Spline) can replace the
exports at the same filenames without touching code.

**Trade-off.** Less photoreal depth than ray-traced renders; accepted for
Phase 0–1.
