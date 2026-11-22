# 06 Scenarios

The guided demo (`lib/story.ts`) is a list of steps. Each step has a time, a caption, a focus URL, a pulse target (the element scrolled to and highlighted) and a list of events. Events are built against the state at that moment and fed to the same `applyEvent` as everything else. Back replays to the previous checkpoint; Reset clears the session.

On first load the session contains one seed event: the **Kalakriti invoice** (INV-KDS-2291, ₹4.2L before GST, "Brand refresh, phase 1", Tue 10 Nov 15:20), sent to accounts with no request, contract or PO behind it. It becomes an orphan invoice on the dashboard with a 60-second confirm for Neha (named as "Attention" on the invoice). Confirming opens a request marked "Started before approval".

Emails used: `lib/scripted.ts`. Extractions: `data/extraction-cache/`. AI outputs: `lib/aiScript.ts`. Expected results are asserted in `tests/engine.test.ts`.

## Scenario A: Trivenika, new project (9 steps)

Rahul (Sales Ops) needs Trivenika to migrate the sales pipeline to Salesforce. It ends in **Ready for Legal Review** at ₹21,10,800 after Ava catches a hidden ₹1.5L line, two contract breaches and customer data access.

| Step | Time | What happens | What Ava shows |
|---|---|---|---|
| A1 | Thu 12 Nov 10:12 | Rahul to Arjun: "Rough budget is about ₹20L. Can your team start Monday? … about 8 weeks." No form. | Opens **REQ-1047** "New SOW: Salesforce migration" under Trivenika › Salesforce migration; links TV-NDA-2024 and TV-MSA-2024. **Read v1:** about ₹20L, 8 weeks from Mon 16 Nov; migrating pipeline data usually means customer records, which Rahul has not mentioned; with two Sales Ops SOWs the 90-day total is ₹38L, over the ₹25L VP limit. **Plan v1:** policy steps budget (Ananya), VP (Vikram), competing quote or exception (Karan); Ava's steps get the quote (Rahul), confirm data access (Rahul, "Migration of customer records"), check NDA and MSA (Ava, done). Predicted ready "Fri 13 Nov, if the quote arrives today". |
| A2 | Thu 10:13 | Clock tick | ₹9L + ₹9L + ₹20L = ₹38L, over ₹25L, so VP approval and a competing quote. The plan pulses: "Required by policy" badges against "Added by Ava" with reasons. |
| A3 | Thu 11:40 | Arjun replies with Proposal v1 (₹20,00,000) and RateCard 2026. Body adds: "Also, a heads-up: the final data-quality report for the CRM clean-up will now come on 20 Dec, as our team is tied up." | Amount confirmed by the document. Data access question to Rahul and a hidden-scope conflict. **Delivery conflict**: 35 days late = 5 weeks, 2% × 5 = 10% (the cap), up to ₹90,000; notice 2 business days vs 10; new date needs a signed change request (MSA 4.3, 12.1). **Rate conflict**: ₹22,400 + ₹11,200 + ₹5,600 = ₹39,200 over the MSA 5.3 cap, Architect ticked, no 60-day notice found. **Read v2** adds admin access to customer records, the ₹39,200 and "the migration depends on the clean-up data, whose final report Trivenika now says will be 35 days late". **Recommendations**: delivery (high, draft): make the final report a condition before migration starts, ask for a signed change request, record the credit for Legal; rates (high, draft): reissue within the 8% cap, removing ₹39,200; data access (high): confirm with Rahul, then InfoSec and a DPA (MSA 8.1). **Plan v2** adds InfoSec review, DPA, insurance, the renewed ISO certificate and resolving the rate and delivery issues (Karan). Predicted ready **Tue 17 Nov**: "Trivenika's ISO certificate expires 8 Dec, so InfoSec will ask for the renewed one; last year Trivenika took 4 business days to send it. Based on sample history in this prototype." |
| A4 | Thu 12:05–12:20 | Rahul confirms data access (12:05). Rahul sends Ava's draft asking for insurance and the renewed ISO certificate (12:09). Karan uses Ava's rate draft (12:18) and sends it (12:20). | InfoSec and the DPA are now required by policy. Each person's Today shows only their items. Read v3 and plan v3 ("Data access confirmed: InfoSec review is now required by policy"). |
| A5 | Thu 16:25–16:30 | Ava prepares receipt summaries. Ananya approves ₹20L; Vikram approves the ₹38L 90-day total. | Each Decision Receipt opens with "Ava's summary for you": 3 bullets on what is approved and the open risks (rates over the cap, the late report). |
| A6 | Fri 13 Nov 09:48 | Arjun: "please find the updated quote attached. We've also attached our comments on the MSA." Proposal v2 (₹21,50,000) and MSA comments. | "What changed" banner: price changed in the attachment, ₹20,00,000 → ₹21,50,000 (+₹1,50,000); the email says nothing about price. The viewer opens v1 beside v2 with the new line "Data validation and UAT support … ₹1,50,000" highlighted. Said-vs-written conflict (impact ₹1,50,000). **Recommendation (medium)**: "The ₹1,50,000 is a new line … Ask Rahul before re-approving", with a one-click question. Read v4. Plan v4. |
| A7 | Fri 09:49–10:30 | Clock tick. Karan clicks "Ask with one click" (09:55). Rahul answers "Keep it: Keep UAT, our team is short-staffed." (10:30) | Budget and VP approvals **reopen** (₹20L → ₹21.5L; ₹38L → ₹39.5L). Handoff blocked. **What changed in the plan**: Budget approval reopened · VP approval reopened · Added: Ask Rahul about the new UAT line · Handoff blocked · Predicted date unchanged: Tue 17 Nov · Critical path is still the ISO certificate. Rahul's answer is logged as a human decision. |
| A8 | Mon 16 Nov 10:20–12:15 | 10:20 insurance certificate. 10:40 Proposal v3 and RateCard v2 with rates at ₹1,94,400, subtotal ₹21,10,800, UAT kept. 11:00 Ananya reconfirms at ₹21,10,800. 11:30 Karan records the sole-supplier exception and chooses "Require a change request" on the delivery conflict, noting the ₹90,000 credit for Legal. 12:15 Vikram reconfirms ₹39,10,800 and the exception. | The rate conflict closes ("Rates now within the 8% cap: ₹39,200 over-charge removed."). The price conflict closes on Ananya's reconfirmation. InfoSec still waits for the certificate. Read v5 and plan v5 ("Rate issue closed by the reissued rate card"). |
| A9 | Tue 17 Nov 11:05 | The renewed ISO certificate arrives; Meera approves. | **Ready for Legal Review.** Banner: "Ava did 77 actions; people made 13 decisions." "Predicted on Thu 11:40: Tue 17 Nov. Actual: Tue 17 Nov 11:05." Took 3 business days against a 1-day target; longest wait InfoSec on the renewed certificate. Handoff packet: Ava's final read, contract issues raised at intake (the delay credit and change request), the resolved rate issue, signed receipts, exceptions, items assigned to Legal (DPA), open notes. |

