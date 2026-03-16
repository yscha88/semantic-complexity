# semantic-complexity

다차원 코드 복잡도 분석기 — Security × Cognitive × Behavioral

> [English](README.md)

## 개요

기존 정적 분석(McCabe 등)의 한계를 LLM 의미론적 추론 + SKILLS(정책 프레임) + MCP(정량 측정) 조합으로 극복한다.

| 축 | 측정 대상 | 핵심 |
|----|----------|------|
| 🍞 **Bread** (Security) | Trust boundary, 인증, secret | 구조 안정성 |
| 🧀 **Cheese** (Cognitive) | 중첩, 개념 수, state×async×retry | 인지 가능성 |
| 🥓 **Ham** (Behavioral) | Golden test, contract test, critical path | 행동 보존 |

## MCP 서버

### Python
```bash
claude mcp add sc-py -- "uvx --from semantic-complexity semantic-complexity-py-mcp"
```

### TypeScript
```bash
claude mcp add sc-ts -- npx -y -p semantic-complexity semantic-complexity-ts-mcp
```

### Go
```bash
go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest
claude mcp add sc-go -- sc-go-mcp
```

## MCP 도구

| 도구 | 설명 |
|------|------|
| `analyze_sandwich` | 전체 3축 복잡도 분석 |
| `analyze_cheese` | 인지 가능성 분석 |
| `check_gate` | 릴리스 Gate 검사 (PoC/MVP/Production) |
| `suggest_refactor` | 리팩토링 권장사항 |
| `check_budget` | PR 변경 예산 검사 |
| `get_label` | 모듈 지배 축 라벨 |
| `check_degradation` | 인지 저하 탐지 |

## 문서

- [이론적 토대](docs/THEORY.ko.md) — 유효한 이론 + 명시적 한계
- [불변조건](docs/STABILITY_INVARIANTS.md) — 안정성 경계 조건
- [LLM 리팩토링 프로토콜](docs/LLM_REFACTORING_PROTOCOL.md) — LLM 허용/금지 영역
- [모듈 타입](docs/MODULE_TYPES.ko.md) — 아키텍처 역할 분류 체계
