#!/bin/bash
# 대규모 MIT 레포 서베이 — 도메인별 × 티어별 자동 수집
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEASURE="$SCRIPT_DIR/measure.sh"
OUT_DIR="$SCRIPT_DIR/batch-results"
REPO_LIST="$SCRIPT_DIR/batch-repos.tsv"
SUMMARY="$SCRIPT_DIR/batch-summary.tsv"

mkdir -p "$OUT_DIR"

# ── Phase 1: 레포 검색 ──

domains=(
  # 서버/API
  "web-framework:web framework"
  "rest-api:rest api backend"
  "graphql:graphql server"
  # AI/ML
  "ml-training:machine learning training"
  "ml-inference:inference serving model"
  "nlp:natural language processing"
  "cv:computer vision image"
  "speech:speech recognition synthesis"
  # 데이터
  "data-parser:parser decoder encoder"
  "data-validation:data validation schema"
  "data-etl:etl pipeline data"
  "data-viz:data visualization chart"
  # 인프라
  "infra-deploy:deployment automation"
  "infra-monitor:monitoring observability"
  "infra-container:container docker kubernetes"
  # 보안
  "security-scan:security scanner vulnerability"
  "security-crypto:cryptography encryption"
  "security-pentest:penetration testing"
  # 네트워크
  "network-proxy:proxy server"
  "network-crawler:web crawler scraper"
  "network-protocol:protocol implementation"
  # CLI/TUI
  "cli-tool:command line tool"
  "tui:terminal user interface"
  # 자동화
  "automation-bot:bot automation"
  "automation-workflow:workflow orchestration"
  # 과학
  "science-compute:scientific computing"
  "science-bio:bioinformatics biology"
  # 금융
  "fintech:trading finance"
  # 의료
  "medical:medical imaging health"
  # 미디어
  "media-image:image processing"
  "media-audio:audio processing music"
  "media-video:video processing streaming"
  # 게임
  "game:game engine"
  # DB
  "database:database driver orm"
  # 테스트
  "testing:testing framework"
  # 컴파일러
  "compiler:compiler interpreter language"
  # 커뮤니케이션
  "comm:email chat notification"
  # IoT
  "iot:iot embedded sensor"
  # GIS
  "gis:geographic map location"
)

tiers=(
  "upper:>10000"
  "mid:1000..10000"
  "lower:300..1000"
)

echo -e "domain\ttier\trepo\tstars\tdescription" > "$REPO_LIST"

for domain_entry in "${domains[@]}"; do
  domain="${domain_entry%%:*}"
  query="${domain_entry#*:}"

  for tier_entry in "${tiers[@]}"; do
    tier="${tier_entry%%:*}"
    stars="${tier_entry#*:}"

    echo ">>> Searching: $domain / $tier ($query, stars:$stars)"

    gh search repos "$query" \
      --language=Python \
      --license=mit \
      --sort=stars \
      --order=desc \
      --limit=5 \
      --json fullName,stargazersCount,description \
      --jq ".[] | select(.stargazersCount >= $(echo $stars | cut -d. -f1 | tr -d '>')) | [\"$domain\", \"$tier\", .fullName, .stargazersCount, .description] | @tsv" \
      2>/dev/null >> "$REPO_LIST" || true

    sleep 3  # rate limit
  done
done

# 중복 제거
sort -u -t$'\t' -k3,3 "$REPO_LIST" -o "$REPO_LIST"
TOTAL=$(tail -n +2 "$REPO_LIST" | wc -l | tr -d ' ')
echo "=== Phase 1 complete: $TOTAL unique repos ==="

# ── Phase 2: 측정 (병렬 5개씩) ──

echo -e "domain\ttier\trepo\tstars\ttotal_py\ttest_ratio\tmax_nest\tmax_func_lines\tenv_refs\tauth_refs\tsecret_refs\traw_sql\torm\tcontract_test\tsar" > "$SUMMARY"

measure_repo() {
  local domain="$1" tier="$2" repo="$3" stars="$4"
  local url="https://github.com/$repo"
  local safe_name=$(echo "$repo" | tr '/' '_')
  local result_file="$OUT_DIR/$safe_name.txt"

  bash "$MEASURE" "$url" > "$result_file" 2>&1 || true

  # 결과 파싱
  local total_py=$(grep "^total_py:" "$result_file" 2>/dev/null | awk '{print $2}' || echo "0")
  local test_r=$(grep "^test_ratio:" "$result_file" 2>/dev/null | awk '{print $2}' || echo "0%")
  local max_nest=$(grep -A1 "Max Nesting" "$result_file" 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
  local max_func=$(grep -A1 "Largest functions" "$result_file" 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
  local env_refs=$(grep "^os.environ" "$result_file" 2>/dev/null | awk '{print $3}' || echo "0")
  local auth=$(grep "^auth refs:" "$result_file" 2>/dev/null | awk '{print $3}' || echo "0")
  local secret=$(grep "^secret/key" "$result_file" 2>/dev/null | awk '{print $3}' || echo "0")
  local raw_sql=$(grep "^raw SQL:" "$result_file" 2>/dev/null | awk '{print $3}' || echo "0")
  local orm=$(grep "^ORM:" "$result_file" 2>/dev/null | awk '{print $2}' || echo "0")
  local contract=$(grep "^contract" "$result_file" 2>/dev/null | awk '{print $3}' || echo "0")
  local sar=$(grep "^SAR candidate" "$result_file" 2>/dev/null | wc -l | tr -d ' ')

  echo -e "$domain\t$tier\t$repo\t$stars\t$total_py\t$test_r\t$max_nest\t$max_func\t$env_refs\t$auth\t$secret\t$raw_sql\t$orm\t$contract\t$sar" >> "$SUMMARY"
}

export -f measure_repo
export MEASURE OUT_DIR SUMMARY

# 병렬 실행 (5개씩)
tail -n +2 "$REPO_LIST" | while IFS=$'\t' read -r domain tier repo stars desc; do
  measure_repo "$domain" "$tier" "$repo" "$stars" &

  # 5개 동시 실행 제한
  while [ "$(jobs -r | wc -l)" -ge 5 ]; do
    sleep 5
  done
done

wait
echo "=== Phase 2 complete: measurements done ==="
echo "=== Results in $SUMMARY ==="
