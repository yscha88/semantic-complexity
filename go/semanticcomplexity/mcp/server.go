// Package mcp provides an MCP server for Go complexity analysis.
package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/yscha88/semantic-complexity/go/semanticcomplexity/core"
)

const version = "0.0.8"

// JSON-RPC types
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// MCP types
type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ServerCapabilities struct {
	Tools map[string]interface{} `json:"tools,omitempty"`
}

type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	ServerInfo      ServerInfo         `json:"serverInfo"`
	Capabilities    ServerCapabilities `json:"capabilities"`
}

type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

type InputSchema struct {
	Type       string              `json:"type"`
	Properties map[string]Property `json:"properties"`
	Required   []string            `json:"required"`
}

type Property struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Enum        []string `json:"enum,omitempty"`
	Default     any      `json:"default,omitempty"`
}

type TextContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ToolResult struct {
	Content []TextContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// Server represents the MCP server
type Server struct {
	scanner *bufio.Scanner
}

// NewServer creates a new MCP server
func NewServer() *Server {
	return &Server{
		scanner: bufio.NewScanner(os.Stdin),
	}
}

// Run starts the MCP server
func (s *Server) Run() error {
	for s.scanner.Scan() {
		line := s.scanner.Text()
		if line == "" {
			continue
		}

		var req JSONRPCRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.sendError(nil, -32700, "Parse error")
			continue
		}

		s.handleRequest(req)
	}
	return s.scanner.Err()
}

func (s *Server) handleRequest(req JSONRPCRequest) {
	switch req.Method {
	case "initialize":
		s.handleInitialize(req)
	case "tools/list":
		s.handleListTools(req)
	case "tools/call":
		s.handleCallTool(req)
	case "notifications/initialized":
		// Notification, no response needed
	default:
		s.sendError(req.ID, -32601, "Method not found: "+req.Method)
	}
}

func (s *Server) handleInitialize(req JSONRPCRequest) {
	result := InitializeResult{
		ProtocolVersion: "2024-11-05",
		ServerInfo: ServerInfo{
			Name:    "semantic-complexity-go-mcp",
			Version: version,
		},
		Capabilities: ServerCapabilities{
			Tools: map[string]interface{}{},
		},
	}
	s.sendResult(req.ID, result)
}

