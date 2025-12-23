package core

import (
	"testing"
)

// ─────────────────────────────────────────────────────────────────
// Vector5D Tests
// ─────────────────────────────────────────────────────────────────

func TestVectorToArray(t *testing.T) {
	v := Vector5D{Control: 1, Nesting: 2, State: 3, Async: 4, Coupling: 5}
	arr := VectorToArray(v)

	expected := []float64{1, 2, 3, 4, 5}
	if len(arr) != 5 {
		t.Errorf("VectorToArray length = %d, want 5", len(arr))
	}
	for i, val := range expected {
		if arr[i] != val {
			t.Errorf("VectorToArray[%d] = %v, want %v", i, arr[i], val)
		}
	}
}

func TestArrayToVector(t *testing.T) {
	arr := []float64{1, 2, 3, 4, 5}
	v := ArrayToVector(arr)

	if v.Control != 1 || v.Nesting != 2 || v.State != 3 || v.Async != 4 || v.Coupling != 5 {
		t.Errorf("ArrayToVector = %+v, want {1,2,3,4,5}", v)
	}
}

func TestVectorNorm(t *testing.T) {
	v := Vector5D{Control: 3, Nesting: 4, State: 0, Async: 0, Coupling: 0}
	norm := VectorNorm(v)

	if norm != 5.0 {
		t.Errorf("VectorNorm = %v, want 5.0", norm)
	}
}

func TestVectorNormZero(t *testing.T) {
	v := Vector5D{}
	norm := VectorNorm(v)

	if norm != 0 {
		t.Errorf("VectorNorm of zero vector = %v, want 0", norm)
	}
}

func TestDotProduct(t *testing.T) {
	v1 := Vector5D{Control: 1, Nesting: 2, State: 3, Async: 4, Coupling: 5}
	v2 := Vector5D{Control: 2, Nesting: 3, State: 4, Async: 5, Coupling: 6}

	result := DotProduct(v1, v2)
	// 1*2 + 2*3 + 3*4 + 4*5 + 5*6 = 2 + 6 + 12 + 20 + 30 = 70
	if result != 70 {
		t.Errorf("DotProduct = %v, want 70", result)
	}
}

func TestDefaultWeightsVector(t *testing.T) {
	w := DefaultWeightsVector()

	if w.Control != 1.0 {
		t.Errorf("Control weight = %v, want 1.0", w.Control)
	}
	if w.Nesting != 1.5 {
		t.Errorf("Nesting weight = %v, want 1.5", w.Nesting)
	}
	if w.State != 2.0 {
		t.Errorf("State weight = %v, want 2.0", w.State)
	}
	if w.Async != 2.5 {
		t.Errorf("Async weight = %v, want 2.5", w.Async)
	}
	if w.Coupling != 3.0 {
		t.Errorf("Coupling weight = %v, want 3.0", w.Coupling)
	}
}

// ─────────────────────────────────────────────────────────────────
// Matrix Tests
// ─────────────────────────────────────────────────────────────────

func TestQuadraticForm(t *testing.T) {
	// Identity matrix
	identity := Matrix5x5{
		{1, 0, 0, 0, 0},
		{0, 1, 0, 0, 0},
		{0, 0, 1, 0, 0},
		{0, 0, 0, 1, 0},
		{0, 0, 0, 0, 1},
	}

	v := Vector5D{Control: 1, Nesting: 2, State: 3, Async: 4, Coupling: 5}
	result := QuadraticForm(v, identity)

	// v^T * I * v = ||v||^2 = 1 + 4 + 9 + 16 + 25 = 55
	if result != 55 {
		t.Errorf("QuadraticForm with identity = %v, want 55", result)
	}
}

func TestQuadraticFormSymmetric(t *testing.T) {
	// Symmetric matrix should give same result as v^T M v
	m := Matrix5x5{
		{1, 0.5, 0, 0, 0},
		{0.5, 1, 0, 0, 0},
		{0, 0, 1, 0, 0},
		{0, 0, 0, 1, 0},
		{0, 0, 0, 0, 1},
	}

	v := Vector5D{Control: 1, Nesting: 1, State: 0, Async: 0, Coupling: 0}
	result := QuadraticForm(v, m)

	// 1*1 + 2*0.5*1*1 + 1*1 = 1 + 1 + 1 = 3
	if result != 3 {
		t.Errorf("QuadraticForm symmetric = %v, want 3", result)
	}
}

