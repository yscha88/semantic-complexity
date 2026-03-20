# gamma-filesystem (Flask send_file — 범용 vs 파일시스템 특화)

| Response | TP | FP | Precision | Specific-only TPs (found by D-specific, missed by D-general) |
|---|---:|---:|---:|---|
| gpt-5.4 D-general | 2 | 5 | 0.29 | None |
| gpt-5.4 D-specific | 3 | 3 | 0.50 | Content-Type sniffing / unsafe inline serving of untrusted files |
| sonnet-4.6 D-general | 1 | 8 | 0.11 | None |
| sonnet-4.6 D-specific | 1 | 4 | 0.20 | None |

gpt-5.4 D-specific uniquely added the real browser-side risk around MIME handling / `nosniff` / inline serving of untrusted files, which D-general did not mention.