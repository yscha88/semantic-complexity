# 🧀 Cheese / 🥓 Ham 축 확장 계획

> 현재 상태: 두 축 모두 R3(icloud-photos-downloader) 1개 레포만 확인됨
> 목표: 각 축 4개 레포 추가 → 총 5개로 β 수준 달성
> 선정 기준: SURVEY 측정값 기반, MIT/BSD, 미사용 레포, 100-300줄 모듈

---

## 🧀 Cheese 추가 레포 (4개)

> 목적: CC 분포가 다양한 파일로 SKILL(C1-C4)의 등급 판정 효과를 검증
> Ground truth: `radon cc -s {file}` 로 실측 후 JSON에 삽입

### cheese-R4: marshmallow — schema.py

| 항목 | 값 |
|------|---|
| 레포 | `marshmallow-code/marshmallow` |
| 커밋 | 최신 main (고정 필요) |
| 파일 | `src/marshmallow/schema.py` |
| 선택 함수 범위 | `_init_fields` (72줄), `_do_load` (103줄), `_deserialize` (110줄) + 소형 함수들 |
| 총 줄 수 | ~300줄 (전체 파일 or 상위 섹션) |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | max_func=137, nesting=8, test_ratio=39.4%, contract_test=5 |
| Cheese 선정 이유 | 중간 CC 함수(B~C등급) 다수. 단일 책임 위반(SRP) 패턴 명확. |

**예상 CC 분포**: _deserialize/do_load → B~C등급, 소형 메서드 → A등급. 변별력 충분.

---

### cheese-R5: toml — decoder.py

| 항목 | 값 |
|------|---|
| 레포 | `uiri/toml` |
| 커밋 | 최신 main (고정 필요) |
| 파일 | `toml/decoder.py` |
| 선택 함수 범위 | `loads` 전체 (353줄) 제외, `load_value`(112), `load_array`(84), `load_line`(83), `_load_date`(45) |
| 총 줄 수 | ~350줄 (loads 제외 섹션) |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | max_func=353, nesting=15, test_ratio=30% |
| Cheese 선정 이유 | 재귀적 파서 구조. 중첩 깊이 극단값(15). load_value가 D~F등급 예상. |

**주의**: `loads()`(353줄)는 토큰 한도 초과 가능 → `load_value`부터 시작하는 섹션 선택.

---

### cheese-R6: h2 — connection.py

| 항목 | 값 |
|------|---|
| 레포 | `python-hyper/h2` |
| 커밋 | 최신 main (고정 필요) |
| 파일 | `src/h2/connection.py` |
| 선택 함수 범위 | `send_headers`(150), `send_data`(75), `__init__`(94), `initiate_upgrade_connection`(72) |
| 총 줄 수 | ~400줄 (상위 4개 함수 구간) |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | max_func=150, nesting=16(테스트), test_ratio=44.6% |
| Cheese 선정 이유 | HTTP/2 프로토콜 상태 머신. send_headers가 C~D등급 예상. 도메인 전문성 없이 LLM이 복잡도를 파악하는가? |

---

### cheese-R7: arq — worker.py

| 항목 | 값 |
|------|---|
| 레포 | `python-arq/arq` |
| 커밋 | 최신 main (고정 필요) |
| 파일 | `arq/worker.py` |
| 선택 함수 범위 | `run_job`(203), `__init__`(115), `start_jobs`(41) |
| 총 줄 수 | ~280줄 |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | max_func=203, nesting=7, test_ratio=19.3% |
| Cheese 선정 이유 | async+retry+state 복합 패턴. SAR 미탐지였으나 run_job은 D등급 예상. Ham과 코드 공유 가능. |

---

## 🥓 Ham 추가 레포 (4개)

> 목적: SKILL(H1-H4)이 테스트 공백과 행동 보존 위험을 더 잘 식별하는가
> 입력: 소스 코드만 (테스트 파일 미포함) → LLM이 무엇이 테스트되어야 하는지 식별
> 단, ham-R8(marshmallow)은 테스트 파일 포함 변형도 실험 (H 규칙이 실제 테스트와 어떻게 상호작용?)

### ham-R4: saq — worker.py

| 항목 | 값 |
|------|---|
| 레포 | `tobymao/saq` |
| 커밋 | 최신 main (고정 필요) |
| 파일 | `saq/worker.py` |
| 선택 함수 범위 | `process`(91), `__init__`(83), `start`(~40) |
| 총 줄 수 | ~200줄 |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | SAR candidate ✅, max_func=97, nesting=9, test_ratio=25.5% |
| Ham 선정 이유 | SAR 패턴(state+async) 명확. process()가 핵심 경로이나 테스트 커버리지가 낮음. 행동 보존 위험 명확. |

---

### ham-R5: arq — worker.py

