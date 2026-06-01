#!/usr/bin/env bash
# Re-download the vendored Tesseract.js assets so the app stays fully offline.
# Run from this directory:  ./fetch-assets.sh
set -euo pipefail
cd "$(dirname "$0")"

TESS_VER=4.1.1      # tesseract.js (library + worker)
CORE_VER=4.0.4      # tesseract.js-core (wasm)
DATA_VER=4.0.0      # tessdata language model

curl -fL -o tesseract.min.js            "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/${TESS_VER}/tesseract.min.js"
curl -fL -o worker.min.js               "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/${TESS_VER}/worker.min.js"
curl -fL -o tesseract-core.wasm.js      "https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VER}/tesseract-core.wasm.js"
curl -fL -o tesseract-core-simd.wasm.js "https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VER}/tesseract-core-simd.wasm.js"
curl -fL -o eng.traineddata.gz          "https://tessdata.projectnaptha.com/${DATA_VER}/eng.traineddata.gz"

echo "Done. Verify eng.traineddata.gz is gzip:"
head -c 2 eng.traineddata.gz | od -An -tx1   # expect: 1f 8b
