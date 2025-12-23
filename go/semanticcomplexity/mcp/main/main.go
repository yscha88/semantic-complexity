// Package main provides the entry point for the Go MCP server.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/yscha88/semantic-complexity/go/semanticcomplexity/mcp"
)

const version = "0.0.8"

func main() {
	showVersion := flag.Bool("version", false, "Show version")
	flag.Parse()

	if *showVersion {
		fmt.Println(version)
		os.Exit(0)
	}

	server := mcp.NewServer()
	if err := server.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
