# Vendored Tesseract.js (offline OCR)

These files are committed so the app runs with **zero network calls**. They are
loaded locally by `index.html` (see `runOCR()` / `TESS_VENDOR`).

| File | Source | Purpose |
|------|--------|---------|
| `tesseract.min.js` | cdnjs — tesseract.js 4.1.1 | main library (loaded by the page) |
| `worker.min.js` | cdnjs — tesseract.js 4.1.1 | web-worker script |
| `tesseract-core.wasm.js` | jsDelivr — tesseract.js-core 4.0.4 | WASM core (non-SIMD) |
| `tesseract-core-simd.wasm.js` | jsDelivr — tesseract.js-core 4.0.4 | WASM core (SIMD) |
| `eng.traineddata.gz` | tessdata.projectnaptha.com 4.0.0 | English language model (~11 MB) |

Re-fetch / upgrade with `./fetch-assets.sh`. Keep the library and worker versions in
sync (both tesseract.js 4.1.1) and the core compatible (4.0.x).
