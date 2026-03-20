# gamma-auth cost-tier scoring

| Model | Group | TP | FP | Precision |
|---|---|---:|---:|---:|
| gpt-5.4-mini | general | 1 | 8 | 0.11 |
| gpt-5.4-mini | specific | 2 | 8 | 0.20 |
| gpt-5.4-nano | general | 1 | 8 | 0.11 |
| gpt-5.4-nano | specific | 2 | 8 | 0.20 |
| gemini-flash | general | 1 | 3 | 0.25 |
| gemini-flash | specific | 3 | 4 | 0.43 |

Best precision: gemini-flash specific; most others over-report speculative issues, with the clearest real TPs being registration race condition, missing brute-force protection, and possible registration/account enumeration.