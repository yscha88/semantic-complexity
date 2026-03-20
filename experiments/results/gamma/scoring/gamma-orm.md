# gamma-orm (SQLAlchemy — 범용 vs ORM 특화)

| Response | TP | FP | Precision | Specific-only TPs (found by D-specific, missed by D-general) |
|---|---:|---:|---:|---|
| gpt-5.4 D-general | 2 | 4 | 0.33 | 0 |
| gpt-5.4 D-specific | 4 | 2 | 0.67 | 2 |
| sonnet-4.6 D-general | 1 | 8 | 0.11 | 0 |
| sonnet-4.6 D-specific | 2 | 6 | 0.25 | 1 |

gpt-5.4 D-specific uniquely added the real risks of untrusted-expression code execution via `operator.python_impl` / `bindparam(callable=...)` and SQL/Python semantic mismatches for `IN` with `None`-containing collections; sonnet D-specific additionally surfaced recursion/complexity DoS, but most of its other extras were false positives.