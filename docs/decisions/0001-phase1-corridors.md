# 0001 — Phase-1 corridor & currency set

**Decision.** Phase 1 quotes all 19 foreign currencies against IRT for the
rates surface, but the **transfer corridors** launch as: USD, EUR, GBP, AED,
TRY, IQD ↔ IRT (the home rate-strip six). AED/TRY/IQD cover the dominant
hawala routes; USD/EUR/GBP cover tuition/family-support demand.

**Why.** tgju quotes all 20 reliably (verified), so showing the full board is
free; but office liquidity, SLAs, and settlement instructions need per-
corridor setup, so transfers start narrow. The corridor rule (§1) — one leg
always IRT — is enforced in the converter, the transfer quote page, and later
server-side in order creation.

**Revisit** when the first offices onboard with their actual corridor lists.