func (s *Server) handleListTools(req JSONRPCRequest) {
	tools := []Tool{
		{
			Name: "get_hotspots",
			Description: `[ENTRY POINT] Find complexity hotspots in Go code.

USE THIS FIRST when user mentions:
- "refactoring", "리팩토링", "개선"
- "code quality", "코드 품질"
- "what should I improve?", "뭐 고쳐야 해?"

Returns top N functions sorted by dimensional complexity.`,
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"directory": {
						Type:        "string",
						Description: "Directory path to scan for Go files",
					},
					"moduleType": {
						Type:        "string",
						Description: "Module type for canonical profile comparison",
						Enum:        []string{"api", "lib", "app", "web", "data", "infra", "deploy"},
					},
					"topN": {
						Type:        "number",
						Description: "Number of hotspots to return (default: 10)",
						Default:     10,
					},
					"pattern": {
						Type:        "string",
						Description: "Glob pattern for files (default: **/*.go)",
						Default:     "**/*.go",
					},
				},
				Required: []string{"directory", "moduleType"},
			},
		},
		{
			Name: "analyze_file",
			Description: `Analyze complexity of all functions in a Go file.

USE when:
- User opens or mentions a specific Go file
- After get_hotspots identifies a problematic file

Returns McCabe, cognitive, and dimensional complexity for each function.`,
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"filePath": {
						Type:        "string",
						Description: "Path to the Go file to analyze",
					},
					"moduleType": {
						Type:        "string",
						Description: "Module type for canonical profile comparison",
						Enum:        []string{"api", "lib", "app", "web", "data", "infra", "deploy"},
					},
					"threshold": {
						Type:        "number",
						Description: "Minimum dimensional complexity to include (default: 0)",
						Default:     0,
					},
				},
				Required: []string{"filePath", "moduleType"},
			},
		},
		{
			Name: "analyze_function",
			Description: `Deep analysis of a specific function with full dimensional breakdown.

USE when:
- User asks about a specific function
- After get_hotspots/analyze_file identifies a complex function

Returns 5-dimension breakdown, tensor score, canonical deviation.`,
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"filePath": {
						Type:        "string",
						Description: "Path to the file containing the function",
					},
					"functionName": {
						Type:        "string",
						Description: "Name of the function to analyze",
					},
					"moduleType": {
						Type:        "string",
						Description: "Module type for canonical profile comparison",
						Enum:        []string{"api", "lib", "app", "web", "data", "infra", "deploy"},
					},
				},
				Required: []string{"filePath", "functionName", "moduleType"},
			},
		},
		{
			Name: "suggest_refactor",
			Description: `Get actionable refactoring suggestions based on complexity profile.

USE when:
- User asks "어떻게 고쳐?", "how to fix?"
- After analyze_function shows high complexity

Returns prioritized suggestions based on the dominant complexity dimension.`,
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"filePath": {
						Type:        "string",
						Description: "Path to the file",
					},
					"functionName": {
						Type:        "string",
						Description: "Name of the function to get suggestions for",
					},
					"moduleType": {
						Type:        "string",
						Description: "Module type for canonical profile comparison",
						Enum:        []string{"api", "lib", "app", "web", "data", "infra", "deploy"},
					},
				},
				Required: []string{"filePath", "functionName", "moduleType"},
			},
		},
		{
			Name: "validate_complexity",
			Description: `Validate if code fits within canonical complexity bounds.

USE when:
- After writing new code
- PR review quality gate
- User asks "이거 괜찮아?", "is this okay?"

Checks bounds against specified module type. Returns pass/fail status.`,
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"filePath": {
						Type:        "string",
						Description: "Path to the file",
					},
					"functionName": {
						Type:        "string",
						Description: "Name of the function (optional)",
					},
					"moduleType": {
						Type:        "string",
						Description: "Module type for canonical profile comparison",
						Enum:        []string{"api", "lib", "app", "web", "data", "infra", "deploy"},
					},
				},
				Required: []string{"filePath", "moduleType"},
			},
		},
	}
	s.sendResult(req.ID, map[string]interface{}{"tools": tools})
}

func (s *Server) handleCallTool(req JSONRPCRequest) {
	var params struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.sendError(req.ID, -32602, "Invalid params")
		return
	}

	var result interface{}
	var err error

	switch params.Name {
	case "get_hotspots":
		result, err = s.getHotspots(params.Arguments)
	case "analyze_file":
		result, err = s.analyzeFile(params.Arguments)
	case "analyze_function":
		result, err = s.analyzeFunction(params.Arguments)
	case "suggest_refactor":
		result, err = s.suggestRefactor(params.Arguments)
	case "validate_complexity":
		result, err = s.validateComplexity(params.Arguments)
	default:
		s.sendError(req.ID, -32602, "Unknown tool: "+params.Name)
		return
	}

	if err != nil {
		s.sendResult(req.ID, ToolResult{
			Content: []TextContent{{Type: "text", Text: fmt.Sprintf(`{"error": "%s"}`, err.Error())}},
			IsError: true,
		})
		return
	}

	jsonResult, _ := json.MarshalIndent(result, "", "  ")
	s.sendResult(req.ID, ToolResult{
		Content: []TextContent{{Type: "text", Text: string(jsonResult)}},
	})
}

