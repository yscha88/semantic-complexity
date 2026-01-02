// Package gate implements quality gate checks for PoC/MVP/Production
package gate

import (
	"fmt"

	"github.com/yscha88/semantic-complexity/src/go/pkg/types"
)

// BaseThresholds defines MVP baseline thresholds
type Thresholds struct {
	NestingMax          int
	ConceptsPerFunction int
	HiddenDepMax        int
	GoldenTestMin       float64
}

// GetThresholds returns thresholds for a specific gate type
func GetThresholds(gateType types.GateType) Thresholds {
	base := Thresholds{
		NestingMax:          4,
		ConceptsPerFunction: 9,
		HiddenDepMax:        2,
		GoldenTestMin:       0.8,
	}

	switch gateType {
	case types.GatePoC:
		base.NestingMax += 2
		base.ConceptsPerFunction += 3
		base.HiddenDepMax += 1
		base.GoldenTestMin -= 0.3
	case types.GateMVP:
		// No adjustments for MVP (baseline)
	case types.GateProduction:
		base.NestingMax -= 1
		base.ConceptsPerFunction -= 2
		base.HiddenDepMax -= 1
		base.GoldenTestMin += 0.15
	}

	return base
}

// GateViolation represents a single gate rule violation
type GateViolation struct {
	Rule      string  `json:"rule"`
	Actual    float64 `json:"actual"`
	Threshold float64 `json:"threshold"`
	Message   string  `json:"message"`
}

// GateResult represents the result of a gate check
type GateResult struct {
	Passed        bool            `json:"passed"`
	GateType      types.GateType  `json:"gateType"`
	Violations    []GateViolation `json:"violations"`
	WaiverApplied bool            `json:"waiverApplied"`
}

// CheckGateOptions contains optional parameters for gate check
type CheckGateOptions struct {
	Source      string
	FilePath    string
	ProjectRoot string
}

// CheckGate checks if code passes the gate
func CheckGate(
	gateType types.GateType,
	cheese types.CheeseResult,
	ham types.HamResult,
	options CheckGateOptions,
) GateResult {
	thresholds := GetThresholds(gateType)
	var violations []GateViolation
	waiverApplied := false

	// Check waiver if source is provided and waiver is allowed for this stage
	waiverAllowed := gateType == types.GateProduction
	if options.Source != "" && waiverAllowed {
		waiver := CheckWaiver(options.Source, options.FilePath, options.ProjectRoot)
		if waiver.Waived {
			waiverApplied = true
			// Apply waiver config overrides
			if waiver.Config != nil {
				if waiver.Config.Nesting != nil {
					thresholds.NestingMax = *waiver.Config.Nesting
				}
				if waiver.Config.ConceptsTotal != nil {
					thresholds.ConceptsPerFunction = *waiver.Config.ConceptsTotal
				}
			}
		}
	}

	// Check nesting
	if cheese.MaxNesting > thresholds.NestingMax {
		violations = append(violations, GateViolation{
			Rule:      "nesting_max",
			Actual:    float64(cheese.MaxNesting),
			Threshold: float64(thresholds.NestingMax),
			Message:   fmt.Sprintf("Nesting depth %d exceeds %d", cheese.MaxNesting, thresholds.NestingMax),
		})
	}

	// Check hidden dependencies
	if cheese.HiddenDependencies > thresholds.HiddenDepMax {
		violations = append(violations, GateViolation{
			Rule:      "hidden_dep_max",
			Actual:    float64(cheese.HiddenDependencies),
			Threshold: float64(thresholds.HiddenDepMax),
			Message:   fmt.Sprintf("Hidden deps %d exceeds %d", cheese.HiddenDependencies, thresholds.HiddenDepMax),
		})
	}

	// Check golden test coverage
	if ham.GoldenTestCoverage < thresholds.GoldenTestMin {
		violations = append(violations, GateViolation{
			Rule:      "golden_test_min",
			Actual:    ham.GoldenTestCoverage,
			Threshold: thresholds.GoldenTestMin,
			Message:   fmt.Sprintf("Test coverage %.1f%% below %.1f%%", ham.GoldenTestCoverage*100, thresholds.GoldenTestMin*100),
		})
	}

	// Check state×async×retry
	if cheese.StateAsyncRetry.Violated {
		violations = append(violations, GateViolation{
			Rule:      "state_async_retry",
			Actual:    float64(cheese.StateAsyncRetry.Count),
			Threshold: 1,
			Message:   fmt.Sprintf("state×async×retry co-occurrence: %v", cheese.StateAsyncRetry.Axes),
		})
	}

	return GateResult{
		Passed:        len(violations) == 0,
		GateType:      gateType,
		Violations:    violations,
		WaiverApplied: waiverApplied,
	}
}
