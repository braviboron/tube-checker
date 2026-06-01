# TODO / Roadmap

## Done
- [x] Order-of-draw model (`draw` on each tube) + numbered draw sequence in the UI.
- [x] Tube count summary ("N tubes needed") with colour swatches.
- [x] Test consolidation — many tests collapse to the minimum tubes (e.g. UEC+CRP+LFT → 1 gold).
- [x] Rules rebuilt on NSW Health / RCPA conventions (Monash chart cross-reference).
- [x] Fixed clinical bugs: ESR no longer double-maps to gold; ammonia → green;
      trace elements (zinc/copper/etc) → royal blue; blood cultures → both bottles.
- [x] Sources & references section (NSW Health Pathology, CEC, RCPA) + formal disclaimer.
- [x] Camera capture (no photo saved to device); tap the preview to capture pages.
- [x] Multi-page forms — add several pages (upload or camera), OCR'd together.
- [x] Conservative clinical redesign, then an iOS-style "sterile" grouped-list redesign
      (reference: UCLH directory app): grouped cards, hairline separators, tinted tiles.
- [x] Removed Google Fonts dependency (system font stack).
- [x] **Fully offline — vendored Tesseract.js** (library, worker, WASM core, eng model)
      under `vendor/tesseract/`; zero network calls. `fetch-assets.sh` to re-fetch.
- [x] **PWA** — installable to home screen, full-screen, service worker precaches the
      whole app (incl. 11 MB model) for true offline. Free, no App Store. (`manifest.json`,
      `sw.js`, `icons/`). Direction decided: web-only, no paid native/App Store route.
- [x] Test harness (`tests/match.test.mjs`) running against the real rules in index.html.

## Next up
- [ ] **Test picker when adding / editing a chip.** Replace the prompt() with a dropdown /
      typeahead of all known tests. Each tube rule gets a CANONICAL test name; the picker
      searches those canonical names with alias support (alternate names/acronyms) and
      typo tolerance (fuzzy match). Selecting a canonical name guarantees a correct tube
      mapping. Needs: a canonical test list (name + aliases + tube) and a fuzzy search.

## Parked for later (agreed with user)
- [ ] **Clinical test-list sweep** — go through the tests actually ordered on the ward
      (paste a list / photograph a request form) and add every missing abbreviation,
      mapping each to the right tube in one pass. EUC was the first such gap found.
- [ ] **More than one tube of the same colour.** Today the app always consolidates to
      one tube per colour (×1). Real life needs a 2nd sometimes, for (a) draw VOLUME and
      (b) dedicated/split tubes (lab-specific). Needs per-test volume data + split rules;
      capture these during the sweep above.
- [ ] **Optional: native one-shot camera** — offered as a more private/clearer capture
      (system Camera app, no held live stream). Not yet decided; current live-preview
      multi-page capture stays for now.

## Clinical accuracy (ongoing)
- [ ] Have a second clinician sanity-check the full `RULES` set against the NSW catalogue.
- [ ] Decide lab-specific edge cases that genuinely vary (ESR dedicated tube? PTH serum vs
      EDTA? folate serum vs red-cell?) — currently follows the Monash/RCPA convention.
- [ ] Confirm trace-element tube draw-order position for the target lab.

## Features
- [ ] Show recommended fill volumes per tube.
- [ ] Let the user confirm/reject individual matches before finalising.
- [ ] "Did you mean…?" suggestions for unrecognised lines.
- [ ] Print / share a collection summary.

## OCR / input
- [x] Image pre-processing (upscale, greyscale, contrast) + tuned worker — done.
- [ ] Further pre-processing (deskew, adaptive threshold) if accuracy needs it.
- [ ] Optional auto-scan when the form is held steady in frame.

## Engineering
- [ ] Add an `npm test` wrapper / CI once a package.json is justified.
