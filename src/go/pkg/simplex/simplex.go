// Package simplex implements normalization and equilibrium calculations
package simplex

import (
	"math"

	"github.com/yscha88/semantic-complexity/pkg/types"
)

// Normalize normalizes Bread, Cheese, Ham scores to simplex coordinates
func Normalize(bread types.BreadResult, cheese types.CheeseResult, ham types.HamResult) types.SimplexCoordinates {
	breadRaw := calculateBreadRaw(bread)
	cheeseRaw := calculateCheeseRaw(cheese)
	hamRaw := calculateHamRaw(ham)

	total := breadRaw + cheeseRaw + hamRaw

	if total == 0 {
		return types.SimplexCoordinates{
			Bread:  1.0 / 3.0,
			Cheese: 1.0 / 3.0,
			Ham:    1.0 / 3.0,
		}
	}

	return types.SimplexCoordinates{
		Bread:  breadRaw / total,
		Cheese: cheeseRaw / total,
		Ham:    hamRaw / total,
	}
}

func calculateBreadRaw(bread types.BreadResult) float64 {
	score := 0.0

	// Trust boundary
	if bread.TrustBoundaryCount == 0 {
		score += 0.3
	}

	// Auth explicitness
	score += (1 - bread.AuthExplicitness) * 0.2

	// Secrets
	highSecrets := 0
	for _, s := range bread.SecretPatterns {
		if s.Severity == "high" {
			highSecrets++
		}
	}
	score += math.Min(float64(highSecrets)*0.15, 0.3)

	// Hidden deps
	score += math.Min(float64(bread.HiddenDeps.Total)*0.02, 0.2)

	return math.Min(score, 1.0)
}

func calculateCheeseRaw(cheese types.CheeseResult) float64 {
	score := 0.0

	// Nesting depth
	score += math.Min(float64(cheese.MaxNesting)/10.0, 0.3)

	// State×Async×Retry violation
	if cheese.StateAsyncRetry.Violated {
		score += 0.3
	}

	// Accessibility
	if !cheese.Accessible {
		score += 0.3
	}

	// Additional violations
	score += math.Min(float64(len(cheese.Violations))*0.05, 0.1)

	return math.Min(score, 1.0)
}

func calculateHamRaw(ham types.HamResult) float64 {
	return 1 - ham.GoldenTestCoverage
}

// CalculateEquilibrium calculates equilibrium state
func CalculateEquilibrium(simplex types.SimplexCoordinates) types.EquilibriumResult {
	ideal := 1.0 / 3.0

	// Energy = sum of squared deviations
	energy := math.Pow(simplex.Bread-ideal, 2) +
		math.Pow(simplex.Cheese-ideal, 2) +
		math.Pow(simplex.Ham-ideal, 2)

	// Find dominant axis
	threshold := 0.5
	max := math.Max(simplex.Bread, math.Max(simplex.Cheese, simplex.Ham))

	var dominantAxis *types.Axis
	if max > threshold {
		if simplex.Bread == max {
			axis := types.AxisBread
			dominantAxis = &axis
		} else if simplex.Cheese == max {
			axis := types.AxisCheese
			dominantAxis = &axis
		} else {
			axis := types.AxisHam
			dominantAxis = &axis
		}
	}

	return types.EquilibriumResult{
		InEquilibrium: energy < 0.1,
		Energy:        energy,
		DominantAxis:  dominantAxis,
	}
}

// GetLabel returns the dominant axis label
func GetLabel(simplex types.SimplexCoordinates) types.LabelResult {
	max := math.Max(simplex.Bread, math.Max(simplex.Cheese, simplex.Ham))

	if max < 0.4 {
		return types.LabelResult{
			Label:      "balanced",
			Confidence: 1 - max*2,
		}
	}

	if simplex.Bread == max {
		return types.LabelResult{Label: "bread", Confidence: simplex.Bread}
	}
	if simplex.Cheese == max {
		return types.LabelResult{Label: "cheese", Confidence: simplex.Cheese}
	}
	return types.LabelResult{Label: "ham", Confidence: simplex.Ham}
}
