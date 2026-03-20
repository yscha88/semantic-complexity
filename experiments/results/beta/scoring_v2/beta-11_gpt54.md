# beta-11 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---|
| gpt-5.4 B | 10 | 7 | 0.59 | None |
| gpt-5.4 D | 9 | 6 | 0.60 | Event loop may close with pending async tasks; non-atomic ETA task migration can lose tasks |
| sonnet-4.6 B | 2 | 17 | 0.11 | None |
| sonnet-4.6 D | 3 | 10 | 0.23 | None |

gpt-5.4 D uniquely found pending-task loop-close cleanup risk and atomicity/task-loss risk in ETA migration; sonnet D found nothing meaningful that sonnet B missed.