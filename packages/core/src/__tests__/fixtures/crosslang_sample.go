// Package fixtures provides cross-language compatibility test samples.
//
// This file contains simple functions to test that all analyzers
// produce compatible output structures across TypeScript, Python, and Go.
package fixtures

import (
	"fmt"
	"net/http"
)

// SimpleControl is a simple function with control flow.
func SimpleControl(x int) string {
	if x > 0 {
		return "positive"
	} else if x < 0 {
		return "negative"
	}
	return "zero"
}

// NestedLoop is a function with nesting.
func NestedLoop(arr [][]int) int {
	sum := 0
	for _, row := range arr {
		for _, val := range row {
			if val > 0 {
				sum += val
			}
		}
	}
	return sum
}

// StateMutation is a function with state mutations.
func StateMutation() int {
	state := 0
	status := "idle"

	status = "processing"
	state = 1

	status = "done"
	state = 2

	_ = status // silence unused warning
	return state
}

// AsyncFunction demonstrates goroutine usage.
func AsyncFunction(url string) chan string {
	result := make(chan string)
	go func() {
		resp, err := http.Get(url)
		if err != nil {
			result <- "error"
			return
		}
		defer resp.Body.Close()
		result <- "success"
	}()
	return result
}

// CoupledFunction is a function with coupling (side effects).
func CoupledFunction(msg string) {
	fmt.Println(msg)
}
