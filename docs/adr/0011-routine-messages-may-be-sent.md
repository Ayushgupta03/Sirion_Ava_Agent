# ADR 0011: Ava may send routine messages; decisions stay with people

Status: Accepted (Nov 2026). Supersedes the "Ava drafts; people send" part of [ADR 0005](0005-people-decide.md). The rest of 0005 stands.

## Context

With Ask Ava, the first message to a supplier is always the same: send a written proposal, and do not start before a PO. Making the requester click Send adds a touch and a delay but no judgment. ADR 0005 said Ava never sends.

## Decision

Autonomy is set per kind of message, never per decision, on a ladder: inform, draft, send routine messages, never decide. Two message types can be sent by Ava: quote requests from Ask Ava (`autoSendQuoteRequests`, on by default) and document chasers (`autoSendDocChasers`, off by default). Ava sends in the requester's name, logs it as an Ava action and marks the email `autoSent`. Switching is an engine action (`set_autonomy`) in the event log. Approving, rejecting, resolving a conflict, accepting a price, changing a term and applying a credit stay with people.

## Consequences

Fewer touches per request, and the supplier hears "no work before a PO" on day one. A routine message that causes a complaint or a wrong commitment drops that type back to draft (tripwire on the Metrics case page). "Ava did N, people decided M" still holds, because sending a routine message is an action, not a decision.
