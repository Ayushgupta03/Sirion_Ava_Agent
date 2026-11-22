// Ask Ava, the front door. An employee describes a need in their own words, before any supplier email exists.
// parseIntake reads the text with rules (a live model can replace it later; the output shape is the same).
// buildIntake turns the confirmed fields into an Email and an Extraction that go through the same pipeline as everything else.
// previewIntake runs that event on a copy of the state and returns what the request would need, before anyone commits.
import type { Email, ExtractedFact, Extraction, RequestType, State, Supplier } from "./types";
import { applyEvent } from "./engine/pipeline";
import { analyze } from "./engine/rules";
import { addMinutes, inr, lakh, nextWeekday, parseAmount, uid } from "./format";
import { person, personName } from "./engine/world";

export interface IntakeFields {
  text: string;
  supplierName: string;
  supplierId?: string; // a supplier already on the list
  supplierContact: string; // email, needed for a new supplier
  project: string;
  budget: string; // as written, e.g. "about ₹6L"
  dataAccess: "yes" | "no" | "unknown";
  duration: string;
  start: string; // as written, e.g. "in 3 weeks"
  type: RequestType;
}

export const INTAKE_ADDRESS = "ava@prayaan.example";

const DOW: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function parseIntake(text: string, suppliers: Pick<Supplier, "id" | "name" | "domain" | "contacts">[]): IntakeFields {
  const low = text.toLowerCase();
  const known = suppliers.find((s) => low.includes(slug(s.name.split(" ")[0]).length > 3 ? s.name.split(" ")[0].toLowerCase() : s.name.toLowerCase()));
  let supplierName = known?.name ?? "";
  if (!supplierName) {
    const m = text.match(/\b(?:with|from|hire|hiring|use|using|engage|engaging|appoint|onboard|need|needs|want|wants)\s+((?:[A-Z][\w&'-]*)(?:\s+[A-Z][\w&'-]*){0,3})/);
    supplierName = m?.[1]?.trim() ?? "";
  }
  const amountMatch = text.match(/(?:about|around|roughly|approx\w*|up to|under)?\s*(?:₹|rs\.?\s?|inr\s?)\s?[\d,.]+\s*(?:l\b|lakh|lakhs|lac|cr\b|crore)?|(?:about|around|roughly)?\s*\b\d+(?:\.\d+)?\s?(?:l|lakh|lakhs|lac|cr|crore)\b/i);
  const budget = amountMatch ? amountMatch[0].trim().replace(/^rs\.?\s?/i, "₹").replace(/\s+/g, " ") : "";
  const startM = text.match(/\bstart(?:ing|s)?\s+((?:on |from |next |this )?(?:monday|tuesday|wednesday|thursday|friday)|in \d+\s*(?:days?|weeks?)|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{4})?)/i) ?? text.match(/\b(?:by|from)\s+(\d{1,2}\s+[A-Za-z]{3,9})/i);
  const start = startM ? startM[1].replace(/^(on|from|next|this)\s+/i, "") : "";
  // The start phrase ("in 3 weeks") is not the duration, so read the duration from what is left.
  const rest = startM ? text.replace(startM[0], " ") : text;
  const dur = rest.match(/(?:for|over|about|around)?\s*(\d+)\s*(weeks?|months?)\b/i);
  const duration = dur ? `${/about|around/i.test(dur[0]) ? "about " : ""}${dur[1]} ${dur[2].toLowerCase()}` : "";
  const no = /\bno\s+(customer|personal|client)\s+data|\bno data access|without\s+(any\s+)?(customer|personal)\s+data|(doesn.t|does not|won.t|will not)\s+(touch|need|access|see)\s+(any\s+)?(customer|personal)/i.test(text);
  const yes = /customer (data|records)|personal data|\bpii\b|admin access|access to (our )?(crm|salesforce|database|systems|customer)|sensitive data|employee data/i.test(text);
  const dataAccess = no ? "no" : yes ? "yes" : "unknown";
  const type: RequestType = /\brenew/i.test(text) ? "renewal" : /\bextend|extension|more weeks|more months\b/i.test(text) ? "amendment" : "new_sow";
  // Project: the thing being bought, trimmed from the first sentence.
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  const pm = first.match(/\b(?:for|to build|to do|to run|to deliver|to set up|build(?:ing)?|run(?:ning)?|need(?:s)? (?:a|an|the))\s+(.+?)(?:,|\.|;| about | around | roughly | for ₹| starting | start | by | with no | with ₹|$)/i);
  const raw = (pm?.[1] ?? first).replace(/^(a|an|the)\s+/i, "").replace(/^(contract|agreement|sow)\s+(with|for)\s+\S+\s*/i, "").trim();
  const project = (raw.length > 70 ? raw.slice(0, 67).replace(/\s+\S*$/, "") + "…" : raw).replace(/^./, (c) => c.toUpperCase());
  return { text, supplierName: supplierName.replace(/[,.]$/, ""), supplierId: known?.id, supplierContact: known?.contacts[0]?.email ?? "", project, budget, dataAccess, duration, start, type };
}

