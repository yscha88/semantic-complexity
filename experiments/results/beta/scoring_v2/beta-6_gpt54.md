# beta-6 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---|
| gpt-5.4 B | 6 | 8 | 0.43 | 0 |
| gpt-5.4 D | 7 | 7 | 0.50 | 1 |
| sonnet-4.6 B | 2 | 8 | 0.20 | 0 |
| sonnet-4.6 D | 2 | 8 | 0.20 | 0 |

gpt-5.4 D uniquely found the real stale-authorization risk from `is_group_member` caching `_group_names_cache` on the user object without invalidation, which B only framed as a design/correctness smell rather than an authorization-risk TP.