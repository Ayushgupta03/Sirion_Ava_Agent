# 01 Overview

## What Ava is

Ava is a contract intake agent. Contract requests start in email: an employee writes to a supplier, the supplier replies with a quote, a rate card, a certificate. Ava receives a copy of that supplier email through a mail rule, and builds the contract request from it. Nobody fills in an intake form.

Ava then:

1. **Reads** every email and attachment, and writes a short cited summary of the deal and its risks (Ava's read).
2. **Plans** the work: the steps policy requires, plus its own steps with reasons, a critical path and a predicted ready date (Ava's plan).
3. **Acts**: files, extracts facts, checks every email against the signed contracts, drafts questions, prepares receipt summaries, re-plans. Every action is logged.
4. **Advises**: on every problem and decision, it recommends one next step with reasons, a confidence level and, where useful, a ready draft.

People make every decision. Ava never approves, never rejects, never resolves a conflict, never accepts a price and never applies a credit. Ava drafts every message; the only ones she may send herself are routine messages switched on in Settings (by default, the first request to a supplier for a written proposal from Ask Ava). See [18 Ask Ava](18-ask-ava.md).

Requests start in one of two ways: from supplier email Ava receives through the mail rule, or from **Ask Ava** (`/new`), where an employee describes a need before any supplier is contacted.

The request leaves intake in one of two end states:

- **Ready for Legal Review**: new agreements, data access, or non-standard terms. A handoff packet goes to Legal.
- **Ready to issue PO**: repeat work under an existing agreement, no data access, within limits. Only the budget owner approves.

## Principles

| Principle | How the prototype holds it |
|---|---|
| The AI understands, plans, acts and advises | Extraction, Ava's read, Ava's plan and recommendations come from the model (or cached model-shaped output) |
| Code enforces policy | Routing, the 90-day spend, the checklist, approvals, conflicts, money and dates are all computed in `lib/engine/` |
| People decide | Approvals, conflict resolutions, exceptions, sending drafts and using or dismissing recommendations are human events with an `actor` |
| Every fact has a source | Facts, conflicts and AI claims link to the email sentence, attachment line or contract clause they came from |
| Ava never picks a side | Contradictions open a conflict card owned by a person |
| Approvals belong to the facts they were given for | A material change reopens the approval; a decrease does not |
| One engine | Scripted steps, composed email and clicks all go through the same `applyEvent` |

## The fictional world

Company: **Prayaan Software Pvt Ltd** (India). Simulated clock starts **Thu 12 Nov 2026, 09:00 IST**.

### People

| id | Name | Role | Cost centre |
|---|---|---|---|
| rahul | Rahul Mehta | Requester, Sales Ops | CC-SALESOPS |
| ananya | Ananya Iyer | Budget owner, Head of Sales Ops | CC-SALESOPS |
| vikram | Vikram Rao | VP Sales, approves over ₹25L | |
| karan | Karan Shah | Procurement, owns every request | |
| meera | Meera Nair | InfoSec reviewer | |
| farah | Farah Khan | Legal | |
| suresh | Suresh Pillai | Finance (also a requester for Kosha) | CC-FIN |
| neha | Neha Kapoor | Requester, Marketing Ops | CC-MKTOPS |
| deepa | Deepa Menon | Budget owner, Financial Controller | CC-FIN |
| ritu | Ritu Bansal | Budget owner, Head of Marketing Ops | CC-MKTOPS |
| aditi | Aditi Verma | Budget owner, Head of Workplace (added in revision 3) | CC-WORKPLACE |
| sameer | Sameer Kulkarni | Budget owner, Head of People (added in revision 3) | CC-PEOPLE |

Ritu Bansal was added because the brief did not name Neha's budget owner. Aditi and Sameer were added so background requests name a person instead of "Budget owner".

### Policy constants

VP limit ₹25,00,000 before GST, per supplier and cost centre, over a rolling 90 days. VP approver Vikram, Procurement owner Karan, InfoSec Meera, Legal Farah, Finance Suresh.

### Suppliers

| id | Name | Domain | Contact |
|---|---|---|---|
| trivenika | Trivenika Systems Pvt Ltd | trivenika.example | Arjun Deshpande |
| kosha | Kosha Analytics Pvt Ltd | kosha.example | Priya Raman; Kosha billing |
| kalakriti | Kalakriti Design Studio (not in the supplier list) | kalakriti.example | Kalakriti accounts |

Background suppliers (sample data only): TalentBridge Staffing, Nimbus Cloud Services, Rangmanch Media, Sukhda Facility Services, Swift Movers Logistics, Pixelwise Analytics, Kalpana Translations, Greenleaf Events, Shieldline Security, Codehive Consulting, LearnLoop Academy.

### Agreements on file

| id | Supplier | What | Key terms |
|---|---|---|---|
| TV-NDA-2024 | Trivenika | Mutual NDA | 14 Mar 2024 |
| TV-MSA-2024 | Trivenika | Master Services Agreement | 2 Apr 2024 to 1 Apr 2027, auto-renews; Schedule A rates; full clauses in [04](04-contracts-and-checks.md) |
| SOW-0391 | Trivenika | Marketing dashboard build | ₹8,00,000, CC-MKTOPS, delivered 28 Aug 2026 |
| SOW-0412 | Trivenika | Salesforce support retainer Q3 | ₹9,00,000, CC-SALESOPS, 1 Sep 2026 |
| SOW-0438 | Trivenika | CRM data clean-up sprint | ₹9,00,000, CC-SALESOPS, final report due 15 Nov 2026 |
| TV-TAX | Trivenika | GST and PAN | on file |
| TV-ISO-2023 | Trivenika | ISO 27001 certificate | expires 8 Dec 2026 |
| KA-MSA-2025 | Kosha | Master Subscription Agreement | 7% renewal cap, notice by 1 Nov 2026, no auto-renewal without written agreement |
| KO-SUB-2026 | Kosha | BI subscription 2026 | ₹18,00,000, 12 months, CC-FIN, no automatic renewal |
| KO-TAX | Kosha | GST and PAN | on file |
| CH-MSA-2026 | Codehive (background) | MSA | 9.1 scope changes need a signed change request |
| TB-MSA-2025 | TalentBridge (background) | MSA | 5.1 consent to replace named contractors; 5.2 equal or higher seniority |
| PW-ORD-2025 | Pixelwise (background) | Order form | 3: price fixed at ₹20,00,000 a year until 31 Mar 2027 |

## Who uses each screen

| Person | Starts on | Sees |
|---|---|---|
| Karan (Procurement) | Today, Requests, Dashboard | Every request, every conflict, exceptions, unsorted invoices |
| Rahul, Neha (requesters) | Today, or Outlook add-in view | One question at a time, drafts to send, status of their requests |
| Ananya, Deepa, Ritu (budget owners), Vikram (VP) | Today | Approvals with a Decision Receipt and Ava's summary |
| Meera (InfoSec) | Today | Security reviews and certificate checks |
| Farah (Legal) | Today | Handoff packets, DPAs, questions from conflict cards, withdrawn packets |
| Suresh (Finance) | Today | PO issue, tax details, the Kosha renewal |

"View as" in the top bar switches person. The coach card says "Done as …" when a guided step acts as someone else.
