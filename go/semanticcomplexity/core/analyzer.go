package core

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
)

// State-related variable patterns
var statePatterns = []string{
	"state", "status", "mode", "phase", "step", "stage", "flag",
	"current", "previous", "next", "active", "enabled", "disabled",
}

// I/O packages that indicate coupling
var ioPackages = map[string]bool{
	"fmt": true, "os": true, "io": true, "net": true, "http": true,
	"log": true, "bufio": true, "ioutil": true,
}

// ComplexityVisitor walks the AST and calculates complexity metrics.
type ComplexityVisitor struct {
	control      int
	nesting      int
	currentDepth int
	state        StateComplexity
	async        AsyncComplexity
	coupling     CouplingComplexity
	localVars    map[string]bool
	imports      map[string]bool
}

// NewComplexityVisitor creates a new complexity visitor.
func NewComplexityVisitor() *ComplexityVisitor {
	return &ComplexityVisitor{
		localVars: make(map[string]bool),
		imports:   make(map[string]bool),
	}
}

// Visit implements ast.Visitor interface.
func (v *ComplexityVisitor) Visit(node ast.Node) ast.Visitor {
	if node == nil {
		return nil
	}

	switch n := node.(type) {
	// Control flow
	case *ast.IfStmt:
		v.control++
		v.enterBlock()
		ast.Walk(v, n.Cond)
		ast.Walk(v, n.Body)
		if n.Else != nil {
			ast.Walk(v, n.Else)
		}
		v.exitBlock()
		return nil

	case *ast.ForStmt:
		v.control++
		v.enterBlock()
		if n.Init != nil {
			ast.Walk(v, n.Init)
		}
		if n.Cond != nil {
			ast.Walk(v, n.Cond)
		}
		if n.Post != nil {
			ast.Walk(v, n.Post)
		}
		ast.Walk(v, n.Body)
		v.exitBlock()
		return nil

	case *ast.RangeStmt:
		v.control++
		v.enterBlock()
		ast.Walk(v, n.Body)
		v.exitBlock()
		return nil

	case *ast.SwitchStmt:
		v.control++
		v.enterBlock()
		ast.Walk(v, n.Body)
		v.exitBlock()
		return nil

	case *ast.TypeSwitchStmt:
		v.control++
		v.enterBlock()
		ast.Walk(v, n.Body)
		v.exitBlock()
		return nil

	case *ast.SelectStmt:
		v.control++
		v.async.AsyncBoundaries++
		v.enterBlock()
		ast.Walk(v, n.Body)
		v.exitBlock()
		return nil

	case *ast.CaseClause:
		if n.List != nil {
			v.control++
		}

	case *ast.CommClause:
		v.control++

	// Logical operators
	case *ast.BinaryExpr:
		if n.Op == token.LAND || n.Op == token.LOR {
			v.control++
		}

	// Async: goroutine
	case *ast.GoStmt:
		v.async.AsyncBoundaries += 2

	// Async: channel operations
	case *ast.SendStmt:
		v.async.AsyncBoundaries++

	case *ast.UnaryExpr:
		if n.Op == token.ARROW { // receive <-
			v.async.AsyncBoundaries++
		}

	// State: assignments
	case *ast.AssignStmt:
		for _, lhs := range n.Lhs {
			if ident, ok := lhs.(*ast.Ident); ok {
				name := ident.Name
				if v.isStateVariable(name) {
					v.state.StateMutations++
				}
				v.localVars[name] = true
			}
		}

	// Coupling: global/package-level access
	case *ast.SelectorExpr:
		if ident, ok := n.X.(*ast.Ident); ok {
			pkgName := ident.Name
			if ioPackages[pkgName] {
				v.coupling.SideEffects++
			}
		}

	// Coupling: function calls
	case *ast.CallExpr:
		v.checkCouplingCall(n)

	// Imports
	case *ast.ImportSpec:
		if n.Path != nil {
			path := strings.Trim(n.Path.Value, `"`)
			parts := strings.Split(path, "/")
			pkgName := parts[len(parts)-1]
			v.imports[pkgName] = true
		}
	}

	return v
}

func (v *ComplexityVisitor) enterBlock() {
	v.currentDepth++
	v.nesting += v.currentDepth
}

func (v *ComplexityVisitor) exitBlock() {
	v.currentDepth--
}

func (v *ComplexityVisitor) isStateVariable(name string) bool {
	nameLower := strings.ToLower(name)
	for _, pattern := range statePatterns {
		if strings.Contains(nameLower, pattern) {
			return true
		}
	}
	return strings.HasPrefix(name, "is") || strings.HasPrefix(name, "has")
}

func (v *ComplexityVisitor) checkCouplingCall(call *ast.CallExpr) {
	switch fn := call.Fun.(type) {
	case *ast.Ident:
		// Built-in functions like make, append, etc.
		if fn.Name == "make" {
			// Check if making channel
			if len(call.Args) > 0 {
				if _, ok := call.Args[0].(*ast.ChanType); ok {
					v.async.AsyncBoundaries++
				}
			}
		}
	case *ast.SelectorExpr:
		if ident, ok := fn.X.(*ast.Ident); ok {
			if ioPackages[ident.Name] {
				v.coupling.SideEffects++
			}
		}
	}
}

