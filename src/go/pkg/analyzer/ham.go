package analyzer

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/yscha88/semantic-complexity/src/go/pkg/types"
)

// AnalyzeHam analyzes behavioral preservation (test coverage) of Go source code
func AnalyzeHam(source string, filePath string) types.HamResult {
	result := types.HamResult{
		GoldenTestCoverage: 0.0,
		UnprotectedPaths:   []string{},
		TestFilesFound:     []string{},
	}

	if filePath == "" {
		return result
	}

	// Find corresponding test file
	dir := filepath.Dir(filePath)
	baseName := filepath.Base(filePath)

	// Go test file naming: foo.go -> foo_test.go
	if strings.HasSuffix(baseName, ".go") && !strings.HasSuffix(baseName, "_test.go") {
		testFileName := strings.TrimSuffix(baseName, ".go") + "_test.go"
		testFilePath := filepath.Join(dir, testFileName)

		if _, err := os.Stat(testFilePath); err == nil {
			result.TestFilesFound = append(result.TestFilesFound, testFilePath)
			result.GoldenTestCoverage = 0.8 // Basic coverage assumption
		}
	}

	// Check for *_test.go files in the same directory
	entries, err := os.ReadDir(dir)
	if err == nil {
		for _, entry := range entries {
			if strings.HasSuffix(entry.Name(), "_test.go") {
				testPath := filepath.Join(dir, entry.Name())
				found := false
				for _, existing := range result.TestFilesFound {
					if existing == testPath {
						found = true
						break
					}
				}
				if !found {
					result.TestFilesFound = append(result.TestFilesFound, testPath)
				}
			}
		}
	}

	// Calculate coverage based on test files found
	if len(result.TestFilesFound) > 0 {
		result.GoldenTestCoverage = 0.8
	}

	return result
}