## Scenario B: Kosha renewal (5 steps)

Suresh (Finance) gets a renewal email that says nothing changes. Scenario B runs after all of Scenario A in the same world; choosing B finishes A first. It ends in **Ready to issue PO** at ₹21.3L.

| Step | Time | What happens | What Ava shows |
|---|---|---|---|
| B1 | Mon 23 Nov 10:00 | Priya: "Same price as this year, nothing changes. The order form is attached." | Opens **REQ-1063** (renewal of KO-SUB-2026). Renewal conflict: the email says nothing changes; the order form says ₹20,16,000 (12% above ₹18,00,000), 36 months and auto-renewal. Source A now also carries KA-MSA-2025 4.2 (12% over the 7% cap, max ₹19.26L; notice 38 days before term end, 60 required by 1 Nov) and 4.3 (auto-renewal needs written agreement). **Read**: as in the brief. **Recommendation (high, draft)**: ask for this year's terms; counter at 5% for 1 year without auto-renewal. **Plan**: predicted ready Tue 1 Dec, "Kosha took 6 business days to correct an order form last year." |
| B2 | Mon 10:19–10:20 | Suresh uses Ava's draft and sends it. | Conflict waiting on supplier since 10:20. |
| B3 | Mon 30 Nov 09:15 | Kosha billing sends invoice KA-7781 for the Forecast module add-on. | Linked to REQ-1063 (same supplier and addressee), marked "Started before approval". **Recommendation (medium)**: if Suresh confirms the module is needed, approve it retrospectively and add it to the renewal, so there is one PO. Plan adds the retrospective approval. |
| B4 | Tue 1 Dec 14:30 | Priya sends a revised form: 12 months, no automatic renewal, ₹18,90,000 (5%). | Tick: "5% increase: within the 7% cap (KA-MSA-2025 4.2)". The renewal conflict closes. Viewer shows v1 beside v2. |
| B5 | Tue 1 Dec 16:00–16:02 | Karan records the reason for the early start; Deepa approves. | **Ready to issue PO** at ₹21.3L. Dashboard "Ava caught this": "Renewal at 12% against a 7% cap, agreed 5%: ₹1,26,000 saved a year." Started before approval: Finance 1. Longest wait: Kosha's corrected order form (Mon 23 Nov 10:20 to Tue 1 Dec 14:30). |

