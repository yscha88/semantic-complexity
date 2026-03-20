# beta-10 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---|
| gpt-5.4 B | 8 | 6 | 0.57 | None |
| gpt-5.4 D | 8 | 4 | 0.67 | Accepting any header-declared algorithm when `algorithms=None` |
| sonnet-4.6 B | 3 | 5 | 0.38 | None |
| sonnet-4.6 D | 3 | 7 | 0.30 | None |

gpt-5.4 D uniquely identified that verification permits any attacker-chosen supported `alg` when `algorithms` is omitted (`None`), which B did not call out explicitly.