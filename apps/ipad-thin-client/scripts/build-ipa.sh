#!/usr/bin/env bash
# DENIS_IPAD_THIN_CLIENT_V1 — Build IPA via GitHub Actions or local Xcode
# Usage: ./scripts/build-ipa.sh [--local|--ci]
set -euo pipefail

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJ_DIR"

echo "=== Denis Thin Client IPA Build ==="

# Step 1: Install deps
echo "[1/5] Installing dependencies..."
npm install --no-fund --no-audit 2>/dev/null

# Step 2: Build web assets
echo "[2/5] Building web assets..."
npx vite build

# Step 3: Sync to Capacitor iOS project
echo "[3/5] Syncing Capacitor..."
npx cap sync ios

# Step 4: Build IPA
if [[ "${1:-}" == "--local" ]]; then
  echo "[4/5] Building IPA locally (requires Xcode)..."
  cd ios/App
  xcodebuild \
    -workspace App.xcworkspace \
    -scheme App \
    -configuration Release \
    -archivePath build/DenisVoice.xcarchive \
    archive
  xcodebuild \
    -exportArchive \
    -archivePath build/DenisVoice.xcarchive \
    -exportOptionsPlist ExportOptions.plist \
    -exportPath build/ipa
  echo "IPA at: ios/App/build/ipa/Denis Voice.ipa"
elif [[ "${1:-}" == "--ci" ]]; then
  echo "[4/5] Queuing GitHub Actions build..."
  gh workflow run build-ipa.yml --ref main
  echo "Waiting for build..."
  sleep 10
  gh run list --workflow=build-ipa.yml --limit 1
  echo "Download with: gh run download <run-id> -n DenisVoice"
else
  echo "[4/5] Web assets built. Use --local (needs Xcode) or --ci (GitHub Actions)"
fi

# Step 5: Report
echo ""
echo "=== Build Summary ==="
echo "Web dist: $(du -sh dist 2>/dev/null | cut -f1)"
echo "Capacitor sync: ios/App/"
echo "Bundle ID: so.denis.voice.client"
echo "Background modes: audio"
echo "Gateway WS: ws://100.86.69.108:18130"
echo ""
echo "Next: sideload with scripts/sideload.sh"
