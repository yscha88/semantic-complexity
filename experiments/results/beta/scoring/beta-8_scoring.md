# beta-8 채점 (TS JWT 검증)

- scorer: gpt-5.4
- elapsed: 5.8s

---

| Response | TP count | FP count | Precision | D found but B missed (same model) |
|---|---:|---:|---:|---|
| gpt-5.4 Group B | 0 | 1 | 0.00 | Yes |
| gpt-5.4 Group D | 1 | 1 | 0.50 | SSRF via attacker-controlled `jwks_uri` |
| sonnet-4.6 Group B | 0 | 3 | 0.00 | No |
| sonnet-4.6 Group D | 1 | 3 | 0.25 | SSRF via attacker-controlled `jwks_uri` |

- **gpt-5.4 Group B:** Its “parse/use claims before signature verification” issue is not a verifiable security risk from the code shown, so FP. Group D additionally identified the only clearly verifiable issue here: direct fetch of attacker-influenced `jwks_uri` causing SSRF risk.

- **gpt-5.4 Group D:** Correctly found SSRF in `fetch(options.jwks_uri, init)`. Its claim-type validation point is not clearly a security risk from the code alone, so FP.

- **sonnet-4.6 Group B:** “Timing attack” from claim checks before signature verification is not a verifiable vulnerability here; token-in-error-message leakage and JWKS size-limit DoS also are not established from the provided code, so all FP. Group D did not add any valid issue beyond SSRF.

- **sonnet-4.6 Group D:** Correctly found SSRF on `jwks_uri`. The other findings—missing string validation for `token`, decode error handling, and URL exposure—are not verifiable security issues from this code alone, so FP.