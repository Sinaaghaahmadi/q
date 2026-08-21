# tgju.org integration — verified findings

_Verified live on **2026-08-21** from the build environment. Re-verify before
production cutover (§7.1: "do not hard-code an endpoint you have not verified")._

## Endpoints in use

### 1. Live prices (primary)

```
GET https://call1.tgju.org/ajax.json
```

- **Auth:** none. Public widget endpoint used by tgju's own homepage.
- **Observed:** HTTP 200, ~138 KB JSON, ~0.7 s.
- **Shape:** `{ "current": { "<symbol>": Tick, … } }` with **762 symbols**.

```jsonc
// Tick
{
  "p": "1,894,000", // price, Rial, comma-grouped string
  "h": "1,898,200", // 24h high
  "l": "1,887,800", // 24h low
  "d": "8000", // absolute change
  "dp": 0.42, // percent change (number)
  "dt": "high", // direction: "high" | "low" | "" (sign for d/dp)
  "t": "۲۹ مرداد", // display time (fa)
  "t_en": "20 Aug",
  "ts": "2026-08-20 00:00:00", // Tehran local time (UTC+03:30, no DST since 2022)
}
```

### 2. Daily history

```
GET https://api.tgju.org/v1/market/indicator/summary-table-data/{symbol}?start=0&length=N
```

- **Auth:** none observed. DataTables-style server-side endpoint.
- **Observed:** `price_dollar_rl` returns `recordsTotal: 3931` (≈15 years of dailies).
- **Row shape (newest first):**
  `[open, low, high, close, Δ-html, Δ%-html, "YYYY/MM/DD", "jalali date"]`
  — all prices Rial, comma-grouped strings; Δ cells contain HTML spans (ignored).
- Pagination via `start`/`length` works as expected.

## Symbol map (all 20 verified present)

| Ours | tgju symbol       |     | Ours | tgju symbol |
| ---- | ----------------- | --- | ---- | ----------- |
| USD  | `price_dollar_rl` |     | AFN  | `price_afn` |
| EUR  | `price_eur`       |     | PKR  | `price_pkr` |
| GBP  | `price_gbp`       |     | TMT  | `price_tmt` |
| AED  | `price_aed`       |     | OMR  | `price_omr` |
| TRY  | `price_try`       |     | KWD  | `price_kwd` |
| IQD  | `price_iqd`       |     | QAR  | `price_qar` |
| AZN  | `price_azn`       |     | SAR  | `price_sar` |
| AMD  | `price_amd`       |     | CAD  | `price_cad` |
| GEL  | `price_gel`       |     | CNY  | `price_cny` |
| RUB  | `price_rub`       |     |      |             |

All are quoted **per 1 unit, in Rial** (verified against USD crosses for the
small-unit currencies IQD/AMD/AFN/PKR). We divide by 10 → Toman exactly once,
at ingestion (`TgjuProvider`).

## Semantics & gotchas

- **Market hours:** outside Iranian market hours (Thu afternoon–Sat morning,
  holidays) `ts` freezes at the last close and `dp` resets to 0. This is not a
  failure; the service only flags `degraded` when the pipeline fails or the
  observation exceeds 80 h.
- **Rate limits:** none documented for the widget endpoint; we poll once per
  60 s server-side and never from browsers. Commercial API (api.tgju.org
  "Persian API") exists for SLA-backed access — `TGJU_API_KEY` is reserved for
  it (server-only env).
- **Failure modes seen/designed for:** timeouts (8 s abort), non-JSON
  responses, missing symbols → provider throws, service serves last-good
  snapshot marked `degraded`, then seeded demo data (clearly labelled) as the
  last resort. Never a silent stale number (§7.1).

## Cross-check (secondary provider)

`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD` (ECB, no key,
verified live) backs the §7.2 guardrail: the tgju-implied EUR/USD cross is
compared against the ECB reference in `/api/health`; deviations beyond the
threshold will alert admin (Phase 3+). `open.er-api.com` also verified
reachable as an alternate.
