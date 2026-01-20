#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Deployment gates doc present (sd_159) =="

F="docs/DEPLOYMENT_GATES.md"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
echo "✅ $F"

# Key headings required
grep -q "^# Deployment Gates" "$F" || { echo "❌ Missing main heading"; exit 1; }
grep -q "^# P0 Gates" "$F" || { echo "❌ Missing P0 section"; exit 1; }
grep -q "P0.1 Authentication" "$F" || { echo "❌ Missing P0.1 auth gate"; exit 1; }
grep -q "P0.2 Authorization" "$F" || { echo "❌ Missing P0.2 authorization gate"; exit 1; }
grep -q "Evidence commands" "$F" || { echo "❌ Missing evidence commands sections"; exit 1; }

echo "✅ deployment gates doc check passed"
