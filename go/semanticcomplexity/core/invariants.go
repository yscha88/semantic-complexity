// Package core provides invariant checks for code complexity analysis.
//
// Cognitive: state x async x retry coexistence detection
// Security: Secret pattern detection, locked zone warning
package core

import (
	"fmt"
	"regexp"
	"strings"
)

// -------------------------------------------------------------------------
// Cognitive Invariant: state x async x retry coexistence forbidden
// -------------------------------------------------------------------------

// CognitiveViolation represents the result of cognitive invariant check.
type CognitiveViolation struct {
	HasState  bool   `json:"hasState"`
	HasAsync  bool   `json:"hasAsync"`
	HasRetry  bool   `json:"hasRetry"`
	Violation bool   `json:"violation"`
	Message   string `json:"message"`
}

// CheckCognitiveInvariant checks for state x async x retry coexistence.
// These three coexisting in the same function indicates cognitive collapse risk.
func CheckCognitiveInvariant(
	stateMutations int,
	stateMachinePatterns int,
	asyncBoundaries int,
	promiseChains int,
	retryPatterns int,
) CognitiveViolation {
	hasState := stateMutations > 0 || stateMachinePatterns > 0
	hasAsync := asyncBoundaries > 0 || promiseChains > 0
	hasRetry := retryPatterns > 0

	// Violation if all three exist
	violation := hasState && hasAsync && hasRetry

	// Count how many axes are present
	count := 0
	if hasState {
		count++
	}
	if hasAsync {
		count++
	}
	if hasRetry {
		count++
	}

	var message string
	if violation {
		message = "VIOLATION: state x async x retry coexistence. Function split required."
	} else if count == 2 {
		message = "WARNING: 2 axes coexist. Complexity concern."
	}

	return CognitiveViolation{
		HasState:  hasState,
		HasAsync:  hasAsync,
		HasRetry:  hasRetry,
		Violation: violation,
		Message:   message,
	}
}

// -------------------------------------------------------------------------
// Security: Secret pattern detection
// -------------------------------------------------------------------------

// SecretViolation represents a detected secret pattern.
type SecretViolation struct {
	Pattern  string `json:"pattern"`
	Match    string `json:"match"`
	Line     int    `json:"line"`
	Severity string `json:"severity"` // "warning" or "error"
	Message  string `json:"message"`
}

type secretPattern struct {
	regex    *regexp.Regexp
	name     string
	severity string
}

var secretPatterns = []secretPattern{
	// API Keys
	{regexp.MustCompile(`(?i)['"\x60](?:api[_-]?key|apikey)['"\x60]\s*[=:]\s*['"\x60][^'"\x60]{10,}['"\x60]`), "API_KEY", "error"},
	{regexp.MustCompile(`(?i)['"\x60](?:secret|password|passwd|pwd)['"\x60]\s*[=:]\s*['"\x60][^'"\x60]{6,}['"\x60]`), "SECRET", "error"},
	// Bearer tokens
	{regexp.MustCompile(`Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+`), "BEARER_TOKEN", "error"},
	// AWS
	{regexp.MustCompile(`AKIA[0-9A-Z]{16}`), "AWS_ACCESS_KEY", "error"},
	{regexp.MustCompile(`(?i)aws[_-]?secret[_-]?access[_-]?key`), "AWS_SECRET_KEY", "error"},
	// Private keys
	{regexp.MustCompile(`-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----`), "PRIVATE_KEY", "error"},
	// Connection strings
	{regexp.MustCompile(`(?i)(?:mongodb|postgres|mysql|redis)://[^@]+:[^@]+@`), "DB_CONNECTION_STRING", "error"},
	// Environment variable access (warning) - Go style
	{regexp.MustCompile(`os\.Getenv\(['"]\w+['"]\)`), "ENV_ACCESS", "warning"},
}

// DetectSecrets detects secret patterns in code.
func DetectSecrets(code string) []SecretViolation {
	var violations []SecretViolation

	for _, sp := range secretPatterns {
		matches := sp.regex.FindAllStringIndex(code, -1)
		for _, match := range matches {
			// Find line number
			beforeMatch := code[:match[0]]
			line := strings.Count(beforeMatch, "\n") + 1

			// Get matched text and mask it
			matchedText := code[match[0]:match[1]]
			var masked string
			if len(matchedText) > 20 {
				masked = matchedText[:10] + "..." + matchedText[len(matchedText)-5:]
			} else {
				masked = matchedText
			}

			var message string
			if sp.severity == "error" {
				message = fmt.Sprintf("ERROR: %s detected at line %d. Remove before commit.", sp.name, line)
			} else {
				message = fmt.Sprintf("WARNING: %s at line %d. Consider using secrets manager.", sp.name, line)
			}

			violations = append(violations, SecretViolation{
				Pattern:  sp.name,
				Match:    masked,
				Line:     line,
				Severity: sp.severity,
				Message:  message,
			})
		}
	}

	return violations
}

