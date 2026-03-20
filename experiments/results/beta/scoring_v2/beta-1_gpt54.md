# beta-1 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---:|
| gpt-5.4 B | 4 | 6 | 0.40 | 0 |
| gpt-5.4 D | 5 | 5 | 0.50 | 1 |
| sonnet-4.6 B | 2 | 8 | 0.20 | 0 |
| sonnet-4.6 D | 2 | 7 | 0.22 | 0 |

gpt-5.4 D uniquely found missing validation for HEADER_TABLE_SIZE and MAX_CONCURRENT_STREAMS; other D-only items were speculative/incorrect.