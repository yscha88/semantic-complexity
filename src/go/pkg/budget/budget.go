// Package budget implements change budget tracking
package budget

import (
	"github.com/yscha88/semantic-complexity/pkg/types"
)

// ChangeBudget defines allowed changes per module type
type ChangeBudget struct {
	DeltaCognitive  int
	DeltaState      int
	DeltaPublicAPI  int
	BreakingAllowed bool
}

// ModuleBudgets defines budgets for each module type
var ModuleBudgets = map[types.ModuleType]ChangeBudget{
	types.APIExternal: {DeltaCognitive: 3, DeltaState: 1, DeltaPublicAPI: 2, BreakingAllowed: false},
	types.APIInternal: {DeltaCognitive: 5, DeltaState: 2, DeltaPublicAPI: 3, BreakingAllowed: true},
	types.LibDomain:   {DeltaCognitive: 5, DeltaState: 2, DeltaPublicAPI: 5, BreakingAllowed: true},
	types.LibUtil:     {DeltaCognitive: 8, DeltaState: 3, DeltaPublicAPI: 3, BreakingAllowed: true},
	types.App:         {DeltaCognitive: 8, DeltaState: 3, DeltaPublicAPI: 999, BreakingAllowed: true},
}

// CalculateDelta calculates the delta between two cheese results
func CalculateDelta(before, after types.CheeseResult) types.Delta {
	beforeScore := cognitiveScore(before)
	afterScore := cognitiveScore(after)

	return types.Delta{
		Cognitive:        afterScore - beforeScore,
		StateTransitions: 0, // TODO: full implementation
		PublicAPI:        0, // TODO: full implementation
		BreakingChanges:  false,
	}
}

func cognitiveScore(result types.CheeseResult) int {
	if result.Accessible {
		return 0
	}
	score := result.MaxNesting * 2
	score += result.HiddenDependencies
	if result.StateAsyncRetry.Violated {
		score += 10
	}
	return score
}

// CheckBudget checks if changes are within budget
func CheckBudget(moduleType types.ModuleType, delta types.Delta) types.BudgetResult {
	budget, ok := ModuleBudgets[moduleType]
	if !ok {
		budget = ModuleBudgets[types.App]
	}

	var violations []types.BudgetViolation

	// ΔCognitive check
	if delta.Cognitive > budget.DeltaCognitive {
		violations = append(violations, types.BudgetViolation{
			Dimension: "ΔCognitive",
			Allowed:   float64(budget.DeltaCognitive),
			Actual:    float64(delta.Cognitive),
			Excess:    float64(delta.Cognitive - budget.DeltaCognitive),
			Message:   "ΔCognitive exceeds budget",
		})
	}

	// ΔState check
	if delta.StateTransitions > budget.DeltaState {
		violations = append(violations, types.BudgetViolation{
			Dimension: "ΔState",
			Allowed:   float64(budget.DeltaState),
			Actual:    float64(delta.StateTransitions),
			Excess:    float64(delta.StateTransitions - budget.DeltaState),
			Message:   "ΔState exceeds budget",
		})
	}

	// Breaking changes check
	if delta.BreakingChanges && !budget.BreakingAllowed {
		violations = append(violations, types.BudgetViolation{
			Dimension: "BreakingChanges",
			Allowed:   0,
			Actual:    1,
			Excess:    1,
			Message:   "Breaking changes not allowed",
		})
	}

	return types.BudgetResult{
		Passed:     len(violations) == 0,
		ModuleType: moduleType,
		Violations: violations,
		Delta:      delta,
	}
}
