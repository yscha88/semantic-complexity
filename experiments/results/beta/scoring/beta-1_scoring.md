# beta-1 채점 (HTTP/2 설정 상태 머신)

- scorer: gpt-5.4
- elapsed: 9.0s

---

| Response | TP count | FP count | Precision | D found but B missed (same model) |
|---|---:|---:|---:|---|
| gpt-5.4 Group B | 1 | 3 | 0.25 | Yes |
| gpt-5.4 Group D | 0 | 4 | 0.00 | N/A |
| sonnet-4.6 Group B | 1 | 4 | 0.20 | Yes |
| sonnet-4.6 Group D | 0 | 5 | 0.00 | N/A |

- **gpt-5.4**: D mentioned missing validation for `HEADER_TABLE_SIZE` and `MAX_CONCURRENT_STREAMS`, plus `initial_values`/key typing concerns, which B did not. However, from the provided code snippet these are not verifiable, so they do not count as TPs.
- **sonnet-4.6**: D added claims about `initial_values`, `__init__`, `__getitem__`, and a `max_concurrent_streams` default edge case that B did not. These also are not verifiable from the shown code, so they do not count as TPs.

Scoring notes, strictly from the visible code:
- The only clearly verifiable issue is **truncation/syntax break in `__repr__`** (`f"ChangedSetting(setting={self.se`), which is a real correctness issue and potentially mitigable.
- Claims about deque growth, missing validation in unseen methods, mutable mapping misuse, unknown-setting behavior, `max_concurrent_streams`, `__getitem__`, `__setitem__`, `acknowledge()`, or `initial_values` rely on code not shown, so they are FPs under the stated rules.