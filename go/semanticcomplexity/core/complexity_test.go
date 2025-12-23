package core

import "testing"

func TestDefaultWeights(t *testing.T) {
	w := DefaultWeights()

	if w.Control != 1.0 {
		t.Errorf("Control weight = %v, want 1.0", w.Control)
	}
	if w.Nesting != 1.5 {
		t.Errorf("Nesting weight = %v, want 1.5", w.Nesting)
	}
	if w.State != 2.0 {
		t.Errorf("State weight = %v, want 2.0", w.State)
	}
	if w.Async != 2.5 {
		t.Errorf("Async weight = %v, want 2.5", w.Async)
	}
	if w.Coupling != 3.0 {
		t.Errorf("Coupling weight = %v, want 3.0", w.Coupling)
	}
}

func TestAnalyzeSource(t *testing.T) {
	source := `package main

func simpleFunc() int {
	x := 0
	if x > 0 {
		return 1
	}
	return 0
}
`
	result, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("AnalyzeSource returned empty results")
	}
	if result[0].Name != "simpleFunc" {
		t.Errorf("Expected function name 'simpleFunc', got '%s'", result[0].Name)
	}
	if result[0].Cyclomatic < 2 {
		t.Errorf("Expected cyclomatic >= 2, got %d", result[0].Cyclomatic)
	}
}

func TestAnalyzeSourceWithTensor(t *testing.T) {
	source := `package main

func complexFunc(x int) int {
	state := 0
	for i := 0; i < 10; i++ {
		if x > i {
			state++
		} else {
			state--
		}
	}
	return state
}
`
	result, err := AnalyzeSource(source, "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("AnalyzeSource returned empty results")
	}

	fn := result[0]
	if fn.Tensor.RawSum == 0 {
		t.Error("Expected non-zero tensor raw_sum")
	}
	if fn.Tensor.Zone == "" {
		t.Error("Expected tensor zone to be set")
	}
}