// -------------------------------------------------------------------------
// Security: LLM locked zone detection
// -------------------------------------------------------------------------

// LockedZoneWarning represents a locked zone warning.
type LockedZoneWarning struct {
	Zone    string `json:"zone"`
	Matched string `json:"matched"`
	Message string `json:"message"`
}

type lockedZonePattern struct {
	regex *regexp.Regexp
	zone  string
}

var lockedZonePatterns = []lockedZonePattern{
	// Auth/Authz
	{regexp.MustCompile(`(?i)\bauth(?:entication|orization|enticate|orize)?\b`), "auth"},
	{regexp.MustCompile(`(?i)\blogin\b|\blogout\b|\bsignin\b|\bsignout\b`), "auth"},
	{regexp.MustCompile(`(?i)\brbac\b|\bacl\b|\bpermission`), "auth"},
	// Crypto
	{regexp.MustCompile(`(?i)\bcrypto\b|\bencrypt\b|\bdecrypt\b|\bhash\b`), "crypto"},
	{regexp.MustCompile(`(?i)\bsign(?:ature)?\b|\bverify\b`), "crypto"},
	{regexp.MustCompile(`(?i)\bcipher\b|\baes\b|\brsa\b`), "crypto"},
	// Patient/Medical data (HIPAA)
	{regexp.MustCompile(`(?i)\bpatient\b|\bmedical\b|\bhealth\b`), "patient-data"},
	{regexp.MustCompile(`(?i)\bphi\b|\bhipaa\b`), "patient-data"},
	// Deployment/Infrastructure
	{regexp.MustCompile(`(?i)\bdeploy\b|\binfra(?:structure)?\b`), "deploy"},
	{regexp.MustCompile(`(?i)\bkubernetes\b|\bk8s\b|\bhelm\b`), "deploy"},
	{regexp.MustCompile(`(?i)\btls\b|\bssl\b|\bcert(?:ificate)?\b`), "deploy"},
	{regexp.MustCompile(`(?i)\bnetwork\s?policy\b`), "deploy"},
}

// CheckLockedZone checks if file/function is in an LLM locked zone.
func CheckLockedZone(filePath string, functionName string) *LockedZoneWarning {
	target := filePath + " " + functionName

	for _, lzp := range lockedZonePatterns {
		match := lzp.regex.FindString(target)
		if match != "" {
			return &LockedZoneWarning{
				Zone:    lzp.zone,
				Matched: match,
				Message: fmt.Sprintf("LOCKED ZONE: %s. LLM modification forbidden. Human approval required.", lzp.zone),
			}
		}
	}

	return nil
}

// -------------------------------------------------------------------------
// Combined check
// -------------------------------------------------------------------------

// InvariantCheckResult represents the result of all invariant checks.
type InvariantCheckResult struct {
	Cognitive  CognitiveViolation  `json:"cognitive"`
	Secrets    []SecretViolation   `json:"secrets"`
	LockedZone *LockedZoneWarning  `json:"lockedZone,omitempty"`
	Passed     bool                `json:"passed"`
	Summary    string              `json:"summary"`
}

// CheckAllInvariants performs all invariant checks.
func CheckAllInvariants(
	code string,
	filePath string,
	functionName string,
	stateMutations int,
	stateMachinePatterns int,
	asyncBoundaries int,
	promiseChains int,
	retryPatterns int,
) InvariantCheckResult {
	cognitive := CheckCognitiveInvariant(
		stateMutations,
		stateMachinePatterns,
		asyncBoundaries,
		promiseChains,
		retryPatterns,
	)
	secrets := DetectSecrets(code)
	lockedZone := CheckLockedZone(filePath, functionName)

	hasError := cognitive.Violation
	for _, s := range secrets {
		if s.Severity == "error" {
			hasError = true
			break
		}
	}
	if lockedZone != nil {
		hasError = true
	}

	passed := !hasError

	var issues []string
	if cognitive.Violation {
		issues = append(issues, "Cognitive violation")
	}
	if len(secrets) > 0 {
		issues = append(issues, fmt.Sprintf("%d secret(s)", len(secrets)))
	}
	if lockedZone != nil {
		issues = append(issues, fmt.Sprintf("Locked zone: %s", lockedZone.Zone))
	}

	var summary string
	if passed {
		summary = "All invariants passed"
	} else {
		summary = "Issues: " + strings.Join(issues, ", ")
	}

	return InvariantCheckResult{
		Cognitive:  cognitive,
		Secrets:    secrets,
		LockedZone: lockedZone,
		Passed:     passed,
		Summary:    summary,
	}
}
