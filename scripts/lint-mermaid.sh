#!/bin/bash
# A wrapper for lint-staged to validate mermaid syntax without polluting the workspace with SVGs
set -e

for file in "$@"; do
    npx mmdc -i "$file" -o /tmp/lint-mmdc-output.svg > /dev/null 2>&1
done

echo "Mermaid validation passed."
