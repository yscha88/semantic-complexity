# cheese-R4_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: D

---

## Analysis: marshmallow schema.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating |
|---|---|---|---|
| `_deserialize` | 23-26 | D | ❌ fail |
| `_init_fields` | 18-20 | C | ❌ fail |
| `_do_load` | 12-14 | C | ❌ fail |
| `_run_validator` | 8-9 | B | ⚠️ warning |
| `__init__` (Schema) | 3 | A | ✅ pass |

**`_deserialize` — fail**: Branches over `many`, `Mapping` check, `partial` (bool vs iterable), per-field partial prefix decomposition, `unknown` (EXCLUDE/INCLUDE/RAISE). CC ~25.

**`_init_fields` — fail**: Set operations on `only`/`exclude`/`opts.fields`, duplicate detection for `data_key` and `attribute` via two separate list comprehensions. CC ~19.

**`_do_load` — fail**: Orchestrates pre-load, deserialize, field-validators, schema-validators (×2 with different `pass_collection`), post-load, all in one method with nested try/except. CC ~13.

---

### C2: Nesting Depth

**`_deserialize` — fail**: `if many` → `for attr_name` → `if raw_value is missing` → `if partial is True or (partial_is_collection and ...)` → list comprehension for `sub_partial`. Depth ≥ 5.

**`_init_fields` — warning**: Max depth ~4 inside the duplicate detection blocks.

**`_do_load` — warning**: try/except nesting + inner `if not errors` block reaches depth 4.

---

### C3: Single Responsibility

**`_deserialize` — fail**: Two distinct responsibilities:
1. Collection mode dispatch (recursive call when `many=True`)
2. Single-item deserialization with field iteration + unknown handling

These should be split: `_deserialize_many()` and `_deserialize_one()`.

**`_do_load` — fail**: Orchestrates 5 distinct phases (pre-load, deserialize, field-validate, schema-validate×2, post-load). Each phase should be a delegated method call, not inline code.

**`_run_validator` — pass**: Single purpose — invoke a validator and map errors to field keys.

---

### C4: Code Placement

**`getter` closure inside `_deserialize` — fail**:
```python
def getter(val, field_obj=field_obj, field_name=field_name, d_kwargs=d_kwargs):
    return field_obj.deserialize(val, field_name, data, **d_kwargs)
```
This closure uses Python default-argument capture to freeze loop variables — a well-known but non-obvious pattern. It should be extracted as `_deserialize_field(field_obj, field_name, data, d_kwargs)` or replaced with `functools.partial`.

**`_do_load` schema-validator double call — warning**:
```python
self._invoke_schema_validators(..., pass_collection=True, ...)
self._invoke_schema_validators(..., pass_collection=False, ...)
```
The reason for calling twice (once with collection context, once without) is not explained and not obvious. A comment or a wrapper method would help.

---

### Free-form analysis (beyond C1-C4)

**1. Partial field prefix decomposition is implicit**
```python
prefix = attr_name + "."
sub_partial = [f[len_prefix:] for f in partial if f.startswith(prefix)]
```
This implements dot-notation nested field resolution inline inside `_deserialize`. It is a non-trivial algorithm that should be extracted as `_resolve_nested_partial(attr_name, partial)`.

**2. `error_store` passed by reference through deep call stack**
`_deserialize` takes `error_store` as a parameter and mutates it, then errors are read back in `_do_load`. This shared-mutation pattern makes the call chain hard to reason about in isolation.

**3. `_init_fields` duplicate detection is O(n²) in disguise**
```python
if len(dump_data_keys) != len(set(dump_data_keys)):
    data_keys_duplicates = {x for x in dump_data_keys if dump_data_keys.count(x) > 1}
```
`dump_data_keys.count(x)` is called inside a set comprehension — O(n²). For large schemas this could be slow. A `Counter` would be O(n).
