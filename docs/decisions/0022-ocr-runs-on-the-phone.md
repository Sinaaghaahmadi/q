# 0022 — The passport is read on the phone, and the Wasm exception reaches four static files

**Status:** accepted · Phase 10

## Context

§20 lists OCR as part of Phase 2. It was the one item left unbuilt, for two
reasons stated at the time: recognising characters needs WebAssembly, and
instantiating a Wasm module needs `'wasm-unsafe-eval'` in `script-src` — a real
loosening of a policy this product leans on. The second reason was that a
machine-readable zone only exists on passports and international ID cards;
Iran's smart national card has none, and reading Persian text off a phone
photograph is not reliable enough to put a number in a KYC form.

The instruction was to build it anyway. This records what that turned out to
mean, because two of the three assumptions above were wrong in useful ways.

## Decision

**Recognition happens on the customer's device.** A passport photograph is the
most sensitive image this product handles. Sending it to a server to be read
would mean a second copy in a second place, and buys nothing the customer can
see. Tesseract compiled to Wasm runs in a Web Worker in their browser.

**The engine is vendored, not fetched from a CDN.** `default-src 'self'` admits
no third-party origin, and a KYC path is the last place to make an exception for
somebody else's uptime. Four files, 4.9 MB, in `public/ocr/`: the SIMD LSTM core,
its loader, the worker script, and the English model gzipped. They are excluded
from the service-worker precache — `globPublicPatterns`, not `exclude`, which
governs webpack assets only and silently precached all four on the first attempt.

**The Wasm exception is scoped to `/ocr/*`, and no page has it.** This is
narrower than planned, and the reason is worth writing down: a dedicated Web
Worker takes its content-security policy from the headers of _its own script_,
not from the page that started it. Granting `'wasm-unsafe-eval'` to `/verify`
changed nothing — the worker still refused, and the console said so. The
exception belongs on the four static engine files, which render nothing and read
nothing. Every page in the product, `/verify` included, keeps the strict policy
byte for byte.

A related trap, also found by reading real responses: Next applies **every**
matching `headers()` entry, and a browser given two `Content-Security-Policy`
headers enforces their intersection. A rule that adds a looser policy on top of
a site-wide one therefore does nothing at all, visibly configured and silently
inert. `curl -D-` on `/verify` returned two CSP lines. The site-wide rule now
excludes `/ocr/` by pattern, and an e2e test counts the headers on five paths.

**A reading is returned only if every ICAO check digit agrees.** `src/lib/kyc/mrz.ts`
contains no OCR at all; it takes lines of text and decides whether they are a
real zone. ICAO 9303 puts a check digit after the document number, the date of
birth and the expiry, and a composite over all three — so a misread fails
arithmetic rather than producing a plausible wrong birthday. There is no
partially-trusted state: either the fields are checked, or nothing is shown and
the customer is asked for another photo. This is what makes an unreliable
recogniser safe to put in front of a KYC form.

**Nothing is written to the form without a press.** The value people notice is
saved typing; the value that matters is the cross-check. The zone is what a
border officer reads, so when it disagrees with what somebody typed a minute ago,
that is surfaced _there_ rather than found by a compliance officer three days
later. A passport in a maiden name is a real and ordinary thing, so the customer
decides which is right.

## Consequences

The gap in Phase 2 is closed for documents that have a zone. It remains true
that Iran's national card has none, so for most domestic customers this button
will not help and they will type their details as before — which is why it sits
behind `kyc.ocr` and why the copy says which documents it works on.

Two defects in this file's own first draft were caught by running it rather than
reading it, and both are recorded in the code:

- The format was gated on the length of **line one**, which is a name followed
  by a long run of `<` filler that recognisers drop as readily as trailing
  whitespace. A 36-character line one meant TD3 was never attempted on a
  perfectly good passport. It is gated on line two now, which is all data.
- Numeric fields were repaired for the `O`/`0` confusion and alphabetic ones
  were not, so `UTO` read as `UT0` and stayed that way.

The five megabytes are fetched only when somebody presses the button. A customer
who types their own details never downloads them, and the budget check still
passes on all 59 routes because the import is dynamic.

To remove this again: delete `public/ocr/`, the `/ocr/*` header rule and
`cspWithWasm`, and the reader component. `mrz.ts` is worth keeping either way —
it is pure arithmetic over a documented format and has no engine in it.
