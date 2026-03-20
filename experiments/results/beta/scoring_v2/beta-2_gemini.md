# beta-2 scored by gemini-3.1-pro (full code)

_encrypt_from_parts` missing validation
- `MultiFernet` eagerly materializes iterable (`list(fernets)`)
- `decrypt_at_time` footgun if caller controls time
- Type inconsistency for plaintext input (`bytes` vs `bytearray`)
- No explicit zeroization of key material

Let's double check gpt-5.4 B's