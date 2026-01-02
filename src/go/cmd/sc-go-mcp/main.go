// Package main implements the MCP server for semantic-complexity
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/yscha88/semantic-complexity/src/go/pkg/analyzer"
	"github.com/yscha88/semantic-complexity/src/go/pkg/budget"
	"github.com/yscha88/semantic-complexity/src/go/pkg/gate"
	"github.com/yscha88/semantic-complexity/src/go/pkg/recommend"
	"github.com/yscha88/semantic-complexity/src/go/pkg/simplex"
	"github.com/yscha88/semantic-complexity/src/go/pkg/types"
)

const version = "0.0.22"

// Canonical profiles (ideal simplex coordinates by module type)
var canonicalProfiles = map[string]types.SimplexCoordinates{
	"api/external": {Bread: 0.5, Cheese: 0.3, Ham: 0.2},
	"api/internal": {Bread: 0.4, Cheese: 0.35, Ham: 0.25},
	"lib/domain":   {Bread: 0.2, Cheese: 0.5, Ham: 0.3},
	"lib/util":     {Bread: 0.1, Cheese: 0.5, Ham: 0.4},
	"app":          {Bread: 0.33, Cheese: 0.34, Ham: 0.33},
	"default":      {Bread: 1.0 / 3.0, Cheese: 1.0 / 3.0, Ham: 1.0 / 3.0},
}

func inferModuleType(filePath string) string {
	if filePath == "" {
		return "default"
	}
	if strings.Contains(filePath, "/api/") || strings.Contains(filePath, "\\api\\") {
		if strings.Contains(filePath, "external") {
			return "api/external"
		}
		return "api/internal"
	}
	if strings.Contains(filePath, "/lib/") || strings.Contains(filePath, "\\lib\\") {
		if strings.Contains(filePath, "domain") {
			return "lib/domain"
		}
		return "lib/util"
	}
	if strings.Contains(filePath, "/app/") || strings.Contains(filePath, "\\app\\") {
		return "app"
	}
	return "default"
}

func calculateDeviation(current, canonical types.SimplexCoordinates) types.SimplexCoordinates {
	return types.SimplexCoordinates{
		Bread:  current.Bread - canonical.Bread,
		Cheese: current.Cheese - canonical.Cheese,
		Ham:    current.Ham - canonical.Ham,
	}
}

const usageGuide = `# semantic-complexity 사용 가이드

## 개요
Ham Sandwich Theorem 기반 코드 복잡도 분석기입니다.
코드를 3가지 축으로 분석하여 균형 잡힌 품질을 측정합니다.

## 3축 모델 (Bread-Cheese-Ham)

### 🍞 Bread (보안성)
- Trust Boundary 정의 여부
- 인증/인가 명시성
- 시크릿 하드코딩 탐지
- 숨겨진 의존성 (환경변수, 파일I/O)

### 🧀 Cheese (인지 가능성)
- 중첩 깊이 (≤4 권장)
- 개념 수 (≤9개/함수, Miller's Law)
- state×async×retry 동시 사용 금지
- 숨겨진 의존성 최소화

### 🥓 Ham (행동 보존)
- 테스트 커버리지
- Golden Test 존재 여부
- Critical Path 보호율

## 도구 사용 시나리오

| 시나리오 | 도구 |
|----------|------|
| 코드 전체 품질 분석 | analyze_sandwich |
| 인지 복잡도만 확인 | analyze_cheese |
| PR 리뷰 시 품질 게이트 | check_gate |
| 리팩토링 방향 제안 | suggest_refactor |
| 코드 변경 전후 비교 | check_degradation |
| 변경 예산 초과 확인 | check_budget |
| 코드 특성 라벨링 | get_label |

## Gate 단계
- PoC: 빠른 검증, 느슨한 기준
- MVP: 첫 릴리스, 기본 기준
- Production: 운영, 엄격한 기준 + Waiver 지원

## 인지 복잡도 정의
인지 복잡도는 개발자가 코드를 읽고 이해하는 데 필요한 정신적 노력입니다.
- 중첩이 깊으면 컨텍스트 스택이 커짐
- 상태+비동기+재시도가 동시에 있으면 경우의 수 폭발
- 숨겨진 의존성은 예측 불가능한 부작용 유발

## 추가 문서
- docs://theory - 이론적 토대
- docs://srs - 소프트웨어 요구사항 명세
- docs://sds - 소프트웨어 설계 명세
`

