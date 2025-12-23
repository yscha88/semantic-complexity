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
	result, err := AnalyzeSource("", "test.go")
	if err != nil {
		t.Fatalf("AnalyzeSource error: %v", err)
	}
	if result == nil {
		t.Fatal("AnalyzeSource returned nil")
	}
}
