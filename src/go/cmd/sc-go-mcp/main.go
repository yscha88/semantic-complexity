// Package main implements the MCP server for semantic-complexity
package main

import (
	"context"
	"encoding/json"
	"fmt"
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

const version = "0.0.15"

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

func main() {
	s := server.NewMCPServer(
		"semantic-complexity",
		version,
	)

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
