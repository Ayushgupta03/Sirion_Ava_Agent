// Scripted emails used by the story player and the seed. They go through the same pipeline as composed email.
import type { Email } from "./types";
import { sampleAttachment } from "./samples";

const at = (d: string, t: string) => `${d}T${t}:00+05:30`;
const mk = (e: Omit<Email, "attachments" | "origin" | "cc"> & { cc?: string[]; files?: string[]; origin?: Email["origin"] }): Email => ({
  ...e, cc: e.cc ?? [], origin: e.origin ?? "scripted",
  attachments: (e.files ?? []).map((f, i) => sampleAttachment(f, `${e.id}-att${i + 1}`)),
});

const RAHUL = "rahul.mehta@prayaan.example", ARJUN = "arjun.d@trivenika.example", SURESH = "suresh.pillai@prayaan.example", PRIYA = "priya.r@kosha.example", NEHA = "neha.kapoor@prayaan.example";
const SFM = "Salesforce migration – can you help?";

export const SCRIPTED: Record<string, Email> = Object.fromEntries([
  mk({ id: "e-k1", threadId: "t-kalakriti", origin: "seed", from: "accounts@kalakriti.example", to: ["ap@prayaan.example"], subject: "Invoice INV-KDS-2291: Brand refresh, phase 1", sentAt: at("2026-11-10", "15:20"),
    body: "Dear Accounts team,\n\nPlease find attached invoice INV-KDS-2291 for the brand refresh, phase 1. Payment is due in 30 days.\n\nRegards,\nKalakriti Design Studio", files: ["Kalakriti_Invoice_INV-KDS-2291.pdf"] }),
  mk({ id: "e-a1", threadId: "t-sfm", from: RAHUL, to: [ARJUN], subject: SFM, sentAt: at("2026-11-12", "10:12"),
    body: "Hi Arjun, we're moving our sales pipeline from the old CRM to Salesforce. Rough budget is about ₹20L. Can your team start Monday? Need it done in about 8 weeks. Thanks, Rahul" }),
  mk({ id: "e-a2", threadId: "t-sfm", from: ARJUN, to: [RAHUL], subject: `RE: ${SFM}`, sentAt: at("2026-11-12", "11:40"),
    body: "Hi Rahul, happy to help. Our proposal and rate card are attached. To migrate the customer records we'll need admin access to your Salesforce instance so we can sync and validate the data. Regards, Arjun",
    files: ["Trivenika_Proposal_v1.pdf", "Trivenika_RateCard_2026.xlsx"] }),
  mk({ id: "e-a3", threadId: "t-sfm", from: ARJUN, to: [RAHUL], subject: `RE: ${SFM}`, sentAt: at("2026-11-13", "09:48"),
    body: "Hi Rahul, please find the updated quote attached. We've also attached our comments on the MSA. Regards, Arjun", files: ["Trivenika_Proposal_v2.pdf", "Trivenika_MSA_comments.pdf"] }),
  mk({ id: "e-a4", threadId: "t-sfm", from: ARJUN, to: [RAHUL], subject: `RE: ${SFM}`, sentAt: at("2026-11-16", "10:20"),
    body: "Hi Rahul, as requested, our insurance certificate is attached. The renewed ISO certificate will follow shortly. Regards, Arjun", files: ["Trivenika_Insurance_Certificate.pdf"] }),
  mk({ id: "e-a5", threadId: "t-sfm", from: ARJUN, to: [RAHUL], subject: `RE: ${SFM}`, sentAt: at("2026-11-17", "11:05"),
    body: "Hi Rahul, attached is our renewed ISO 27001 certificate. Regards, Arjun", files: ["Trivenika_ISO27001_2026-2029.pdf"] }),
  mk({ id: "e-b1", threadId: "t-kosha", from: PRIYA, to: [SURESH], subject: "Your Kosha renewal", sentAt: at("2026-11-23", "10:00"),
    body: "Hi Suresh, your renewal is coming up on 31 Dec. Same price as this year, nothing changes. The order form is attached for signature. Best, Priya", files: ["Kosha_Renewal_Order_Form.pdf"] }),
  mk({ id: "e-b3", threadId: "t-kosha-inv", from: "billing@kosha.example", to: [SURESH], subject: "Kosha invoice KA-7781", sentAt: at("2026-11-30", "09:15"),
    body: "Dear Suresh, please find attached invoice KA-7781 for the Forecast module add-on. Regards, Kosha billing", files: ["Kosha_Invoice_KA-7781.pdf"] }),
  mk({ id: "e-b4", threadId: "t-kosha", from: PRIYA, to: [SURESH], subject: "RE: Your Kosha renewal", sentAt: at("2026-12-01", "14:30"),
    body: "Hi Suresh, sorry about that. The earlier form was our standard 3-year template. The revised form is attached: 12 months, no automatic renewal. The annual fee is ₹18,90,000, a 5% increase in line with our 2027 price list. Best, Priya",
    files: ["Kosha_Renewal_Order_Form_v2.pdf"] }),
].map((e) => [e.id, e]));

/** Contrast request emails, created at the current clock. */
export function contrastEmails(nowIso: string): Email[] {
  const t1 = new Date(new Date(nowIso).getTime() + 5 * 60000), t2 = new Date(t1.getTime() + 40 * 60000);
  const iso = (d: Date) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 19) + "+05:30";
  return [
    mk({ id: "e-c1", threadId: "t-mkt", from: NEHA, to: [ARJUN], subject: "Marketing dashboard: 4 more weeks?", sentAt: iso(t1),
      body: "Hi Arjun, can you extend the marketing dashboard work for 4 more weeks? Same team as last time. Thanks, Neha" }),
    mk({ id: "e-c2", threadId: "t-mkt", from: ARJUN, to: [NEHA], subject: "RE: Marketing dashboard: 4 more weeks?", sentAt: iso(t2),
      body: "Hi Neha, sure. The SOW extension is attached, under our existing MSA. Regards, Arjun", files: ["Trivenika_SOW_Extension.pdf"] }),
  ];
}