function startValue(start: string, now: string) {
  if (!start) return "";
  const dow = start.toLowerCase().match(/monday|tuesday|wednesday|thursday|friday/)?.[0];
  const rel = start.match(/in (\d+)\s*(day|week)/i);
  let d: string | undefined;
  if (dow) d = nextWeekday(now, DOW[dow]);
  else if (rel) { const t = new Date(now); t.setUTCDate(t.getUTCDate() + +rel[1] * (/week/i.test(rel[2]) ? 7 : 1)); d = new Date(t.getTime() + 330 * 60000).toISOString().slice(0, 10); }
  if (!d) return start;
  const dt = new Date(d + "T00:00:00Z");
  return `${DAY[dt.getUTCDay()]} ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export function buildIntake(f: IntakeFields, requesterId: string, state: Pick<State, "now" | "suppliers">): { email: Email; extraction: Extraction } {
  const requester = person(requesterId)!;
  const id = uid("int");
  const sup = state.suppliers.find((s) => s.id === f.supplierId);
  const extra: string[] = [];
  const has = (needle: string) => !!needle && f.text.toLowerCase().includes(needle.toLowerCase());
  if (f.budget && !has(f.budget)) extra.push(`Budget: ${f.budget}.`);
  if (f.duration && !has(f.duration)) extra.push(`Duration: ${f.duration}.`);
  if (f.dataAccess === "yes" && !/customer|personal|admin access|pii/i.test(f.text)) extra.push("The supplier will access customer data.");
  if (f.dataAccess === "no" && !/\bno\b.*\bdata\b/i.test(f.text)) extra.push("No access to personal or customer data.");
  if (f.supplierContact && !sup) extra.push(`Supplier contact: ${f.supplierContact}.`);
  const body = [f.text.trim(), extra.length ? `\nAnswered in Ask Ava:\n${extra.join("\n")}` : ""].join("");
  const sentAt = addMinutes(state.now, 1);
  const sentences = body.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const quoteFor = (needle: string) => sentences.find((s) => needle && s.toLowerCase().includes(needle.toLowerCase())) ?? sentences[0];
  const facts: ExtractedFact[] = [];
  const src = (quote: string) => ({ file: "email", quote });
  if (f.project) facts.push({ field: "scope", value: f.project, state: "confirmed", source: src(sentences[0]) });
  if (f.budget) facts.push({ field: "amount_pre_gst", value: f.budget, state: "unconfirmed", source: src(quoteFor(f.budget)) });
  if (f.duration) facts.push({ field: "duration", value: f.duration, state: /about|around/i.test(f.duration) ? "unconfirmed" : "confirmed", source: src(quoteFor(f.duration)) });
  const sv = startValue(f.start, sentAt);
  if (sv) facts.push({ field: "start_date", value: sv, state: "confirmed", source: src(quoteFor(f.start)) });
  if (f.dataAccess === "yes") facts.push({ field: "data_access", value: "Yes: the supplier will access customer data", state: "confirmed", source: src(sentences.find((s) => /customer|personal|admin access|pii|access/i.test(s)) ?? sentences[0]) });
  if (f.dataAccess === "no") facts.push({ field: "data_access", value: "No access to personal or customer data", state: "confirmed", source: src(sentences.find((s) => /\bno\b.*data|without.*data|data/i.test(s)) ?? sentences[0]) });
  const email: Email = { id, threadId: `t-${id}`, from: requester.email, to: [INTAKE_ADDRESS], cc: [], subject: `New request: ${f.project || "supplier work"}`, body, sentAt, attachments: [], origin: "intake" };
  const extraction: Extraction = {
    isSupplierCommunication: false,
    supplier: f.supplierName ? { name: sup?.name ?? f.supplierName, domain: sup?.domain ?? `${slug(f.supplierName)}.example`, known: !!sup?.domain } : null,
    supplierContact: f.supplierContact || undefined,
    filing: { project: f.project || "General", request: "NEW", requestType: f.type, confidence: sup ? "high" : "low", reason: sup ? `${personName(requesterId)} named ${sup.name} in Ask Ava` : `${personName(requesterId)} named a supplier that is not on the list` },
    facts, changesVsKnown: [], flags: [],
  };
  return { email, extraction };
}

export interface IntakePreview {
  duplicateOf?: { id: string; title: string };
  approvals: { who: string; why: string }[];
  rules: string[];
  endState: string;
  spendText: string;
  spendTotal: number;
  overLimit: boolean;
  gate: string;
  draft?: { to: string; body: string; autoSent: boolean };
  newSupplier: boolean;
  costCentre: string;
}

/** What this request would need, computed by the real engine on a copy of the state. Nothing is saved. */
export function previewIntake(state: State, f: IntakeFields, requesterId: string): IntakePreview | null {
  if (!person(requesterId)) return null;
  const { email, extraction } = buildIntake(f, requesterId, state);
  const before = state.requestOrder.length;
  const next = applyEvent(state, { id: "preview", at: email.sentAt, kind: "email", email, extraction, extractionSource: "basic" });
  const rid = next.threadRequest[email.threadId]; if (!rid) return null;
  const a = analyze(next, rid);
  const dup = next.requestOrder.length === before;
  const draft = next.drafts.find((d) => d.requestId === rid && d.id === `draft-rfq-${rid}`);
  const approvals = a.routing.approvals.map((x) => ({ who: personName(x.approverId), why: x.reason }));
  if (a.routing.needsCompetingQuote) approvals.push({ who: personName("karan"), why: `Competing quote or an authorized exception: ${a.spend.text} is over ₹25L.` });
  return {
    duplicateOf: dup ? { id: rid, title: next.requests[rid].title } : undefined,
    approvals, rules: a.routing.rules.filter((r) => r.fired || r.id === "R9").map((r) => r.text),
    endState: a.routing.endState === "legal" ? "Ready for Legal Review" : "Ready to issue PO", spendText: a.spend.text, spendTotal: a.spend.total, overLimit: a.spend.overLimit,
    gate: "Approvers are asked once the supplier's written quote confirms the amount. Until then nobody signs for a rough number.",
    draft: draft ? { to: draft.to, body: draft.body, autoSent: draft.status === "sent" } : undefined,
    newSupplier: !a.req.supplierId, costCentre: a.req.costCentre,
  };
}

export const EXAMPLES: { who: string; label: string; text: string }[] = [
  { who: "neha", label: "Small job, existing agreement", text: "I'd like Trivenika to build a campaign attribution dashboard for Marketing Ops, about ₹6L, starting in 3 weeks for about 6 weeks. No customer data, just campaign spend and web analytics." },
  { who: "rahul", label: "Crosses the VP limit, uses customer data", text: "We want Trivenika to set up lead-scoring in Salesforce, around ₹12L, starting Monday. They will need admin access to customer records in our CRM." },
  { who: "aditi", label: "New supplier", text: "We need Urban Shine Facility Services for housekeeping at the Pune office, about ₹4L for 6 months. No customer data." },
];

export { inr, lakh, parseAmount };
