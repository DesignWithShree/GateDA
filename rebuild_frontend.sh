#!/bin/bash
# Only needed if you edit files under frontend/src. Requires Node.js 18+.
cd "$(dirname "$0")/frontend"
npm install
npm run build
echo "Rebuilt into ../web"
