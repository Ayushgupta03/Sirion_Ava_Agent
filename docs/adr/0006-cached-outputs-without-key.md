# ADR 0006: Hand-written cached outputs while no key is available

Status: Accepted (Nov 2026)

## Context

The build had no API key; the demo still had to show the AI layers.

## Decision

Write cached extraction and AI outputs in the exact response shapes, label them 'Cached', and evaluate them with the same evals as live outputs.

## Consequences

The demo works offline and deterministically. Risk: cached text is not model-written; regenerate with the model (roadmap N2).