func TestGetInteractionMatrix(t *testing.T) {
	moduleTypes := []ModuleType{
		ModuleAPI, ModuleLib, ModuleApp, ModuleWeb,
		ModuleData, ModuleInfra, ModuleDeploy, ModuleUnknown,
	}

	for _, mt := range moduleTypes {
		m := GetInteractionMatrix(mt)
		// Diagonal should be positive
		for i := 0; i < 5; i++ {
			if m[i][i] <= 0 {
				t.Errorf("GetInteractionMatrix(%s) diagonal[%d] = %v, want > 0", mt, i, m[i][i])
			}
		}
	}
}

func TestIsPositiveSemidefinite(t *testing.T) {
	// Identity matrix should be positive semidefinite
	identity := Matrix5x5{
		{1, 0, 0, 0, 0},
		{0, 1, 0, 0, 0},
		{0, 0, 1, 0, 0},
		{0, 0, 0, 1, 0},
		{0, 0, 0, 0, 1},
	}
	if !IsPositiveSemidefinite(identity) {
		t.Error("Identity matrix should be positive semidefinite")
	}

	// Diagonally dominant matrix should be positive semidefinite
	diagDominant := Matrix5x5{
		{5, 1, 0, 0, 1},
		{1, 5, 1, 0, 0},
		{0, 1, 5, 1, 0},
		{0, 0, 1, 5, 1},
		{1, 0, 0, 1, 5},
	}
	if !IsPositiveSemidefinite(diagDominant) {
		t.Error("Diagonally dominant matrix should be positive semidefinite")
	}
}

// ─────────────────────────────────────────────────────────────────
// Distance Tests
// ─────────────────────────────────────────────────────────────────

func TestEuclideanDistance(t *testing.T) {
	v1 := Vector5D{Control: 0, Nesting: 0, State: 0, Async: 0, Coupling: 0}
	v2 := Vector5D{Control: 3, Nesting: 4, State: 0, Async: 0, Coupling: 0}

	dist := EuclideanDistance(v1, v2)
	if dist != 5.0 {
		t.Errorf("EuclideanDistance = %v, want 5.0", dist)
	}
}

func TestEuclideanDistanceSame(t *testing.T) {
	v := Vector5D{Control: 1, Nesting: 2, State: 3, Async: 4, Coupling: 5}
	dist := EuclideanDistance(v, v)

	if dist != 0 {
		t.Errorf("EuclideanDistance of same vectors = %v, want 0", dist)
	}
}

func TestMahalanobisDistance(t *testing.T) {
	v1 := Vector5D{Control: 0, Nesting: 0, State: 0, Async: 0, Coupling: 0}
	v2 := Vector5D{Control: 1, Nesting: 1, State: 1, Async: 1, Coupling: 1}

	dist := MahalanobisDistance(v1, v2, DefaultMatrix)

	// Should be positive
	if dist <= 0 {
		t.Errorf("MahalanobisDistance = %v, want > 0", dist)
	}
}

// ─────────────────────────────────────────────────────────────────
// TensorScore Tests
// ─────────────────────────────────────────────────────────────────

func TestCalculateTensorScoreZero(t *testing.T) {
	v := Vector5D{}
	score := CalculateTensorScore(v, ModuleUnknown, 2.0)

	if score.RawSum != 0 {
		t.Errorf("TensorScore.RawSum for zero vector = %v, want 0", score.RawSum)
	}
	if score.Linear != 0 {
		t.Errorf("TensorScore.Linear for zero vector = %v, want 0", score.Linear)
	}
}

func TestCalculateTensorScoreSimple(t *testing.T) {
	v := Vector5D{Control: 5, Nesting: 3, State: 2, Async: 1, Coupling: 1}
	score := CalculateTensorScore(v, ModuleUnknown, 2.0)

	// RawSum = 5 + 3 + 2 + 1 + 1 = 12
	if score.RawSum != 12 {
		t.Errorf("TensorScore.RawSum = %v, want 12", score.RawSum)
	}

	// Should have all components
	if score.Linear == 0 {
		t.Error("TensorScore.Linear should not be 0")
	}
	if score.Quadratic == 0 {
		t.Error("TensorScore.Quadratic should not be 0")
	}
	if score.Regularization == 0 {
		t.Error("TensorScore.Regularization should not be 0")
	}
}

