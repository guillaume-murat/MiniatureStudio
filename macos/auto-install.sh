#!/bin/sh
# Rebuilds and reinstalls the macOS app when its sources changed since the last
# install. Run by a Claude Code Stop hook (.claude/settings.local.json); also
# fine to run by hand. Prints a hook JSON message only when it did something.
set -u
cd "$(dirname "$0")/.."

PATHS="src public local netlify macos/NanoThumbnail.swift macos/build.sh astro.config.mjs package.json"
STAMP=macos/build/.installed
LOG=macos/build/auto-install.log
LOCK=macos/build/.auto-install.lock

# shellcheck disable=SC2086
fingerprint() {
  {
    git rev-parse HEAD
    git diff HEAD -- $PATHS
    git ls-files --others --exclude-standard -- $PATHS | while IFS= read -r f; do
      echo "$f"
      cat "$f"
    done
  } | shasum | cut -d' ' -f1
}

mkdir -p macos/build
current=$(fingerprint)
[ "$current" = "$(cat "$STAMP" 2>/dev/null)" ] && exit 0
mkdir "$LOCK" 2>/dev/null || exit 0 # another install is running
trap 'rmdir "$LOCK"' EXIT

if npm run app:mac:install >"$LOG" 2>&1; then
  echo "$current" >"$STAMP"
  echo '{"systemMessage": "NanoThumbnail.app rebuilt and installed in /Applications (relaunch it to use the new version)."}'
else
  echo "{\"systemMessage\": \"NanoThumbnail.app auto-install failed, see $LOG\"}"
fi
