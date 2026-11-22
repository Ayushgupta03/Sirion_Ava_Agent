// Cached AI outputs for the scripted steps (Part 5). Same shape as /api/ava/read, /plan and /recommend.
// Written to match the expected substance in the revision brief. Regenerate with `npm run build-ai-cache` when a key is set.
import type { AiPlan, AiRead, AiRec, PlanStep } from "./aiTypes";

const H = "Based on sample history in this prototype.";
const st = (id: string, title: string, ownerId: string, source: "policy" | "ava", reason: string | undefined, dependsOn: string[] = [], eta?: string): PlanStep => ({ id, title, ownerId, source, reason, dependsOn, status: "todo", eta });

// ── Scenario A: Trivenika ──
export const A_READ: Record<string, AiRead> = {
  A1: { risks: ["Customer data access not mentioned", "Over the ₹25L VP limit"], sentences: [
    { text: "Rahul (Sales Ops) wants Trivenika to move the sales pipeline from the old CRM to Salesforce: about ₹20L, 8 weeks, from Mon 16 Nov.", citations: [{ type: "email", id: "e-a1", quote: "Rough budget is about ₹20L" }] },
    { text: "Migrating pipeline data usually means access to customer records, which Rahul has not mentioned.", citations: [{ type: "email", id: "e-a1", quote: "we're moving our sales pipeline from the old CRM to Salesforce" }] },
    { text: "Trivenika already has two SOWs from Sales Ops in the last 90 days, so the total is ₹38L, over the ₹25L VP limit.", citations: [{ type: "doc", id: "SOW-0412" }, { type: "doc", id: "SOW-0438" }] },
  ] },
  A3: { risks: ["Customer data access", "Rates over the MSA cap by ₹39,200", "Clean-up report 35 days late"], sentences: [
    { text: "Proposal v1 prices the Salesforce migration at ₹20,00,000 for 8 weeks from Mon 16 Nov.", citations: [{ type: "doc", id: "e-a2-att1", quote: "Subtotal (before GST) ₹20,00,000" }] },
    { text: "Trivenika mentions admin access to sync customer records, which Rahul has not confirmed.", citations: [{ type: "email", id: "e-a2", quote: "we'll need admin access to your Salesforce instance" }] },
    { text: "The rates break the MSA cap by ₹39,200, and no notice of an increase was found.", citations: [{ type: "clause", id: "TV-MSA-2024 5.3" }, { type: "doc", id: "e-a2-att1", quote: "Senior Salesforce Developer 2 2 ₹2,00,000 ₹8,00,000" }] },
    { text: "The migration depends on the clean-up data, whose final report Trivenika now says will be 35 days late.", citations: [{ type: "email", id: "e-a2", quote: "will now come on 20 Dec" }, { type: "clause", id: "SOW-0438 4.2" }] },
  ] },
  A4: { risks: ["Rates over the MSA cap by ₹39,200", "Clean-up report 35 days late", "ISO certificate expires 8 Dec"], sentences: [
    { text: "Rahul confirmed Trivenika will access customer data, so InfoSec review and a DPA are needed.", citations: [{ type: "email", id: "e-a2", quote: "admin access to your Salesforce instance" }, { type: "clause", id: "TV-MSA-2024 8.1" }] },
    { text: "Karan has asked Trivenika to reissue the rates within the 8% cap, which removes ₹39,200.", citations: [{ type: "clause", id: "TV-MSA-2024 5.3" }] },
    { text: "The clean-up report is still 35 days late, with 2 business days' notice instead of 10.", citations: [{ type: "clause", id: "SOW-0438 4.2" }, { type: "clause", id: "TV-MSA-2024 4.2" }] },
    { text: "Trivenika's ISO certificate expires 8 Dec, before the work ends.", citations: [{ type: "doc", id: "TV-ISO-2023" }] },
  ] },
  A6: { risks: ["New ₹1,50,000 UAT line", "Approvals given for ₹20L", "Clean-up report 35 days late"], sentences: [
    { text: "Proposal v2 adds a new line, Data validation and UAT support, for ₹1,50,000, so the quote is now ₹21,50,000.", citations: [{ type: "doc", id: "e-a3-att1", quote: "Data validation and UAT support 1 lump sum ₹1,50,000" }] },
    { text: "Arjun's email says nothing about price, and Ananya and Vikram approved the old amount.", citations: [{ type: "email", id: "e-a3", quote: "please find the updated quote attached" }] },
    { text: "The rates still break the MSA cap by ₹39,200, and the clean-up report is still 35 days late.", citations: [{ type: "clause", id: "TV-MSA-2024 5.3" }, { type: "clause", id: "SOW-0438 4.2" }] },
  ] },
  A8: { risks: ["Renewed ISO certificate outstanding", "Change request needed for the clean-up report"], sentences: [
    { text: "Proposal v3 reissues the rates within the 8% cap, so the quote is ₹21,10,800 with UAT support kept in.", citations: [{ type: "doc", id: "e-a6-att1", quote: "Subtotal (before GST) ₹21,10,800" }, { type: "clause", id: "TV-MSA-2024 5.3" }] },
    { text: "Ananya and Vikram reconfirmed, and Vikram approved the sole-supplier exception.", citations: [{ type: "doc", id: "Decision Receipt" }] },
    { text: "Karan required a change request for the late clean-up report and noted the delay credit of up to ₹90,000 for Legal.", citations: [{ type: "clause", id: "TV-MSA-2024 9.1" }, { type: "clause", id: "TV-MSA-2024 4.3" }] },
    { text: "Only the renewed ISO certificate is left before InfoSec can approve.", citations: [{ type: "email", id: "e-a4", quote: "The renewed ISO certificate will follow shortly" }] },
  ] },
  A9: { risks: ["Delay credit and change request for Legal"], sentences: [
    { text: "Trivenika sent the renewed ISO certificate and Meera approved, so the Salesforce migration is ready for Legal review at ₹21,10,800.", citations: [{ type: "email", id: "e-a5", quote: "attached is our renewed ISO 27001 certificate" }] },
    { text: "Legal needs to draft the DPA and confirm the delay credit of up to ₹90,000 and the change request for the clean-up report.", citations: [{ type: "clause", id: "TV-MSA-2024 8.1" }, { type: "clause", id: "TV-MSA-2024 9.1" }] },
    { text: "The rate issue was fixed by Trivenika's reissued rate card, saving ₹39,200.", citations: [{ type: "doc", id: "e-a6-att1" }] },
  ] },
};

