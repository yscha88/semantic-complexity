# beta-8 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---|
| gpt-5.4 B | 6 | 8 | 0.43 | 1 |
| gpt-5.4 D | 7 | 6 | 0.54 | token leakage via exceptions |
| sonnet-4.6 B | 2 | 7 | 0.22 | 0 |
| sonnet-4.6 D | 3 | 10 | 0.23 | 1 |

gpt-5.4 D uniquely found raw JWT/token leakage in thrown exceptions; sonnet-4.6 D uniquely found nothing clearly real beyond B except the same token-leak point.