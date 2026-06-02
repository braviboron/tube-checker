#!/usr/bin/env bash
# Re-download the vendored Tesseract.js assets so the app stays fully offline.
# Run from this directory:  ./fetch-assets.sh
set -euo pipefail
cd "$(dirname "$0")"

TESS_VER=4.1.1      # tesseract.js (library + worker)
CORE_VER=4.0.4      # tesseract.js-core (wasm)

curl -fL -o tesseract.min.js            "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/${TESS_VER}/tesseract.min.js"
curl -fL -o worker.min.js               "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/${TESS_VER}/worker.min.js"
curl -fL -o tesseract-core.wasm.js      "https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VER}/tesseract-core.wasm.js"
curl -fL -o tesseract-core-simd.wasm.js "https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VER}/tesseract-core-simd.wasm.js"

# Language model: tessdata_fast (integerised LSTM). ~1.9 MB gzipped vs ~11 MB for
# standard tessdata, with effectively identical accuracy on printed request forms
# (A/B tested: same tests detected on clean + degraded samples, equal/higher conf).
# tessdata_fast ships uncompressed, so gzip it for serving (Tesseract.js loads .gz).
curl -fL -o eng.traineddata "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata"
gzip -9 -f eng.traineddata   # -> eng.traineddata.gz

echo "Done. Verify eng.traineddata.gz is gzip:"
head -c 2 eng.traineddata.gz | od -An -tx1   # expect: 1f 8b
