// Package analyzer implements code complexity analysis
package analyzer

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strings"

	"github.com/yscha88/semantic-complexity/src/go/pkg/types"
)

// AnalyzeCheese analyzes cognitive accessibility of Go source code
func AnalyzeCheese(source string) types.CheeseResult {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "", source, parser.ParseComments)
	if err != nil {
		return types.CheeseResult{
			Accessible: false,
			Reason:     "파싱 실패",
			Violations: []string{"소스 코드 파싱 실패"},
		}
	}

	var maxNesting int
	var hiddenDeps int
	var violations []string
	sar := types.StateAsyncRetry{}

	// Analyze each function
	ast.Inspect(f, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.FuncDecl:
			nesting := analyzeNesting(node.Body, 0)
			if nesting > maxNesting {
				maxNesting = nesting
			}

			// Check for goroutine (async)
			if hasGoroutine(node.Body) {
				sar.HasAsync = true
			}

		case *ast.AssignStmt:
			// Check for state mutation
			for _, lhs := range node.Lhs {
				if ident, ok := lhs.(*ast.Ident); ok && ident.Obj != nil {
					if ident.Obj.Kind == ast.Var {
						sar.HasState = true
					}
				}
			}

		case *ast.CallExpr:
			// Check for global/hidden dependencies
			if sel, ok := node.Fun.(*ast.SelectorExpr); ok {
				if ident, ok := sel.X.(*ast.Ident); ok {
					name := ident.Name
					// os.Getenv, os.Open, etc.
					if name == "os" {
						hiddenDeps++
					}
				}
			}

			// Check for retry patterns
			if ident, ok := node.Fun.(*ast.Ident); ok {
				if strings.Contains(strings.ToLower(ident.Name), "retry") {
					sar.HasRetry = true
				}
			}
		}

		return true
	})

	// Check nesting threshold
	if maxNesting > 4 {
		violations = append(violations, "중첩 깊이 초과")
	}

	// Check state×async×retry
	sarCount := 0
	if sar.HasState {
		sarCount++
		sar.Axes = append(sar.Axes, "state")
	}
	if sar.HasAsync {
		sarCount++
		sar.Axes = append(sar.Axes, "async")
	}
	if sar.HasRetry {
		sarCount++
		sar.Axes = append(sar.Axes, "retry")
	}
	sar.Count = sarCount
	sar.Violated = sarCount >= 2

	if sar.Violated {
		violations = append(violations, "state×async×retry 위반")
	}

	accessible := len(violations) == 0
	reason := ""
	if !accessible {
		reason = strings.Join(violations, ", ")
	}

	return types.CheeseResult{
		Accessible:         accessible,
		Reason:             reason,
		Violations:         violations,
		MaxNesting:         maxNesting,
		HiddenDependencies: hiddenDeps,
		StateAsyncRetry:    sar,
	}
}

func analyzeNesting(node ast.Node, currentDepth int) int {
	maxDepth := currentDepth

	ast.Inspect(node, func(n ast.Node) bool {
		switch n.(type) {
		case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt, *ast.SwitchStmt, *ast.SelectStmt:
			newDepth := currentDepth + 1
			if newDepth > maxDepth {
				maxDepth = newDepth
			}
		}
		return true
	})

	return maxDepth
}

func hasGoroutine(body *ast.BlockStmt) bool {
	if body == nil {
		return false
	}

	hasGo := false
	ast.Inspect(body, func(n ast.Node) bool {
		if _, ok := n.(*ast.GoStmt); ok {
			hasGo = true
			return false
		}
		return true
	})
	return hasGo
}
