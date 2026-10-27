#!/bin/sh
# Rebuilds and reinstalls the macOS app when its sources changed since the last
# install. Run by a Claude Code Stop hook (.claude/settings.local.json); also
# fine to run by hand. Prints a hook JSON message only when it did something.
# `--mark-installed` records the current sources as installed without building.
set -u
cd "$(dirname "$0")/.."

PATHS="src public local netlify macos/NanoThumbnail.swift macos/build.sh macos/AppIcon.png astro.config.mjs package.json"
STAMP=macos/build/.installed
LOG=macos/build/auto-install.log
LOCK=macos/build/.auto-install.lock

# The content of every source file, tracked or new: a commit alone changes
# nothing, so it doesn't trigger a rebuild.
# shellcheck disable=SC2086
fingerprint() {
  git ls-files --cached --others --exclude-standard -- $PATHS | sort -u | while IFS= read -r f; do
    [ -f "$f" ] || continue
    echo "$f"
    cat "$f"
  done | shasum | cut -d' ' -f1
}

mkdir -p macos/build
current=$(fingerprint)
if [ "${1:-}" = "--mark-installed" ]; then
  echo "$current" >"$STAMP"
  exit 0
fi
[ "$current" = "$(cat "$STAMP" 2>/dev/null)" ] && exit 0
mkdir "$LOCK" 2>/dev/null || exit 0 # another install is running
trap 'rmdir "$LOCK"' EXIT

if npm run app:mac:install >"$LOG" 2>&1; then
  echo "$current" >"$STAMP"
  echo '{"systemMessage": "NanoThumbnail.app rebuilt and installed in /Applications (relaunch it to use the new version)."}'
else
  echo "{\"systemMessage\": \"NanoThumbnail.app auto-install failed, see $LOG\"}"
fi
