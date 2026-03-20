# beta-5 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---:|
| gpt-5.4 B | 1 | 8 | 0.11 | 0 |
| gpt-5.4 D | 2 | 9 | 0.18 | 1 |
| sonnet-4.6 B | 1 | 10 | 0.09 | 0 |
| sonnet-4.6 D | 0 | 11 | 0.00 | 0 |

gpt-5.4 D uniquely found the real execute()-defaults inconsistency: validated/default-coerced model values can be dropped, causing the raw function default to be used instead.