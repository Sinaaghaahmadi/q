# 0012 — Jalali dates come from ICU, not a transcribed leap table

**Decision.** `src/lib/date/jalali.ts` reads the Persian calendar through
`Intl.DateTimeFormat` with `ca-persian`, and converts the other way by
anchoring on Nowruz (found by a five-day scan around 19–23 March) plus a fixed
day-of-year offset.

**Why.** The first implementation transcribed the well-known 33-year
break table from memory and was wrong: it put Nowruz 1400 a year early and
mis-handled Esfand 30 in leap year 1399. A date of birth that shifts by a day
in a KYC record is a compliance defect. ICU is the authoritative
implementation and ships in every runtime we target.

**Verification.** Unit tests pin three known anchors, round-trip every day of
a full Jalali year, and check Esfand's length in both a leap and a common
year.
