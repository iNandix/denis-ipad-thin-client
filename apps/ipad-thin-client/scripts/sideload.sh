#!/usr/bin/env bash
# DENIS_IPAD_THIN_CLIENT_V1 — Sideload IPA to iPad via AltServer-Linux
# Requires: AltServer-Linux running, iPad connected via USB
set -euo pipefail

IPA_PATH="${1:-}"
APPLE_ID="${APPLE_ID:-alecbcn@icloud.com}"
DEVICE_UDID="${DEVICE_UDID:-00008103-000C195C02E9401E}"
ALT_SERVER="${ALT_SERVER:-localhost:6969}"

if [[ -z "$IPA_PATH" ]]; then
  echo "Usage: $0 <path-to-ipa>"
  echo ""
  echo "Environment vars:"
  echo "  APPLE_ID     — Apple ID for signing (default: $APPLE_ID)"
  echo "  DEVICE_UDID  — iPad UDID (default: $DEVICE_UDID)"
  echo "  ALT_SERVER   — AltServer-Linux address (default: $ALT_SERVER)"
  exit 1
fi

if [[ ! -f "$IPA_PATH" ]]; then
  echo "ERROR: IPA not found: $IPA_PATH"
  exit 1
fi

echo "=== Denis iPad Sideload ==="
echo "IPA:        $IPA_PATH"
echo "Device:     $DEVICE_UDID"
echo "Apple ID:   $APPLE_ID"
echo "AltServer:  $ALT_SERVER"
echo ""

# Check iPad is connected
echo "[1/3] Checking USB connection..."
UDID=$(idevice_id -l 2>/dev/null || true)
if [[ -z "$UDID" ]]; then
  echo "ERROR: No iOS device detected via USB"
  echo "Connect the iPad and try again."
  exit 1
fi
echo "  ✓ Device: $UDID"

# Validate pairing
echo "[2/3] Validating pairing..."
idevicepair validate 2>/dev/null || {
  echo "ERROR: Pairing validation failed"
  echo "Run: idevicepair pair"
  exit 1
}
echo "  ✓ Paired"

# Install via ideviceinstaller (if already signed) or AltServer
echo "[3/3] Installing..."
if command -v altserver &>/dev/null; then
  echo "  Using AltServer-Linux..."
  altserver "$IPA_PATH" -u "$DEVICE_UDID" -a "$APPLE_ID"
elif command -v ideviceinstaller &>/dev/null; then
  echo "  Using ideviceinstaller (IPA must be pre-signed)..."
  ideviceinstaller -u "$DEVICE_UDID" -i "$IPA_PATH"
else
  echo "ERROR: No sideload tool found."
  echo "Install AltServer-Linux or use ideviceinstaller with pre-signed IPA."
  exit 1
fi

echo ""
echo "=== Installation Complete ==="
echo "Open Settings → General → VPN & Device Management"
echo "Trust the developer profile for: $APPLE_ID"
echo "Then launch 'Denis' from the home screen."
