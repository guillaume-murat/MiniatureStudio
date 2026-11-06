#!/bin/sh
# Builds "macos/build/Miniature Studio.app" from dist/ and local/dist/server.mjs
# (run through `npm run app:mac`). `--install` copies it to /Applications
# (or $NT_INSTALL_DIR).
# Needs only the Xcode Command Line Tools; the app needs Node.js at runtime.
set -eu
cd "$(dirname "$0")/.."

APP="macos/build/Miniature Studio.app"

if [ "${1:-}" = "--install" ]; then
  DEST=${NT_INSTALL_DIR:-/Applications}
  mkdir -p "$DEST"
  rm -rf "$DEST/Miniature Studio.app" "$DEST/NanoThumbnail.app" # the app's name before the rename
  cp -R "$APP" "$DEST/"
  echo "Installed: $DEST/Miniature Studio.app"
  exit 0
fi

[ -f dist/app/index.html ] || { echo "Run npm run build first." >&2; exit 1; }
[ -f local/dist/server.mjs ] || { echo "Run npm run build:local first." >&2; exit 1; }

VERSION=$(node -p "require('./package.json').version")
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# Universal: Apple silicon and Intel Macs.
TMP=$(mktemp -d)
swiftc -O -target arm64-apple-macos14 -o "$TMP/arm64" macos/MiniatureStudio.swift
swiftc -O -target x86_64-apple-macos14 -o "$TMP/x86_64" macos/MiniatureStudio.swift
lipo -create "$TMP/arm64" "$TMP/x86_64" -output "$APP/Contents/MacOS/MiniatureStudio"
rm -rf "$TMP"

cp -R dist "$APP/Contents/Resources/dist"
cp local/dist/server.mjs "$APP/Contents/Resources/server.mjs"

# Icon: macos/AppIcon.png (1024 px, already in the macOS icon shape; see make-icon.swift)
ICONSET=macos/build/AppIcon.iconset
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z $size $size macos/AppIcon.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double macos/AppIcon.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

# The bundle identifier keeps the former name: WebKit stores the app's data (projects, keys) under it.
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Miniature Studio</string>
  <key>CFBundleDisplayName</key><string>Miniature Studio</string>
  <key>CFBundleIdentifier</key><string>com.nanothumbnail.studio</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>MiniatureStudio</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.graphics-design</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP" >/dev/null
echo "Built: $APP"
