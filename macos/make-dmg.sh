#!/bin/sh
# Packs macos/build/Miniature Studio.app into a DMG to share (drag the app onto Applications).
# Run `npm run app:mac` first. Output: macos/build/Miniature-Studio-<version>.dmg
set -e
cd "$(dirname "$0")/.."
APP="macos/build/Miniature Studio.app"
[ -d "$APP" ] || { echo "Run npm run app:mac first." >&2; exit 1; }
VERSION=$(node -p "require('./package.json').version")
DMG="macos/build/Miniature-Studio-$VERSION.dmg"
STAGE=$(mktemp -d)
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -volname "Miniature Studio $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"
echo "Built: $DMG"
