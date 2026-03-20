# beta-12 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---:|
| gpt-5.4 B | 6 | 8 | 0.43 | 0 |
| gpt-5.4 D | 6 | 8 | 0.43 | 0 |
| sonnet-4.6 B | 3 | 13 | 0.19 | 0 |
| sonnet-4.6 D | 3 | 10 | 0.23 | 0 |

D found no clear additional TPs over B for either model; mostly the same real issues, with D sometimes omitting B’s valid findings.