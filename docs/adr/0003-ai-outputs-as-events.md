# ADR 0003: AI outputs are versioned events with fingerprints

Status: Accepted (Nov 2026)

## Context

Reads and plans must update when facts change, keep history, and replay deterministically.

## Decision

Reads, plans and recommendations are `ai` events stored in `state.ai`, each with a fingerprint of the facts it depends on. A stale or missing output falls back to rules and triggers a live call.

## Consequences

Cached and live outputs are interchangeable. 'Updated … see previous' is free. Replays never call the model.
