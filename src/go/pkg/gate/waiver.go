// Package gate implements quality gate checks with waiver support
package gate

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ExternalWaiverEntry represents an entry in .waiver.json
type ExternalWaiverEntry struct {
	Pattern       string  `json:"pattern"`
	ADR           string  `json:"adr"`
	Justification *string `json:"justification,omitempty"`
	ApprovedAt    *string `json:"approved_at,omitempty"`
	ExpiresAt     *string `json:"expires_at,omitempty"`
	Approver      *string `json:"approver,omitempty"`
}

// WaiverFile represents the .waiver.json file structure
type WaiverFile struct {
	Schema  string                `json:"$schema,omitempty"`
	Version string                `json:"version"`
	Waivers []ExternalWaiverEntry `json:"waivers"`
}

// EssentialComplexityConfig represents inline waiver configuration
type EssentialComplexityConfig struct {
	ADR           string `json:"adr"`
	Nesting       *int   `json:"nesting,omitempty"`
	ConceptsTotal *int   `json:"concepts_total,omitempty"`
}

// WaiverResult represents the result of waiver check
type WaiverResult struct {
	Waived         bool                       `json:"waived"`
	Reason         string                     `json:"reason,omitempty"`
	ADRPath        string                     `json:"adr_path,omitempty"`
	Config         *EssentialComplexityConfig `json:"config,omitempty"`
	ExternalWaiver *ExternalWaiverEntry       `json:"external_waiver,omitempty"`
}

// ============================================================
// Layer 1: External .waiver.json parsing
// ============================================================

// ParseWaiverFile parses a .waiver.json file
func ParseWaiverFile(waiverPath string) (*WaiverFile, error) {
	data, err := os.ReadFile(waiverPath)
	if err != nil {
		return nil, err
	}

	var wf WaiverFile
	if err := json.Unmarshal(data, &wf); err != nil {
		return nil, err
	}

	if wf.Version == "" || wf.Waivers == nil {
		return nil, nil
	}

	return &wf, nil
}

// ============================================================
// Layer 2: .waiver.json file discovery
// ============================================================

// FindWaiverFile finds .waiver.json from filePath upward to projectRoot
func FindWaiverFile(filePath, projectRoot string) string {
	currentDir := filepath.Dir(filePath)

	for strings.HasPrefix(currentDir, projectRoot) || currentDir == projectRoot {
		waiverPath := filepath.Join(currentDir, ".waiver.json")
		if _, err := os.Stat(waiverPath); err == nil {
			return waiverPath
		}

		parentDir := filepath.Dir(currentDir)
		if parentDir == currentDir {
			break
		}
		currentDir = parentDir
	}

	return ""
}

// ============================================================
// Layer 3: File pattern matching
// ============================================================

// MatchFilePattern checks if filePath matches the glob pattern
func MatchFilePattern(filePath, pattern string) bool {
	// Normalize paths (convert backslash to forward slash)
	normalizedPath := strings.ReplaceAll(filePath, "\\", "/")
	normalizedPattern := strings.ReplaceAll(pattern, "\\", "/")

	// Use filepath.Match for basic glob matching
	matched, _ := filepath.Match(normalizedPattern, normalizedPath)
	if matched {
		return true
	}

	// Handle ** pattern (match any depth)
	if strings.Contains(normalizedPattern, "**") {
		regexPattern := strings.ReplaceAll(normalizedPattern, ".", "\\.")
		regexPattern = strings.ReplaceAll(regexPattern, "**", ".*")
		regexPattern = strings.ReplaceAll(regexPattern, "*", "[^/]*")
		// Simple string matching for now
		if strings.HasSuffix(normalizedPattern, "*.go") {
			basePart := strings.TrimSuffix(normalizedPattern, "*.go")
			basePart = strings.TrimSuffix(basePart, "/")
			return strings.HasPrefix(normalizedPath, basePart) && strings.HasSuffix(normalizedPath, ".go")
		}
	}

	return false
}

// ============================================================
// Layer 4: External waiver expiry check
// ============================================================

// IsWaiverExpired checks if a waiver entry has expired
func IsWaiverExpired(entry *ExternalWaiverEntry) bool {
	if entry.ExpiresAt == nil || *entry.ExpiresAt == "" {
		return false // No expiry = permanent
	}

	expiryDate, err := time.Parse("2006-01-02", *entry.ExpiresAt)
	if err != nil {
		return false // Parse error = not expired
	}

	return time.Now().After(expiryDate)
}

// ============================================================
// Layer 5: External waiver check
// ============================================================