const baseA = (extra: PlanStep[] = []): PlanStep[] => [
  st("check-nda-msa", "Check the NDA and MSA", "ava", "ava", "Found TV-NDA-2024 and TV-MSA-2024 on file."),
  st("get-quote", "Get Trivenika's written quote", "rahul", "ava", "Rahul's email gives a rough budget only. Approvals need a written amount.", [], "Thu 12 Nov"),
  st("confirm-data", "Confirm data access", "rahul", "ava", "Migration of customer records.", [], "Thu 12 Nov"),
  st("approve-budget", "Budget approval", "ananya", "policy", undefined, ["get-quote"], "Thu 12 Nov"),
  st("approve-vp", "VP approval of the 90-day total", "vikram", "policy", undefined, ["approve-budget"], "Fri 13 Nov"),
  st("competing", "Competing quote or authorized exception", "karan", "policy", undefined, [], "Fri 13 Nov"),
  ...extra,
];
const infosec = (eta: string): PlanStep[] => [
  st("security-cert", "Renewed ISO 27001 certificate from Trivenika", "meera", "ava", "The certificate on file expires 8 Dec, before the work ends.", ["confirm-data"], eta),
  st("insurance", "Insurance certificate", "karan", "ava", "Needed once customer data is in scope.", ["confirm-data"], "Mon 16 Nov"),
  st("approve-infosec", "InfoSec review of customer-data access", "meera", "ava", "Required by policy once Rahul confirms data access (rule 3).", ["confirm-data", "security-cert"], eta),
  st("dpa", "Data processing agreement (Legal review)", "farah", "ava", "MSA 8.1: a DPA must be signed before customer data is processed.", ["confirm-data"], "Legal review"),
];
const issues: PlanStep[] = [
  st("resolve-rates", "Get the rates reissued within the 8% cap", "karan", "ava", "Rates break MSA 5.3 by ₹39,200.", [], "Mon 16 Nov"),
  st("resolve-delivery", "Change request for the late clean-up report", "karan", "ava", "The report is 35 days late against SOW-0438 4.2.", [], "Mon 16 Nov"),
];
const handoff = (deps: string[]) => st("handoff", "Hand off to Legal review", "ava", "ava", "New SOW with customer data ends in Legal review (rule 9).", deps, "Tue 17 Nov");
const ISO_REASON = `Trivenika's ISO certificate expires 8 Dec, so InfoSec will ask for the renewed one; last year Trivenika took 4 business days to send it. ${H}`;