## The repeat request (contrast)

"Show a repeat request" in the dock. Neha asks Arjun to extend the marketing dashboard work for 4 more weeks; Arjun replies with an SOW extension under the existing MSA. Ava files it under Marketing Ops, the 90-day total is ₹6L (under the limit), there is no data access, so only Ritu approves and it reaches **Ready to issue PO** in minutes. Message: asking first is faster than signing first.

## Background requests (visible from the first load)

16 other-team requests, REQ-1029 to REQ-1044, in `data/background.json`. They never change the scenario numbers. Each has a cached 2-sentence read, a plan with owners and a predicted date, Ava actions (with who they were for), decisions needing named people with recommendations, and a check count. Totals feed the dashboard counters so a fresh session has no zero counters except "Forms filled".

| Id | Supplier › Project | Status | Notable |
|---|---|---|---|
| REQ-1029 | TalentBridge › Contract QA engineers, Q1 (₹32.4L) | Blocked | Conflict: "Asha is moving; Rohan joins Monday" vs TB-MSA-2025 5.1, 5.2. **At risk.** Needs Karan and Vikram. |
| REQ-1030 | Nimbus Cloud › Log storage expansion (₹11.5L) | Waiting on Meera | SOC 2 summary for Meera |
| REQ-1031 | Rangmanch › Q4 product launch campaign (₹7.8L) | Ready (PO) | Suresh issues the PO |
| REQ-1032 | Sukhda › Housekeeping, Pune office (₹4.2L) | Waiting on Sukhda | **At risk**: "waiting 7 days for insurance; took 9 days last year" |
| REQ-1033 | Swift Movers › Laptop shipments to new hires (₹2.6L) | New | Karan's first look |
| REQ-1034 | Pixelwise › Product analytics renewal (₹22.8L) | Blocked | Conflict: up 14% while PW-ORD-2025 3 fixes ₹20L until 31 Mar 2027; ₹2,80,000 a year |
| REQ-1035 | TalentBridge › Support desk contractors (₹16.8L) | **Ready for Legal Review** | Contractors handle customer data; Farah drafts the DPA |
| REQ-1036 | Kalpana › Hindi and Tamil UI strings (₹95,000) | Approvals | Deepa approves |
| REQ-1037 | Nimbus Cloud › Disaster-recovery region (₹6.4L) | Approvals | Ananya approves |
| REQ-1038 | Greenleaf › Sales kickoff venue, Goa (₹18.9L) | Waiting on Rahul | Question: will Greenleaf handle attendee personal data? |
| REQ-1039 | Shieldline › Office access control upgrade (₹5.3L) | Approvals | Waiting on Aditi Verma |
| REQ-1040 | Rangmanch › Brand video, 3 cuts (₹3.1L) | Blocked | Conflict: shoot days invoiced before approval (₹3,10,000). Needs Neha's reason, then Ritu. |
| REQ-1041 | Codehive › Data warehouse audit (₹14.2L) | Waiting on Codehive | Conflict: "we've added two extra sprints, billed at the end" vs CH-MSA-2026 9.1, about ₹5.6L |
| REQ-1042 | Swift Movers › Mumbai office move (₹8.7L) | Ready (PO) | |
| REQ-1043 | LearnLoop › Manager training cohort (₹3.6L) | Approvals | Waiting on Sameer Kulkarni |
| REQ-1044 | Pixelwise › Extra seats, 40 users (₹2.1L) | New | Linked to the open Pixelwise renewal |

Background request pages (`/requests/REQ-10xx`) show the read, plan, conflict with recommendation and Ava's actions, all labelled Cached and "outside the guided demo".

## Try this (test lab)

Pre-filled emails in Captured mail, each running through the same pipeline:

| Prompt | Expected |
|---|---|
| As Arjun, reply with a quote for ₹23L | Said-vs-written conflict, 90-day total updates, approvals reopen; if already Ready, the handoff is withdrawn and Farah is told |
| As Arjun: "Our team has started work today" | Started-before-approval conflict |
| As a new supplier, send a quote | Possible new supplier, sent to Procurement |
| As Rahul, ask a supplier to renew with no changes | A new renewal request |
| As Arjun, send an expired ISO certificate | The security certificate check reopens for InfoSec |
