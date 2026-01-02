// Package types defines core types for semantic-complexity
package types

// ModuleType represents the type of code module
type ModuleType string

const (
	APIExternal ModuleType = "api/external"
	APIInternal ModuleType = "api/internal"
	LibDomain   ModuleType = "lib/domain"
	LibUtil     ModuleType = "lib/util"
	App         ModuleType = "app"
)

// GateType represents the quality gate level
type GateType string

const (
	GatePoC        GateType = "poc"
	GateMVP        GateType = "mvp"
	GateProduction GateType = "production"
)

// Axis represents a complexity dimension
type Axis string

const (
	AxisBread  Axis = "bread"
	AxisCheese Axis = "cheese"
	AxisHam    Axis = "ham"
)

// SimplexCoordinates represents normalized 3-axis coordinates
type SimplexCoordinates struct {
	Bread  float64 `json:"bread"`
	Cheese float64 `json:"cheese"`
	Ham    float64 `json:"ham"`
}

// EquilibriumResult represents equilibrium analysis
type EquilibriumResult struct {
	InEquilibrium bool    `json:"inEquilibrium"`
	Energy        float64 `json:"energy"`
	DominantAxis  *Axis   `json:"dominantAxis,omitempty"`
}

// StateAsyncRetry represents the state×async×retry check
type StateAsyncRetry struct {
	HasState bool     `json:"hasState"`
	HasAsync bool     `json:"hasAsync"`
	HasRetry bool     `json:"hasRetry"`
	Violated bool     `json:"violated"`
	Count    int      `json:"count"`
	Axes     []string `json:"axes"`
}

// CheeseResult represents cognitive accessibility analysis
type CheeseResult struct {
	Accessible         bool            `json:"accessible"`
	Reason             string          `json:"reason"`
	Violations         []string        `json:"violations"`
	MaxNesting         int             `json:"maxNesting"`
	HiddenDependencies int             `json:"hiddenDependencies"`
	StateAsyncRetry    StateAsyncRetry `json:"stateAsyncRetry"`
}

// SecretPattern represents a detected secret pattern
type SecretPattern struct {
	Pattern  string `json:"pattern"`
	Line     int    `json:"line"`
	Severity string `json:"severity"`
}

// HiddenDeps represents hidden dependencies
type HiddenDeps struct {
	Total      int      `json:"total"`
	GlobalVars []string `json:"globalVars"`
	EnvAccess  []string `json:"envAccess"`
	FileIO     []string `json:"fileIO"`
}

// BreadResult represents security analysis
type BreadResult struct {
	TrustBoundaryCount int             `json:"trustBoundaryCount"`
	AuthExplicitness   float64         `json:"authExplicitness"`
	SecretPatterns     []SecretPattern `json:"secretPatterns"`
	HiddenDeps         HiddenDeps      `json:"hiddenDeps"`
	Violations         []string        `json:"violations"`
}

// HamResult represents behavioral preservation analysis
type HamResult struct {
	GoldenTestCoverage float64  `json:"goldenTestCoverage"`
	UnprotectedPaths   []string `json:"unprotectedPaths"`
	TestFilesFound     []string `json:"testFilesFound"`
}

// GateViolation represents a gate check violation
type GateViolation struct {
	Rule      string      `json:"rule"`
	Actual    interface{} `json:"actual"`
	Threshold interface{} `json:"threshold"`
	Message   string      `json:"message"`
}

// GateResult represents gate check result
type GateResult struct {
	Passed        bool            `json:"passed"`
	GateType      GateType        `json:"gateType"`
	Violations    []GateViolation `json:"violations"`
	WaiverApplied bool            `json:"waiverApplied"`
}

// Recommendation represents a refactoring recommendation
type Recommendation struct {
	Axis              Axis               `json:"axis"`
	Priority          int                `json:"priority"`
	Action            string             `json:"action"`
	Reason            string             `json:"reason"`
	ExpectedImpact    map[string]float64 `json:"expectedImpact"`
	TargetEquilibrium bool               `json:"targetEquilibrium"`
}

// DegradationResult represents cognitive degradation check
type DegradationResult struct {
	Degraded         bool     `json:"degraded"`
	Severity         string   `json:"severity"`
	Indicators       []string `json:"indicators"`
	BeforeAccessible bool     `json:"beforeAccessible"`
	AfterAccessible  bool     `json:"afterAccessible"`
	DeltaNesting     int      `json:"deltaNesting"`
	DeltaHiddenDeps  int      `json:"deltaHiddenDeps"`
	DeltaViolations  int      `json:"deltaViolations"`
}

// BudgetViolation represents a budget check violation
type BudgetViolation struct {
	Dimension string  `json:"dimension"`
	Allowed   float64 `json:"allowed"`
	Actual    float64 `json:"actual"`
	Excess    float64 `json:"excess"`
	Message   string  `json:"message"`
}

// BudgetResult represents budget check result
type BudgetResult struct {
	Passed     bool              `json:"passed"`
	ModuleType ModuleType        `json:"moduleType"`
	Violations []BudgetViolation `json:"violations"`
	Delta      Delta             `json:"delta"`
}

// Delta represents change delta between versions
type Delta struct {
	Cognitive        int  `json:"cognitive"`
	StateTransitions int  `json:"stateTransitions"`
	PublicAPI        int  `json:"publicAPI"`
	BreakingChanges  bool `json:"breakingChanges"`
}

// LabelResult represents module labeling result
type LabelResult struct {
	Label      string  `json:"label"`
	Confidence float64 `json:"confidence"`
}
