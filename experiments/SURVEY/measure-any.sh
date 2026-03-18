#!/bin/bash
# 다국어 측정 스크립트 — Python, TypeScript, JavaScript, Go, Rust, Java, Ruby
set -euo pipefail

REPO_URL="$1"
REPO_NAME=$(echo "$REPO_URL" | sed 's|.*/||')
WORK_DIR="/tmp/sc-survey/$REPO_NAME"

echo "=== Measuring: $REPO_URL ==="

rm -rf "$WORK_DIR"
git clone --depth 1 "$REPO_URL" "$WORK_DIR" 2>/dev/null

cd "$WORK_DIR"

# 언어별 확장자 감지
PY=$(find . -name "*.py" -not -path "*/.git/*" -not -path "*/node_modules/*" | wc -l | tr -d ' ')
TS=$(find . -name "*.ts" -not -path "*/.git/*" -not -path "*/node_modules/*" -not -name "*.d.ts" | wc -l | tr -d ' ')
JS=$(find . -name "*.js" -not -path "*/.git/*" -not -path "*/node_modules/*" -not -name "*.min.js" | wc -l | tr -d ' ')
GO=$(find . -name "*.go" -not -path "*/.git/*" | wc -l | tr -d ' ')
RS=$(find . -name "*.rs" -not -path "*/.git/*" | wc -l | tr -d ' ')
RB=$(find . -name "*.rb" -not -path "*/.git/*" | wc -l | tr -d ' ')
JV=$(find . -name "*.java" -not -path "*/.git/*" | wc -l | tr -d ' ')

# 가장 많은 언어 선택
MAX=0; LANG="unknown"; EXT="py"
for pair in "py:$PY" "ts:$TS" "js:$JS" "go:$GO" "rs:$RS" "rb:$RB" "java:$JV"; do
  ext="${pair%%:*}"; cnt="${pair#*:}"
  if [ "$cnt" -gt "$MAX" ]; then MAX=$cnt; LANG=$ext; EXT=$ext; fi
done

echo "primary_language: $LANG"
echo "total_files: $MAX"

# 테스트 비율
case "$EXT" in
  py) TEST_FILES=$(find . -name "test_*.py" -o -name "*_test.py" | wc -l | tr -d ' ') ;;
  ts|js) TEST_FILES=$(find . -name "*.test.$EXT" -o -name "*.spec.$EXT" -not -path "*/node_modules/*" | wc -l | tr -d ' ') ;;
  go) TEST_FILES=$(find . -name "*_test.go" | wc -l | tr -d ' ') ;;
  rs) TEST_FILES=$(grep -rl '#\[cfg(test)\]' --include="*.rs" . 2>/dev/null | wc -l | tr -d ' ') ;;
  rb) TEST_FILES=$(find . -name "*_test.rb" -o -name "*_spec.rb" | wc -l | tr -d ' ') ;;
  java) TEST_FILES=$(find . -name "*Test.java" -o -name "*Tests.java" | wc -l | tr -d ' ') ;;
esac
echo "test_files: $TEST_FILES"
if [ "$MAX" -gt 0 ]; then
  echo "test_ratio: $(echo "scale=1; $TEST_FILES * 100 / $MAX" | bc)%"
fi

# 중첩 깊이 (들여쓰기 기반 — 언어 무관)
echo ""
echo "--- Max Nesting Depth (top 5) ---"
case "$EXT" in
  py) INDENT=4 ;;
  go|rs|java) INDENT=4 ;;  # tab→4
  ts|js|rb) INDENT=2 ;;