const theorySummary = `# Theoretical Foundation (Summary)

## Core Theorem: Ham Sandwich

Maintainability (Ham) only has meaning between Security (Bread) and Cognitive (Cheese).
Maximizing any single axis degrades the system.

## Stability Invariants

| Axis | Metaphor | Meaning |
|------|----------|---------|
| Bread | Structural stability | Trust boundaries, auth, crypto |
| Cheese | Context density | Human/LLM comprehensible range |
| Ham | Behavior preservation | Golden test, contract test |

## Accessibility Conditions (ALL must be met)

1. Nesting depth <= N (configurable)
2. Concept count <= 9 per function (Miller's Law: 7±2)
3. Hidden dependencies minimized
4. state*async*retry: No 2+ coexistence

## Mathematical Framework: Lyapunov Stability

Energy function:  E(v) = ||v - c||²
Stable point:     c = canonical centroid

For full documentation: https://github.com/yscha88/semantic-complexity/blob/main/docs/THEORY.md
`

const srsSummary = `# Software Requirements Specification (Summary)

## System Overview

semantic-complexity is a multi-dimensional code complexity analyzer based on:
- Ham Sandwich Theorem
- Sperner's Lemma (equilibrium existence)
- Lyapunov stability (convergence path)

## Module Types

| Type | Bread | Cheese | Ham |
|------|-------|--------|-----|
| deploy | 70 | 10 | 20 |
| api-external | 50 | 20 | 30 |
| api-internal | 30 | 30 | 40 |
| app | 20 | 50 | 30 |
| lib-domain | 10 | 30 | 60 |
| lib-infra | 20 | 30 | 50 |

## Gate System (3-Stage)

| Stage | Strictness | Waiver |
|-------|------------|--------|
| PoC | Loose | No |
| MVP | Tight | No |
| Production | Strict | Yes |

For full documentation: https://github.com/yscha88/semantic-complexity/blob/main/docs/SRS.md
`

const sdsSummary = `# Software Design Specification (Summary)

## Architecture: ML Pipeline Structure

INPUT (5D Vector) -> PROCESSING (Normalization) -> OUTPUT (3-axis)

- INPUT: Context-free measurement (deterministic)
- PROCESSING: Context injection, weights, filters
- OUTPUT: Context-aware inference

## Algorithms

### Simplex Normalization

bread + cheese + ham = 100

### Gradient Direction (Lyapunov)

E(v) = ||v - c||²  (energy function)
recommendation = -∇E  (gradient descent)

For full documentation: https://github.com/yscha88/semantic-complexity/blob/main/docs/SDS.md
`