// GetResult calculates and returns the final complexity result.
func (v *ComplexityVisitor) GetResult(weights DimensionalWeights) DimensionalComplexity {
	stateScore := float64(v.state.StateMutations) * 2
	asyncScore := float64(v.async.AsyncBoundaries)
	couplingScore := float64(v.coupling.GlobalAccess)*2 + float64(v.coupling.SideEffects)*3

	weighted := float64(v.control)*weights.Control +
		float64(v.nesting)*weights.Nesting +
		stateScore*weights.State +
		asyncScore*weights.Async +
		couplingScore*weights.Coupling

	return DimensionalComplexity{
		Weighted: weighted,
		Control:  v.control,
		Nesting:  v.nesting,
		State:    v.state,
		Async:    v.async,
		Coupling: v.coupling,
	}
}

// AnalyzeSource analyzes the complexity of Go source code.
func AnalyzeSource(source string, filename string) ([]FunctionResult, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, source, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	return analyzeFile(fset, file), nil
}

// AnalyzeFile analyzes the complexity of a Go file.
func AnalyzeFile(filepath string) ([]FunctionResult, error) {
	source, err := os.ReadFile(filepath)
	if err != nil {
		return nil, err
	}
	return AnalyzeSource(string(source), filepath)
}

func analyzeFile(fset *token.FileSet, file *ast.File) []FunctionResult {
	var results []FunctionResult
	weights := DefaultWeights()

	// First pass: collect imports
	imports := make(map[string]bool)
	for _, imp := range file.Imports {
		if imp.Path != nil {
			path := strings.Trim(imp.Path.Value, `"`)
			parts := strings.Split(path, "/")
			pkgName := parts[len(parts)-1]
			imports[pkgName] = true
		}
	}

	// Second pass: analyze functions
	ast.Inspect(file, func(n ast.Node) bool {
		switch fn := n.(type) {
		case *ast.FuncDecl:
			visitor := NewComplexityVisitor()
			visitor.imports = imports
			ast.Walk(visitor, fn.Body)

			result := visitor.GetResult(weights)

			startPos := fset.Position(fn.Pos())
			endPos := fset.Position(fn.End())

			// Calculate 5D vector
			vector := Vector5D{
				Control:  float64(result.Control),
				Nesting:  float64(result.Nesting),
				State:    float64(result.State.StateMutations),
				Async:    float64(result.Async.AsyncBoundaries),
				Coupling: float64(result.Coupling.GlobalAccess + result.Coupling.SideEffects),
			}

			// Find best module type
			bestType := FindBestModuleType(vector)
			confidence := 1.0 / (1.0 + bestType.Distance)

			// Calculate tensor score with inferred module type
			tensorScore := CalculateTensorScore(vector, bestType.Type, 2.0)

			// Analyze deviation from canonical
			deviation := AnalyzeDeviation(vector, bestType.Type)

			// Hodge decomposition
			hodge := HodgeDecompose(vector)

			// Refactoring recommendations
			recommendations := RecommendRefactoring(vector)
			var recOutputs []RecommendationOutput
			for _, r := range recommendations {
				recOutputs = append(recOutputs, RecommendationOutput{
					Dimension:      r.Dimension,
					Priority:       r.Priority,
					Action:         r.Action,
					ExpectedImpact: r.ExpectedImpact,
				})
			}

			funcResult := FunctionResult{
				Name:        fn.Name.Name,
				Lineno:      startPos.Line,
				EndLineno:   endPos.Line,
				Cyclomatic:  result.Control + 1,
				Cognitive:   result.Control + result.Nesting,
				Dimensional: result,
				Tensor: TensorScoreOutput{
					Linear:          tensorScore.Linear,
					Quadratic:       tensorScore.Quadratic,
					Regularized:     tensorScore.Regularized,
					RawSum:          tensorScore.RawSum,
					RawSumThreshold: tensorScore.RawSumThreshold,
					RawSumRatio:     tensorScore.RawSumRatio,
					Zone:            GetZone(tensorScore),
				},
				ModuleType: ModuleTypeOutput{
					Inferred:   string(bestType.Type),
					Distance:   bestType.Distance,
					Confidence: round(confidence, 3),
				},
				Canonical: CanonicalOutput{
					IsCanonical:         deviation.IsCanonical,
					IsOrphan:            deviation.IsOrphan,
					Status:              deviation.Status,
					EuclideanDistance:   deviation.EuclideanDistance,
					MahalanobisDistance: deviation.MahalanobisDistance,
					Violations:          deviation.ViolationDimensions,
				},
				Hodge: HodgeOutput{
					Algorithmic:   hodge.Algorithmic,
					Architectural: hodge.Architectural,
					Balanced:      hodge.Balanced,
					Total:         hodge.Total,
					BalanceRatio:  hodge.BalanceRatio,
					IsHarmonic:    hodge.IsHarmonic,
				},
				Recommendations: recOutputs,
			}

			results = append(results, funcResult)
		}
		return true
	})

	return results
}
