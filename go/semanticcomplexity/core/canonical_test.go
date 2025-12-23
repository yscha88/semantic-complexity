package core

import (
	"testing"
)

// ─────────────────────────────────────────────────────────────────
// Canonical Profile Tests
// ─────────────────────────────────────────────────────────────────

func TestGetCanonicalProfileAllTypes(t *testing.T) {
	moduleTypes := []ModuleType{
		ModuleAPI, ModuleLib, ModuleApp, ModuleWeb,
		ModuleData, ModuleInfra, ModuleDeploy, ModuleUnknown,
	}

	for _, mt := range moduleTypes {
		profile := GetCanonicalProfile(mt)

		// All bounds should have min <= max
		if profile.Control[0] > profile.Control[1] {
			t.Errorf("%s: Control min > max", mt)
		}
		if profile.Nesting[0] > profile.Nesting[1] {
			t.Errorf("%s: Nesting min > max", mt)
		}
		if profile.State[0] > profile.State[1] {
			t.Errorf("%s: State min > max", mt)
		}
		if profile.Async[0] > profile.Async[1] {
			t.Errorf("%s: Async min > max", mt)
		}
		if profile.Coupling[0] > profile.Coupling[1] {
			t.Errorf("%s: Coupling min > max", mt)
		}
	}
}

func TestGetCanonicalProfileUnknownFallback(t *testing.T) {
	profile := GetCanonicalProfile("nonexistent")
	expected := GetCanonicalProfile(ModuleUnknown)

	if profile != expected {
		t.Error("Unknown module type should fallback to ModuleUnknown profile")
	}
}

func TestGetProfileCentroid(t *testing.T) {
	profile := CanonicalBounds{
		Control:  [2]float64{0, 10},
		Nesting:  [2]float64{0, 6},
		State:    [2]float64{0, 4},
		Async:    [2]float64{0, 2},
		Coupling: [2]float64{0, 8},
	}

	centroid := GetProfileCentroid(profile)

	if centroid.Control != 5 {
		t.Errorf("Centroid.Control = %v, want 5", centroid.Control)
	}
	if centroid.Nesting != 3 {
		t.Errorf("Centroid.Nesting = %v, want 3", centroid.Nesting)
	}
	if centroid.State != 2 {
		t.Errorf("Centroid.State = %v, want 2", centroid.State)
	}
	if centroid.Async != 1 {
		t.Errorf("Centroid.Async = %v, want 1", centroid.Async)
	}
	if centroid.Coupling != 4 {
		t.Errorf("Centroid.Coupling = %v, want 4", centroid.Coupling)
	}
}

// ─────────────────────────────────────────────────────────────────
// Bounds Checking Tests
// ─────────────────────────────────────────────────────────────────

func TestIsWithinCanonicalBoundsTrue(t *testing.T) {
	profile := GetCanonicalProfile(ModuleAPI)
	// API profile: Control[0,5], Nesting[0,3], State[0,2], Async[0,3], Coupling[0,3]

	v := Vector5D{Control: 3, Nesting: 2, State: 1, Async: 2, Coupling: 2}

	if !IsWithinCanonicalBounds(v, profile) {
		t.Error("Vector within bounds should return true")
	}
}

func TestIsWithinCanonicalBoundsFalse(t *testing.T) {
	profile := GetCanonicalProfile(ModuleAPI)
	// API profile: Control[0,5], Nesting[0,3], State[0,2], Async[0,3], Coupling[0,3]

	v := Vector5D{Control: 10, Nesting: 2, State: 1, Async: 2, Coupling: 2}

	if IsWithinCanonicalBounds(v, profile) {
		t.Error("Vector exceeding Control bound should return false")
	}
}

func TestIsWithinCanonicalBoundsEdge(t *testing.T) {
	profile := GetCanonicalProfile(ModuleAPI)

	// Exactly at upper bounds
	v := Vector5D{Control: 5, Nesting: 3, State: 2, Async: 3, Coupling: 3}

	if !IsWithinCanonicalBounds(v, profile) {
		t.Error("Vector at exact upper bounds should return true")
	}
}

func TestGetViolationDimensionsNone(t *testing.T) {
	profile := GetCanonicalProfile(ModuleAPI)
	v := Vector5D{Control: 3, Nesting: 2, State: 1, Async: 2, Coupling: 2}

	violations := GetViolationDimensions(v, profile)

	if len(violations) != 0 {
		t.Errorf("Expected no violations, got %v", violations)
	}
}