func main() {
	// Handle --version flag
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-v") {
		fmt.Printf("sc-go-mcp %s\n", version)
		os.Exit(0)
	}

	s := server.NewMCPServer(
		"semantic-complexity",
		version,
		server.WithResourceCapabilities(false, false),
	)

	// Register usage guide resource
	usageResource := mcp.NewResource(
		"docs://usage-guide",
		"사용 가이드",
		mcp.WithResourceDescription("semantic-complexity MCP 서버 사용 가이드"),
		mcp.WithMIMEType("text/markdown"),
	)
	s.AddResource(usageResource, func(ctx context.Context, request mcp.ReadResourceRequest) ([]interface{}, error) {
		return []interface{}{
			mcp.TextResourceContents{
				ResourceContents: mcp.ResourceContents{
					URI:      "docs://usage-guide",
					MIMEType: "text/markdown",
				},
				Text: usageGuide,
			},
		}, nil
	})

	// Register theory resource
	theoryResource := mcp.NewResource(
		"docs://theory",
		"Theoretical Foundation",
		mcp.WithResourceDescription("Ham Sandwich Theorem based theory"),
		mcp.WithMIMEType("text/markdown"),
	)
	s.AddResource(theoryResource, func(ctx context.Context, request mcp.ReadResourceRequest) ([]interface{}, error) {
		return []interface{}{
			mcp.TextResourceContents{
				ResourceContents: mcp.ResourceContents{
					URI:      "docs://theory",
					MIMEType: "text/markdown",
				},
				Text: theorySummary,
			},
		}, nil
	})

	// Register SRS resource
	srsResource := mcp.NewResource(
		"docs://srs",
		"Requirements Specification",
		mcp.WithResourceDescription("Software requirements specification"),
		mcp.WithMIMEType("text/markdown"),
	)
	s.AddResource(srsResource, func(ctx context.Context, request mcp.ReadResourceRequest) ([]interface{}, error) {
		return []interface{}{
			mcp.TextResourceContents{
				ResourceContents: mcp.ResourceContents{
					URI:      "docs://srs",
					MIMEType: "text/markdown",
				},
				Text: srsSummary,
			},
		}, nil
	})

	// Register SDS resource
	sdsResource := mcp.NewResource(
		"docs://sds",
		"Design Specification",
		mcp.WithResourceDescription("Software design specification"),
		mcp.WithMIMEType("text/markdown"),
	)
	s.AddResource(sdsResource, func(ctx context.Context, request mcp.ReadResourceRequest) ([]interface{}, error) {
		return []interface{}{
			mcp.TextResourceContents{
				ResourceContents: mcp.ResourceContents{
					URI:      "docs://sds",
					MIMEType: "text/markdown",
				},
				Text: sdsSummary,
			},
		}, nil
	})

	// Register tools
	s.AddTool(mcp.NewTool("analyze_sandwich",
		mcp.WithDescription("Analyze code complexity using Bread-Cheese-Ham model"),
		mcp.WithString("source", mcp.Required(), mcp.Description("Source code to analyze")),
		mcp.WithString("file_path", mcp.Description("Optional file path for context")),
	), analyzeSandwich)

	s.AddTool(mcp.NewTool("check_gate",
		mcp.WithDescription("Check if code passes PoC/MVP/Production gate"),
		mcp.WithString("source", mcp.Required(), mcp.Description("Source code to check")),
		mcp.WithString("gate_type", mcp.Description("Gate type: poc, mvp, or production")),
		mcp.WithString("file_path", mcp.Description("File path for waiver check")),
		mcp.WithString("project_root", mcp.Description("Project root for waiver discovery")),
	), checkGateHandler)

	s.AddTool(mcp.NewTool("analyze_cheese",
		mcp.WithDescription("Analyze cognitive accessibility (Cheese axis)"),
		mcp.WithString("source", mcp.Required(), mcp.Description("Source code to analyze")),
	), analyzeCheese)

	s.AddTool(mcp.NewTool("get_label",
		mcp.WithDescription("Get dominant axis label (bread/cheese/ham/balanced)"),
		mcp.WithString("source", mcp.Required(), mcp.Description("Source code to analyze")),
	), getLabel)

	s.AddTool(mcp.NewTool("check_degradation",
		mcp.WithDescription("Detect cognitive degradation between code versions"),
		mcp.WithString("before_source", mcp.Required(), mcp.Description("Source code before changes")),
		mcp.WithString("after_source", mcp.Required(), mcp.Description("Source code after changes")),
	), checkDegradation)

	s.AddTool(mcp.NewTool("suggest_refactor",
		mcp.WithDescription("Suggest refactoring actions based on complexity analysis"),
		mcp.WithString("source", mcp.Required(), mcp.Description("Source code to analyze")),
		mcp.WithString("module_type", mcp.Description("Module type for context-aware recommendations")),
	), suggestRefactor)

	s.AddTool(mcp.NewTool("check_budget",
		mcp.WithDescription("Check if code changes stay within allowed complexity budget"),
		mcp.WithString("before_source", mcp.Required(), mcp.Description("Source code before changes")),
		mcp.WithString("after_source", mcp.Required(), mcp.Description("Source code after changes")),
		mcp.WithString("module_type", mcp.Description("Module type for budget limits")),
	), checkBudgetHandler)

	// Start server
	if err := server.ServeStdio(s); err != nil {
		fmt.Printf("Server error: %v\n", err)
	}
}

func analyzeSandwich(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	source := request.Params.Arguments["source"].(string)
	filePath := ""
	if fp, ok := request.Params.Arguments["file_path"].(string); ok {
		filePath = fp
	}

	bread := analyzer.AnalyzeBread(source)
	cheese := analyzer.AnalyzeCheese(source)
	ham := analyzer.AnalyzeHam(source, filePath)
	simplexCoords := simplex.Normalize(bread, cheese, ham)
	equilibrium := simplex.CalculateEquilibrium(simplexCoords)
	label := simplex.GetLabel(simplexCoords)
	recommendations := recommend.SuggestRefactor(simplexCoords, equilibrium, &cheese, 3)

	// Get canonical profile based on inferred module type
	moduleType := inferModuleType(filePath)
	canonical := canonicalProfiles[moduleType]
	deviation := calculateDeviation(simplexCoords, canonical)

	result := map[string]interface{}{
		"bread":           bread,
		"cheese":          cheese,
		"ham":             ham,
		"simplex":         simplexCoords,
		"equilibrium":     equilibrium,
		"label":           label.Label,
		"confidence":      label.Confidence,
		"canonical":       canonical,
		"deviation":       deviation,
		"recommendations": recommendations,
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}

func checkGateHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	source := request.Params.Arguments["source"].(string)
	gateTypeStr := "mvp"
	if gt, ok := request.Params.Arguments["gate_type"].(string); ok {
		gateTypeStr = gt
	}
	filePath := ""
	if fp, ok := request.Params.Arguments["file_path"].(string); ok {
		filePath = fp
	}
	projectRoot := ""
	if pr, ok := request.Params.Arguments["project_root"].(string); ok {
		projectRoot = pr
	}

	// Convert string to GateType
	gateType := types.GateMVP
	switch gateTypeStr {
	case "poc":
		gateType = types.GatePoC
	case "production":
		gateType = types.GateProduction
	}

	cheese := analyzer.AnalyzeCheese(source)
	ham := analyzer.AnalyzeHam(source, filePath)

	result := gate.CheckGate(gateType, cheese, ham, gate.CheckGateOptions{
		Source:      source,
		FilePath:    filePath,
		ProjectRoot: projectRoot,
	})

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}

