# cheese-R4_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: marshmallow schema.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating | Key drivers |
|---|---|---|---|---|
| `_deserialize` | 24-27 | D | ❌ fail | many-dispatch, partial (5 variants), unknown (3 variants), getter closure |
| `_init_fields` | 18-20 | C | ❌ fail | only/exclude/opts.fields, 2× duplicate detection |
| `_do_load` | 12-14 | C | ❌ fail | 5-phase orchestration with try/except |
| `_run_validator` | 8-9 | B | ⚠️ warning | field lookup fallback chain |
| `__init__` (Schema) | 3 | A | ✅ pass | attribute assignment |

**`_deserialize` detail**: The combination of `many` dispatch, `partial` resolution (None / True / False / str / dot-notation nested), `unknown` enum (EXCLUDE/INCLUDE/RAISE), inner `getter` closure, and nested `d_kwargs` construction gives this function among the highest complexity of any marshmallow core function.

---

### C2: Nesting Depth

**`_deserialize` — ❌ fail** (depth 6 at maximum):
```
if many:
  [list comprehension]
else:
  if not isinstance(data, Mapping):
    ...
  else:
    for attr_name, field_obj in ...:
      if raw_value is missing:
        if partial is True or (partial_is_collection and ...):  ← depth 5
          ...
      if partial_is_collection:
        sub_partial = [f[len_prefix:] for f in partial ...]     ← depth 5
```

**`_init_fields` — ⚠️ warning** (depth 4):
```
if self.only is not None:
  field_names = ...
  invalid_fields |= ...
if self.exclude:
  field_names = ...
  invalid_fields |= ...
if invalid_fields:
  ...
for field_name in field_names:
  for field_name, field_obj in fields_dict.items():  ← depth 4
```

**`_do_load` — ⚠️ warning** (depth 4): try/except wrapping nested `if not errors` block.

---

### C3: Single Responsibility

**`_deserialize` — ❌ fail**: Three distinct responsibilities in one function:
1. **Collection dispatch** — recursive call when `many=True`
2. **Single-item field iteration** — per-field deserialization with partial/unknown handling
3. **Unknown field handling** — INCLUDE/RAISE logic post field loop

Recommended split:
- `_deserialize(data, ...) → _deserialize_many / _deserialize_one` dispatch
- `_handle_unknown_fields(data, ret_d, unknown, ...)` extracted

**`_do_load` — ❌ fail**: Five sequential phases are inlined:
1. Pre-load processors
2. Deserialization (`_deserialize`)
3. Field-level validation
4. Schema-level validation (×2)
5. Post-load processors

Each phase boundary should be a method call, not inline code.

**`_run_validator` — ✅ pass**: Single responsibility — map ValidationError to the correct field key in error_store.

---

### C4: Code Placement

**`getter` closure — ❌ fail**:
```python
def getter(val, field_obj=field_obj, field_name=field_name, d_kwargs=d_kwargs):
    return field_obj.deserialize(val, field_name, data, **d_kwargs)
value = self._call_and_store(getter_func=getter, ...)
```
Defining a closure inside a loop with default-argument capture is a well-known Python pitfall. Even when done correctly (as here), it imposes cognitive load on readers unfamiliar with the pattern. Should be:
```python
value = self._call_and_store(
    getter_func=functools.partial(field_obj.deserialize, field_name=field_name, data=data, **d_kwargs),
    ...
)
```
Or extracted as `_make_field_getter(field_obj, field_name, data, d_kwargs)`.

**Double schema validator call in `_do_load` — ⚠️ warning**:
The two calls differ only in `pass_collection`. The intent (first pass with collection context for cross-field validators, second pass per-item) is not documented. A comment explaining why two calls are needed would eliminate the confusion.

---

### Free-form analysis

**1. O(n²) duplicate detection in `_init_fields`**
```python
data_keys_duplicates = {x for x in dump_data_keys if dump_data_keys.count(x) > 1}
```
`list.count()` is O(n); calling it inside a comprehension over all items is O(n²). For schemas with many fields this degrades performance. Fix:
```python
from collections import Counter
counts = Counter(dump_data_keys)
data_keys_duplicates = {k for k, v in counts.items() if v > 1}
```

**2. Implicit error accumulation contract**
`error_store` is a mutable object passed through `_deserialize` → `_call_and_store` → field deserialization. Errors accumulate as a side effect. The caller (`_do_load`) then reads `error_store.errors`. This hidden side-effect contract is invisible at the call site.

**3. `_run_validator` exception-driven control flow**
The entire function body is a try/except where the except branch contains the main logic (error key resolution). This inverts the normal control flow expectation — the "normal" path (validator succeeds) does nothing, and the exception path does work.

**4. `partial` type overloading**
`partial` accepts `None`, `True`, `False`, or a collection of strings. This union type creates 5 distinct runtime behaviors scattered across `_deserialize` and `_do_load`. A dataclass or enum would make the variants explicit.
