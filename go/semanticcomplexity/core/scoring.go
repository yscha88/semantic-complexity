package core

import "math"

// CalculateRawSum calculates the simple sum of dimensions (CDR-SOB style).
func CalculateRawSum(v Vector5D) float64 {
	return v.Control + v.Nesting + v.State + v.Async + v.Coupling
}

// CalculateRawSumThreshold calculates the rawSum threshold from canonical profile upper bounds.
func CalculateRawSumThreshold(moduleType ModuleType) float64 {
	profile := GetCanonicalProfile(moduleType)
	return profile.Control[1] + profile.Nesting[1] + profile.State[1] +
		profile.Async[1] + profile.Coupling[1]
}

// CalculateTensorScore calculates the tensor-based complexity score.
func CalculateTensorScore(v Vector5D, moduleType ModuleType, epsilon float64) TensorScore {
	if epsilon == 0 {
		epsilon = 2.0
	}
	weights := DefaultWeightsVector()

	// Get interaction matrix for module type
	matrix := GetInteractionMatrix(moduleType)

	// Calculate components
	linear := DotProduct(v, weights)
	quadratic := QuadraticForm(v, matrix) * 0.1 // Scale factor
	raw := linear + quadratic

	// ε-regularization
	normSquared := math.Pow(VectorNorm(v), 2)
	regularization := epsilon * normSquared * 0.01 // Scale factor
	regularized := raw + regularization

	// CDR-SOB style: simple sum and threshold
	rawSum := CalculateRawSum(v)
	rawSumThreshold := CalculateRawSumThreshold(moduleType)
	rawSumRatio := 0.0
	if rawSumThreshold > 0 {
		rawSumRatio = rawSum / rawSumThreshold
	}

	return TensorScore{
		Linear:         round(linear, 2),
		Quadratic:      round(quadratic, 2),
		Raw:            round(raw, 2),
		Regularization: round(regularization, 2),
		Regularized:    round(regularized, 2),
		Epsilon:        epsilon,
		ModuleType:     moduleType,
		Vector:         v,
		RawSum:         round(rawSum, 2),
		RawSumThreshold: rawSumThreshold,
		RawSumRatio:    round(rawSumRatio, 3),
	}
}

// ConvergenceScore calculates the convergence score.
// Returns:
//   < 0: Safe zone (converged)
//   0-1: ε-neighborhood (review needed)
//   > 1: Violation zone
func ConvergenceScore(current, threshold, epsilon float64) float64 {
	if epsilon == 0 {
		if current > threshold-epsilon {
			return math.Inf(1)
		}
		return 0
	}
	target := threshold - epsilon
	return (current - target) / epsilon
}

// getConvergenceStatus determines the convergence status from score.
func getConvergenceStatus(convScore float64, isOscillating bool) ConvergenceStatus {
	if isOscillating {
		return StatusOscillating
	}
	if convScore < 0 {
		return StatusSafe
	}
	if convScore < 1 {
		return StatusReview
	}
	return StatusViolation
}

// EstimateLipschitz estimates the Lipschitz constant from two points.
func EstimateLipschitz(v1, v2 Vector5D, score1, score2 float64) float64 {
	a1 := VectorToArray(v1)
	a2 := VectorToArray(v2)

	// Calculate vector distance
	sum := 0.0
	for i := 0; i < 5; i++ {
		diff := a1[i] - a2[i]
		sum += diff * diff
	}
	vDist := math.Sqrt(sum)

	if vDist < 1e-10 {
		return 0
	}

	// Calculate score distance
	sDist := math.Abs(score1 - score2)
	return sDist / vDist
}

// AnalyzeConvergenceOptions contains options for convergence analysis.
type AnalyzeConvergenceOptions struct {
	PrevVector    *Vector5D
	CurrVector    *Vector5D
	PrevScore     *float64
	IsOscillating bool
}

// AnalyzeConvergence analyzes the convergence status.
func AnalyzeConvergence(score, threshold, epsilon float64, opts *AnalyzeConvergenceOptions) ConvergenceAnalysis {
	if epsilon == 0 {
		epsilon = 2.0
	}
	if threshold == 0 {
		threshold = 10.0
	}

	target := threshold - epsilon
	convScore := ConvergenceScore(score, threshold, epsilon)

	// Estimate Lipschitz constant if vectors provided
	lipschitzEstimate := 0.0
	isOscillating := false
	if opts != nil {
		isOscillating = opts.IsOscillating
		if opts.PrevVector != nil && opts.CurrVector != nil && opts.PrevScore != nil {
			lipschitzEstimate = EstimateLipschitz(*opts.PrevVector, *opts.CurrVector, *opts.PrevScore, score)
		}
	}

	return ConvergenceAnalysis{
		Score:               score,
		Threshold:           threshold,
		Epsilon:             epsilon,
		ConvergenceScore:    round(convScore, 3),
		Status:              getConvergenceStatus(convScore, isOscillating),
		DistanceToTarget:    round(score-target, 2),
		DistanceToThreshold: round(threshold-score, 2),
		LipschitzEstimate:   round(lipschitzEstimate, 3),
	}
}