func analyzeCheese(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	source := request.Params.Arguments["source"].(string)
	cheese := analyzer.AnalyzeCheese(source)

	jsonBytes, _ := json.MarshalIndent(cheese, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}

func getLabel(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	source := request.Params.Arguments["source"].(string)

	bread := analyzer.AnalyzeBread(source)
	cheese := analyzer.AnalyzeCheese(source)
	ham := analyzer.AnalyzeHam(source, "")
	simplexCoords := simplex.Normalize(bread, cheese, ham)
	label := simplex.GetLabel(simplexCoords)

	result := map[string]interface{}{
		"label":      label.Label,
		"confidence": label.Confidence,
		"simplex":    simplexCoords,
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}

func checkDegradation(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	beforeSource := request.Params.Arguments["before_source"].(string)
	afterSource := request.Params.Arguments["after_source"].(string)

	before := analyzer.AnalyzeCheese(beforeSource)
	after := analyzer.AnalyzeCheese(afterSource)

	// Degradation indicators
	indicators := []string{}

	// Accessibility lost
	if before.Accessible && !after.Accessible {
		indicators = append(indicators, "Accessibility lost (accessible: true → false)")
	}

	// Nesting increase
	deltaNesting := after.MaxNesting - before.MaxNesting
	if deltaNesting > 0 {
		indicators = append(indicators, fmt.Sprintf("Nesting depth increased: +%d", deltaNesting))
	}

	// Hidden deps increase
	deltaHiddenDeps := after.HiddenDependencies - before.HiddenDependencies
	if deltaHiddenDeps > 0 {
		indicators = append(indicators, fmt.Sprintf("Hidden dependencies increased: +%d", deltaHiddenDeps))
	}

	// SAR violation introduced
	if !before.StateAsyncRetry.Violated && after.StateAsyncRetry.Violated {
		indicators = append(indicators, "state×async×retry violation introduced")
	}

	// Violations increase
	deltaViolations := len(after.Violations) - len(before.Violations)
	if deltaViolations > 0 {
		indicators = append(indicators, fmt.Sprintf("Violations increased: +%d", deltaViolations))
	}

	// Determine severity
	severity := "none"
	if len(indicators) > 0 {
		if before.Accessible && !after.Accessible {
			severity = "severe"
		} else if len(indicators) >= 3 {
			severity = "severe"
		} else if len(indicators) >= 2 {
			severity = "moderate"
		} else {
			severity = "mild"
		}
	}

	result := map[string]interface{}{
		"degraded":          len(indicators) > 0,
		"severity":          severity,
		"indicators":        indicators,
		"beforeAccessible":  before.Accessible,
		"afterAccessible":   after.Accessible,
		"delta": map[string]interface{}{
			"nesting":    deltaNesting,
			"hiddenDeps": deltaHiddenDeps,
			"violations": deltaViolations,
		},
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}

func suggestRefactor(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	source := request.Params.Arguments["source"].(string)

	bread := analyzer.AnalyzeBread(source)
	cheese := analyzer.AnalyzeCheese(source)
	ham := analyzer.AnalyzeHam(source, "")
	simplexCoords := simplex.Normalize(bread, cheese, ham)
	equilibrium := simplex.CalculateEquilibrium(simplexCoords)
	recommendations := recommend.SuggestRefactor(simplexCoords, equilibrium, &cheese, 3)

	jsonBytes, _ := json.MarshalIndent(recommendations, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}

func checkBudgetHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	beforeSource := request.Params.Arguments["before_source"].(string)
	afterSource := request.Params.Arguments["after_source"].(string)
	moduleType := types.App
	if mt, ok := request.Params.Arguments["module_type"].(string); ok && mt != "" {
		moduleType = types.ModuleType(mt)
	}

	before := analyzer.AnalyzeCheese(beforeSource)
	after := analyzer.AnalyzeCheese(afterSource)
	delta := budget.CalculateDelta(before, after)
	result := budget.CheckBudget(moduleType, delta)

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	return mcp.NewToolResultText(string(jsonBytes)), nil
}
