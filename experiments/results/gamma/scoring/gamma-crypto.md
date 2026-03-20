# gamma-crypto (Fernet — 범용 vs 암호화 특화)

| Response | TP | FP | Precision | Specific-only TPs (found by D-specific, missed by D-general) |
|---|---:|---:|---:|---|
| gpt-5.4 D-general | 0 | 8 | 0.00 | 0 |
| gpt-5.4 D-specific | 0 | 7 | 0.00 | 0 |
| sonnet-4.6 D-general | 0 | 5 | 0.00 | 0 |
| sonnet-4.6 D-specific | 0 | 5 | 0.00 | 0 |

D-specific found no real security risk that D-general missed; its extra points (zeroization/key lifecycle, TTL-before-MAC timing distinction) are not real vulnerabilities here.