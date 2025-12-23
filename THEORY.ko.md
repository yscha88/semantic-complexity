# 이론적 기반

[English](./THEORY.md) | 한국어

본 문서는 semantic-complexity를 단순한 메트릭 도구가 아닌 **안정성 검증 시스템**으로 정립하기 위한 수학적·공학적 기반을 정의합니다.

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
| 🧀 **Cognitive** | 맥락 밀도 | 인간/LLM이 이해 가능한 구조 | Tensor score, canonical deviation |
| 🥓 **Behavioral** | 행동 보존 | 리팩토링 후 의미 보존 | Golden test, contract test |

**핵심 제약**: `state × async × retry`는 동일 함수/모듈에 공존할 수 없음.

> 📄 전체 스펙: [docs/STABILITY_INVARIANTS.md](./docs/STABILITY_INVARIANTS.md)

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

> 📄 전체 스펙: [docs/LLM_REFACTORING_PROTOCOL.md](./docs/LLM_REFACTORING_PROTOCOL.md)

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

> 📄 전체 스펙: [docs/RELEASE_EVIDENCE_THEORY.md](./docs/RELEASE_EVIDENCE_THEORY.md)

---

## 4. 수학적 프레임워크

### Lyapunov 안정성 해석

5D 복잡도 공간은 Lyapunov 안정성 해석을 허용합니다:

```
에너지 함수:  E(v) = vᵀMv + ⟨v,w⟩
안정점:       ∂E/∂v = 0  (canonical centroid)
안정성:       M ≥ 0      (positive semidefinite)
```

여기서:
- `v = [Control, Nesting, State, Async, Coupling] ∈ ℝ⁵`
- `M` = 모듈 타입별 상호작용 행렬
- `w` = 가중치 벡터

### 수렴 보장

모든 모듈 타입에서 `M`이 positive semidefinite이므로:
1. 에너지 함수는 canonical centroid에서 전역 최소값을 가짐
2. E(v)를 감소시키는 모든 리팩토링은 안정 방향으로 이동
3. `suggest_refactor` 도구는 gradient descent 방향 제공

이는 권장사항을 따르면 안정적이고 최소 복잡도의 코드로 수렴한다는 **수학적 보장**을 제공합니다.

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

> Gate 조건은 [docs/LLM_REFACTORING_PROTOCOL.md](./docs/LLM_REFACTORING_PROTOCOL.md#4-gate-conditions) 참조

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

- [STABILITY_INVARIANTS.md](./docs/STABILITY_INVARIANTS.md) - 불변조건 전체 스펙
- [LLM_REFACTORING_PROTOCOL.md](./docs/LLM_REFACTORING_PROTOCOL.md) - LLM 운용 규칙
- [RELEASE_EVIDENCE_THEORY.md](./docs/RELEASE_EVIDENCE_THEORY.md) - 증거 프레임워크
