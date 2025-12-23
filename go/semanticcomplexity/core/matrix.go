package core

// DefaultMatrix is the default interaction matrix.
var DefaultMatrix = Matrix5x5{
	//  C     N     S     A     Λ
	{1.0, 0.3, 0.2, 0.2, 0.3}, // Control
	{0.3, 1.0, 0.4, 0.8, 0.2}, // Nesting × Async ↑
	{0.2, 0.4, 1.0, 0.5, 0.9}, // State × Coupling ↑↑
	{0.2, 0.8, 0.5, 1.0, 0.4}, // Async × Nesting ↑
	{0.3, 0.2, 0.9, 0.4, 1.0}, // Coupling × State ↑↑
}

// ModuleMatrices contains module-type specific interaction matrices.
var ModuleMatrices = map[ModuleType]Matrix5x5{
	ModuleAPI: {
		// API: Coupling interactions are critical
		{1.0, 0.2, 0.3, 0.2, 0.4},
		{0.2, 1.0, 0.3, 0.6, 0.2},
		{0.3, 0.3, 1.0, 0.4, 1.5}, // State × Coupling ↑↑↑
		{0.2, 0.6, 0.4, 1.0, 0.5},
		{0.4, 0.2, 1.5, 0.5, 1.0}, // Coupling × State ↑↑↑
	},
	ModuleLib: {
		// LIB: Control/Nesting interactions are important
		{1.0, 1.2, 0.2, 0.2, 0.2}, // Control × Nesting ↑
		{1.2, 1.0, 0.3, 0.5, 0.2}, // Nesting × Control ↑
		{0.2, 0.3, 1.0, 0.3, 0.6},
		{0.2, 0.5, 0.3, 1.0, 0.3},
		{0.2, 0.2, 0.6, 0.3, 1.0},
	},
	ModuleApp: {
		// APP: State/Async interactions are critical
		{1.0, 0.3, 0.3, 0.3, 0.3},
		{0.3, 1.0, 0.5, 0.9, 0.2}, // Nesting × Async ↑
		{0.3, 0.5, 1.0, 1.3, 0.7}, // State × Async ↑↑
		{0.3, 0.9, 1.3, 1.0, 0.4}, // Async × State ↑↑
		{0.3, 0.2, 0.7, 0.4, 1.0},
	},
	ModuleWeb: {
		// WEB: Nesting is most important (component hierarchy)
		{1.0, 0.5, 0.2, 0.4, 0.2},
		{0.5, 1.5, 0.3, 0.6, 0.2}, // Nesting self-weight ↑
		{0.2, 0.3, 1.0, 0.3, 0.5},
		{0.4, 0.6, 0.3, 1.0, 0.3},
		{0.2, 0.2, 0.5, 0.3, 1.0},
	},
	ModuleData: {
		// DATA: State is most important (entity definitions)
		{1.0, 0.2, 0.3, 0.1, 0.4},
		{0.2, 1.0, 0.2, 0.1, 0.2},
		{0.3, 0.2, 1.5, 0.2, 0.8}, // State self-weight ↑
		{0.1, 0.1, 0.2, 1.0, 0.2},
		{0.4, 0.2, 0.8, 0.2, 1.0}, // Coupling × State ↑
	},
	ModuleInfra: {
		// INFRA: Async and Coupling are critical (DB/IO)
		{1.0, 0.2, 0.2, 0.3, 0.4},
		{0.2, 1.0, 0.2, 0.3, 0.2},
		{0.2, 0.2, 1.0, 0.4, 0.6},
		{0.3, 0.3, 0.4, 1.5, 0.8}, // Async self-weight ↑
		{0.4, 0.2, 0.6, 0.8, 1.5}, // Coupling self-weight ↑
	},
	ModuleDeploy: {
		// DEPLOY: All interactions should be minimal
		{1.0, 0.1, 0.1, 0.1, 0.2},
		{0.1, 1.0, 0.1, 0.1, 0.1},
		{0.1, 0.1, 1.0, 0.1, 0.3},
		{0.1, 0.1, 0.1, 1.0, 0.2},
		{0.2, 0.1, 0.3, 0.2, 1.0},
	},
	ModuleUnknown: DefaultMatrix,
}

// GetInteractionMatrix returns the interaction matrix for a module type.
func GetInteractionMatrix(moduleType ModuleType) Matrix5x5 {
	if m, ok := ModuleMatrices[moduleType]; ok {
		return m
	}
	return DefaultMatrix
}

// IsPositiveSemidefinite checks if matrix is positive semi-definite using diagonal dominance.
func IsPositiveSemidefinite(m Matrix5x5) bool {
	for i := 0; i < 5; i++ {
		rowSum := 0.0
		for j := 0; j < 5; j++ {
			if i != j {
				if m[i][j] < 0 {
					rowSum -= m[i][j]
				} else {
					rowSum += m[i][j]
				}
			}
		}
		if m[i][i] < rowSum {
			return false
		}
	}
	return true
}
