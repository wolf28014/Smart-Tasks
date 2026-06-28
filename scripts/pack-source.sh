#!/bin/bash
# Pack the TodoList project source code into a downloadable zip.
# Excludes node_modules, .next build cache, dev logs, db files, uploads,
# and other ephemeral / environment-specific files.

set -euo pipefail

PROJECT_DIR="/home/z/my-project"
OUTPUT_DIR="/home/z/my-project/download"
OUTPUT_ZIP="$OUTPUT_DIR/todolist-source.zip"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_ZIP"

cd "$PROJECT_DIR"

# Use zip with exclusion patterns
zip -r "$OUTPUT_ZIP" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*" \
  -x ".zscripts/*" \
  -x "skills/*" \
  -x "examples/*" \
  -x "mini-services/*" \
  -x "upload/*" \
  -x "uploads/*" \
  -x "public/uploads/*" \
  -x "db/*" \
  -x "dev.log" \
  -x "server.log" \
  -x "download/*" \
  -x "*.log" \
  -x ".DS_Store" \
  > /dev/null

echo "✓ Packed to: $OUTPUT_ZIP"
ls -lh "$OUTPUT_ZIP"
echo ""
echo "Contents overview:"
unzip -l "$OUTPUT_ZIP" | tail -5
