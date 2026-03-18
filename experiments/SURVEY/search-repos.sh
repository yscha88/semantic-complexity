#!/bin/bash
# MIT Python 레포를 도메인×티어로 검색하여 목록 생성
set -euo pipefail

OUT_DIR="$(dirname "$0")"
RESULTS="$OUT_DIR/repo-candidates.tsv"

echo -e "domain\ttier\trepo\tstars\tlicense" > "$RESULTS"

search_github() {
  local domain="$1"
  local query="$2"
  local tier="$3"
  local stars="$4"
  local limit="${5:-20}"

  gh search repos "$query" \
    --language=Python \
    --license=mit \
    --sort=stars \
    --order=desc \
    --limit="$limit" \
    --json fullName,stargazersCount,licenseInfo \
    --jq ".[] | select(.stargazersCount $stars) | [\"$domain\", \"$tier\", .fullName, .stargazersCount, .licenseInfo.name] | @tsv" \
    2>/dev/null >> "$RESULTS" || true

  sleep 2  # rate limit 회피
}

echo "=== Searching repos ==="

# Web API
search_github "web-api" "fastapi api" "upper" ">= 10000" 10
search_github "web-api" "django rest api" "upper" ">= 10000" 10
search_github "web-api" "flask api" "mid" ">= 1000" 15
search_github "web-api" "fastapi template" "mid" ">= 1000" 10
search_github "web-api" "fastapi example" "lower" ">= 300" 10

# ML/AI
search_github "ml-ai" "machine learning pipeline" "upper" ">= 10000" 10
search_github "ml-ai" "inference model" "upper" ">= 10000" 10
search_github "ml-ai" "deep learning training" "mid" ">= 1000" 15
search_github "ml-ai" "model serving" "lower" ">= 300" 10

# CLI
search_github "cli" "command line tool" "upper" ">= 10000" 10
search_github "cli" "cli tool python" "mid" ">= 1000" 15
search_github "cli" "python cli utility" "lower" ">= 300" 10

# Data Processing
search_github "data" "data parser python" "upper" ">= 10000" 10
search_github "data" "data validation" "upper" ">= 10000" 10
search_github "data" "data processing python" "mid" ">= 1000" 15
search_github "data" "python parser" "lower" ">= 300" 10

# Infra/DevOps
search_github "infra" "infrastructure automation" "upper" ">= 10000" 10
search_github "infra" "devops tool python" "mid" ">= 1000" 15
search_github "infra" "deployment tool" "lower" ">= 300" 10

# Queue/Messaging
search_github "queue" "task queue python" "mid" ">= 1000" 10
search_github "queue" "async worker python" "mid" ">= 500" 10
search_github "queue" "message queue python" "lower" ">= 300" 10

# 중복 제거
sort -u -t$'\t' -k3,3 "$RESULTS" -o "$RESULTS"

TOTAL=$(tail -n +2 "$RESULTS" | wc -l | tr -d ' ')
echo "=== Found $TOTAL unique repos ==="
echo "=== Saved to $RESULTS ==="
