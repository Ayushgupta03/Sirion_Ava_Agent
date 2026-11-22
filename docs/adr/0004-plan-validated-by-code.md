# ADR 0004: AI plans are validated by code

Status: Accepted (Nov 2026)

## Context

A plan that drops a required approval would mislead people.

## Decision

`validatePlan` inserts missing policy steps (logged 'Added by policy check'), checks owners, removes cycles and sets known step statuses from the engine. The rules engine alone decides handoff.

## Consequences

The plan can be wrong in wording but not in policy. Unknown AI steps keep their own status.
