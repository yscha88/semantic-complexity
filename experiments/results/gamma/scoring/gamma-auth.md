# gamma-auth (FastAPI auth — 범용 R1-R4 vs 보안 특화 B1-B4)

| Response | TP | FP | Precision | Specific-only TPs (found by D-specific, missed by D-general) |
|---|---:|---:|---:|---|
| gpt-5.4 D-general | 4 | 3 | 0.57 | none |
| gpt-5.4 D-specific | 4 | 2 | 0.67 | none |
| sonnet-4.6 D-general | 2 | 6 | 0.25 | none |
| sonnet-4.6 D-specific | 2 | 5 | 0.29 | none |

D-specific did not find any clear additional true positives beyond D-general; mostly it reframed the same issues, and in Sonnet added more false positives.