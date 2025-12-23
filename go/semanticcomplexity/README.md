# semantic-complexity (Go)

Multi-dimensional code complexity analyzer for Go.

## Installation

```bash
go get github.com/yscha88/semantic-complexity/go/semanticcomplexity
```

## Usage

### CLI

```bash
# Build
cd go/semanticcomplexity
go build -o go-complexity ./cmd

# Analyze a file
./go-complexity path/to/file.go

# JSON output
./go-complexity path/to/file.go -json
```

### Go API

```go
package main

import (
    "fmt"
    "github.com/yscha88/semantic-complexity/go/semanticcomplexity/core"
)

func main() {
    source := `
package main

func complexFunction(x int) {
    if x > 0 {
        for i := 0; i < x; i++ {
            if i%2 == 0 {
                fmt.Println(i)
            }
        }
    }
}
`
    results, err := core.AnalyzeSource(source, nil)
    if err != nil {
        panic(err)
    }

    for _, fn := range results {
        fmt.Printf("%s: McCabe=%d, Dimensional=%.2f\n",
            fn.Name, fn.Cyclomatic, fn.Dimensional.Weighted)
    }
}
```

## Domains

| Domain | Weight | Description |
|--------|--------|-------------|
| Control (C) | 1.0 | Cyclomatic complexity (branches, loops) |
| Nesting (N) | 1.5 | Depth penalty |
| State (S) | 2.0 | State mutations and transitions |
| Async (A) | 2.5 | Goroutines, channels, select |
| Coupling (Λ) | 3.0 | Hidden dependencies, side effects |

## License

MIT
