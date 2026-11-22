# ADR 0005: Ava never sends, approves, rejects or applies credits

Status: Accepted (Nov 2026). Superseded in part by [ADR 0011](0011-routine-messages-may-be-sent.md): Ava may send routine messages; every decision below still stays with people.

## Context

Accountability; trust; the brief's limits.

## Decision

Ava drafts; people send. Recommendations are applied only by a person (`rec_use`), logged with the person as actor.

## Consequences

Clear audit trail; 'Ava did N, people decided M' is meaningful.