func (s *Server) getHotspots(args map[string]interface{}) (interface{}, error) {
	dir, _ := args["directory"].(string)
	topN := 10
	if v, ok := args["topN"].(float64); ok {
		topN = int(v)
	}
	pattern := "**/*.go"
	if v, ok := args["pattern"].(string); ok {
		pattern = v
	}

	files, err := filepath.Glob(filepath.Join(dir, pattern))
	if err != nil {
		// Try recursive glob
		files = []string{}
		filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() && filepath.Ext(path) == ".go" {
				files = append(files, path)
			}
			return nil
		})
	}

	var allResults []map[string]interface{}
	for _, f := range files {
		results, err := core.AnalyzeFile(f)
		if err != nil {
			continue
		}
		for _, r := range results {
			allResults = append(allResults, map[string]interface{}{
				"file":        f,
				"name":        r.Name,
				"line":        r.Lineno,
				"dimensional": r.Dimensional.Weighted,
				"mccabe":      r.Cyclomatic,
				"tensor":      r.Tensor,
				"moduleType":  r.ModuleType,
			})
		}
	}

	// Sort by dimensional (descending)
	for i := 0; i < len(allResults)-1; i++ {
		for j := i + 1; j < len(allResults); j++ {
			if allResults[i]["dimensional"].(float64) < allResults[j]["dimensional"].(float64) {
				allResults[i], allResults[j] = allResults[j], allResults[i]
			}
		}
	}

	if topN < len(allResults) {
		allResults = allResults[:topN]
	}

	return map[string]interface{}{
		"totalFiles":     len(files),
		"totalFunctions": len(allResults),
		"hotspots":       allResults,
	}, nil
}

func (s *Server) analyzeFile(args map[string]interface{}) (interface{}, error) {
	filePath, _ := args["filePath"].(string)
	threshold := 0.0
	if v, ok := args["threshold"].(float64); ok {
		threshold = v
	}

	results, err := core.AnalyzeFile(filePath)
	if err != nil {
		return nil, err
	}

	var filtered []core.FunctionResult
	for _, r := range results {
		if r.Dimensional.Weighted >= threshold {
			filtered = append(filtered, r)
		}
	}

	return map[string]interface{}{
		"file":      filePath,
		"functions": filtered,
		"summary": map[string]interface{}{
			"total": len(filtered),
		},
	}, nil
}

func (s *Server) analyzeFunction(args map[string]interface{}) (interface{}, error) {
	filePath, _ := args["filePath"].(string)
	funcName, _ := args["functionName"].(string)

	results, err := core.AnalyzeFile(filePath)
	if err != nil {
		return nil, err
	}

	for _, r := range results {
		if r.Name == funcName {
			return r, nil
		}
	}

	return nil, fmt.Errorf("function '%s' not found", funcName)
}

func (s *Server) suggestRefactor(args map[string]interface{}) (interface{}, error) {
	filePath, _ := args["filePath"].(string)
	funcName, _ := args["functionName"].(string)

	results, err := core.AnalyzeFile(filePath)
	if err != nil {
		return nil, err
	}

	for _, r := range results {
		if r.Name == funcName {
			return map[string]interface{}{
				"function":          funcName,
				"file":              filePath,
				"currentComplexity": r.Dimensional,
				"recommendations":   r.Recommendations,
			}, nil
		}
	}

	return nil, fmt.Errorf("function '%s' not found", funcName)
}

func (s *Server) validateComplexity(args map[string]interface{}) (interface{}, error) {
	filePath, _ := args["filePath"].(string)
	funcName, _ := args["functionName"].(string)

	results, err := core.AnalyzeFile(filePath)
	if err != nil {
		return nil, err
	}

	var validationResults []map[string]interface{}
	for _, r := range results {
		if funcName != "" && r.Name != funcName {
			continue
		}
		passed := r.Tensor.Zone == "safe"
		validationResults = append(validationResults, map[string]interface{}{
			"function":   r.Name,
			"moduleType": r.ModuleType.Inferred,
			"zone":       r.Tensor.Zone,
			"passed":     passed,
			"tensor":     r.Tensor,
		})
	}

	allPassed := true
	for _, vr := range validationResults {
		if !vr["passed"].(bool) {
			allPassed = false
			break
		}
	}

	return map[string]interface{}{
		"file":    filePath,
		"passed":  allPassed,
		"results": validationResults,
	}, nil
}

func (s *Server) sendResult(id interface{}, result interface{}) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
	data, _ := json.Marshal(resp)
	fmt.Println(string(data))
}

func (s *Server) sendError(id interface{}, code int, message string) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &RPCError{
			Code:    code,
			Message: message,
		},
	}
	data, _ := json.Marshal(resp)
	fmt.Println(string(data))
}
