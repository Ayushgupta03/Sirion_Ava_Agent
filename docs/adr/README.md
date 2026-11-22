# Architecture decision records

Short records of decisions that shape the code. Add a new file for each new decision; do not edit accepted ones, supersede them.

| ADR | Decision |
|---|---|
| [0001](0001-event-sourced-engine.md) | Event-sourced engine with one pipeline |
| [0002](0002-policy-in-code.md) | Policy, money and dates in code; AI only reads, plans and advises |
| [0003](0003-ai-outputs-as-events.md) | AI outputs are versioned events with fingerprints |
| [0004](0004-plan-validated-by-code.md) | AI plans are validated by code |
| [0005](0005-people-decide.md) | Ava never sends, approves, rejects or applies credits |
| [0006](0006-cached-outputs-without-key.md) | Hand-written cached outputs while no key is available |
| [0007](0007-stable-conflict-ids.md) | Stable conflict ids |
| [0008](0008-decrease-does-not-reopen.md) | A decrease does not reopen approvals |
| [0009](0009-client-state-for-prototype.md) | Session state in the browser |
| [0010](0010-evals-as-guardrail.md) | Evals offline and online |

Template: copy any file, set Status to Proposed, fill Context, Decision, Consequences.
