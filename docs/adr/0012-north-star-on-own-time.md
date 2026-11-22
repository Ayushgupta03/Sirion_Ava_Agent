# ADR 0012: The north star measures Prayaan's own time, not the calendar

Status: Accepted (Nov 2026). Replaces the earlier definition (complete and correctly routed within 1 business day of the first email).

## Context

Scenario A takes 3 business days, almost all of it waiting on the supplier's renewed certificate. A calendar target punishes intake for time it does not control and hides whether intake itself got faster.

## Decision

North star: of the requests that reach Ready for Legal Review or Ready to issue PO, the share that are complete, correctly routed, never withdrawn, and took under 1 day of Prayaan's own time. `waitSplit` in `lib/engine/timing.ts` computes own time as the calendar time minus every stretch between a message to the supplier and their reply; `northStar` in `lib/insights.ts` counts live requests only. Activity counts (Ava actions, contract checks) are shown as context, not success.

## Consequences

Rework is punished (a withdrawn handoff does not count). The supplier's wait is shown separately everywhere a duration appears. The pilot baseline must measure the same split from the mailbox in week 1.
