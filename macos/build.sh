#!/bin/sh
# Builds macos/build/NanoThumbnail.app from dist/ and local/dist/server.mjs
# (run through `npm run app:mac`). `--install` copies it to /Applications
# (or $NT_INSTALL_DIR).
# Needs only the Xcode Command Line Tools; the app needs Node.js at runtime.
set -eu
cd "$(dirname "$0")/.."

APP=macos/build/NanoThumbnail.app

if [ "${1:-}" = "--install" ]; then
  DEST=${NT_INSTALL_DIR:-/Applications}
  mkdir -p "$DEST"
  rm -rf "$DEST/NanoThumbnail.app"
  cp -R "$APP" "$DEST/"
  echo "Installed: $DEST/NanoThumbnail.app"
  exit 0
fi

[ -f dist/app/index.html ] || { echo "Run npm run build first." >&2; exit 1; }
[ -f local/dist/server.mjs ] || { echo "Run npm run build:local first." >&2; exit 1; }

VERSION=$(node -p "require('./package.json').version")
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -o "$APP/Contents/MacOS/NanoThumbnail" macos/NanoThumbnail.swift

cp -R dist "$APP/Contents/Resources/dist"
cp local/dist/server.mjs "$APP/Contents/Resources/server.mjs"

# Icon from the PWA icon
ICONSET=macos/build/AppIcon.iconset
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z $size $size public/icons/icon-512.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  [ $double -le 512 ] && sips -z $double $double public/icons/icon-512.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
cp public/icons/icon-512.png "$ICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>NanoThumbnail</string>
  <key>CFBundleDisplayName</key><string>NanoThumbnail</string>
  <key>CFBundleIdentifier</key><string>com.nanothumbnail.studio</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>NanoThumbnail</string>
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
