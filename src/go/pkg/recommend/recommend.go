// Package recommend implements refactoring recommendations
package recommend

import (
	"math"

	"github.com/yscha88/semantic-complexity/pkg/types"
)

// Action represents a refactoring action
type Action struct {
	Name   string
	Reason string
}

var breadActions = map[string][]Action{
	"increase": {
		{"Add explicit trust boundary", "Define trust boundary in code explicitly"},
		{"Apply auth decorators", "Add @Auth decorators to endpoints"},
	},
	"decrease": {
		{"Separate security logic", "Extract security logic from business logic"},
	},
}

var cheeseActions = map[string][]Action{
	"increase": {
		{"Add proper error handling", "Add exception handling for edge cases"},
	},
	"decrease": {
		{"Flatten nesting (early return)", "Use early return to reduce nesting depth"},
		{"Extract function", "Extract complex blocks to separate functions"},
		{"Simplify conditions", "Extract complex conditions to named variables"},
		{"Separate state logic", "Split state×async×retry into separate concerns"},
	},
}

var hamActions = map[string][]Action{
	"increase": {
		{"Add golden tests", "Write golden tests for critical paths"},
		{"Add contract tests", "Write API contract tests"},
	},
	"decrease": {
		{"Remove duplicate tests", "Clean up unnecessary test duplication"},
	},
}

// SuggestRefactor generates refactoring recommendations
func SuggestRefactor(
	simplex types.SimplexCoordinates,
	equilibrium types.EquilibriumResult,
	cheese *types.CheeseResult,
	maxRecommendations int,
) []types.Recommendation {
	var recommendations []types.Recommendation

	// If in equilibrium, no recommendations needed
	if equilibrium.InEquilibrium {
		return recommendations
	}

	// state×async×retry violation is highest priority
	if cheese != nil && cheese.StateAsyncRetry.Violated {
		recommendations = append(recommendations, types.Recommendation{
			Axis:              types.AxisCheese,
			Priority:          0,
			Action:            "Separate state×async×retry",
			Reason:            "Cognitive invariant violation - must be separated",
			ExpectedImpact:    map[string]float64{"cheese": -20},
			TargetEquilibrium: true,
		})
	}

	// Generate recommendations based on dominant axis
	ideal := 1.0 / 3.0

	type deviation struct {
		axis      types.Axis
		dev       float64
		direction string
	}

	deviations := []deviation{
		{types.AxisBread, simplex.Bread - ideal, directionFor(simplex.Bread, ideal)},
		{types.AxisCheese, simplex.Cheese - ideal, directionFor(simplex.Cheese, ideal)},
		{types.AxisHam, simplex.Ham - ideal, directionFor(simplex.Ham, ideal)},
	}

	// Sort by absolute deviation (largest first)
	for i := 0; i < len(deviations); i++ {
		for j := i + 1; j < len(deviations); j++ {
			if math.Abs(deviations[j].dev) > math.Abs(deviations[i].dev) {
				deviations[i], deviations[j] = deviations[j], deviations[i]
			}
		}
	}

	priority := len(recommendations) + 1
	for _, d := range deviations {
		if len(recommendations) >= maxRecommendations {
			break
		}
		if math.Abs(d.dev) < 0.1 {
			continue
		}

		actions := getActionsFor(d.axis, d.direction)
		if len(actions) > 0 {
			action := actions[0]
			impactValue := math.Abs(d.dev) * 100
			if d.direction == "decrease" {
				impactValue = -impactValue
			}

			recommendations = append(recommendations, types.Recommendation{
				Axis:              d.axis,
				Priority:          priority,
				Action:            action.Name,
				Reason:            action.Reason,
				ExpectedImpact:    map[string]float64{string(d.axis): impactValue},
				TargetEquilibrium: true,
			})
			priority++
		}
	}

	return recommendations
}

func directionFor(value, ideal float64) string {
	if value > ideal {
		return "decrease"
	}
	return "increase"
}

func getActionsFor(axis types.Axis, direction string) []Action {
	switch axis {
	case types.AxisBread:
		return breadActions[direction]
	case types.AxisCheese:
		return cheeseActions[direction]
	case types.AxisHam:
		return hamActions[direction]
	}
	return nil
}
