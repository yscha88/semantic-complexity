# 이론적 기반

본 문서는 semantic-complexity를 단순한 메트릭 도구가 아닌 **안정성 검증 시스템**으로 정립하기 위한 수학적·공학적 기반을 정의합니다.

---

## 0. 대수적 토대: McCabe에서 다차원으로

### 0.1 문제 인식: McCabe의 한계

McCabe 순환복잡도는 제어 흐름 그래프(CFG)에 대해 다음과 같이 정의됩니다:

```
V(G) = E − N + 2P
```

여기서:
- `E` = 간선(edge) 수
- `N` = 노드(node) 수
- `P` = 연결된 컴포넌트 수

이는 그래프의 **1차 베티 수(first Betti number)** 와 동형입니다:

```
McCabe 복잡도 = dim H₁(G) + 1
```

즉, "독립적인 사이클의 수"를 측정합니다.

### 0.2 관점 전환: Homology 해석

CFG를 단순한 그래프가 아닌 **단체복합체(simplicial complex)** 또는 **CW complex**로 확장하면:

| Homology | 의미 | 소프트웨어 해석 |
|----------|------|-----------------|
| H₀ | 연결 컴포넌트 | 모듈/패키지 분리도 |
| H₁ | 1차원 구멍 (사이클) | 조건 분기, 루프 |
| H₂ 이상 | 고차원 구멍 | 상태공간 + 제어흐름 결합 구조 |

**핵심 통찰**: 순환복잡도는 H₁만 보는 **매우 저차원적인 불변량**입니다.

### 0.3 해결방안: 다차원 복잡도

소프트웨어에서 실제로 존재하는 "차원":

| 차원 | 예시 | McCabe가 측정? |
|------|------|----------------|
| **제어 차원** | if / for / while | ✅ (H₁ 수준) |
| **상태 차원** | 상태 머신, enum, 플래그 | ❌ |
| **데이터 차원** | 입력 조합, 타입 복잡도 | ❌ |
| **시간 차원** | 비동기, concurrency | ❌ |
| **공간 차원** | 분산 노드, 마이크로서비스 | ❌ |

McCabe는 **제어 차원 1D만** 측정합니다.

### 0.4 Weighted / Dimensional Cyclomatic Complexity

다차원 복잡도를 통합하면:

```
C = Σ(k=1 to d) wₖ · Cₖ
```

여기서:
- `d` = 차원 수 (제어, 상태, 비동기, ...)
- `wₖ` = 각 차원의 가중치
- `Cₖ` = 각 차원의 복잡도 점수

### 0.5 계층화된 복잡도 모델

| 레벨 | 기준 | 측정 대상 |
|------|------|-----------|
| Level 1 | McCabe ≤ 10 | 제어 흐름만 |
| Level 2 | Weighted CC ≤ 15 | + 상태 변이 |
| Level 3 | State-aware CC ≤ 20 | + 숨겨진 결합 |
| Level 4 | Async/Distributed penalty | + 시간/공간 |

### 0.6 Ham Sandwich로의 통합

이 다차원 복잡도는 🍞🧀🥓 3축으로 **재정규화**됩니다:

```
제어 + 중첩 + 숨겨진 결합  →  🧀 Cognitive (인지 밀도)
상태 + 비동기 + 시간       →  🍞 Security (구조 안정성) 일부
테스트 + 변경 용이성       →  🥓 Behavioral (행동 보존)
```

이렇게 고차원 복잡도를 **3차원 simplex**로 사영하여:
- Sperner's Lemma로 균형점 존재 보장
- Lyapunov 함수로 수렴 경로 제공
- 실용적인 게이트 조건으로 변환

---

## 핵심 명제

> 코드 복잡도 분석은 최적화 문제가 아니다.
> 정의된 불변조건을 가진 **안정성 검증 문제**다.

본 시스템은 코드 변경이 안정 영역(canonical profile)으로 흘러가도록 보장하며, 위반 시 자동으로 감지하고 거부합니다.

---

## 1. 안정성 불변조건 (🍞🧀🥓)

시스템의 안정성은 세 개의 직교 축으로 분해됩니다:

| 축 | 메타포 | 의미 | 검증 |
|----|--------|------|------|
| 🍞 **Security** | 구조 안정성 | 신뢰 경계, 인증, 암호, 배포 | Policy-as-code, SBOM, 서명 |
| 🧀 **Cognitive** | 인지 밀도 | 사람/LLM이 인지 가능한 범위 내 | 인지 가능 조건 충족 여부 |
| 🥓 **Behavioral** | 행동 보존 | 리팩토링 후 의미 보존 | Golden test, contract test |

### 🧀 인지 가능 조건

