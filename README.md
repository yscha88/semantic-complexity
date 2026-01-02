# semantic-complexity

Ham Sandwich Theorem 기반 코드 복잡도 분석기

## MCP Server 설치

### Python

```bash
# 설치
claude mcp add sc-py -- uvx semantic-complexity-py-mcp

# 업데이트
uv cache clean && uvx semantic-complexity-py-mcp --version

# 삭제
claude mcp remove sc-py

# 재설치
uv cache clean && claude mcp remove sc-py && claude mcp add sc-py -- uvx semantic-complexity-py-mcp
```

### TypeScript

```bash
# 설치
claude mcp add sc-ts -- "npx -y semantic-complexity-mcp"

# 업데이트
npm cache clean --force

# 삭제
claude mcp remove sc-ts

# 재설치
npm cache clean --force && claude mcp remove sc-ts && claude mcp add sc-ts -- "npx -y semantic-complexity-mcp"
```

### Go

```bash
# 설치 (go install)
go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest
claude mcp add sc-go -- sc-go-mcp

# 업데이트
go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest

# 빌드 (로컬)
cd src/go && go build -o sc-go-mcp ./cmd/sc-go-mcp
claude mcp add sc-go -- /path/to/sc-go-mcp

# 삭제
claude mcp remove sc-go

# 캐시 삭제
go clean -cache -modcache

# 재설치
go clean -cache && go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest
```

## MCP 도구 목록

| 도구 | 설명 |
|------|------|
| `analyze_sandwich` | 전체 복잡도 분석 (Bread + Cheese + Ham 3축) |
| `analyze_cheese` | 인지 가능성 분석 |
| `check_gate` | 릴리스 Gate 검사 (MVP/Production) |
| `suggest_refactor` | 리팩토링 권장사항 |
| `check_budget` | PR 변경 예산 검사 |
| `get_label` | 모듈 지배 축 라벨 |
| `check_degradation` | 인지 저하 탐지 |

## MCP 리소스

| URI | 설명 |
|-----|------|
| `docs://usage-guide` | 사용 가이드 (3축 모델, 도구 시나리오, 인지 복잡도 정의) |

## 문서

- [이론](docs/THEORY.ko.md) - Ham Sandwich Theorem 기반 이론
- [요구사항](docs/SRS.ko.md) - 소프트웨어 요구사항 명세
- [설계](docs/SDS.ko.md) - 소프트웨어 설계 명세
- [변경이력](docs/CHANGELOG.ko.md) - 버전별 변경사항
