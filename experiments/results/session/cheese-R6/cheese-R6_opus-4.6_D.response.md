# cheese-R6_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: h2/connection.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating | Notes |
|---|---|---|---|---|
| `send_headers` | 8 | B | ⚠️ warning | RFC-driven branching |
| `send_data` | 8 | B | ⚠️ warning | flow control math |
| `acknowledge_received_data` | 7 | B | ⚠️ warning | WINDOW_UPDATE hysteresis |
| `_receive_headers_frame` | 7 | B | ⚠️ warning | stream state dispatch |
| `__init__` (H2ConnectionStateMachine) | 1 | A | ✅ pass | — |
| `__init__` (H2Connection) | 1 | A | ✅ pass | dense but low CC |

**Key observation**: All complexity here is RFC 7540-driven. Each branch corresponds to a protocol requirement. This is qualitatively different from accidental complexity — it cannot be reduced without violating the HTTP/2 specification.

---

### C2: Nesting Depth

All functions — ✅ **pass**. Maximum depth observed: 3. The code uses early-return and guard clauses effectively. This is notably better than the B-grade complexity level would suggest — the complexity is "wide" (many branches) rather than "deep" (nested branches).

---

### C3: Single Responsibility

**`send_headers` — ⚠️ warning**: Two logical phases:
1. **Precondition validation** — stream state check, authority header presence, TE header restriction
2. **Frame construction** — HPACK encoding, CONTINUATION frame splitting

Recommendation: `_validate_send_headers_preconditions(headers, stream_id)` extracted as a guard clause before encoding.

**`_receive_headers_frame` — ⚠️ warning**: Handles both client-side and server-side header reception via `if self.config.client_side`. The two paths have different semantics (client receives responses/push promises, server receives requests). While the dispatch is simple, it creates a maintenance burden when either path needs to diverge.

**`send_data`, `acknowledge_received_data` — ✅ pass**: Both have tight, single-purpose implementations.

---

### C4: Code Placement

**Security defaults with CVE comments in `__init__` — ✅ pass**:
```python
SettingCodes.MAX_CONCURRENT_STREAMS: 100,  # CVE: unbounded resources
SettingCodes.MAX_HEADER_LIST_SIZE: DEFAULT_MAX_HEADER_LIST_SIZE,  # CVE-2016-6581
```
Excellent practice: security-significant defaults are explained inline with their rationale. This is the correct placement.

**`H2Connection.__init__` attribute density — ⚠️ warning**: ~50 attributes initialized without logical grouping. Recommend section comments:
```python
# --- Settings ---
self.local_settings = ...
self.remote_settings = ...
# --- Flow control ---
self.outbound_flow_control_window = ...
# --- Frame buffering ---
self.incoming_buffer = ...
self._data_to_send = ...
# --- Stream tracking ---
self.streams = ...
self._header_frames = ...
```

---

### Free-form analysis

**1. `_header_frames` accumulator invariant is undocumented**
```python
self._header_frames: list[Frame] = []
```
This accumulates HEADERS frames during CONTINUATION frame sequences. The invariant — "non-empty means we're mid-header-block, and no other frame types are legal until complete" — is a critical RFC constraint (RFC 7540 §6.10) that is not stated. A violation causes connection error, but the code doesn't document when this list should and should not be empty.

**2. `send_data` implicit frame size contract**
The `max_outbound_frame_size` attribute from `__init__` is used to split DATA frames but its relationship to SETTINGS_MAX_FRAME_SIZE negotiation is implicit. If `remote_settings.max_frame_size` changes during a connection (SETTINGS frame received), `max_outbound_frame_size` must be updated — this coupling is not documented at the `send_data` call site.

**3. `acknowledge_received_data` threshold is hardcoded**
```python
if increment > 0:
```
The WINDOW_UPDATE is sent when any data is consumed. RFC 7540 recommends implementing a hysteresis threshold (e.g., only send when window drops below half of initial) to reduce WINDOW_UPDATE traffic. The current implementation may send more WINDOW_UPDATE frames than necessary.
