# beta-9 scored by gpt-5.4 (full code)

| Response | TP | FP | Precision | D-only TPs (found by D, missed by B, same model) |
|---|---:|---:|---:|---|
| gpt-5.4 B | 2 | 8 | 0.20 | — |
| gpt-5.4 D | 2 | 7 | 0.22 | — |
| sonnet-4.6 B | 2 | 9 | 0.18 | — |
| sonnet-4.6 D | 1 | 8 | 0.11 | — |

D found nothing materially new over B on either model; both Ds mostly repeated B’s real finding (_straight_evaluate double-evaluation) plus the same speculative dispatch/input-validation claims.