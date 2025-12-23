package core

import (
	"testing"
)

// ─────────────────────────────────────────────────────────────────
// Control Flow Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeIfStatement(t *testing.T) {
	source := `package main

func testIf(x int) int {
	if x > 0 {
		return 1
	}
	return 0
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	if len(results) == 0 {
		t.Fatal("Expected at least one function result")
	}

	fn := results[0]
	if fn.Dimensional.Control < 1 {
		t.Errorf("If statement should add control complexity, got %d", fn.Dimensional.Control)
	}
}

func TestAnalyzeForLoop(t *testing.T) {
	source := `package main

func testFor() int {
	sum := 0
	for i := 0; i < 10; i++ {
		sum += i
	}
	return sum
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Control < 1 {
		t.Errorf("For loop should add control complexity, got %d", fn.Dimensional.Control)
	}
}

func TestAnalyzeRangeLoop(t *testing.T) {
	source := `package main

func testRange(items []int) int {
	sum := 0
	for _, v := range items {
		sum += v
	}
	return sum
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Control < 1 {
		t.Errorf("Range loop should add control complexity, got %d", fn.Dimensional.Control)
	}
}

func TestAnalyzeSwitch(t *testing.T) {
	source := `package main

func testSwitch(x int) string {
	switch x {
	case 1:
		return "one"
	case 2:
		return "two"
	default:
		return "other"
	}
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	// switch + 2 cases (default doesn't count as it has no List)
	if fn.Dimensional.Control < 3 {
		t.Errorf("Switch with cases should add control complexity, got %d", fn.Dimensional.Control)
	}
}

func TestAnalyzeLogicalOperators(t *testing.T) {
	source := `package main

func testLogical(a, b, c bool) bool {
	return a && b || c
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	// && and || each add 1
	if fn.Dimensional.Control < 2 {
		t.Errorf("Logical operators should add control complexity, got %d", fn.Dimensional.Control)
	}
}

// ─────────────────────────────────────────────────────────────────
// Nesting Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeNesting(t *testing.T) {
	source := `package main

func testNesting(x int) int {
	if x > 0 {
		if x > 10 {
			if x > 100 {
				return 3
			}
			return 2
		}
		return 1
	}
	return 0
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Nesting < 3 {
		t.Errorf("Deep nesting should add nesting complexity, got %d", fn.Dimensional.Nesting)
	}
}

func TestAnalyzeNestedLoops(t *testing.T) {
	source := `package main

func testNestedLoops(n int) int {
	sum := 0
	for i := 0; i < n; i++ {
		for j := 0; j < n; j++ {
			sum += i * j
		}
	}
	return sum
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Nesting < 2 {
		t.Errorf("Nested loops should add nesting complexity, got %d", fn.Dimensional.Nesting)
	}
}

// ─────────────────────────────────────────────────────────────────
// State Mutation Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeStateMutation(t *testing.T) {
	source := `package main

func testState() int {
	state := 0
	status := "pending"
	state = 1
	status = "active"
	return state
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.State.StateMutations < 2 {
		t.Errorf("State variable assignments should be detected, got %d", fn.Dimensional.State.StateMutations)
	}
}

func TestAnalyzeStatePatterns(t *testing.T) {
	source := `package main

func testStatePatterns() {
	isEnabled := true
	hasPermission := false
	currentMode := "edit"
	previousValue := 0

	isEnabled = false
	hasPermission = true
	currentMode = "view"
	previousValue = 1
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	// is*, has*, current*, previous* are all state patterns
	if fn.Dimensional.State.StateMutations < 4 {
		t.Errorf("State patterns should be detected, got %d", fn.Dimensional.State.StateMutations)
	}
}

// ─────────────────────────────────────────────────────────────────
// Async Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeGoroutine(t *testing.T) {
	source := `package main

func testGoroutine() {
	go func() {
		println("hello")
	}()
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Async.AsyncBoundaries < 2 {
		t.Errorf("Goroutine should add async complexity (2), got %d", fn.Dimensional.Async.AsyncBoundaries)
	}
}

func TestAnalyzeChannelSend(t *testing.T) {
	source := `package main

func testChannelSend(ch chan int) {
	ch <- 1
	ch <- 2
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Async.AsyncBoundaries < 2 {
		t.Errorf("Channel sends should add async complexity, got %d", fn.Dimensional.Async.AsyncBoundaries)
	}
}

func TestAnalyzeChannelReceive(t *testing.T) {
	source := `package main

func testChannelReceive(ch chan int) int {
	x := <-ch
	return x
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Async.AsyncBoundaries < 1 {
		t.Errorf("Channel receive should add async complexity, got %d", fn.Dimensional.Async.AsyncBoundaries)
	}
}

func TestAnalyzeSelect(t *testing.T) {
	source := `package main

func testSelect(ch1, ch2 chan int) int {
	select {
	case x := <-ch1:
		return x
	case y := <-ch2:
		return y
	}
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	// select adds async boundary
	if fn.Dimensional.Async.AsyncBoundaries < 1 {
		t.Errorf("Select should add async complexity, got %d", fn.Dimensional.Async.AsyncBoundaries)
	}
}

func TestAnalyzeMakeChannel(t *testing.T) {
	source := `package main

func testMakeChannel() chan int {
	ch := make(chan int)
	return ch
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Async.AsyncBoundaries < 1 {
		t.Errorf("make(chan) should add async complexity, got %d", fn.Dimensional.Async.AsyncBoundaries)
	}
}

// ─────────────────────────────────────────────────────────────────
// Coupling Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeFmtSideEffect(t *testing.T) {
	source := `package main

import "fmt"

func testFmt() {
	fmt.Println("hello")
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Coupling.SideEffects < 1 {
		t.Errorf("fmt.Println should add side effect, got %d", fn.Dimensional.Coupling.SideEffects)
	}
}

func TestAnalyzeOsSideEffect(t *testing.T) {
	source := `package main

import "os"

func testOs() {
	os.Exit(0)
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	if fn.Dimensional.Coupling.SideEffects < 1 {
		t.Errorf("os.Exit should add side effect, got %d", fn.Dimensional.Coupling.SideEffects)
	}
}

// ─────────────────────────────────────────────────────────────────
// Tensor Output Tests
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeTensorOutput(t *testing.T) {
	source := `package main

func complexFunc(x int) int {
	state := 0
	for i := 0; i < 10; i++ {
		if x > i {
			state++
		}
	}
	return state
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]

	// Check tensor fields exist and are reasonable
	if fn.Tensor.RawSum < 0 {
		t.Error("Tensor.RawSum should be >= 0")
	}
	if fn.Tensor.RawSumThreshold <= 0 {
		t.Error("Tensor.RawSumThreshold should be > 0")
	}
	if fn.Tensor.Zone == "" {
		t.Error("Tensor.Zone should not be empty")
	}
	if fn.Tensor.Zone != "safe" && fn.Tensor.Zone != "review" && fn.Tensor.Zone != "violation" {
		t.Errorf("Tensor.Zone = %s, want safe|review|violation", fn.Tensor.Zone)
	}
}

// ─────────────────────────────────────────────────────────────────
// Cyclomatic & Cognitive Tests
// ─────────────────────────────────────────────────────────────────

func TestCyclomaticComplexity(t *testing.T) {
	source := `package main

func testCyclomatic(x int) int {
	if x > 0 {
		if x > 10 {
			return 2
		}
		return 1
	}
	return 0
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	// 2 if statements + 1 base = 3
	if fn.Cyclomatic < 3 {
		t.Errorf("Cyclomatic = %d, want >= 3", fn.Cyclomatic)
	}
}

func TestCognitiveComplexity(t *testing.T) {
	source := `package main

func testCognitive(x int) int {
	if x > 0 {
		for i := 0; i < x; i++ {
			if i > 5 {
				return i
			}
		}
	}
	return 0
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	fn := results[0]
	// Should be higher due to nesting
	if fn.Cognitive < fn.Cyclomatic {
		t.Error("Cognitive should be >= Cyclomatic for nested code")
	}
}

// ─────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────

func TestAnalyzeEmptyFunction(t *testing.T) {
	source := `package main

func empty() {}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	if len(results) == 0 {
		t.Fatal("Should find empty function")
	}

	fn := results[0]
	if fn.Cyclomatic != 1 {
		t.Errorf("Empty function cyclomatic = %d, want 1", fn.Cyclomatic)
	}
}

func TestAnalyzeMultipleFunctions(t *testing.T) {
	source := `package main

func first() {}
func second() {}
func third() {}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	if len(results) != 3 {
		t.Errorf("Expected 3 functions, got %d", len(results))
	}
}

func TestAnalyzeMethod(t *testing.T) {
	source := `package main

type MyType struct{}

func (m MyType) Method() int {
	return 42
}
`
	results, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}

	if len(results) == 0 {
		t.Fatal("Should find method")
	}

	if results[0].Name != "Method" {
		t.Errorf("Method name = %s, want Method", results[0].Name)
	}
}
