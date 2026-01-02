package analyzer

import (
	"go/ast"
	"go/parser"
	"go/token"
	"regexp"
	"strings"

	"github.com/yscha88/semantic-complexity/pkg/types"
)

var secretPatterns = []struct {
	pattern  *regexp.Regexp
	severity string
}{
	{regexp.MustCompile(`(?i)(api[_-]?key|apikey)\s*[:=]\s*["'][^"']+["']`), "high"},
	{regexp.MustCompile(`(?i)(password|passwd|pwd)\s*[:=]\s*["'][^"']+["']`), "high"},
	{regexp.MustCompile(`(?i)(secret|token)\s*[:=]\s*["'][^"']+["']`), "high"},
	{regexp.MustCompile(`(?i)bearer\s+[a-zA-Z0-9._-]+`), "medium"},
}

// AnalyzeBread analyzes security aspects of Go source code
func AnalyzeBread(source string) types.BreadResult {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "", source, parser.ParseComments)
	if err != nil {
		return types.BreadResult{
			TrustBoundaryCount: 0,
			AuthExplicitness:   0,
			Violations:         []string{"소스 코드 파싱 실패"},
		}
	}

	var trustBoundaries int
	var authExplicitness float64 = 1.0
	var violations []string
	var secrets []types.SecretPattern
	hiddenDeps := types.HiddenDeps{}

	// Check for trust boundary annotations
	for _, cg := range f.Comments {
		for _, c := range cg.List {
			if strings.Contains(c.Text, "@TrustBoundary") ||
				strings.Contains(c.Text, "TRUST_BOUNDARY") {
				trustBoundaries++
			}
		}
	}

	// Check for secrets in source
	lines := strings.Split(source, "\n")
	for i, line := range lines {
		for _, sp := range secretPatterns {
			if sp.pattern.MatchString(line) {
				secrets = append(secrets, types.SecretPattern{
					Pattern:  sp.pattern.String(),
					Line:     i + 1,
					Severity: sp.severity,
				})
				violations = append(violations, "하드코딩된 시크릿 발견")
			}
		}
	}

	// Analyze for hidden dependencies
	ast.Inspect(f, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.CallExpr:
			if sel, ok := node.Fun.(*ast.SelectorExpr); ok {
				if ident, ok := sel.X.(*ast.Ident); ok {
					switch ident.Name {
					case "os":
						if sel.Sel.Name == "Getenv" {
							hiddenDeps.EnvAccess = append(hiddenDeps.EnvAccess, "os.Getenv")
							hiddenDeps.Total++
						}
						if strings.HasPrefix(sel.Sel.Name, "Open") ||
							strings.HasPrefix(sel.Sel.Name, "Read") ||
							strings.HasPrefix(sel.Sel.Name, "Write") {
							hiddenDeps.FileIO = append(hiddenDeps.FileIO, "os."+sel.Sel.Name)
							hiddenDeps.Total++
						}
					}
				}
			}
		}
		return true
	})

	return types.BreadResult{
		TrustBoundaryCount: trustBoundaries,
		AuthExplicitness:   authExplicitness,
		SecretPatterns:     secrets,
		HiddenDeps:         hiddenDeps,
		Violations:         violations,
	}
}
