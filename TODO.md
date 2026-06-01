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
- [x] Conservative clinical redesign: light theme, system font, no emoji, line icons.
- [x] Removed Google Fonts dependency (system font stack) — one fewer network call.
- [x] Test harness (`tests/match.test.mjs`) running against the real rules in index.html.

## Clinical accuracy (ongoing)
- [ ] Have a second clinician sanity-check the full `RULES` set against the NSW catalogue.
- [ ] Decide lab-specific edge cases that genuinely vary (ESR dedicated tube? PTH serum vs
      EDTA? folate serum vs red-cell?) — currently follows the Monash/RCPA convention.
- [ ] Confirm trace-element tube draw-order position for the target lab.
- [ ] Model tests that legitimately need a specific tube *volume* or multiple tubes.

## Features
- [ ] Show recommended fill volumes per tube.
- [ ] Let the user confirm/reject individual matches before finalising.
- [ ] "Did you mean…?" suggestions for unrecognised lines.
- [ ] Print / share a collection summary.

## OCR / input
- [ ] Image pre-processing (deskew, threshold) to improve recognition.
- [ ] Optional auto-scan when the form is held steady in frame.

## Engineering
- [ ] Add an `npm test` wrapper / CI once a package.json is justified.
- [ ] Consider vendoring Tesseract.js locally to remove the one remaining CDN dependency
      (would make the app fully offline after first load with no external calls at all).