코드가 인지 가능하려면 다음 조건을 **모두** 충족해야 함:

| 조건 | 기준 | 근거 |
|------|------|------|
| 중첩 깊이 | ≤ N (설정 가능) | 한눈에 구조 파악 가능 |
| 개념 수 | ≤ 9개/함수 | 작업 기억(Working Memory) 한계 (Miller's Law: 7±2) |
| 숨겨진 의존성 | 최소화 | 컨텍스트 완결성 |
| state×async×retry | 2개 이상 공존 금지 | 동시 추론 불가 |

**핵심 제약**: `state × async × retry`는 동일 함수/모듈에 공존할 수 없음.

> 📄 전체 스펙: [docs/STABILITY_INVARIANTS.md](STABILITY_INVARIANTS.md)

### 품질 속성 매핑 (ISO/IEC 25010 SQuaRE)

🍞🧀🥓 3축은 소프트웨어 엔지니어링의 표준 품질 속성과 다음과 같이 매핑됩니다:

| 🍞🧀🥓 축 | ISO/IEC 25010 품질 속성 | Coverage |
|----------|----------------------|----------|
| **🍞 Bread (Security)** | Security, Reliability | 직접 |
| **🧀 Cheese (Cognitive)** | Maintainability, Usability | 직접 |
| **🥓 Ham (Behavioral)** | Functional Suitability, Reliability | 직접 |

#### 세부 매핑

| ISO/IEC 25010 | 우리 축 | 측정 항목 |
|---------------|---------|-----------|
| Security | 🍞 | Trust Boundary, Secrets |
| Confidentiality | 🍞 | 암호화, 접근제어 |
| Integrity | 🍞 | 데이터 무결성 |
| Analysability | 🧀 | 중첩, 개념 수 |
| Modifiability | 🧀 | 숨겨진 의존성 |
| Testability | 🧀🥓 | state×async×retry 분리 |
| Functional Correctness | 🥓 | Golden test 보존 |
| Functional Completeness | 🥓 | Contract test 통과 |
| Recoverability | 🥓 | Critical path 보호 |

---

## 2. LLM 리팩토링 프로토콜

LLM은 자유로운 생성기가 아닌 **제약된 변환기**로 취급됩니다.

### 허용되는 작업

| ✅ 허용 | ❌ 금지 |
|--------|--------|
| 함수 추출 | 인증/인가 로직 변경 |
| 네이밍 개선 | Trust Boundary 이동 |
| Adapter 분리 | 보안 정책 수정 |
| 중첩 평탄화 | External API 계약 변경 |
| 테스트 보강 | 릴리스 메타데이터 변경 |

### 게이트 조건

LLM이 생성한 모든 변경은 다음을 통과해야 함:

```
🧀 Cognitive Gate: Δ복잡도 ≤ 예산, state×async×retry 없음
🥓 Behavioral Gate: 모든 golden/contract 테스트 통과
🍞 Security Gate: 정책 위반 없음, secret 노출 없음
```

**실패 규칙**: 게이트 실패 → 결과 폐기, 축소된 범위로만 재시도 허용.

> 📄 전체 스펙: [docs/LLM_REFACTORING_PROTOCOL.md](LLM_REFACTORING_PROTOCOL.md)

---

## 3. 릴리스 증거 이론

이것은 수학적 증명이 아닌 **공학적 증명**입니다.

### 정의

| 용어 | 정의 |
|------|------|
| **ReleaseID** | 인가된 Git commit hash prefix |
| **Canonical Artifact** | ReleaseID로부터 결정적으로 생성된 산출물 |
| **Invariant** | 위반 시 릴리스가 불가능한 조건 |

### 공학적 주장

> 모든 릴리스 스펙은 정의된 불변조건(🍞🧀🥓)을 자동 검증한다.
> 위반된 상태는 프로덕션에 배포될 수 없다.

이것은 **최적성이 아닌 안정성 보장**을 주장합니다.

### 증거 체인

모든 릴리스는 다음 증거를 생성:

```
CommitHash / ReleaseID
Image Digest
SBOM Digest
Tensor Score / RawSum / Canonical Deviation
Gate pass/fail 결과
승인 기록
```

이 증거 묶음은 **재현 가능**하고 **해석자 독립적**입니다.

> 📄 전체 스펙: [docs/RELEASE_EVIDENCE_THEORY.md](RELEASE_EVIDENCE_THEORY.md)

---

## 4. 수학적 프레임워크

### Lyapunov 안정성 해석

🍞🧀🥓 3축 simplex 공간은 Lyapunov 안정성 해석을 허용합니다:

```
에너지 함수:  E(v) = ||v - c||²
안정점:       c = canonical centroid (모듈 타입별 기대 비율)
안정성:       E(v) → 0 일수록 안정
```

여기서:
- `v = [🍞, 🧀, 🥓] ∈ simplex` (현재 비율)
- `c = [🍞ₒ, 🧀ₒ, 🥓ₒ]` (canonical 비율)
- `🍞 + 🧀 + 🥓 = 100` (simplex 제약)

### 수렴 보장

1. 에너지 함수 E(v)는 canonical centroid c에서 최소값 0을 가짐
2. E(v)를 감소시키는 모든 리팩토링은 안정 방향으로 이동
3. `suggest_refactor`는 -∇E 방향 (gradient descent) 제공

이는 권장사항을 따르면 모듈 타입에 맞는 균형 상태로 수렴한다는 **수학적 보장**을 제공합니다.

---

## 5. 범위 및 경계

**semantic-complexity**는 **정적 분석 신호 제공자**이지, 완전한 강제(enforcement) 시스템이 아닙니다.

| 책임 | semantic-complexity | CI/CD 파이프라인 |
|------|---------------------|------------------|
| Tensor score 계산 | ✅ | - |
| Canonical deviation 분석 | ✅ | - |
| Cognitive 불변조건 탐지 (state×async×retry) | ✅ | - |
| Secret 패턴 탐지 | ✅ | - |
| LLM 금지 영역 경고 | ✅ | - |
| 리팩토링 제안 | ✅ | - |
| Gate 로직 (pass/warn/fail 결정) | ✅ | - |
| Gate 파이프라인 (dev → qa → ra) | ✅ | - |
| Delta 분석 (baseline vs current) | ✅ | - |
| **실제 차단/강제** | - | ✅ |
| SBOM 생성/서명 | - | ✅ |
| 테스트 실행 (golden/contract) | - | ✅ |
| 배포 차단 | - | ✅ |

### 우리가 제공하는 것 (Gate별)

> Gate 조건은 [docs/LLM_REFACTORING_PROTOCOL.md](LLM_REFACTORING_PROTOCOL.md#4-gate-conditions) 참조

| Gate | semantic-complexity 제공 | CI/CD 제공 |
|------|--------------------------|------------|
| 🧀 **Cognitive** | `checkCognitiveInvariant()`, tensor/rawSum 추적 | 예산 강제, 차단 |
| 🥓 **Behavioral** | `suggest_refactor` (행동 보존) | 테스트 실행, 감소 검사 |
| 🍞 **Security** | `detectSecrets()`, `checkLockedZone()` | 전체 보안 스캔, 정책 강제 |

### 우리가 제공하지 않는 것

- **강제/차단**: 우리는 탐지 및 신호 제공, CI/CD가 강제
- **테스트 실행**: 우리는 제안, 테스팅 프레임워크가 golden/contract 테스트 실행
- **보안 스캐닝**: 우리는 패턴 탐지, 전용 보안 도구가 전체 스캔
- **SBOM/서명**: 우리는 코드 분석, 보안 도구가 아티팩트 처리

---

## 6. 구현 매핑

| 이론 | 구현 | 비고 |
|------|------|------|
| 🧀 Cognitive 불변조건 | `checkCognitiveInvariant()` | state×async×retry 탐지 |
| 🧀 Cognitive Score | `tensor.score`, `canonical.deviation` | 정적 분석 |
| 🍞 Security 신호 | `detectSecrets()`, `checkLockedZone()` | 경고만 제공 |
| 🥓 Behavioral Gate | `suggest_refactor` | 행동 보존 권장사항 |
| Gate 로직 | `checkGate()`, `runGatePipeline()` | pass/warn/fail 결정 |
| Delta 분석 | `analyzeDelta()`, `detectViolations()` | baseline vs current |
| Lyapunov 에너지 | `calculateTensorScore()` | 수학적 프레임워크 |
| Canonical Centroid | `CANONICAL_5D_PROFILES[moduleType]` | 목표 프로파일 |
| Gradient Descent | `recommendRefactoring()` | 방향 제안 |

---

## 7. 한계

1. 본 이론은 **유일한 최적해**를 주장하지 않음
2. 불변조건은 환경/도메인 변화에 따라 갱신될 수 있음
3. 안정성은 **구조 + 공정**의 결과이지, 코드만의 결과가 아님
4. 시스템은 제약을 검증하며, 정확성을 보장하지 않음

---

## 참조

- [STABILITY_INVARIANTS.md](STABILITY_INVARIANTS.md) - 불변조건 전체 스펙
- [LLM_REFACTORING_PROTOCOL.md](LLM_REFACTORING_PROTOCOL.md) - LLM 운용 규칙
- [RELEASE_EVIDENCE_THEORY.md](RELEASE_EVIDENCE_THEORY.md) - 증거 프레임워크
