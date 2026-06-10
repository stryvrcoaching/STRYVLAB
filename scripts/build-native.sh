#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STRYV — Native build script (Capacitor remote-URL mode)
#
# Usage:
#   ./scripts/build-native.sh ios      → sync + open Xcode
#   ./scripts/build-native.sh android  → sync + open Android Studio
#   ./scripts/build-native.sh sync     → sync only (no IDE open)
#
# Prerequisites:
#   - CAPACITOR_SERVER_URL env var set (production URL)
#   - npx cap add ios / npx cap add android already run once
#   - Xcode (iOS) or Android Studio (Android) installed
# ─────────────────────────────────────────────────────────────────────────────

set -e

PLATFORM=${1:-sync}

echo "▶ STRYV native build — platform: $PLATFORM"

# Validate CAPACITOR_SERVER_URL in production builds
if [ "$NODE_ENV" = "production" ] && [ -z "$CAPACITOR_SERVER_URL" ]; then
  echo "❌ CAPACITOR_SERVER_URL is not set. Export it before building:"
  echo "   export CAPACITOR_SERVER_URL=https://your-app.vercel.app"
  exit 1
fi

echo "▶ Syncing Capacitor plugins..."
npx cap sync

if [ "$PLATFORM" = "ios" ]; then
  echo "▶ Opening Xcode..."
  npx cap open ios

elif [ "$PLATFORM" = "android" ]; then
  echo "▶ Opening Android Studio..."
  npx cap open android

elif [ "$PLATFORM" = "sync" ]; then
  echo "✓ Sync complete. Run with 'ios' or 'android' to open the IDE."

else
  echo "❌ Unknown platform: $PLATFORM"
  echo "   Usage: ./scripts/build-native.sh [ios|android|sync]"
  exit 1
fi

echo "✓ Done."
