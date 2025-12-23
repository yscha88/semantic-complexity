package core

import (
	"math"
	"testing"
)

// ─────────────────────────────────────────────────────────────────
// Convergence Score Tests
// ─────────────────────────────────────────────────────────────────

func TestConvergenceScoreSafe(t *testing.T) {
	// current < threshold - epsilon
	score := ConvergenceScore(5.0, 10.0, 2.0)

	if score >= 0 {
		t.Errorf("ConvergenceScore(5, 10, 2) = %v, want < 0 (safe)", score)
	}
}

func TestConvergenceScoreReview(t *testing.T) {
	// threshold - epsilon <= current < threshold
	score := ConvergenceScore(9.0, 10.0, 2.0)

	if score < 0 || score >= 1 {
		t.Errorf("ConvergenceScore(9, 10, 2) = %v, want in [0, 1) (review)", score)
	}
}

func TestConvergenceScoreViolation(t *testing.T) {
	// current >= threshold
	score := ConvergenceScore(12.0, 10.0, 2.0)

	if score < 1 {
		t.Errorf("ConvergenceScore(12, 10, 2) = %v, want >= 1 (violation)", score)
	}
}

func TestConvergenceScoreZeroEpsilon(t *testing.T) {
	// epsilon = 0 should handle edge case
	score := ConvergenceScore(11.0, 10.0, 0)

	if !math.IsInf(score, 1) {
		t.Errorf("ConvergenceScore with epsilon=0 above threshold should be +Inf, got %v", score)
	}
}

// ─────────────────────────────────────────────────────────────────
// Convergence Status Tests
// ─────────────────────────────────────────────────────────────────

func TestGetConvergenceStatusSafe(t *testing.T) {
	status := getConvergenceStatus(-0.5, false)
	if status != StatusSafe {
		t.Errorf("Status for convScore=-0.5 = %s, want safe", status)
	}
}

func TestGetConvergenceStatusReview(t *testing.T) {
	status := getConvergenceStatus(0.5, false)
	if status != StatusReview {
		t.Errorf("Status for convScore=0.5 = %s, want review", status)
	}
}

func TestGetConvergenceStatusViolation(t *testing.T) {
	status := getConvergenceStatus(1.5, false)
	if status != StatusViolation {
		t.Errorf("Status for convScore=1.5 = %s, want violation", status)
	}
}

func TestGetConvergenceStatusOscillating(t *testing.T) {
	status := getConvergenceStatus(-0.5, true)
	if status != StatusOscillating {
		t.Errorf("Status with oscillation = %s, want oscillating", status)
	}
}

// ─────────────────────────────────────────────────────────────────
// Analyze Convergence Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeConvergenceBasic(t *testing.T) {
	result := AnalyzeConvergence(5.0, 10.0, 2.0, nil)

	if result.Score != 5.0 {
		t.Errorf("Score = %v, want 5.0", result.Score)
	}
	if result.Threshold != 10.0 {
		t.Errorf("Threshold = %v, want 10.0", result.Threshold)
	}
	if result.Epsilon != 2.0 {
		t.Errorf("Epsilon = %v, want 2.0", result.Epsilon)
	}
	if result.Status != StatusSafe {
		t.Errorf("Status = %s, want safe", result.Status)
	}
}

func TestAnalyzeConvergenceDistances(t *testing.T) {
	result := AnalyzeConvergence(9.0, 10.0, 2.0, nil)

	// DistanceToTarget = 9 - (10-2) = 9 - 8 = 1
	if result.DistanceToTarget != 1.0 {
		t.Errorf("DistanceToTarget = %v, want 1.0", result.DistanceToTarget)
	}

	// DistanceToThreshold = 10 - 9 = 1
	if result.DistanceToThreshold != 1.0 {
		t.Errorf("DistanceToThreshold = %v, want 1.0", result.DistanceToThreshold)
	}
}

