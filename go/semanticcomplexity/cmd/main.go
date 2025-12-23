// Package main provides the CLI for go-complexity.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/yscha88/semantic-complexity/go/semanticcomplexity/core"
)

const version = "0.0.7"

func main() {
	showVersion := flag.Bool("version", false, "Show version")
	showHelp := flag.Bool("help", false, "Show help")
	functionName := flag.String("function", "", "Analyze specific function only")

	flag.Parse()

	if *showVersion {
		fmt.Printf("go-complexity %s\n", version)
		os.Exit(0)
	}

	if *showHelp || flag.NArg() == 0 {
		printHelp()
		os.Exit(0)
	}

	filePath := flag.Arg(0)

	// Verify file exists and is .go file
	if ext := filepath.Ext(filePath); ext != ".go" {
		fmt.Fprintf(os.Stderr, `{"error": "Not a Go file: %s"}`+"\n", filePath)
		os.Exit(1)
	}

	results, err := core.AnalyzeFile(filePath)
	if err != nil {
		errJSON, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintln(os.Stderr, string(errJSON))
		os.Exit(1)
	}

	// Filter by function name if specified
	if *functionName != "" {
		var filtered []core.FunctionResult
		for _, r := range results {
			if r.Name == *functionName {
				filtered = append(filtered, r)
				break
			}
		}
		if len(filtered) == 0 {
			errJSON, _ := json.Marshal(map[string]string{
				"error": fmt.Sprintf("Function '%s' not found", *functionName),
			})
			fmt.Fprintln(os.Stderr, string(errJSON))
			os.Exit(1)
		}
		results = filtered
	}

	// Output JSON
	output, err := json.Marshal(results)
	if err != nil {
		errJSON, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintln(os.Stderr, string(errJSON))
		os.Exit(1)
	}

	fmt.Println(string(output))
}

func printHelp() {
	fmt.Println("go-complexity - Multi-dimensional code complexity analyzer for Go")
	fmt.Println()
	fmt.Println("Usage: go-complexity [options] <file.go>")
	fmt.Println()
	fmt.Println("Options:")
	fmt.Println("  -version       Show version")
	fmt.Println("  -help          Show this help")
	fmt.Println("  -function      Analyze specific function only")
	fmt.Println()
	fmt.Println("Output: JSON array of function analysis results")
	fmt.Println()
	fmt.Println("Example:")
	fmt.Println("  go-complexity main.go")
	fmt.Println("  go-complexity -function=ProcessData handler.go")
}
