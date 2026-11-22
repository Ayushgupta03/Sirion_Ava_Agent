# ADR 0001: Event-sourced engine with one pipeline

Status: Accepted (Nov 2026)

## Context

The demo, composed email and clicks must behave identically; Back and Reset must be exact; counts must be provable.

## Decision

State is the replay of an append-only event log (`email`, `action`, `ai`). One `applyEvent` handles all of them. The story player is a list of events.

## Consequences

Tests run real scenarios without a browser. The demo cannot drift from the product. Cost: every derived value is recomputed per event (mitigated with per-state WeakMap caches); a server version must keep the log append-only.
