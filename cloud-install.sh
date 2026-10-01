#!/usr/bin/env bash
set -euo pipefail
cd /workspace/nehirakademi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||major>=25||(major===22&&minor<9)) throw new Error("Use Node 24.19.0 or supported Node 22.9+.")'
npm ci --cache /tmp/nehir-npm-cache --no-audit --no-fund
npm run db:migrate
