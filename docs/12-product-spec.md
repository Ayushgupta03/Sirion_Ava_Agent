# 12 Product spec

The product layer: what Ava is for, who it serves, how we know it works, and where the line sits between AI, code and people. Read this before changing behaviour.

## Problem

Contract requests start in email. The facts that decide price, routing and risk (amount, scope, data access, term, supplier entity) are scattered across email bodies and attachments, and nobody checks them against what was already signed. Intake forms are filled late, partly, or not at all. The result: approvals given for numbers that later change, work started before approval, renewals that quietly add terms, and Legal receiving incomplete requests. See the case pages ("Why intake", "The problem") for the sourced evidence.

## Users and jobs

| User | Job to be done | Ava's promise |
|---|---|---|
| Requester (Rahul, Neha, Suresh) | Get the supplier working without learning procurement | Write to the supplier as usual. Answer one question at a time. Send drafts Ava prepares. |
| Procurement (Karan) | Own every request; keep it compliant and fast | One case file per request with the read, plan, problems and recommendations. Nothing slips through email. |
| Budget owner, VP | Approve with confidence, once | A Decision Receipt with exactly what they approve, Ava's summary and open risks; reopened only when the facts go up |
| InfoSec (Meera) | Review data access before it happens | Asked only when the requester confirms customer data; certificates checked for dates |
| Legal (Farah) | Receive complete requests | A handoff packet with facts, sources, receipts, contract issues raised at intake, DPA assignment and open notes |
| Finance | Pay only for approved work | Orphan invoices surfaced, early starts recorded, tax details checked |

## Scope

In scope: intake from the first supplier email to Ready for Legal Review or Ready to issue PO. Extraction, filing, fact folding, policy routing, contract commitment checks, conflicts, approvals with receipts, drafts, plans, predictions, recommendations, handoff packet.

Out of scope (non-goals): sending email to suppliers; approving, rejecting or applying credits; reviewing clause wording; negotiating; contract authoring, signature, obligations management after signing (that is the contract system's job, e.g. Sirion); a real mail integration; authentication; a server database.

## AI, code and people

| Decision or task | Owner | Why |
|---|---|---|
| Read emails and attachments, extract facts with quotes | AI | Language understanding; every fact cites its source |
| Summarise the deal and risks (Ava's read) | AI | Judgment in plain words, cited |
| Plan the work and predict a date | AI, validated by code | AI proposes; code inserts missing policy steps, checks owners and cycles, sets statuses |
| Recommend a next step, draft a message | AI | Advice with confidence; a person uses, edits or dismisses |
| Routing, limits, spend, checklist, approvals, conflicts, handoff | Code | Policy must be exact, explainable and testable |
| Money and dates (credits, overages, notice days, savings) | Code | Never computed by the AI; evals fail any AI number that code did not provide |
| Approve, reject, resolve, send, apply a credit | People | Accountability |

## Success metrics

| Metric | Definition | Where measured |
|---|---|---|
| North star | Share of supplier requests complete and correctly routed within 1 business day of the first email | Case page "Metrics" (live value), dashboard timing |
| Forms filled | Intake forms people had to fill | Dashboard (target 0) |
| ₹ at stake caught | Over-charges, credits and savings found at intake | Dashboard counter |
| Ava actions : people decisions | How much legwork Ava does per human decision | Dashboard, handoff banner |
| Contract terms checked | Commitments checked per email | Dashboard |
| Approvals reopened by changed facts | Approvals that would have been wrong | Dashboard |
| Started before approval, by department | Spend without approval | Dashboard |
| Prediction accuracy | Predicted vs actual ready date | Plan header after Ready; to be aggregated (see roadmap) |
| Recommendation use rate | Used vs edited vs dismissed, with reasons | Event log (`rec_use`, `rec_dismiss`); to be aggregated |
| AI output check failures | Live outputs failing evals | Timeline flags and badges; `npm run eval` |

Guardrail metrics: no recommendation applies a decision; no AI number outside code numbers; every AI sentence cited.

## Principles for future work

1. Ask first is faster than sign first: keep the controlled path the fastest one.
2. One decision per person per moment. If a screen asks a person two things, split it.
3. Every claim links to its source. If it cannot be cited, it is not shown as fact.
4. Code owns numbers. Add a code path before letting the AI mention a new figure.
5. Show what changed, not everything.
6. Plain words, short sentences, names, numbers, dates.

## Risks

| Risk | Mitigation in the prototype | Next step |
|---|---|---|
| Hallucinated facts or numbers | Quotes required; zod; evals; numbers from code | Model-graded faithfulness eval on live traffic |
| Wrong filing | Confidence shown; thread first; Procurement can reassign | Merge and split requests |
| Privacy of employee mail | Only supplier domains via a mail rule; exclusions | Real DLP rules and retention jobs |
| Over-trust in recommendations | Confidence, reasons, citations; every use is logged by person | Track dismiss reasons; tune prompts |
| Alert fatigue | Items only for whoever can fix it | Digest mode, snooze |
