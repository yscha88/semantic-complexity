// Package main provides the CLI for semantic-complexity.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/yscha88/semantic-complexity/go/semanticcomplexity/core"
)

const version = "0.0.1"

func main() {
	showVersion := flag.Bool("version", false, "Show version")
	showHelp := flag.Bool("help", false, "Show help")
	outputFormat := flag.String("format", "json", "Output format (json, markdown, html)")
	outputPath := flag.String("output", "", "Output file path")

	flag.Parse()

	if *showVersion {
		fmt.Printf("semantic-complexity %s\n", version)
		os.Exit(0)
	}

	if *showHelp || flag.NArg() == 0 {
		fmt.Println("semantic-complexity - Multi-dimensional code complexity analyzer")
		fmt.Println()
		fmt.Println("Usage: semantic-complexity [options] <path>")
		fmt.Println()
		fmt.Println("Options:")
		flag.PrintDefaults()
		os.Exit(0)
	}

	path := flag.Arg(0)
	result, err := core.AnalyzeFile(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	_ = outputFormat
	_ = outputPath

	fmt.Printf("Analysis result: %+v\n", result)
}
