package core

import "math"

// CanonicalBounds represents the canonical profile bounds for a module type.
type CanonicalBounds struct {
	Control  [2]float64 `json:"control"`  // [min, max]
	Nesting  [2]float64 `json:"nesting"`
	State    [2]float64 `json:"state"`
	Async    [2]float64 `json:"async"`
	Coupling [2]float64 `json:"coupling"`
}

// Canonical5DProfiles contains canonical profiles per module type.
var Canonical5DProfiles = map[ModuleType]CanonicalBounds{
	ModuleAPI: {
		Control:  [2]float64{0, 5},  // low: thin controllers
		Nesting:  [2]float64{0, 3},  // low: flat structure
		State:    [2]float64{0, 2},  // low: stateless preferred
		Async:    [2]float64{0, 3},  // low: simple I/O
		Coupling: [2]float64{0, 3},  // low: explicit deps
	},
	ModuleLib: {
		Control:  [2]float64{0, 10}, // medium: algorithmic complexity ok
		Nesting:  [2]float64{0, 5},  // medium: some depth acceptable
		State:    [2]float64{0, 2},  // low: pure functions preferred
		Async:    [2]float64{0, 2},  // low: sync preferred
		Coupling: [2]float64{0, 2},  // low: minimal deps
	},
	ModuleApp: {
		Control:  [2]float64{0, 10}, // medium: business logic
		Nesting:  [2]float64{0, 5},  // medium: reasonable depth
		State:    [2]float64{0, 8},  // medium: stateful ok
		Async:    [2]float64{0, 8},  // medium: async workflows
		Coupling: [2]float64{0, 5},  // low: controlled deps
	},
	ModuleWeb: {
		Control:  [2]float64{0, 8},  // medium: UI logic
		Nesting:  [2]float64{0, 10}, // higher: component hierarchy
		State:    [2]float64{0, 5},  // medium: UI state
		Async:    [2]float64{0, 5},  // medium: data fetching
		Coupling: [2]float64{0, 3},  // low: component isolation
	},
	ModuleData: {
		Control:  [2]float64{0, 3},  // low: simple getters/setters
		Nesting:  [2]float64{0, 2},  // low: flat structure
		State:    [2]float64{0, 10}, // high: entity field definitions
		Async:    [2]float64{0, 2},  // low: typically sync
		Coupling: [2]float64{0, 5},  // medium: ORM relationships
	},
	ModuleInfra: {
		Control:  [2]float64{0, 5}, // low: simple CRUD
		Nesting:  [2]float64{0, 3}, // low: flat queries
		State:    [2]float64{0, 2}, // low: stateless data access
		Async:    [2]float64{0, 8}, // high: DB I/O
		Coupling: [2]float64{0, 8}, // high: external dependencies
	},
	ModuleDeploy: {
		Control:  [2]float64{0, 3}, // low: simple scripts
		Nesting:  [2]float64{0, 2}, // low: flat
		State:    [2]float64{0, 2}, // low: idempotent
		Async:    [2]float64{0, 2}, // low: sequential
		Coupling: [2]float64{0, 3}, // low: explicit config
	},
	ModuleUnknown: {
		Control:  [2]float64{0, 15}, // permissive
		Nesting:  [2]float64{0, 10},
		State:    [2]float64{0, 10},
		Async:    [2]float64{0, 10},
		Coupling: [2]float64{0, 10},
	},
}

// GetCanonicalProfile returns the canonical profile for a module type.
func GetCanonicalProfile(moduleType ModuleType) CanonicalBounds {
	if profile, ok := Canonical5DProfiles[moduleType]; ok {
		return profile
	}
	return Canonical5DProfiles[ModuleUnknown]
}

// GetProfileCentroid calculates the centroid of a canonical profile.
func GetProfileCentroid(profile CanonicalBounds) Vector5D {
	return Vector5D{
		Control:  (profile.Control[0] + profile.Control[1]) / 2,
		Nesting:  (profile.Nesting[0] + profile.Nesting[1]) / 2,
		State:    (profile.State[0] + profile.State[1]) / 2,
		Async:    (profile.Async[0] + profile.Async[1]) / 2,
		Coupling: (profile.Coupling[0] + profile.Coupling[1]) / 2,
	}
}

// IsWithinCanonicalBounds checks if a vector is within canonical bounds.
func IsWithinCanonicalBounds(v Vector5D, profile CanonicalBounds) bool {
	return v.Control >= profile.Control[0] && v.Control <= profile.Control[1] &&
		v.Nesting >= profile.Nesting[0] && v.Nesting <= profile.Nesting[1] &&
		v.State >= profile.State[0] && v.State <= profile.State[1] &&
		v.Async >= profile.Async[0] && v.Async <= profile.Async[1] &&
		v.Coupling >= profile.Coupling[0] && v.Coupling <= profile.Coupling[1]
}

