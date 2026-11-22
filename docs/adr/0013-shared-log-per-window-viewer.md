# ADR 0013: One event log per browser, one viewer per window

Status: Accepted (Nov 2026). Extends [ADR 0009](0009-client-state-for-prototype.md).

## Context

The case asks how stakeholders' experiences connect. One window can only show one person at a time.

## Decision

The event log stays in `localStorage` and is shared by every window of the browser; each window replays changes made in another (the `storage` event). "View as" moves to `sessionStorage`, so it is per window. After any change the store compares each person's open items before and after (`rippleBetween`) and shows "What this reached" with a button to step into each person's view.

## Consequences

Two windows side by side show one person's action reaching another. Still no server: windows of different browsers or devices do not share state.
