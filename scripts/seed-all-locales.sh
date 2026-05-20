#!/usr/bin/env bash
# scripts/seed-all-locales.sh
# Runs seed-translations.ts for each locale in order, reports inserted counts,
# and flags any locale where translated text looks like wrong-script output.
# Usage: bash scripts/seed-all-locales.sh [locales...]
# Default order: bn as ta te mr gu kn ml pa es ru

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
LOCALES=("${@:-bn as ta te mr gu kn ml pa es ru}")

# Unicode block ranges for each non-Latin script locale
declare -A SCRIPT_PATTERN
SCRIPT_PATTERN[bn]="[\x{0980}-\x{09FF}]"   # Bengali
SCRIPT_PATTERN[as]="[\x{0980}-\x{09FF}]"   # Assamese (same block as Bengali)
SCRIPT_PATTERN[ta]="[\x{0B80}-\x{0BFF}]"   # Tamil
SCRIPT_PATTERN[te]="[\x{0C00}-\x{0C7F}]"   # Telugu
SCRIPT_PATTERN[mr]="[\x{0900}-\x{097F}]"   # Marathi / Devanagari
SCRIPT_PATTERN[gu]="[\x{0A80}-\x{0AFF}]"   # Gujarati
SCRIPT_PATTERN[kn]="[\x{0C80}-\x{0CFF}]"   # Kannada
SCRIPT_PATTERN[ml]="[\x{0D00}-\x{0D7F}]"   # Malayalam
SCRIPT_PATTERN[pa]="[\x{0A00}-\x{0A7F}]"   # Punjabi / Gurmukhi
SCRIPT_PATTERN[hi]="[\x{0900}-\x{097F}]"   # Hindi / Devanagari

for LOCALE in "${LOCALES[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Running locale: $LOCALE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  OUTFILE="/tmp/seed_${LOCALE}.log"

  TRANSLATE_LOCALE="$LOCALE" npx tsx "$ROOT/scripts/seed-translations.ts" 2>&1 | tee "$OUTFILE"

  # Count results
  DONE=$(grep -c "^  ✓" "$OUTFILE" 2>/dev/null || echo 0)
  FAILED=$(grep -c "^  ✗" "$OUTFILE" 2>/dev/null || echo 0)
  SKIPPED=$(grep -c "^  ⟳ Skip" "$OUTFILE" 2>/dev/null || echo 0)

  echo ""
  echo "  [$LOCALE] Done: $DONE translated | $SKIPPED skipped | $FAILED failed"

  # Flag bad output for non-Latin script languages
  if [[ -n "${SCRIPT_PATTERN[$LOCALE]+_}" ]]; then
    PATTERN="${SCRIPT_PATTERN[$LOCALE]}"
    BAD=$(grep "^  ✓" "$OUTFILE" | grep "→" | while IFS= read -r line; do
      VALUE="${line##*→  }"
      # Check if translated value contains at least one expected-script character
      if ! echo "$VALUE" | grep -qP "$PATTERN"; then
        echo "  ⚠ POSSIBLE BAD OUTPUT [$LOCALE]: $line"
      fi
    done)
    if [[ -n "$BAD" ]]; then
      echo "$BAD"
    fi
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All locales complete."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
