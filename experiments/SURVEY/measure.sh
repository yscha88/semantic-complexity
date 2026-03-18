#!/bin/bash
set -euo pipefail

REPO_URL="$1"
REPO_NAME=$(echo "$REPO_URL" | sed 's|.*/||')
WORK_DIR="/tmp/sc-survey/$REPO_NAME"

echo "=== Measuring: $REPO_URL ==="

rm -rf "$WORK_DIR"
git clone --depth 1 "$REPO_URL" "$WORK_DIR" 2>/dev/null

cd "$WORK_DIR"

echo "--- Basic Stats ---"
TOTAL_PY=$(find . -name "*.py" -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l | tr -d ' ')
TEST_PY=$(find . -name "test_*.py" -o -name "*_test.py" | wc -l | tr -d ' ')
echo "total_py: $TOTAL_PY"
echo "test_py: $TEST_PY"
if [ "$TOTAL_PY" -gt 0 ]; then
  echo "test_ratio: $(echo "scale=1; $TEST_PY * 100 / $TOTAL_PY" | bc)%"
fi

echo ""
echo "--- C3: Max Nesting Depth (top 5 files) ---"
find . -name "*.py" -not -path "*/.git/*" -not -path "*/node_modules/*" | while read f; do
  MAX_INDENT=$(python3 -c "
import sys
max_d = 0
with open('$f', errors='ignore') as fh:
    for line in fh:
        stripped = line.lstrip()
        if stripped and not stripped.startswith('#'):
            indent = len(line) - len(stripped)
            d = indent // 4
            if d > max_d:
                max_d = d
print(max_d)
" 2>/dev/null || echo 0)
  echo "$MAX_INDENT $f"
done | sort -rn | head -5

echo ""
echo "--- C4: Hidden Dependencies (global/environ) ---"
echo "os.environ refs: $(grep -r 'os\.environ\|os\.getenv' --include="*.py" . 2>/dev/null | grep -v test | wc -l | tr -d ' ')"
echo "global keyword: $(grep -r '^[[:space:]]*global ' --include="*.py" . 2>/dev/null | grep -v test | wc -l | tr -d ' ')"

echo ""
echo "--- B1: Auth patterns ---"
echo "auth refs: $(grep -rl 'auth\|login\|token\|jwt\|oauth\|password\|credential' --include="*.py" . 2>/dev/null | grep -v test | wc -l | tr -d ' ')"

echo ""
echo "--- B2: Secret patterns ---"
echo "secret/key refs: $(grep -r 'SECRET\|API_KEY\|PASSWORD\|CREDENTIAL\|api_key\|secret_key' --include="*.py" . 2>/dev/null | grep -v test | wc -l | tr -d ' ')"

echo ""
echo "--- B4: SQL patterns ---"
echo "raw SQL: $(grep -r 'execute(\|cursor\.\|raw_sql\|text(' --include="*.py" . 2>/dev/null | grep -v test | grep -v migration | wc -l | tr -d ' ')"
echo "ORM: $(grep -r 'session\.\|query\.\|filter(\|select(\|SQLModel\|Base\.metadata' --include="*.py" . 2>/dev/null | grep -v test | wc -l | tr -d ' ')"

echo ""
echo "--- H3: Contract test ---"
echo "contract/schema test: $(grep -rl 'schemathesis\|pact\|contract\|openapi.*test\|schema.*valid' --include="*.py" . 2>/dev/null | wc -l | tr -d ' ')"

echo ""
echo "--- C1: Largest functions (by line count) ---"
python3 -c "
import ast, os, sys

results = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '__pycache__')]
    for fname in files:
        if not fname.endswith('.py'): continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, errors='ignore') as f:
                tree = ast.parse(f.read())
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    end = getattr(node, 'end_lineno', node.lineno)
                    lines = end - node.lineno + 1
                    results.append((lines, fpath, node.name))
        except: pass

results.sort(reverse=True)
for lines, fpath, name in results[:10]:
    print(f'{lines:4d} {fpath}::{name}')
" 2>/dev/null

echo ""
echo "--- C2: SAR (state+async+retry) candidates ---"
grep -rl 'async def' --include="*.py" . 2>/dev/null | while read f; do
  HAS_RETRY=$(grep -l 'retry\|Retry\|backoff\|reconnect\|max_retries\|max_tries' "$f" 2>/dev/null | wc -l)
  HAS_STATE=$(grep -l 'self\.\|_state\|_status\|_cache' "$f" 2>/dev/null | wc -l)
  if [ "$HAS_RETRY" -gt 0 ] && [ "$HAS_STATE" -gt 0 ]; then
    echo "SAR candidate: $f"
  fi
done | head -10

echo ""
echo "=== Done: $REPO_URL ==="

rm -rf "$WORK_DIR"
