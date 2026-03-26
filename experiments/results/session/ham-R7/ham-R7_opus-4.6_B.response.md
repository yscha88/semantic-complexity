# ham-R7_opus-4.6_B

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: B

---

## Analysis: marshmallow/schema.py — Behavioral Preservation

### Summary
marshmallow's schema deserialization pipeline is a well-established behavioral contract. The five phases of `_do_load()` represent the core observable behavior that all marshmallow users depend on.

### Critical behavioral contracts

**`_do_load()` pipeline (critical)**
Five phases with strict ordering:
1. Pre-load processors (may transform input)
2. `_deserialize()` (per-field deserialization)  
3. Field-level validators (`@validates` decorated methods)
4. Schema-level validators (×2 for collection and per-item) 
5. Post-load processors (only if no errors)

The invariant "post-load does not run when there are errors" is behavioral and must not change. The double schema validator call is equally critical — it handles both `@validates_schema(pass_many=True)` and standard validators.

**`_deserialize()` unknown field handling**
Three distinct behaviors (RAISE/INCLUDE/EXCLUDE) are the most commonly exercised public API contracts. Users rely on exact error message keys when catching `ValidationError`.

**`_init_fields()` field set computation**
The interaction of `Meta.fields`, `Meta.exclude`, `only`, and `exclude` parameters determines which fields are active. This is the schema instantiation contract.

### Testing priorities (if no tests exist)

1. **`_do_load()` with all three `unknown` modes** — most commonly broken behavior
2. **`_do_load()` error accumulation** — validate that all field errors are collected, not just the first
3. **Schema validator ×2 invariant** — ensure both `pass_collection=True` and `False` validators run
4. **Post-load skipped on error** — verify post-load hook does NOT run when field validation fails
5. **`partial` with dot-notation** — nested partial field exclusion

### Key fragility
The `getter` closure in `_deserialize()` (loop variable capture via default args) is the highest refactoring risk. Any "simplification" of this pattern could silently change which field object is used for deserialization.
