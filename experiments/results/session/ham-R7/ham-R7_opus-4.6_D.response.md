# ham-R7_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: marshmallow/schema.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`_do_load()` pipeline phases — ❌ fail (critical)**
Each phase transition is an observable checkpoint:

| Phase transition | Observable output | Golden test needed |
|---|---|---|
| Input → pre-load | transformed data | mock pre-load processor, verify transformed data passed to `_deserialize` |
| `_deserialize` → field validate | deserialized result | verify field validator receives deserialized (not raw) value |
| Field validate → schema validate ×2 | error_store state | verify both pass_collection=True and False validators are invoked |
| Schema validate → post-load | only if no errors | verify post-load does NOT run when field errors exist |
| Post-load → return | final result | verify return value matches post-load output |

**`_deserialize()` unknown modes — ❌ fail**
Three separate golden tests:
```python
# RAISE: unknown field → ValidationError with key name in errors
# INCLUDE: unknown field → passed through in result dict
# EXCLUDE: unknown field → silently dropped from result dict
```

**`_init_fields()` field selection — ⚠️ warning**
Golden tests for all option combinations:
- `Meta.fields = ('a', 'b')` → only a, b in `self.fields`
- `Meta.exclude = ('c',)` → c not in `self.fields`
- `only=('a',)` on instance → only a
- Conflict: `only` contains field not in `Meta.fields` → `ValueError`

---

### H2: Contract Tests

**Schema ↔ Field deserialization contract — ❌ fail**
`field_obj.deserialize(val, field_name, data, **d_kwargs)` is called for every field. The contract: Field receives raw value and returns deserialized value OR raises `ValidationError`. No contract test verifies this.

**`@validates_schema` calling convention — ❌ fail**
Schema validators receive `(output, original_data, partial, many, unknown)` with `pass_original=True`, or `(output, partial, many, unknown)` without. Two different calling conventions based on decorator parameter. No contract test verifies which variant is called when.

**`@pre_load` / `@post_load` contract — ❌ fail**
Processors must accept `(data, **kwargs)` and return transformed data (or None to use original). The contract that returning None uses original data is not documented or tested.

---

### H3: Structural vs Behavioral Separation

**`_do_load()` 5-phase orchestration — ❌ fail**
The phases cannot be structurally separated because they share mutable state (`error_store`, `errors` dict, `result` variable). Specifically:

```python
result = self._deserialize(...)     # result may be partial if errors
self._invoke_field_validators(...)  # reads result, writes to error_store
...
errors = error_store.errors         # converts error_store to dict
if not errors and postprocess:      # post-load gated on errors
    result = self._invoke_load_processors(POST_LOAD, result, ...)
```

The `result` variable is mutated across phases. Extracting phases into separate methods requires passing `result` and `error_store` as mutable arguments, which doesn't reduce behavioral coupling.

**`_deserialize()` `many` dispatch — ⚠️ warning**
The `many=True` path (recursive call) and `many=False` path (field iteration) could be separated structurally (`_deserialize_many` / `_deserialize_one`) only after golden tests confirm the recursive call is equivalent.

---

### H4: Critical Path Coverage

| Path | Coverage | Behavioral risk |
|---|---|---|
| `_do_load()` success | ❌ | Critical |
| `_do_load()` field error accumulated | ❌ | Critical |
| `_do_load()` post-load gated on errors | ❌ | Critical |
| Schema validator ×2 invocation | ❌ | Critical |
| `_deserialize()` RAISE | ❌ | High |
| `_deserialize()` INCLUDE | ❌ | High |
| `_deserialize()` EXCLUDE | ❌ | High |
| `_deserialize()` partial dot-notation | ❌ | High |
| `_init_fields()` only+exclude conflict | ❌ | Medium |

**Estimated critical path coverage: <5%** (in isolation, without external test suite).

---

### Free-form analysis

**1. Double schema validator call is the highest behavioral fragility**
```python
self._invoke_schema_validators(..., pass_collection=True, ...)
self._invoke_schema_validators(..., pass_collection=False, ...)
```
This is the most likely line to be "simplified" in a refactoring. The behavioral invariant:
> Both calls are always made, regardless of whether any validators use `pass_many=True`.

Removing one call silently disables a class of validators. A golden test that registers both `@validates_schema(pass_many=True)` and `@validates_schema` and verifies both are called is essential.

**2. `getter` closure variable capture is fragile under Python version changes**
```python
def getter(val, field_obj=field_obj, field_name=field_name, d_kwargs=d_kwargs):
    ...
```
Default-argument capture is required here because Python closures capture by reference. If someone "modernizes" this to a lambda or removes the default args, the last `field_obj` value in the loop is used for all fields. This behavioral regression would affect all multi-field schemas and might not be caught without integration tests.

**3. `ValidationError(errors, data=data, valid_data=result)` carries partial result**
When validation fails, the `ValidationError` contains `valid_data=result` — the partially deserialized result up to the point of failure. Callers who access `exc.valid_data` depend on this including only the successfully deserialized fields. If `_deserialize` changes when it populates `ret_d`, the `valid_data` contract changes.

**4. Error message format is a behavioral contract**
```python
error_store.store_error([self.error_messages["unknown"]], key, ...)
```
The error messages use list-wrapped strings: `["Unknown field."]`. Code that catches `ValidationError` and inspects `exc.messages["field_name"][0]` depends on this format. Changing to non-list format would break all error message inspectors.
