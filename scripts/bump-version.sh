#!/usr/bin/env bash
set -e

NEW_VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Validate ──────────────────────────────────────────────────────────────────
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: bash scripts/bump-version.sh <new-version>"
  echo "Example: bash scripts/bump-version.sh 2.2.0"
  exit 1
fi

if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be in X.Y.Z format (got: $NEW_VERSION)"
  exit 1
fi

OLD_VERSION=$(node -p "require('$ROOT/package.json').version")
echo "Bumping $OLD_VERSION → $NEW_VERSION"

# ── Helper: update version field in a JSON file ───────────────────────────────
bump_json() {
  local file="$1"
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$file', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('$file', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  ✓ $file"
}

# ── Update package JSON files ─────────────────────────────────────────────────
bump_json "$ROOT/package.json"
bump_json "$ROOT/package.full.json"

[ -f "$ROOT/package.fraud.json" ] && bump_json "$ROOT/package.fraud.json"

echo ""
echo "✓ Version bumped to $NEW_VERSION"
echo ""
echo "  Next steps:"
echo "    1. Regenerate Podfile.lock (it pins the plugin version):"
echo "       cd example/ios && bundle exec pod install && cd ../.."
echo ""
echo "    2. Commit everything:"
echo "       git add package.json package.full.json package.fraud.json example/ios/Podfile.lock"
echo "       git commit -m \"chore: bump version to v$NEW_VERSION\""
echo "       git tag v$NEW_VERSION"
echo ""
