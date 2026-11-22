# ADR 0010: Evals offline and online

Status: Accepted (Nov 2026)

## Context

AI quality must be measurable and visible.

## Decision

`lib/evals.ts` runs on cached outputs in CI and on live outputs as they arrive; failures are logged and badged.

## Consequences

Prompt and model changes are testable; people see when not to trust an output.