| 항목 | 값 |
|------|---|
| 레포 | `python-arq/arq` |
| 커밋 | cheese-R7과 동일 커밋 고정 |
| 파일 | `arq/worker.py` |
| 선택 함수 범위 | Cheese-R7과 동일 코드 사용 |
| 총 줄 수 | ~280줄 |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | test_ratio=19.3% (낮음), async worker |
| Ham 선정 이유 | run_job이 핵심 경로인데 테스트 비율이 낮다. retry+async 조합에서 golden test 부재 명확. Cheese와 코드 공유로 동일 코드에서 두 축 비교 가능. |

---

### ham-R6: procrastinate — worker.py

| 항목 | 값 |
|------|---|
| 레포 | `procrastinate-org/procrastinate` |
| 커밋 | 최신 main (고정 필요) |
| 파일 | `procrastinate/worker.py` |
| 선택 함수 범위 | `_process_job`(111), `run_worker`(~50), `periodic_deferrer`(~40) |
| 총 줄 수 | ~220줄 |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | max_func=111, nesting=7, test_ratio=27.7% |
| Ham 선정 이유 | PostgreSQL 기반 작업 큐. _process_job이 핵심인데 상태 전이(deferred→doing→done)가 복잡. 계약 테스트 0개. |

---

### ham-R7: marshmallow — schema.py (테스트 포함)

| 항목 | 값 |
|------|---|
| 레포 | `marshmallow-code/marshmallow` |
| 커밋 | cheese-R4와 동일 커밋 고정 |
| 파일 | `src/marshmallow/schema.py` + `tests/test_schema.py` 일부 |
| 선택 함수 범위 | schema.py 전체 + 관련 테스트 함수 10개 |
| 총 줄 수 | ~500줄 (코드+테스트 혼합) |
| 라이선스 | MIT ✓ |
| SURVEY 근거 | test_ratio=39.4%, contract_test=5 |
| Ham 선정 이유 | **테스트가 있는 코드**로 H1-H4 SKILL이 실제 테스트 커버리지와 어떻게 상호작용하는지 확인. R3~R6는 모두 테스트 없는 코드 → 이 실험이 유일한 "테스트 있음" 케이스. |

---

## 레포-축 매핑 요약

| 레포 | Cheese | Ham | 공유 이점 |
|------|--------|-----|----------|
| icloud-photos-downloader (R3) | ✅ 기존 | ✅ 기존 | — |
| marshmallow/schema.py | ✅ R4 | ✅ R7 | 동일 코드, 다른 SKILL |
| toml/decoder.py | ✅ R5 | — | — |
| h2/connection.py | ✅ R6 | — | — |
| arq/worker.py | ✅ R7 | ✅ R5 | 동일 코드, 다른 SKILL |
| saq/worker.py | — | ✅ R4 | SAR 패턴 명확 |
| procrastinate/worker.py | — | ✅ R6 | async 상태 전이 |

---

## Input JSON 생성 절차

각 레포에 대해:

```bash
# 1. 커밋 해시 고정
git clone --depth 1 {repo_url}
git log --oneline -1  # → 커밋 해시 기록

# 2. radon으로 CC 측정 (Cheese용)
pip install radon
radon cc -s {file_path}  # → ground_truth 생성

# 3. SHA-256 계산
sha256sum {file_path}

# 4. JSON 구조
{
  "experiment_id": "cheese-R4",
  "repo": "marshmallow-code/marshmallow",
  "commit": "{hash}",
  "file": "src/marshmallow/schema.py",
  "lines": "{start}-{end}",
  "code": "{파일 내용}",
  "ground_truth": { ... },  // Cheese만
  "prompts": {
    "B": "{prompt_B.md 내용}",
    "D": "{prompt_D.md 내용}"
  }
}
```

`experiments/inputs/prompt_B.md`와 프롬프트 구조는 `cheese_R3.json` / `ham_R3.json` 참조.

---

## 실험 설계 (B vs D, 반복 2회)

| 항목 | 값 |
|------|---|
| 그룹 | B (체크리스트), D (SKILL+자율) |
| 모델 | gpt-5.4, sonnet-4.6 |
| 반복 | **2회** (β 설계 원칙 이행) |
| 실험 단위 | 4레포 × 2모델 × 2그룹 × 2반복 = **32단위** (축당) |
| 출력 디렉토리 | `experiments/results/cheese/`, `experiments/results/ham/` |

---

## 완료 기준

| 조건 | 기준 |
|------|------|
| 최소 레포 수 | 각 축 5개 (R3 포함) ✓ |
| D > B 재현 | 5개 중 3개 이상 |
| 2회 반복 일치율 | ≥ 80% (temperature=0이므로 높을 것) |
| 결과 저장 | scoring.md + summary.json |
