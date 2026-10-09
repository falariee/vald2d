#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --cache "${NPM_CONFIG_CACHE:-/tmp/stride-npm-cache}"
node scripts/setup.mjs
npm test