export const A_PLAN: Record<string, AiPlan> = {
  A1: { steps: [...baseA(), handoff(["approve-vp", "competing"])], criticalPath: ["get-quote", "approve-budget", "approve-vp", "handoff"], predictedReady: "Fri 13 Nov, if the quote arrives today", predictionReason: `Trivenika usually replies to commercial questions the same day. ${H}`, changesSinceLast: [] },
  A3: { steps: [...baseA(), ...infosec("Tue 17 Nov"), ...issues, handoff(["approve-vp", "competing", "approve-infosec", "resolve-rates", "resolve-delivery"])], criticalPath: ["confirm-data", "security-cert", "approve-infosec", "handoff"], predictedReady: "Tue 17 Nov", predictionReason: ISO_REASON, changesSinceLast: ["Added: InfoSec review, DPA, insurance and the renewed ISO certificate", "Added: resolve the rate and delivery issues (Karan)"] },
  A4: { steps: [...baseA(), ...infosec("Tue 17 Nov"), ...issues, handoff(["approve-vp", "competing", "approve-infosec", "resolve-rates", "resolve-delivery"])], criticalPath: ["security-cert", "approve-infosec", "handoff"], predictedReady: "Tue 17 Nov", predictionReason: ISO_REASON, changesSinceLast: ["Data access confirmed: InfoSec review is now required by policy"] },
  A7: { steps: [...baseA([st("resolve-uat", "Ask Rahul about the new UAT line (₹1,50,000)", "rahul", "ava", "Rahul's first email asked only for the migration.", [], "Fri 13 Nov")]), ...infosec("Tue 17 Nov"), ...issues, handoff(["approve-vp", "competing", "approve-infosec", "resolve-rates", "resolve-delivery", "resolve-uat"])], criticalPath: ["security-cert", "approve-infosec", "handoff"], predictedReady: "Tue 17 Nov", predictionReason: `The critical path is still the ISO certificate. ${ISO_REASON}`, changesSinceLast: ["Critical path is still the ISO certificate"] },
  A8: { steps: [...baseA([st("resolve-uat", "Ask Rahul about the new UAT line (₹1,50,000)", "rahul", "ava", "Rahul's first email asked only for the migration.")]), ...infosec("Tue 17 Nov"), ...issues, handoff(["approve-vp", "competing", "approve-infosec", "resolve-rates", "resolve-delivery", "resolve-uat"])], criticalPath: ["security-cert", "approve-infosec", "handoff"], predictedReady: "Tue 17 Nov", predictionReason: `Only the renewed ISO certificate is left. Arjun said it will follow shortly; last year it took 4 business days. ${H}`, changesSinceLast: ["Rate issue closed by the reissued rate card"] },
};

