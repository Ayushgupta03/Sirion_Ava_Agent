# ADR 0009: Session state in the browser

Status: Accepted (Nov 2026)

## Context

A shareable demo without accounts or a database.

## Decision

Zustand store persisted to localStorage; each browser is a sandbox; Reset clears it.

## Consequences

Zero backend to run. Not multi-user; see roadmap X2 for the server version.