// HodgeDecompose performs Hodge decomposition of a complexity vector.
func HodgeDecompose(v Vector5D) HodgeDecomposition {
	weights := DefaultWeightsVector()

	// Algorithmic: Control + Nesting
	algorithmic := v.Control*weights.Control + v.Nesting*weights.Nesting

	// Architectural: State + Coupling
	architectural := v.State*weights.State + v.Coupling*weights.Coupling

	// Balanced: Async (bridges both worlds)
	balanced := v.Async * weights.Async

	total := algorithmic + architectural + balanced
	balanceRatio := 0.0
	if total > 0 {
		balanceRatio = balanced / total
	}

	return HodgeDecomposition{
		Algorithmic:   round(algorithmic, 2),
		Architectural: round(architectural, 2),
		Balanced:      round(balanced, 2),
		Total:         round(total, 2),
		BalanceRatio:  round(balanceRatio, 3),
		IsHarmonic:    balanceRatio >= 0.3,
	}
}

// ClassifyComplexityLevel classifies the complexity score into a level.
func ClassifyComplexityLevel(score float64) ComplexityLevel {
	if score < 2 {
		return LevelMinimal
	}
	if score < 5 {
		return LevelLow
	}
	if score < 10 {
		return LevelMedium
	}
	if score < 20 {
		return LevelHigh
	}
	return LevelExtreme
}

// RecommendRefactoring generates refactoring recommendations based on vector analysis.
func RecommendRefactoring(v Vector5D) []RefactoringRecommendation {
	weights := DefaultWeightsVector()
	dims := []string{"control", "nesting", "state", "async", "coupling"}
	arr := VectorToArray(v)
	wArr := VectorToArray(weights)

	// Calculate weighted contributions
	weighted := make([]float64, 5)
	total := 0.0
	for i := 0; i < 5; i++ {
		weighted[i] = arr[i] * wArr[i]
		total += weighted[i]
	}

	if total == 0 {
		return nil
	}

	// Calculate contributions and sort by weight
	type contribution struct {
		dimension  string
		weighted   float64
		percentage float64
	}
	contributions := make([]contribution, 5)
	for i := 0; i < 5; i++ {
		contributions[i] = contribution{
			dimension:  dims[i],
			weighted:   weighted[i],
			percentage: weighted[i] / total,
		}
	}

	// Sort by weighted (descending)
	for i := 0; i < 4; i++ {
		for j := i + 1; j < 5; j++ {
			if contributions[j].weighted > contributions[i].weighted {
				contributions[i], contributions[j] = contributions[j], contributions[i]
			}
		}
	}

	actions := map[string]string{
		"control":  "Extract complex conditionals into separate functions",
		"nesting":  "Flatten nested structures using early returns or guard clauses",
		"state":    "Reduce state mutations; consider immutable patterns",
		"async":    "Simplify async flow; reduce callback nesting",
		"coupling": "Extract dependencies; use dependency injection",
	}

	var recommendations []RefactoringRecommendation
	for _, c := range contributions {
		if c.percentage >= 0.1 { // Only dimensions contributing >= 10%
			priority := int(math.Min(5, math.Floor(c.percentage*10)+1))
			recommendations = append(recommendations, RefactoringRecommendation{
				Dimension:      c.dimension,
				Priority:       priority,
				Action:         actions[c.dimension],
				ExpectedImpact: round(c.weighted*0.3, 2), // Assume 30% reduction
			})
		}
	}

	return recommendations
}

// IsSafe checks if in safe zone (below threshold - ε).
func IsSafe(score TensorScore) bool {
	return score.Regularized < 8.0 // threshold(10) - ε(2)
}

// NeedsReview checks if needs review (in ε-neighborhood).
func NeedsReview(score TensorScore) bool {
	return score.Regularized >= 8.0 && score.Regularized < 10.0
}

// IsViolation checks if violates threshold.
func IsViolation(score TensorScore) bool {
	return score.Regularized >= 10.0
}

// GetZone returns the zone classification: safe, review, or violation.
func GetZone(score TensorScore) string {
	if score.RawSumRatio < 0.7 {
		return "safe"
	}
	if score.RawSumRatio < 1.0 {
		return "review"
	}
	return "violation"
}
