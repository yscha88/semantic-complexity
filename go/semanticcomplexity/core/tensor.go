package core

import "math"

// Vector5D represents a 5-dimensional complexity vector.
type Vector5D struct {
	Control  float64 `json:"control"`
	Nesting  float64 `json:"nesting"`
	State    float64 `json:"state"`
	Async    float64 `json:"async"`
	Coupling float64 `json:"coupling"`
}

// ModuleType represents the type of module for context-aware analysis.
type ModuleType string

const (
	ModuleAPI     ModuleType = "api"
	ModuleLib     ModuleType = "lib"
	ModuleApp     ModuleType = "app"
	ModuleWeb     ModuleType = "web"
	ModuleData    ModuleType = "data"
	ModuleInfra   ModuleType = "infra"
	ModuleDeploy  ModuleType = "deploy"
	ModuleUnknown ModuleType = "unknown"
)

// Matrix5x5 represents a 5x5 interaction matrix.
type Matrix5x5 [5][5]float64

// TensorScore represents the tensor-based complexity score result.
type TensorScore struct {
	Linear         float64    `json:"linear"`
	Quadratic      float64    `json:"quadratic"`
	Raw            float64    `json:"raw"`
	Regularization float64    `json:"regularization"`
	Regularized    float64    `json:"regularized"`
	Epsilon        float64    `json:"epsilon"`
	ModuleType     ModuleType `json:"module_type"`
	Vector         Vector5D   `json:"vector"`
	RawSum         float64    `json:"raw_sum"`
	RawSumThreshold float64   `json:"raw_sum_threshold"`
	RawSumRatio    float64    `json:"raw_sum_ratio"`
}

// ConvergenceStatus represents the convergence state.
type ConvergenceStatus string

const (
	StatusSafe        ConvergenceStatus = "safe"
	StatusReview      ConvergenceStatus = "review"
	StatusViolation   ConvergenceStatus = "violation"
	StatusOscillating ConvergenceStatus = "oscillating"
)

// ConvergenceAnalysis represents the convergence analysis result.
type ConvergenceAnalysis struct {
	Score               float64           `json:"score"`
	Threshold           float64           `json:"threshold"`
	Epsilon             float64           `json:"epsilon"`
	ConvergenceScore    float64           `json:"convergence_score"`
	Status              ConvergenceStatus `json:"status"`
	DistanceToTarget    float64           `json:"distance_to_target"`
	DistanceToThreshold float64           `json:"distance_to_threshold"`
	LipschitzEstimate   float64           `json:"lipschitz_estimate"`
}

// HodgeDecomposition represents the Hodge decomposition result.
type HodgeDecomposition struct {
	Algorithmic   float64 `json:"algorithmic"`
	Architectural float64 `json:"architectural"`
	Balanced      float64 `json:"balanced"`
	Total         float64 `json:"total"`
	BalanceRatio  float64 `json:"balance_ratio"`
	IsHarmonic    bool    `json:"is_harmonic"`
}

// ComplexityLevel represents the complexity classification.
type ComplexityLevel string

const (
	LevelMinimal ComplexityLevel = "minimal"
	LevelLow     ComplexityLevel = "low"
	LevelMedium  ComplexityLevel = "medium"
	LevelHigh    ComplexityLevel = "high"
	LevelExtreme ComplexityLevel = "extreme"
)

// RefactoringRecommendation represents a refactoring suggestion.
type RefactoringRecommendation struct {
	Dimension      string  `json:"dimension"`
	Priority       int     `json:"priority"`
	Action         string  `json:"action"`
	ExpectedImpact float64 `json:"expected_impact"`
}

// DefaultWeights returns the default linear weights.
func DefaultWeightsVector() Vector5D {
	return Vector5D{
		Control:  1.0,
		Nesting:  1.5,
		State:    2.0,
		Async:    2.5,
		Coupling: 3.0,
	}
}

// VectorToArray converts Vector5D to a slice.
func VectorToArray(v Vector5D) []float64 {
	return []float64{v.Control, v.Nesting, v.State, v.Async, v.Coupling}
}

// ArrayToVector converts a slice to Vector5D.
func ArrayToVector(arr []float64) Vector5D {
	if len(arr) != 5 {
		return Vector5D{}
	}
	return Vector5D{
		Control:  arr[0],
		Nesting:  arr[1],
		State:    arr[2],
		Async:    arr[3],
		Coupling: arr[4],
	}
}

// ZeroVector returns a zero vector.
func ZeroVector() Vector5D {
	return Vector5D{}
}

// VectorNorm calculates the L2 norm of a vector.
func VectorNorm(v Vector5D) float64 {
	arr := VectorToArray(v)
	sum := 0.0
	for _, x := range arr {
		sum += x * x
	}
	return math.Sqrt(sum)
}

// DotProduct calculates the dot product of two vectors.
func DotProduct(v1, v2 Vector5D) float64 {
	a1 := VectorToArray(v1)
	a2 := VectorToArray(v2)
	sum := 0.0
	for i := 0; i < 5; i++ {
		sum += a1[i] * a2[i]
	}
	return sum
}

// QuadraticForm calculates v^T M v.
func QuadraticForm(v Vector5D, m Matrix5x5) float64 {
	arr := VectorToArray(v)
	result := 0.0
	for i := 0; i < 5; i++ {
		for j := 0; j < 5; j++ {
			result += arr[i] * m[i][j] * arr[j]
		}
	}
	return result
}

// EuclideanDistance calculates the Euclidean distance between two vectors.
func EuclideanDistance(v1, v2 Vector5D) float64 {
	a1 := VectorToArray(v1)
	a2 := VectorToArray(v2)
	sum := 0.0
	for i := 0; i < 5; i++ {
		diff := a1[i] - a2[i]
		sum += diff * diff
	}
	return math.Sqrt(sum)
}

// MahalanobisDistance calculates the Mahalanobis-like distance.
func MahalanobisDistance(v, target Vector5D, m Matrix5x5) float64 {
	diff := Vector5D{
		Control:  v.Control - target.Control,
		Nesting:  v.Nesting - target.Nesting,
		State:    v.State - target.State,
		Async:    v.Async - target.Async,
		Coupling: v.Coupling - target.Coupling,
	}
	result := QuadraticForm(diff, m)
	return math.Sqrt(math.Abs(result))
}

// round rounds a float to specified decimal places.
func round(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}
