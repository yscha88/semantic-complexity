# beta-4 채점 (send_file/send_from_directory 경로 처리)

- scorer: gpt-5.4
- elapsed: 6.1s

---

| Response | TP count | FP count | Precision | D found but B missed (same model) |
|---|---:|---:|---:|---|
| gpt-5.4 Group B | 2 | 0 | 1.00 | D added 1 FP (`send_file` lacks local validation of many params). |
| gpt-5.4 Group D | 1 | 1 | 0.50 | D found no additional TP over B; it missed B’s valid `send_from_directory` trust-boundary issue. |
| sonnet-4.6 Group B | 1 | 4 | 0.20 | D added 1 FP (`get_root_path import_name` validation) and missed B’s only TP (`send_file` misuse risk). |
| sonnet-4.6 Group D | 0 | 4 | 0.00 | D found no TP that B missed. |

**Notes on D vs B differences**

- **gpt-5.4:** B correctly identified two verifiable misuse/trust-boundary risks: `send_file` with untrusted paths and `send_from_directory` only being safe when `directory` is trusted. D only kept the first and added a non-verifiable “missing local validation” complaint about parameters like `mimetype`, `etag`, etc.
- **sonnet-4.6:** B had one valid issue (`send_file` trusted-path misuse) but several speculative findings unrelated to the shown code. D was worse: it missed that valid issue’s framing and added only speculative/non-verifiable claims about `get_root_path`, error leakage, and validation.