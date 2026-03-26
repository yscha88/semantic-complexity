# ham-R7_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- timestamp: 2026-03-26T11:32:09.778063+00:00
- temperature: 0
- seed: N/A
- prompt_sha256: 5323730aaae543c3c0860e9d1eb474fc93977eff8c53a1d8d1837cd0b383e403
- tokens: session (미측정)
- elapsed: session (미측정)

---

# ham-R7_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: D

---

## Analysis: marshmallow/schema.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`_do_load()` — ❌ fail (highest priority)**
The 5-phase pipeline has multiple observable checkpoints:
1. Pre-load processor output → what does `_do_load` pass to `_deserialize`?
2. `_deserialize` output → what field values are produced?
3. Field validator effects → which errors accumulate?
4. Schema validator ×2 → both pass_collection=True and False are invoked?
5. Post-load output → final returned value

Golden tests should verify: given input X with schema Y, result is Z and errors are W.

**`_deserialize()` unknown field handling — ❌ fail**
Three observable behaviors:
- `unknown=RAISE` → `ValidationError` with unknown field names
- `unknown=INCLUDE` → unknown fields passed through in result
- `unknown=EXCLUDE` → unknown fields silently dropped

Each requires a golden test to pin.

**`_init_fields()` field selection — ⚠️ warning**
The observable output is `self.fields`, `self.load_fields`, `self.dump_fields`. For a given schema class with `only`, `exclude`, `Meta.fields`, the exact set of fields must be pinned.

---

### H2: Contract Tests

**Schema ↔ Field contract — ❌ fail**
`_deserialize` calls `field_obj.deserialize(val, field_name, data, **d_kwargs)`. This calling convention is a contract between schema and field classes. No contract test verifies it.

**`_do_load` processor calling convention — ❌ fail**
Pre/post load processors are called as `processor(schema_obj, data, many, **kwargs)`. This calling convention is a behavioral contract for all `@pre_load` / `@post_load` decorated methods.

---

### H3: Structural vs Behavioral Separation

**`_do_load()` — ❌ fail**
The 5-phase pipeline cannot be structurally refactored. Each phase transition has a behavioral contract:
- Phase 1→2: processed_data (after pre-load) is what gets deserialized, not original data
- Phase 2→3: field validators run on deserialized result, not original data
- Phase 3→4: schema validators have access to both result AND error_store
- Phase 4→5: post-load only runs if NO errors

The phrase "post-load only runs if no errors" is encoded as:
```python
if not errors and postprocess and self._hooks[POST_LOAD]:
```
This is a behavioral invariant — post-load must NOT run when there are field errors.

**`_deserialize()` collection dispatch — ⚠️ warning**
The `many=True` recursive dispatch could be extracted structurally only after pinning that the recursive call produces identical results to calling `_deserialize` directly with `many=False`.

---

### H4: Critical Path Coverage

| Path | Coverage | Behavioral importance |
|---|---|---|
| `_do_load()` success | ❌ | Critical |
| `_do_load()` ValidationError raised | ❌ | Critical |
| `_do_load()` post-load skipped on errors | ❌ | High |
| `_deserialize()` unknown=RAISE | ❌ | High |
| `_deserialize()` unknown=INCLUDE | ❌ | High |
| `_deserialize()` partial nested | ❌ | High |
| `_init_fields()` only+exclude | ❌ | Medium |

---

### Free-form analysis

**1. Double schema validator call is the most brittle behavioral invariant**
```python
self._invoke_schema_validators(..., pass_collection=True, ...)
self._invoke_schema_validators(..., pass_collection=False, ...)
```
Why two calls? Schema validators decorated with `@validates_schema(pass_many=True)` receive the full collection; those without receive per-item. Both must run. If someone changes this to a single call, validators annotated for collection-level validation silently stop running. This invariant is not documented or tested.

**2. `error_store` vs `errors` dict transition**
`_do_load` converts from `error_store.errors` (accumulated during deserialization) to a `ValidationError(errors)`. If this conversion changes (e.g., error message format changes), all callers who parse `exception.messages` for specific field names break silently.

**3. `_init_fields()` is called in `__init__` without test isolation**
Since `_init_fields()` runs during `__init__`, testing it in isolation requires constructing a complete schema instance. This makes it impossible to unit test the field selection logic without triggering the full initialization chain.
