// Package core provides multi-dimensional code complexity analysis.
//
// Complexity Domains:
//   - Control (C): Cyclomatic complexity (branches, loops)
//   - Nesting (N): Depth penalty
//   - State (S): State mutations and transitions
//   - Async (A): Goroutines, channels
//   - Coupling (Λ): Hidden dependencies, side effects
package core

// DimensionalWeights holds weight multipliers for each complexity domain.
type DimensionalWeights struct {
	Control  float64 // C: branch points
	Nesting  float64 // N: depth penalty
	State    float64 // S: state complexity
	Async    float64 // A: async complexity
	Coupling float64 // Λ: hidden coupling
}

// DefaultWeights returns the default weight configuration.
func DefaultWeights() DimensionalWeights {
	return DimensionalWeights{
		Control:  1.0,
		Nesting:  1.5,
		State:    2.0,
		Async:    2.5,
		Coupling: 3.0,
	}
}

// StateComplexity holds state complexity metrics.
type StateComplexity struct {
	StateMutations int `json:"state_mutations"`
}

// AsyncComplexity holds async complexity metrics.
type AsyncComplexity struct {
	AsyncBoundaries int `json:"async_boundaries"`
}

// CouplingComplexity holds hidden coupling metrics.
type CouplingComplexity struct {
	GlobalAccess int `json:"global_access"`
	SideEffects  int `json:"side_effects"`
}

// DimensionalComplexity holds the complete complexity analysis result.
type DimensionalComplexity struct {
	Weighted float64            `json:"weighted"`
	Control  int                `json:"control"`
	Nesting  int                `json:"nesting"`
	State    StateComplexity    `json:"state"`
	Async    AsyncComplexity    `json:"async_"`
	Coupling CouplingComplexity `json:"coupling"`
}

// TensorScoreOutput holds the tensor score output for JSON.
type TensorScoreOutput struct {
	Regularized     float64 `json:"regularized"`
	RawSum          float64 `json:"raw_sum"`
	RawSumThreshold float64 `json:"raw_sum_threshold"`
	RawSumRatio     float64 `json:"raw_sum_ratio"`
	Zone            string  `json:"zone"`
}

// FunctionResult holds the analysis result for a single function.
type FunctionResult struct {
	Name        string                `json:"name"`
	Lineno      int                   `json:"lineno"`
	EndLineno   int                   `json:"end_lineno"`
	Cyclomatic  int                   `json:"cyclomatic"`
	Cognitive   int                   `json:"cognitive"`
	Dimensional DimensionalComplexity `json:"dimensional"`
	Tensor      TensorScoreOutput     `json:"tensor"`
}
