# Glossary

| Term | Meaning |
|---|---|
| Intake | Everything from the first supplier email to a request ready for Legal or a PO |
| Request (REQ-…) | One contract need, built by Ava from email |
| Fact | A value the request needs (amount, scope, data access, term, supplier entity, start date…) with state, origin, sources and versions |
| Material fact | Amount, scope, data access, term, supplier entity: changing one can reopen approvals |
| Fact states | Missing, Unconfirmed, Contradicted, Confirmed |
| Supersession | A newer document replaces an older value; the old version is kept |
| 90-day total | Spend before GST with one supplier in one cost centre over a rolling 90 days |
| Routing | Which approvals and reviews a request needs, and why |
| Decision Receipt | An approval record with a snapshot of exactly what was approved |
| Needs reconfirmation | An approval whose snapshot no longer matches the facts (only increases count for money) |
| Conflict | Two sources disagree; a person resolves it; Ava never picks a side |
| Goes against the contract | A conflict between an email or quote and a signed clause |
| Commitment | A checkable promise in a signed contract (rate cap, due date, notice, insurance…) |
| Check | One commitment checked against one email or document: consistent, conflict or note |
| Change request (CR) | A signed agreement to change scope, fees or dates (MSA 4.3, 12.1) |
| Delay credit | 2% of SOW fees per full week late, up to 10% (MSA 9.1) |
| Handoff | Leaving intake: Ready for Legal Review or Ready to issue PO |
| Handoff packet | What Legal or Finance receives: facts, sources, receipts, issues, notes |
| Withdrawal | A ready request pulled back because facts changed |
| Started before approval | Work or invoices before approvals were complete |
| Orphan invoice | An invoice with no request, contract or PO |
| Item | One thing waiting on one person (question, approval, conflict, draft…) |
| Ava's read | Ava's cited summary of a request |
| Ava's plan | Steps, owners, critical path and predicted ready date |
| Required by policy / Added by Ava | Plan step badges: from the rules engine, or Ava's own step with a reason |
| Ava recommends | One next step with reasoning, confidence and an optional draft |
| Ava did | Ava's logged actions; people's actions are decisions |
| Fingerprint | What an AI output depends on; when it changes, the output is stale |
| Live AI / Cached / Simulated | Where an AI output came from: the model, a hand-written stored answer, or code writing it from the facts |
| Eval | An automatic check of an AI output against the prompt's rules |
| Background request | Another team's request: static sample data, outside the guided demo |
| Test lab | The composer for simulating any incoming email |
| Ask Ava | The front door (`/new`): an employee describes a need in their own words before any supplier email; Ava previews what it needs and opens the request |
| Autonomy | What Ava may do without a click, set per kind of message: inform, draft, send routine messages; never decide |
| Routine message | A message that commits no money and changes no terms (a quote request, a document chaser). The only kind Ava may send herself, when switched on |
| Auto-sent | An email Ava sent under the autonomy settings; shown as "Sent by Ava, routine" |
| Prayaan's own time | Time from the first message to Ready minus every stretch spent waiting on the supplier; the north star's 1-day target applies to it |
| Supplier wait | From a message to the supplier until their reply |
| North star | Requests that reach Ready complete, correctly routed, never withdrawn, with Prayaan's own time under 1 day |
| Touches per request | People decisions per request; lower means Ava does more of the legwork |
| What this reached (ripple) | The panel that shows whose open items a change added or closed, with a button to switch to their view |
| Supplier view | `/supplier/[id]`: what a supplier sees for one request, and where they reply |
