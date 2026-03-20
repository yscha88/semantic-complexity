# beta-2 채점 (Fernet 대칭 암호화)

- scorer: gpt-5.4
- elapsed: 5.1s

---

| Response | TP count | FP count | Precision | D found but B missed (same model) |
|---|---:|---:|---:|---|
| gpt-5.4 Group B | 1 | 1 | 0.50 | Internal helper input-validation robustness on `_encrypt_from_parts` (`iv`, `current_time`) |
| gpt-5.4 Group D | 1 | 0 | 1.00 | Yes |
| sonnet-4.6 Group B | 0 | 3 | 0.00 | None verifiable from code shown |
| sonnet-4.6 Group D | 0 | 0 | N/A | No |

- **gpt-5.4:** D identified a verifiable robustness issue in `_encrypt_from_parts`: `iv` and `current_time` are not validated before use, so bad values can trigger exceptions. B instead raised one real DoS concern (unbounded token size) but also claimed malformed slicing/structure issues that are not verifiable as a real risk from the shown code.
- **sonnet-4.6:** D did not add any verifiable security issue beyond B. B’s findings rely on code not shown (`MultiFernet`, `_decrypt_data`) or on speculative side channels, so none count as TPs from this snippet.