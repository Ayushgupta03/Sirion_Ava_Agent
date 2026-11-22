# ADR 0002: Policy, money and dates in code; AI only reads, plans and advises

Status: Accepted (Nov 2026)

## Context

Approval routing and money must be exact, explainable and auditable. Models can hallucinate numbers.

## Decision

Routing, spend, checklist, approvals, conflicts, handoff, credits and overages are TypeScript in `lib/engine/`. The AI receives numbers in `numbersFromCode` and may not invent others; evals enforce it.

## Consequences

Every rule is unit-tested and shows why it fired. The AI cannot change policy. New figures need a code path first.