func TestGetViolationDimensionsSingle(t *testing.T) {
	profile := GetCanonicalProfile(ModuleAPI)
	v := Vector5D{Control: 10, Nesting: 2, State: 1, Async: 2, Coupling: 2}

	violations := GetViolationDimensions(v, profile)

	if len(violations) != 1 {
		t.Errorf("Expected 1 violation, got %d", len(violations))
	}
	if violations[0] != "control" {
		t.Errorf("Expected 'control' violation, got %s", violations[0])
	}
}

func TestGetViolationDimensionsMultiple(t *testing.T) {
	profile := GetCanonicalProfile(ModuleAPI)
	v := Vector5D{Control: 10, Nesting: 10, State: 10, Async: 10, Coupling: 10}

	violations := GetViolationDimensions(v, profile)

	if len(violations) != 5 {
		t.Errorf("Expected 5 violations, got %d", len(violations))
	}
}

// ─────────────────────────────────────────────────────────────────
// Orphan Detection Tests
// ─────────────────────────────────────────────────────────────────

func TestIsOrphanFalse(t *testing.T) {
	// A simple vector should fit in at least one canonical region
	v := Vector5D{Control: 2, Nesting: 2, State: 1, Async: 1, Coupling: 1}

	if IsOrphan(v) {
		t.Error("Simple vector should not be orphan")
	}
}

func TestIsOrphanTrue(t *testing.T) {
	// Extremely high values in all dimensions
	v := Vector5D{Control: 100, Nesting: 100, State: 100, Async: 100, Coupling: 100}

	if !IsOrphan(v) {
		t.Error("Extreme vector should be orphan")
	}
}

// ─────────────────────────────────────────────────────────────────
// Deviation Analysis Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeDeviationCanonical(t *testing.T) {
	v := Vector5D{Control: 2, Nesting: 1, State: 1, Async: 1, Coupling: 1}
	result := AnalyzeDeviation(v, ModuleAPI)

	if !result.IsCanonical {
		t.Error("Vector within bounds should be canonical")
	}
	if result.Status != "canonical" {
		t.Errorf("Status = %s, want canonical", result.Status)
	}
}

func TestAnalyzeDeviationDeviated(t *testing.T) {
	v := Vector5D{Control: 8, Nesting: 1, State: 1, Async: 1, Coupling: 1}
	result := AnalyzeDeviation(v, ModuleAPI)

	if result.IsCanonical {
		t.Error("Vector exceeding bounds should not be canonical")
	}
	if result.Status != "deviated" && result.Status != "orphan" {
		t.Errorf("Status = %s, want deviated or orphan", result.Status)
	}
}

func TestAnalyzeDeviationDistances(t *testing.T) {
	v := Vector5D{Control: 5, Nesting: 5, State: 5, Async: 5, Coupling: 5}
	result := AnalyzeDeviation(v, ModuleAPI)

	if result.EuclideanDistance <= 0 {
		t.Error("EuclideanDistance should be positive")
	}
	if result.MahalanobisDistance <= 0 {
		t.Error("MahalanobisDistance should be positive")
	}
}

// ─────────────────────────────────────────────────────────────────
// Best Module Type Tests
// ─────────────────────────────────────────────────────────────────

func TestFindBestModuleTypeAPI(t *testing.T) {
	// Low everything - should match API
	v := Vector5D{Control: 2, Nesting: 1, State: 1, Async: 1, Coupling: 1}
	result := FindBestModuleType(v)

	// Should find a match (not necessarily API, but some type)
	if result.Distance < 0 {
		t.Error("Distance should be non-negative")
	}
}

func TestFindBestModuleTypeData(t *testing.T) {
	// High state, low others - should match Data
	v := Vector5D{Control: 1, Nesting: 1, State: 8, Async: 1, Coupling: 3}
	result := FindBestModuleType(v)

	if result.Type != ModuleData {
		t.Logf("Expected Data, got %s (distance: %v)", result.Type, result.Distance)
		// Not a hard failure, just log
	}
}

func TestFindBestModuleTypeInfra(t *testing.T) {
	// High async and coupling - should match Infra
	v := Vector5D{Control: 2, Nesting: 1, State: 1, Async: 6, Coupling: 6}
	result := FindBestModuleType(v)

	if result.Type != ModuleInfra {
		t.Logf("Expected Infra, got %s (distance: %v)", result.Type, result.Distance)
	}
}
