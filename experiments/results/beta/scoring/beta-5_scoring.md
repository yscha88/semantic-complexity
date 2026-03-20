# beta-5 채점 (데코레이터 검증)

- scorer: gpt-5.4
- elapsed: 6.2s

---

| Response | TP count | FP count | Precision | D found but B missed (same model) |
|---|---:|---:|---:|---|
| gpt-5.4 Group B | 1 | 1 | 0.50 | Group D additionally claimed a `get_type_hints`/`type_hints[name]` edge-case issue that B did not. |
| gpt-5.4 Group D | 1 | 2 | 0.33 | D found one extra claim vs B: possible missing `type_hints[name]` handling. |
| sonnet-4.6 Group B | 0 | 5 | 0.00 | Group D did not add any verifiable TP that B missed. |
| sonnet-4.6 Group D | 0 | 7 | 0.00 | D added several extra claims beyond B, but none are verifiable from the shown code. |

gpt-5.4: D’s only substantive addition over B was the `get_type_hints` / `type_hints[name]` robustness concern, but from the provided snippet that is not verifiable, so it should not count as a TP.

sonnet-4.6: D listed more issues than B (missing validation, KeyError/error-path claims, etc.), but none are verifiable from the provided code, so there’s nothing valid that D found and B missed.