esac
find . -name "*.$EXT" -not -path "*/.git/*" -not -path "*/node_modules/*" | while read f; do
  MAX_D=$(python3 -c "
import sys
max_d = 0
with open('$f', errors='ignore') as fh:
    for line in fh:
        stripped = line.lstrip()
        if stripped and not stripped.startswith(('//', '#', '*', '/*')):
            indent = len(line) - len(stripped)
            d = indent // $INDENT
            if d > max_d: max_d = d
print(max_d)
" 2>/dev/null || echo 0)
  echo "$MAX_D $f"
done | sort -rn | head -5

# Auth 패턴
echo ""
echo "--- Auth patterns ---"
echo "auth refs: $(grep -rl 'auth\|login\|token\|jwt\|oauth\|password\|credential' --include="*.$EXT" . 2>/dev/null | grep -vi test | wc -l | tr -d ' ')"

# Secret 패턴
echo ""
echo "--- Secret patterns ---"
echo "secret/key refs: $(grep -r 'SECRET\|API_KEY\|PASSWORD\|CREDENTIAL\|api_key\|secret_key' --include="*.$EXT" . 2>/dev/null | grep -vi test | wc -l | tr -d ' ')"

# 최대 함수 — 언어별
echo ""
echo "--- Largest functions ---"
case "$EXT" in
  py)
    python3 -c "
import ast, os
results = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '__pycache__')]
    for fname in files:
        if not fname.endswith('.py'): continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, errors='ignore') as f: tree = ast.parse(f.read())
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    end = getattr(node, 'end_lineno', node.lineno)
                    results.append((end - node.lineno + 1, fpath, node.name))
        except: pass
results.sort(reverse=True)
for lines, fpath, name in results[:5]:
    print(f'{lines:4d} {fpath}::{name}')
" 2>/dev/null
    ;;
  ts|js)
    # 간이 측정: function/method 사이 줄 수
    find . -name "*.$EXT" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read f; do
      awk '/^[[:space:]]*(export )?(async )?(function |const \w+ = |class )/{name=$0; start=NR} /^}/{if(start>0){print NR-start+1, FILENAME"::"name; start=0}}' "$f" 2>/dev/null
    done | sort -rn | head -5
    ;;
  go)
    find . -name "*.go" -not -path "*/.git/*" | while read f; do
      awk '/^func /{name=$0; start=NR} /^}/{if(start>0){print NR-start+1, FILENAME"::"name; start=0}}' "$f" 2>/dev/null
    done | sort -rn | head -5
    ;;
  *)
    echo "(unsupported language for function size)"
    ;;
esac

# SAR
echo ""
echo "--- SAR candidates ---"
case "$EXT" in
  py) grep -rl 'async def' --include="*.py" . 2>/dev/null | while read f; do
        HR=$(grep -l 'retry\|Retry\|backoff\|reconnect\|max_retries' "$f" 2>/dev/null | wc -l)
        HS=$(grep -l 'self\.\|_state\|_status\|_cache' "$f" 2>/dev/null | wc -l)
        if [ "$HR" -gt 0 ] && [ "$HS" -gt 0 ]; then echo "SAR: $f"; fi
      done | head -5 ;;
  ts|js) grep -rl 'async ' --include="*.$EXT" . 2>/dev/null | while read f; do
           HR=$(grep -l 'retry\|backoff\|reconnect' "$f" 2>/dev/null | wc -l)
           HS=$(grep -l 'this\.\|state\|cache' "$f" 2>/dev/null | wc -l)
           if [ "$HR" -gt 0 ] && [ "$HS" -gt 0 ]; then echo "SAR: $f"; fi
         done | head -5 ;;
  go) grep -rl 'go func\|goroutine\|chan ' --include="*.go" . 2>/dev/null | while read f; do
        HR=$(grep -l 'retry\|backoff\|Retry' "$f" 2>/dev/null | wc -l)
        HS=$(grep -l 'mutex\|sync\.\|atomic\.' "$f" 2>/dev/null | wc -l)
        if [ "$HR" -gt 0 ] && [ "$HS" -gt 0 ]; then echo "SAR: $f"; fi
      done | head -5 ;;
  *) echo "(unsupported)" ;;
esac

echo ""
echo "=== Done: $REPO_URL ==="

rm -rf "$WORK_DIR"