func TestAnalyzeConvergenceWithVectors(t *testing.T) {
	prevVector := Vector5D{Control: 5, Nesting: 3, State: 2, Async: 1, Coupling: 1}
	currVector := Vector5D{Control: 6, Nesting: 4, State: 3, Async: 2, Coupling: 2}
	prevScore := 8.0

	opts := &AnalyzeConvergenceOptions{
		PrevVector: &prevVector,
		CurrVector: &currVector,
		PrevScore:  &prevScore,
	}

	result := AnalyzeConvergence(10.0, 15.0, 2.0, opts)

	// Should have Lipschitz estimate
	if result.LipschitzEstimate == 0 {
		t.Error("LipschitzEstimate should be non-zero with vectors provided")
	}
}

// ─────────────────────────────────────────────────────────────────
// Lipschitz Estimate Tests
// ─────────────────────────────────────────────────────────────────

func TestEstimateLipschitzBasic(t *testing.T) {
	v1 := Vector5D{Control: 0, Nesting: 0, State: 0, Async: 0, Coupling: 0}
	v2 := Vector5D{Control: 1, Nesting: 0, State: 0, Async: 0, Coupling: 0}

	L := EstimateLipschitz(v1, v2, 0, 2.0)

	// |2 - 0| / |1 - 0| = 2
	if L != 2.0 {
		t.Errorf("EstimateLipschitz = %v, want 2.0", L)
	}
}

func TestEstimateLipschitzSameVector(t *testing.T) {
	v := Vector5D{Control: 5, Nesting: 3, State: 2, Async: 1, Coupling: 1}

	L := EstimateLipschitz(v, v, 5.0, 5.0)

	// Same vectors should give 0
	if L != 0 {
		t.Errorf("EstimateLipschitz for same vectors = %v, want 0", L)
	}
}

// ─────────────────────────────────────────────────────────────────
// Hodge Decomposition Tests
// ─────────────────────────────────────────────────────────────────

func TestHodgeDecomposeZero(t *testing.T) {
	v := Vector5D{}
	result := HodgeDecompose(v)

	if result.Total != 0 {
		t.Errorf("HodgeDecompose zero vector Total = %v, want 0", result.Total)
	}
}

func TestHodgeDecomposeAlgorithmic(t *testing.T) {
	// High control and nesting, low others
	v := Vector5D{Control: 10, Nesting: 10, State: 0, Async: 0, Coupling: 0}
	result := HodgeDecompose(v)

	if result.Algorithmic <= 0 {
		t.Error("Algorithmic component should be positive for control/nesting heavy vector")
	}
	if result.Architectural != 0 {
		t.Errorf("Architectural = %v, want 0 for zero state/coupling", result.Architectural)
	}
}

func TestHodgeDecomposeArchitectural(t *testing.T) {
	// High state and coupling, low others
	v := Vector5D{Control: 0, Nesting: 0, State: 10, Async: 0, Coupling: 10}
	result := HodgeDecompose(v)

	if result.Architectural <= 0 {
		t.Error("Architectural component should be positive for state/coupling heavy vector")
	}
	if result.Algorithmic != 0 {
		t.Errorf("Algorithmic = %v, want 0 for zero control/nesting", result.Algorithmic)
	}
}

func TestHodgeDecomposeBalanced(t *testing.T) {
	// High async only
	v := Vector5D{Control: 0, Nesting: 0, State: 0, Async: 10, Coupling: 0}
	result := HodgeDecompose(v)

	if result.Balanced <= 0 {
		t.Error("Balanced component should be positive for async heavy vector")
	}
}

func TestHodgeDecomposeHarmonic(t *testing.T) {
	// Balanced vector with significant async
	v := Vector5D{Control: 3, Nesting: 3, State: 3, Async: 10, Coupling: 3}
	result := HodgeDecompose(v)

	// BalanceRatio >= 0.3 means IsHarmonic
	if result.BalanceRatio >= 0.3 && !result.IsHarmonic {
		t.Error("IsHarmonic should be true when BalanceRatio >= 0.3")
	}
}