export const A_REC: Record<string, AiRec> = {
  delivery: { recommendation: "Make the final clean-up report a condition before migration work starts, and ask Trivenika for a signed change request for the new date. Record the delay credit of up to ₹90,000 for Legal to confirm.", reasoning: "The migration uses the cleaned data, and SOW-0438 4.2 set 15 Nov. MSA 4.3 and 12.1 say a new date needs a signed change request.", citations: [{ type: "clause", id: "SOW-0438 4.2" }, { type: "clause", id: "TV-MSA-2024 4.3" }, { type: "clause", id: "TV-MSA-2024 9.1" }], confidence: "high", action: "draft_supplier",
    draft: "Hi Arjun,\n\nThanks for the heads-up on the data-quality report. SOW-0438 4.2 set 15 Nov, and MSA 4.2 asks for 10 business days' notice of a delay. Please send a signed change request for the new date (MSA 4.3). We will need the final report before the migration starts.\n\nThanks,\nKaran" },
  rates: { recommendation: "Ask Trivenika to reissue the rate card within the 8% cap; that removes ₹39,200 from this quote.", reasoning: "MSA 5.3 allows at most 8% over Schedule A, with 60 days' notice. Three roles are above that, and no notice was found.", citations: [{ type: "clause", id: "TV-MSA-2024 5.3" }, { type: "doc", id: "e-a2-att1" }], confidence: "high", action: "draft_supplier",
    draft: "Hi Arjun,\n\nThe rates in Proposal v1 are above the cap in our MSA (5.3): at most 8% over Schedule A, so ₹1,94,400 a month for the Senior Developer, Data Migration and PM roles. We also have no notice of an increase. Could you reissue the rate card and proposal within the cap?\n\nThanks,\nKaran" },
  data: { recommendation: "Confirm with Rahul; if yes, InfoSec review and a DPA are needed (MSA 8.1).", reasoning: "Arjun asks for admin access to sync customer records. Rahul's request did not mention it.", citations: [{ type: "email", id: "e-a2", quote: "admin access to your Salesforce instance" }, { type: "clause", id: "TV-MSA-2024 8.1" }], confidence: "high" },
  uat: { recommendation: "The ₹1,50,000 is a new line, Data validation and UAT support. Rahul's first email asked only for migration, so this may be optional or something our team does itself. Ask Rahul before re-approving.", reasoning: "The line appears only in Proposal v2. The cover email says nothing about price.", citations: [{ type: "doc", id: "e-a3-att1", quote: "Data validation and UAT support 1 lump sum ₹1,50,000" }, { type: "email", id: "e-a1" }], confidence: "medium", action: "ask_requester",
    draft: "Proposal v2 adds Data validation and UAT support for ₹1,50,000. Your first email asked only for the migration. Keep it in scope?" },
  receipt_budget: { recommendation: "Summary for Ananya", reasoning: "What you are approving and the open risks.", citations: [{ type: "doc", id: "e-a2-att1" }], confidence: "high", bullets: ["You are approving ₹20,00,000 for the Salesforce migration (Proposal v1), 8 weeks from Mon 16 Nov.", "Open: the rates are ₹39,200 over the MSA cap; Karan has asked Trivenika to reissue them.", "Open: the clean-up report is 35 days late; the migration depends on it."] },
  receipt_vp: { recommendation: "Summary for Vikram", reasoning: "What you are approving and the open risks.", citations: [{ type: "doc", id: "SOW-0412" }, { type: "doc", id: "SOW-0438" }], confidence: "high", bullets: ["You are approving the ₹38L 90-day total with Trivenika in Sales Ops: ₹9L + ₹9L + ₹20L.", "That is over the ₹25L limit; Karan still needs a competing quote or an exception.", "Open: rates over the MSA cap (₹39,200) and a late clean-up report."] },
};

