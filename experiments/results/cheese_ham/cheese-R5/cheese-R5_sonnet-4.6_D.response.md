# cheese-R5_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- timestamp: 2026-03-26T11:32:09.530998+00:00
- temperature: 0
- seed: N/A
- prompt_sha256: e4f1c9b2079529721f80a73f884cfb584dca8b029cb131c606374657c9d831a8
- tokens: session (미측정)
- elapsed: session (미측정)

---

# cheese-R5_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: D

---

## Analysis: toml/decoder.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating |
|---|---|---|---|
| `load_value` | 50+ | F | ❌ fail |
| `load_line` | 37-40 | E | ❌ fail |
| `load_array` | 32-35 | E | ❌ fail |
| `load_inline_object` | 15-17 | C | ❌ fail |
| `_load_date` | 11-13 | C | ❌ fail |

All five functions exceed grade B. This is a hand-written recursive-descent parser without any parsing abstraction layer — complexity is inherent to the approach but not managed.

---

### C2: Nesting Depth

**`_load_date` — ❌ fail** (depth 5):
```
try:
  if len(val) > 19:
    if val[19] == '.':
      if val[-1].upper() == 'Z':    ← depth 4
        ...
      else:
        if '+' in subsecondvalandtz: ← depth 5
```

**`load_value` — ❌ fail**: Cascading if/elif chains with nested string type detection reach depth 4+.

**`load_array` — ❌ fail**: Recursive structure + mixed-type validation + whitespace stripping loop reach depth 4.

---

### C3: Single Responsibility

**`load_value` — ❌ fail**: Handles 10+ value types in one function:
- 4 string variants (basic, literal, multiline basic, multiline literal)
- Integer (decimal, hex, octal, binary)
- Float (regular, nan, inf, -inf)
- Boolean
- Datetime
- Array
- Inline table

Each type should be `_parse_string()`, `_parse_integer()`, `_parse_float()`, `_parse_datetime()`, etc.

**`load_inline_object` — ⚠️ warning**: Handles both the comma-splitting (with quoted-string awareness) and the actual parsing via `load_line`. The re-assembly retry loop is a non-trivial algorithm mixed with delegation.

---

### C4: Code Placement

**`_load_date` magic number indexing — ❌ fail**:
```python
int(val[:4]), int(val[5:7]), int(val[8:10]),   # year, month, day
int(val[11:13]), int(val[14:16]), int(val[17:19])  # hour, min, sec
```
These positions are ISO 8601 format constants with no documentation. Python 3.7+ has `datetime.fromisoformat()` which handles this entirely. Using magic positions is error-prone and unnecessary.

**`load_inline_object` comma retry loop — ⚠️ warning**: The retry logic (pop, check if terminal type, if not prepend to next candidate) implements a simple state machine inline. Should be extracted as `_split_inline_table_values(line)`.

---

### Free-form analysis

**1. No error recovery — exceptions propagate raw**
`load_value` raises `ValueError` with minimal context. When parsing fails deep in a nested structure, the caller has no way to know which line or key caused the failure. A custom `TomlDecodeError` with line/column information would make debugging possible.

**2. `load_array` type homogeneity check is partial**
TOML 1.0 requires arrays to be homogeneous at the top level but allows mixed nested arrays. The current check (`if atype != type(val)`) uses Python `type()` equality which doesn't handle TOML's type hierarchy correctly (e.g., integer vs float).

**3. `_load_date` silently returns None on parse failure**
```python
except ValueError:
    return None
```
Returning `None` on failure causes the caller to treat the value as something other than a datetime without knowing why. This makes debugging TOML parse errors extremely difficult.

**4. Regex usage in `load_line` is not compiled**
Pattern strings are used directly in `re.match()` calls without pre-compilation. For a parser that may be called on many lines, this wastes repeated compilation overhead.
