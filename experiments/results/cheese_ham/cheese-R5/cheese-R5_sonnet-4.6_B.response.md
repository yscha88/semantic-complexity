# cheese-R5_sonnet-4.6_B

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- timestamp: 2026-03-26T11:32:09.530600+00:00
- temperature: 0
- seed: N/A
- prompt_sha256: 9ac907efa6115525d389dfe7628b827631e1099062417b9fd1765fb6dda5c2e5
- tokens: session (미측정)
- elapsed: session (미측정)

---

# cheese-R5_sonnet-4.6_B

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: B

---

## Analysis: toml/decoder.py — Cognitive Complexity

### Function complexity estimates

**`load_value` (~CC 50+, grade F) — extreme**
This function is a hand-written dispatch table for TOML value types. Every possible TOML value type (strings with multiple quote styles, arrays, inline tables, integers in multiple bases, floats with special values, booleans, datetime) is handled with cascading if/elif chains. The string parsing section alone spans multiple branches for raw strings, multiline strings, and escape sequences. Exceptional complexity — likely the most complex function in the entire toml library.

**`load_line` (~CC 37, grade E) — very high**
Handles comment stripping, key-value parsing, array-of-tables detection, section headers, and multi-key handling. Multiple regex applications and string manipulations are interleaved with state management for multikey/multibackslash modes.

**`load_array` (~CC 32, grade E) — very high**
Recursive TOML array parser. Handles nested arrays, mixed-type detection (TOML requires uniform array types), and whitespace/comment stripping between elements. The type homogeneity check branches over all TOML types.

**`load_inline_object` (~CC 15, grade C) — high**
Splits on commas but must handle commas inside quoted strings. Uses a re-assembly loop that is subtle: candidate groups are popped, and if a value doesn't match a terminal type, the next candidate is prepended and retried.

**`_load_date` (~CC 11, grade C) — medium-high**
Datetime parsing without a library. Nested conditionals parse subsecond precision and timezone from position-based string indexing. The positions (19, 20, -1) are magic numbers with no comments.

### Nesting depth
`_load_date` reaches depth 5+ with nested `if len(val) > 19` → `if val[19] == '.'` → `if val[-1].upper() == 'Z'` → further timezone parsing. `load_value` and `load_array` both exceed 4 levels.

### Single Responsibility
`load_value` handles 10+ distinct value types in one function. Each type (integer, float, string, datetime, boolean, array, inline table) could be a separate `_parse_integer`, `_parse_string`, etc.

### Code placement
Magic-number string indexing in `_load_date` (positions 0:4, 5:7, 8:10, 11:13, 14:16, 17:19) should be named constants or use `datetime.fromisoformat` (Python 3.7+).

The comma-splitting retry loop in `load_inline_object` is the most algorithmically complex part and deserves an extracted helper with a clear docstring.