func TestHodgeDecomposeTotalConsistent(t *testing.T) {
	v := Vector5D{Control: 5, Nesting: 3, State: 4, Async: 2, Coupling: 6}
	result := HodgeDecompose(v)

	expectedTotal := result.Algorithmic + result.Architectural + result.Balanced

	if math.Abs(result.Total-expectedTotal) > 0.01 {
		t.Errorf("Total = %v, want %v (sum of components)", result.Total, expectedTotal)
	}
}

// ─────────────────────────────────────────────────────────────────
// Complexity Level Tests
// ─────────────────────────────────────────────────────────────────

func TestClassifyComplexityLevelMinimal(t *testing.T) {
	level := ClassifyComplexityLevel(1.5)
	if level != LevelMinimal {
		t.Errorf("Level for 1.5 = %s, want minimal", level)
	}
}

func TestClassifyComplexityLevelLow(t *testing.T) {
	level := ClassifyComplexityLevel(3.0)
	if level != LevelLow {
		t.Errorf("Level for 3.0 = %s, want low", level)
	}
}

func TestClassifyComplexityLevelMedium(t *testing.T) {
	level := ClassifyComplexityLevel(7.0)
	if level != LevelMedium {
		t.Errorf("Level for 7.0 = %s, want medium", level)
	}
}

func TestClassifyComplexityLevelHigh(t *testing.T) {
	level := ClassifyComplexityLevel(15.0)
	if level != LevelHigh {
		t.Errorf("Level for 15.0 = %s, want high", level)
	}
}

func TestClassifyComplexityLevelExtreme(t *testing.T) {
	level := ClassifyComplexityLevel(25.0)
	if level != LevelExtreme {
		t.Errorf("Level for 25.0 = %s, want extreme", level)
	}
}

// ─────────────────────────────────────────────────────────────────
// Refactoring Recommendation Tests
// ─────────────────────────────────────────────────────────────────

func TestRecommendRefactoringEmpty(t *testing.T) {
	v := Vector5D{}
	recommendations := RecommendRefactoring(v)

	if recommendations != nil && len(recommendations) > 0 {
		t.Error("Zero vector should have no recommendations")
	}
}

func TestRecommendRefactoringControl(t *testing.T) {
	v := Vector5D{Control: 20, Nesting: 1, State: 1, Async: 1, Coupling: 1}
	recommendations := RecommendRefactoring(v)

	if len(recommendations) == 0 {
		t.Fatal("High control should have recommendations")
	}

	found := false
	for _, r := range recommendations {
		if r.Dimension == "control" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Should have control dimension recommendation")
	}
}

func TestRecommendRefactoringCoupling(t *testing.T) {
	v := Vector5D{Control: 1, Nesting: 1, State: 1, Async: 1, Coupling: 20}
	recommendations := RecommendRefactoring(v)

	if len(recommendations) == 0 {
		t.Fatal("High coupling should have recommendations")
	}

	found := false
	for _, r := range recommendations {
		if r.Dimension == "coupling" {
			found = true
			if r.Action == "" {
				t.Error("Action should not be empty")
			}
			break
		}
	}
	if !found {
		t.Error("Should have coupling dimension recommendation")
	}
}

func TestRecommendRefactoringPriority(t *testing.T) {
	v := Vector5D{Control: 10, Nesting: 5, State: 3, Async: 2, Coupling: 1}
	recommendations := RecommendRefactoring(v)

	if len(recommendations) == 0 {
		t.Fatal("Should have recommendations")
	}

	// First recommendation should have highest priority (or equal)
	for i := 1; i < len(recommendations); i++ {
		if recommendations[i].Priority > recommendations[0].Priority {
			t.Error("Recommendations should be sorted by priority (descending)")
		}
	}
}
