# cheese-R5_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: toml/decoder.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating | Primary driver |
|---|---|---|---|---|
| `load_value` | 52-56 | F | ❌ fail | 10+ value type dispatch, no abstraction |
| `load_line` | 37-41 | E | ❌ fail | full line type discrimination |
| `load_array` | 32-36 | E | ❌ fail | recursive + type homogeneity + comments |
| `load_inline_object` | 15-17 | C | ❌ fail | comma-split with string awareness |
| `_load_date` | 11-13 | C | ❌ fail | ISO 8601 without library |

This is among the highest average complexity per function of any Python library this size. The absence of parser combinators or a tokenizer stage is the architectural root cause.

---

### C2: Nesting Depth

**`_load_date` — ❌ fail** (depth 5 confirmed):
```
try:                                   # depth 1
  if len(val) > 19:                    # depth 2
    if val[19] == '.':                 # depth 3
      if val[-1].upper() == 'Z':      # depth 4
        ...
      else:
        if '+' in subsecondvalandtz:   # depth 5
```

**`load_value` — ❌ fail**: The string-type detection section reaches depth 4, and the escape character processing within multiline strings reaches depth 5.

**`load_array` — ❌ fail**: `while` loop → `if` type check → `if atype != type(val)` → recursive call stack. Depth 4+ with implicit recursion depth unbounded.

**`load_inline_object` — ⚠️ warning**: Max depth 3-4, borderline.

---

### C3: Single Responsibility

**`load_value` — ❌ fail**: Ten distinct type parsers in one function. Each has different validation requirements, escape semantics, and error conditions:
- Basic string (`"..."`)
- Literal string (`'...'`)
- Multiline basic string (`triple-quote...triple-quote`)
- Multiline literal string (`triple-single-quote...triple-single-quote`)
- Integer (decimal)
- Integer (hex/octal/binary)
- Float (including special values)
- Boolean
- Datetime
- Array
- Inline table

Decomposition: `_parse_string(val)`, `_parse_number(val)`, `_parse_datetime(val)`, `_parse_collection(val)`.

**`load_line` — ❌ fail**: Discriminates between comment lines, section headers, array-of-table headers, key-value pairs, and multiline continuation — five distinct line types.

**`load_array` — ⚠️ warning**: Parsing + type checking are mixed, but both relate to array semantics.

---

### C4: Code Placement

**`_load_date` position arithmetic — ❌ fail**:
```python
int(val[:4]), int(val[5:7]), int(val[8:10]),
int(val[11:13]), int(val[14:16]), int(val[17:19])
```
These magic slice positions implement ISO 8601 date format parsing. Python 3.7+ includes `datetime.fromisoformat()` that handles all standard cases. The manual implementation is both fragile and unnecessary for Python 3.7+ targets.

**`load_inline_object` retry loop — ❌ fail**:
```python
while len(candidate_groups) > 0:
    candidate_group = candidate_groups.pop(0)
    ...
    elif len(candidate_groups) > 0:
        candidate_groups[0] = candidate_group + "," + candidate_groups[0]
```
This implements a scan-and-reassemble algorithm for splitting comma-separated values while respecting quoted strings. The algorithm is non-trivial and has no documentation or extracted name. Should be `_tokenize_inline_table(line)`.

---

### Free-form analysis

**1. Unbounded recursion in `load_array`**
Nested TOML arrays like `[[[[...]]]]` cause unbounded recursion. There is no recursion depth limit. A deeply nested structure could cause `RecursionError`. Python's default recursion limit (1000) is the only protection.

**2. Type homogeneity check uses Python `type()` equality**
```python
if atype != type(val):
    raise ValueError(...)
```
TOML 1.0 spec: arrays may contain mixed types as long as all elements are valid TOML values (the homogeneity requirement was relaxed in TOML 1.0). This check may incorrectly reject valid TOML 1.0 arrays.

**3. `_load_date` silent `return None` on failure**
Two separate `except ValueError: return None` branches make it impossible to distinguish "this string is not a date" from "this string is malformed". Callers check for `None` without knowing which failure occurred.

**4. `load_value` is not testable as a unit**
Testing the boolean parser requires invoking the entire 50+ branch dispatch. There are no internal seams. This makes it impossible to write focused unit tests for individual value types without mocking.

**5. String escape processing is O(n²)**
The multiline string escape handling in `load_value` uses repeated string `replace()` calls rather than a single-pass scanner. For large strings with many escape sequences, this degrades quadratically.
