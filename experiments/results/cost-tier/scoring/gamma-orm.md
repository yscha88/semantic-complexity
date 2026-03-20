# gamma-orm cost-tier scoring

| Model | Group | TP | FP | Precision |
|---|---|---:|---:|---:|
| gpt-5.4-mini_D-general | general | 1 | 6 | 0.14 |
| gpt-5.4-mini_D-specific | specific | 4 | 4 | 0.50 |
| gpt-5.4-nano_D-general | general | 1 | 9 | 0.10 |
| gpt-5.4-nano_D-specific | specific | 4 | 7 | 0.36 |
| gemini-flash_D-general | general | 1 | 3 | 0.25 |
| gemini-flash_D-specific | specific | 2 | 3 | 0.40 |

Specific/ORM-focused prompts did much better; best recall was both mini/nano specific at 4 TP, while best precision here was gpt-5.4-mini_D-specific.