// ── Scenario B: Kosha ──
export const B_READ: Record<string, AiRead> = {
  B1: { risks: ["12% increase against a 7% cap", "3-year term and auto-renewal", "Notice 38 days before term end"], sentences: [
    { text: "Kosha's email says the renewal is unchanged, but the order form raises the price 12% (₹18L → ₹20.16L), extends the term to 3 years and adds auto-renewal.", citations: [{ type: "email", id: "e-b1", quote: "Same price as this year, nothing changes" }, { type: "doc", id: "e-b1-att1" }] },
    { text: "The contract (KA-MSA-2025 4.2, 4.3) caps increases at 7% with 60 days' notice and needs written agreement for auto-renewal.", citations: [{ type: "clause", id: "KA-MSA-2025 4.2" }, { type: "clause", id: "KA-MSA-2025 4.3" }] },
    { text: "The notice came 38 days before term end.", citations: [{ type: "email", id: "e-b1" }, { type: "clause", id: "KA-MSA-2025 2" }] },
  ] },
  B3: { risks: ["Forecast module invoiced before approval", "12% increase against a 7% cap"], sentences: [
    { text: "Kosha invoiced the Forecast module (KA-7781) before anyone approved it.", citations: [{ type: "email", id: "e-b3" }, { type: "doc", id: "e-b3-att1" }] },
    { text: "The renewal itself is still waiting on Kosha's corrected order form.", citations: [{ type: "clause", id: "KA-MSA-2025 4.2" }] },
  ] },
  B4: { risks: ["Forecast module started before approval"], sentences: [
    { text: "Kosha's revised form is 12 months at ₹18,90,000, a 5% increase with no automatic renewal.", citations: [{ type: "email", id: "e-b4", quote: "12 months, no automatic renewal" }, { type: "doc", id: "e-b4-att1" }] },
    { text: "That is within the 7% cap in KA-MSA-2025 4.2, so the renewal conflict is closed.", citations: [{ type: "clause", id: "KA-MSA-2025 4.2" }] },
    { text: "The Forecast module invoice still needs a reason and Deepa's approval.", citations: [{ type: "doc", id: "e-b3-att1" }] },
  ] },
};
const bSteps = (): PlanStep[] => [st("renewal-terms", "Renewal terms match what was agreed", "karan", "policy", undefined, [], "Tue 1 Dec"), st("retro", "Reason and retrospective approval for the Forecast module", "karan", "policy", undefined, [], "Tue 1 Dec"), st("approve-budget", "Budget approval", "deepa", "policy", undefined, ["renewal-terms", "retro"], "Tue 1 Dec"), st("handoff", "Issue the PO", "ava", "ava", "One PO for the renewal and the module.", ["approve-budget"], "Tue 1 Dec")];
export const B_PLAN: Record<string, AiPlan> = {
  B4: { steps: bSteps(), criticalPath: ["retro", "approve-budget", "handoff"], predictedReady: "Tue 1 Dec", predictionReason: "Only Deepa's approval and the reason for the early start are left.", changesSinceLast: ["Renewal terms now match the contract"] },
  B5: { steps: bSteps(), criticalPath: [], predictedReady: "Tue 1 Dec", predictionReason: "Ready to issue the PO.", changesSinceLast: ["Ready to issue PO"] },
  B1: { steps: [st("renewal-terms", "Renewal terms match what was agreed", "karan", "policy", undefined, [], "Tue 1 Dec"), st("approve-budget", "Budget approval", "deepa", "policy", undefined, ["renewal-terms"], "Tue 1 Dec"), st("handoff", "Issue the PO", "ava", "ava", "Renewal under an existing agreement, no data access: ends in Ready to issue PO.", ["approve-budget"], "Tue 1 Dec")], criticalPath: ["renewal-terms", "approve-budget", "handoff"], predictedReady: "Tue 1 Dec", predictionReason: `Kosha took 6 business days to correct an order form last year. ${H}`, changesSinceLast: [] },
  B3: { steps: [st("renewal-terms", "Renewal terms match what was agreed", "karan", "policy", undefined, [], "Tue 1 Dec"), st("retro", "Reason and retrospective approval for the Forecast module", "karan", "policy", undefined, [], "Tue 1 Dec"), st("approve-budget", "Budget approval", "deepa", "policy", undefined, ["renewal-terms", "retro"], "Tue 1 Dec"), st("handoff", "Issue the PO", "ava", "ava", "One PO for the renewal and the module.", ["approve-budget"], "Tue 1 Dec")], criticalPath: ["renewal-terms", "approve-budget", "handoff"], predictedReady: "Tue 1 Dec", predictionReason: `Still waiting on Kosha's corrected form; last year it took 6 business days. ${H}`, changesSinceLast: ["Added: retrospective approval for the Forecast module"] },
};
B_READ.B5 = { risks: [], sentences: [
  { text: "The Kosha renewal is ready for a PO at ₹21.3L: ₹18,90,000 for 12 months plus the Forecast module.", citations: [{ type: "doc", id: "e-b4-att1" }, { type: "doc", id: "e-b3-att1" }] },
  { text: "The agreed 5% is within the 7% cap, against 12% in the first form: ₹1,26,000 saved a year.", citations: [{ type: "clause", id: "KA-MSA-2025 4.2" }] },
  { text: "Deepa approved the module retrospectively, with Karan's recorded reason.", citations: [{ type: "doc", id: "Decision Receipt" }] },
] };
export const B_REC: Record<string, AiRec> = {
  renewal: { recommendation: "Ask Kosha for this year's terms. The contract allows at most 7% (₹19.26L) and the notice was late, so counter at 5% for 1 year without auto-renewal.", reasoning: "KA-MSA-2025 4.2 caps increases at 7% with notice by 1 Nov; the email came on 23 Nov. Clause 4.3 rules out auto-renewal without written agreement.", citations: [{ type: "clause", id: "KA-MSA-2025 4.2" }, { type: "clause", id: "KA-MSA-2025 4.3" }, { type: "doc", id: "e-b1-att1" }], confidence: "high", action: "draft_supplier",
    draft: "Hi Priya,\n\nYour email says nothing changes, but the order form has a 12% increase, a 3-year term and auto-renewal. Our agreement (KA-MSA-2025 4.2 and 4.3) caps increases at 7% with notice by 1 Nov, and rules out auto-renewal without written agreement. Could you send a form for 12 months at 5%, with no automatic renewal?\n\nThanks,\nSuresh" },
  invoice: { recommendation: "Finance has used the module since the free trial. If Suresh confirms it is needed, approve it retrospectively and add it to the renewal, so there is one PO.", reasoning: "Invoice KA-7781 is for the Forecast module add-on, which no request covers.", citations: [{ type: "doc", id: "e-b3-att1" }], confidence: "medium" },
};