// GetViolationDimensions returns dimensions that violate canonical bounds.
func GetViolationDimensions(v Vector5D, profile CanonicalBounds) []string {
	var violations []string
	dims := []struct {
		name   string
		value  float64
		bounds [2]float64
	}{
		{"control", v.Control, profile.Control},
		{"nesting", v.Nesting, profile.Nesting},
		{"state", v.State, profile.State},
		{"async", v.Async, profile.Async},
		{"coupling", v.Coupling, profile.Coupling},
	}

	for _, d := range dims {
		if d.value < d.bounds[0] || d.value > d.bounds[1] {
			violations = append(violations, d.name)
		}
	}
	return violations
}

// IsOrphan checks if a vector is outside ALL canonical regions.
func IsOrphan(v Vector5D) bool {
	for moduleType := range Canonical5DProfiles {
		if moduleType == ModuleUnknown {
			continue
		}
		if IsWithinCanonicalBounds(v, Canonical5DProfiles[moduleType]) {
			return false
		}
	}
	return true
}

// DeviationResult represents the deviation from canonical form result.
type DeviationResult struct {
	EuclideanDistance    float64    `json:"euclidean_distance"`
	MahalanobisDistance  float64    `json:"mahalanobis_distance"`
	MaxDimensionDeviation float64   `json:"max_dimension_deviation"`
	NormalizedDeviation  float64    `json:"normalized_deviation"`
	IsCanonical          bool       `json:"is_canonical"`
	IsOrphan             bool       `json:"is_orphan"`
	ModuleType           ModuleType `json:"module_type"`
	Vector               Vector5D   `json:"vector"`
	ViolationDimensions  []string   `json:"violation_dimensions"`
	Status               string     `json:"status"` // canonical | deviated | orphan
}

// AnalyzeDeviation analyzes deviation from canonical form.
func AnalyzeDeviation(v Vector5D, moduleType ModuleType) DeviationResult {
	profile := GetCanonicalProfile(moduleType)
	centroid := GetProfileCentroid(profile)
	matrix := GetInteractionMatrix(moduleType)

	// Calculate distances
	eucDist := EuclideanDistance(v, centroid)
	mahDist := MahalanobisDistance(v, centroid, matrix)

	// Max dimension deviation
	arr := VectorToArray(v)
	centArr := VectorToArray(centroid)
	maxDev := 0.0
	for i := 0; i < 5; i++ {
		dev := math.Abs(arr[i] - centArr[i])
		if dev > maxDev {
			maxDev = dev
		}
	}

	// Normalize to 0-1 scale
	normDev := math.Min(1.0, mahDist/50.0)

	// Check canonical bounds
	withinBounds := IsWithinCanonicalBounds(v, profile)
	violations := GetViolationDimensions(v, profile)
	orphan := IsOrphan(v)

	status := "canonical"
	if !withinBounds {
		if orphan {
			status = "orphan"
		} else {
			status = "deviated"
		}
	}

	return DeviationResult{
		EuclideanDistance:    round(eucDist, 3),
		MahalanobisDistance:  round(mahDist, 3),
		MaxDimensionDeviation: round(maxDev, 3),
		NormalizedDeviation:  round(normDev, 3),
		IsCanonical:          withinBounds,
		IsOrphan:             orphan,
		ModuleType:           moduleType,
		Vector:               v,
		ViolationDimensions:  violations,
		Status:               status,
	}
}

// BestModuleTypeResult represents the best fitting module type result.
type BestModuleTypeResult struct {
	Type     ModuleType `json:"type"`
	Distance float64    `json:"distance"`
}

// FindBestModuleType finds the best fitting module type for a vector.
func FindBestModuleType(v Vector5D) BestModuleTypeResult {
	bestType := ModuleUnknown
	bestDist := math.MaxFloat64

	for moduleType := range Canonical5DProfiles {
		if moduleType == ModuleUnknown {
			continue
		}
		profile := Canonical5DProfiles[moduleType]
		centroid := GetProfileCentroid(profile)
		matrix := GetInteractionMatrix(moduleType)
		dist := MahalanobisDistance(v, centroid, matrix)
		if dist < bestDist {
			bestDist = dist
			bestType = moduleType
		}
	}

	return BestModuleTypeResult{
		Type:     bestType,
		Distance: round(bestDist, 3),
	}
}
