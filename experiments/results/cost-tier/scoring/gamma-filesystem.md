# gamma-filesystem cost-tier scoring

| Model | Group | TP | FP | Precision |
|---|---|---:|---:|---:|
| gpt-5.4-mini_D-general | general | 1 | 13 | 0.07 |
| gpt-5.4-mini_D-specific | specific | 3 | 4 | 0.43 |
| gpt-5.4-nano_D-general | general | 1 | 10 | 0.09 |
| gpt-5.4-nano_D-specific | specific | 3 | 5 | 0.38 |
| gemini-flash_D-general | general | 1 | 5 | 0.17 |
| gemini-flash_D-specific | specific | 2 | 4 | 0.33 |

Specific/filesystem-focused analyses did better; best was gpt-5.4-mini_D-specific with 3 TP, while general checklists were mostly noisy FPs.