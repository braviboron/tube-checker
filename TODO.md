# TODO / Roadmap

## Clinical accuracy (highest priority)
- [ ] Audit every rule in `RULES` against an authoritative AU/NZ tube guide.
- [ ] Resolve `ESR` appearing in both the purple-top and gold-top rules.
- [ ] Disambiguate `lithium`: drug level (gold/serum) vs lithium-heparin tube (green).
- [ ] Decide whether some tests legitimately need **multiple** tubes and model that.
- [ ] Review the broad "biochem" gold rule for false positives (e.g. bare `protein`,
      `ck`, `pt` word-boundary collisions).
- [ ] Green-top (Li-heparin) currently has no rules — add the tests that use it.

## Features
- [ ] Show **order of draw** when multiple tubes are required.
- [ ] Show the number/volume of tubes, not just the colour.
- [ ] Let the user confirm/reject matches before finalising.
- [ ] Improve handling of unrecognised lines (suggest closest known test).

## OCR / input
- [ ] More robust extraction (deskew, threshold, per-line confidence).
- [ ] Better camera UX and image preprocessing.

## Engineering
- [ ] Add a test harness for `matchTests()` with sample request-form text fixtures.
- [ ] Consider extracting `TUBES`/`RULES` into a separate data file (kept inlined for
      now to preserve the single-file / offline property).