func TestCalculateTensorScoreModuleType(t *testing.T) {
	v := Vector5D{Control: 5, Nesting: 5, State: 5, Async: 5, Coupling: 5}

	scoreAPI := CalculateTensorScore(v, ModuleAPI, 2.0)
	scoreLib := CalculateTensorScore(v, ModuleLib, 2.0)

	// Different module types should produce different scores
	if scoreAPI.Regularized == scoreLib.Regularized {
		t.Error("Different module types should produce different regularized scores")
	}
}

func TestCalculateTensorScoreEpsilon(t *testing.T) {
	v := Vector5D{Control: 5, Nesting: 5, State: 5, Async: 5, Coupling: 5}

	// Note: epsilon=0 defaults to 2.0 in implementation
	scoreEps1 := CalculateTensorScore(v, ModuleUnknown, 1.0)
	scoreEps2 := CalculateTensorScore(v, ModuleUnknown, 2.0)
	scoreEps5 := CalculateTensorScore(v, ModuleUnknown, 5.0)

	// Higher epsilon = higher regularized score
	if scoreEps2.Regularized <= scoreEps1.Regularized {
		t.Errorf("Higher epsilon should increase regularized score: eps1=%v, eps2=%v", scoreEps1.Regularized, scoreEps2.Regularized)
	}
	if scoreEps5.Regularized <= scoreEps2.Regularized {
		t.Errorf("Higher epsilon should increase regularized score: eps2=%v, eps5=%v", scoreEps2.Regularized, scoreEps5.Regularized)
	}
}

func TestRawSumThreshold(t *testing.T) {
	// Each module type should have a specific threshold
	thresholds := map[ModuleType]float64{
		ModuleAPI:     16,
		ModuleLib:     21,
		ModuleApp:     36,
		ModuleWeb:     31,
		ModuleData:    22,
		ModuleInfra:   26,
		ModuleDeploy:  12,
		ModuleUnknown: 55,
	}

	for mt, expected := range thresholds {
		actual := CalculateRawSumThreshold(mt)
		if actual != expected {
			t.Errorf("RawSumThreshold(%s) = %v, want %v", mt, actual, expected)
		}
	}
}

// ─────────────────────────────────────────────────────────────────
// Zone Classification Tests
// ─────────────────────────────────────────────────────────────────

func TestGetZoneSafe(t *testing.T) {
	score := TensorScore{RawSumRatio: 0.5}
	zone := GetZone(score)

	if zone != "safe" {
		t.Errorf("GetZone(0.5) = %s, want safe", zone)
	}
}

func TestGetZoneReview(t *testing.T) {
	score := TensorScore{RawSumRatio: 0.8}
	zone := GetZone(score)

	if zone != "review" {
		t.Errorf("GetZone(0.8) = %s, want review", zone)
	}
}

func TestGetZoneViolation(t *testing.T) {
	score := TensorScore{RawSumRatio: 1.5}
	zone := GetZone(score)

	if zone != "violation" {
		t.Errorf("GetZone(1.5) = %s, want violation", zone)
	}
}

func TestIsSafe(t *testing.T) {
	safe := TensorScore{Regularized: 5.0}
	notSafe := TensorScore{Regularized: 9.0}

	if !IsSafe(safe) {
		t.Error("IsSafe(5.0) should be true")
	}
	if IsSafe(notSafe) {
		t.Error("IsSafe(9.0) should be false")
	}
}

func TestNeedsReview(t *testing.T) {
	review := TensorScore{Regularized: 9.0}
	notReview := TensorScore{Regularized: 5.0}

	if !NeedsReview(review) {
		t.Error("NeedsReview(9.0) should be true")
	}
	if NeedsReview(notReview) {
		t.Error("NeedsReview(5.0) should be false")
	}
}

func TestIsViolation(t *testing.T) {
	violation := TensorScore{Regularized: 15.0}
	notViolation := TensorScore{Regularized: 8.0}

	if !IsViolation(violation) {
		t.Error("IsViolation(15.0) should be true")
	}
	if IsViolation(notViolation) {
		t.Error("IsViolation(8.0) should be false")
	}
}