// CheckExternalWaiver checks for external waiver matching the file
func CheckExternalWaiver(filePath, projectRoot string) WaiverResult {
	waiverFilePath := FindWaiverFile(filePath, projectRoot)
	if waiverFilePath == "" {
		return WaiverResult{Waived: false, Reason: ".waiver.json 파일 없음"}
	}

	waiverFile, err := ParseWaiverFile(waiverFilePath)
	if err != nil || waiverFile == nil {
		return WaiverResult{Waived: false, Reason: ".waiver.json 파싱 실패"}
	}

	// Get relative path for pattern matching
	relativePath, _ := filepath.Rel(projectRoot, filePath)
	relativePath = strings.ReplaceAll(relativePath, "\\", "/")

	for _, entry := range waiverFile.Waivers {
		if MatchFilePattern(relativePath, entry.Pattern) {
			if IsWaiverExpired(&entry) {
				return WaiverResult{
					Waived:         false,
					Reason:         "waiver 만료됨: " + *entry.ExpiresAt,
					ADRPath:        entry.ADR,
					ExternalWaiver: &entry,
				}
			}

			justification := ""
			if entry.Justification != nil {
				justification = *entry.Justification
			}

			return WaiverResult{
				Waived:         true,
				Reason:         justification,
				ADRPath:        entry.ADR,
				ExternalWaiver: &entry,
			}
		}
	}

	return WaiverResult{Waived: false, Reason: "매칭되는 waiver 패턴 없음"}
}

// ============================================================
// Inline __essential_complexity__ parsing (Go-specific)
// ============================================================

// ParseEssentialComplexity parses __essential_complexity__ from Go source
func ParseEssentialComplexity(source string) *EssentialComplexityConfig {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "", source, parser.ParseComments)
	if err != nil {
		return nil
	}

	// Look for var __essential_complexity__ = ...
	for _, decl := range f.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.VAR {
			continue
		}

		for _, spec := range genDecl.Specs {
			valueSpec, ok := spec.(*ast.ValueSpec)
			if !ok {
				continue
			}

			for i, name := range valueSpec.Names {
				if name.Name == "__essential_complexity__" && i < len(valueSpec.Values) {
					// Found it, try to parse the value
					return parseComplexityValue(valueSpec.Values[i])
				}
			}
		}
	}

	return nil
}

func parseComplexityValue(expr ast.Expr) *EssentialComplexityConfig {
	// For now, return nil - full implementation would parse composite literals
	// This is a placeholder for Go-specific parsing
	return nil
}

// ============================================================
// Layer 6: Unified waiver check (external first, inline fallback)
// ============================================================

// CheckWaiver checks both external and inline waivers
func CheckWaiver(source, filePath, projectRoot string) WaiverResult {
	// 1. Check external waiver first (higher priority)
	if filePath != "" && projectRoot != "" {
		externalResult := CheckExternalWaiver(filePath, projectRoot)
		if externalResult.Waived || externalResult.ExternalWaiver != nil {
			return externalResult
		}
	}

	// 2. Check inline waiver (fallback)
	config := ParseEssentialComplexity(source)
	if config == nil {
		return WaiverResult{Waived: false, Reason: "__essential_complexity__ 없음"}
	}

	if config.ADR == "" {
		return WaiverResult{Waived: false, Reason: "ADR 경로 없음", Config: config}
	}

	// Check ADR file exists
	var adrFullPath string
	if projectRoot != "" {
		adrFullPath = filepath.Join(projectRoot, config.ADR)
	} else if filePath != "" {
		adrFullPath = filepath.Join(filepath.Dir(filePath), config.ADR)
	} else {
		adrFullPath = config.ADR
	}

	if _, err := os.Stat(adrFullPath); os.IsNotExist(err) {
		return WaiverResult{
			Waived:  false,
			Reason:  "ADR 파일 없음: " + config.ADR,
			ADRPath: config.ADR,
			Config:  config,
		}
	}

	// Check ADR content length
	content, err := os.ReadFile(adrFullPath)
	if err != nil {
		return WaiverResult{
			Waived:  false,
			Reason:  "ADR 파일 읽기 실패: " + config.ADR,
			ADRPath: config.ADR,
			Config:  config,
		}
	}

	if len(strings.TrimSpace(string(content))) < 50 {
		return WaiverResult{
			Waived:  false,
			Reason:  "ADR 파일이 너무 짧음 (< 50자)",
			ADRPath: config.ADR,
			Config:  config,
		}
	}

	return WaiverResult{
		Waived:  true,
		ADRPath: config.ADR,
		Config:  config,
	}
}
