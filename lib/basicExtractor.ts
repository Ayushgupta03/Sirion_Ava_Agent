// Basic extractor: rules and regex. Used when there is no API key or the API fails.
// Same output shape as the AI (section 6), with lower confidence.
import type { Email, ExtractedFact, Extraction, Supplier } from "./types";
import { domainOf, nextWeekday, parseAmount } from "./format";
import { stripQuoted } from "./quoted";

const DOW: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sentences(body: string) {
  return body.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function basicExtract(email: Email, suppliers: Pick<Supplier, "name" | "domain" | "known">[]): Extraction {
  const facts: ExtractedFact[] = [];
  const addrs = [email.from, ...email.to, ...email.cc];
  const sup = suppliers.find((s) => addrs.some((a) => domainOf(a) === s.domain));
  const ext = addrs.find((a) => domainOf(a) && !domainOf(a).endsWith("prayaan.example"));
  const fromEmployee = domainOf(email.from).endsWith("prayaan.example");
  const body = stripQuoted(email.body); // quoted earlier messages are not this email
  const all = `${email.subject} ${body} ${email.attachments.map((a) => a.pages.flat().join(" ")).join(" ")}`;
  const low = all.toLowerCase();

  const isInvoice = /\binvoice\b/i.test(email.subject + " " + email.attachments.map((a) => a.name).join(" ")) || email.attachments.some((a) => /tax invoice/i.test(a.pages.flat().join(" ")));
  const requestType = isInvoice ? "invoice" : /renew/i.test(email.subject + body) ? "renewal" : /\bextend|extension\b/i.test(email.subject + body) ? "amendment" : "new_sow";

  // Email body
  const sents = sentences(body);
  sents.forEach((raw, i) => {
    const s = raw.replace(/^(hi|hello|dear)\s+[a-z]+,\s*/i, "");
    if (/₹|\brs\.?\s?\d|\binr\b|\d+\s?(l|lakh|crore)\b/i.test(s) && parseAmount(s) != null)
      facts.push({ field: "amount_pre_gst", value: s.match(/(about|around|approx\w*)?\s*₹\s?[\d,.]+\s*(l|lakh|crore)?/i)?.[0].trim() ?? s, state: /about|around|rough|approx|budget/i.test(s) ? "unconfirmed" : "confirmed", source: { file: "email", quote: raw } });
    if (/same price|nothing changes|no changes?\b|unchanged/i.test(s)) {
      facts.push({ field: "other", value: "Nothing changes", state: "unconfirmed", source: { file: "email", quote: raw } });
      if (/price|fee|cost/i.test(s)) facts.push({ field: "amount_pre_gst", value: "Same as this year", state: "unconfirmed", source: { file: "email", quote: raw } });
    }
    const dur = s.match(/(\d+)\s*(more\s+)?(weeks?|months?)/i);
    if (dur && !/valid|days/i.test(s)) facts.push({ field: "duration", value: `${/about|around/i.test(s) ? "about " : ""}${dur[1]} ${dur[3]}`, state: /about|around|roughly/i.test(s) ? "unconfirmed" : "confirmed", source: { file: "email", quote: raw } });
    const day = s.match(/start\w*\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday)/i);
    if (day) { const d = nextWeekday(email.sentAt, DOW[day[1].toLowerCase()]); facts.push({ field: "start_date", value: `${day[1][0].toUpperCase()}${day[1].slice(1)} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`, state: "confirmed", source: { file: "email", quote: raw } }); }
    if (/admin access|customer data|customer records|personal data/i.test(s)) facts.push({ field: "data_access", value: /\bno access\b/i.test(s) ? "No access to personal or customer data" : s, state: /\bno access\b/i.test(s) ? "confirmed" : "unconfirmed", source: { file: "email", quote: raw } });
    if (/\b(started|onboarded|began|kicked off)\b/i.test(s) && !fromEmployee) facts.push({ field: "other", value: "Work started", state: "confirmed", source: { file: "email", quote: raw } });
    if (i === 0 && fromEmployee && s.length > 15) facts.push({ field: "scope", value: s.replace(/[.?!]$/, ""), state: "confirmed", source: { file: "email", quote: raw.replace(/^(hi|hello|dear)\s+[a-z]+,\s*/i, "") } });
  });

  // Attachments
  for (const a of email.attachments) {
    const lines = a.pages.flatMap((p, pi) => p.map((l) => ({ l, page: pi + 1 })));
    const f = (field: ExtractedFact["field"], value: string, quote: string, page: number, state: ExtractedFact["state"] = "confirmed") => facts.push({ field, value, state, source: { file: a.name, page, quote } });
    const first = lines[0];
    if (first && /pvt|ltd|llp|studio|inc\b/i.test(first.l)) f("supplier_entity", first.l, first.l, first.page);
    for (const { l, page } of lines) {
      const amt = l.match(/₹[\d,]+/)?.[0];
      if (amt && /subtotal|before gst|annual fee|fees \(before|amount \(before/i.test(l)) f("amount_pre_gst", amt, l, page);
      else if (amt && /^gst/i.test(l)) f("gst", amt, l, page);
      else if (amt && /^total\b/i.test(l)) f("total", amt, l, page);
      if (/^(duration|term):/i.test(l)) f("duration", l.replace(/^(duration|term):\s*/i, "").replace(/,?\s*starting.*$/i, "").replace(/\s+from .*$/i, ""), l, page);
      const st = l.match(/starting\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|on signature)/i);
      if (st) f("start_date", st[1], l, page);
      if (/^scope:/i.test(l)) f("scope", l.replace(/^scope:\s*/i, ""), l, page);
      if (/access required:|data access:/i.test(l)) f("data_access", l.replace(/^.*?:\s*/, ""), l, page, /\bno access\b/i.test(l) ? "confirmed" : "unconfirmed");
      if (/renews? automatically|does not renew|auto-?renew/i.test(l)) f("notice_period", l, l, page);
      const vu = l.match(/valid until:?\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i);
      if (vu) f("certificate_expiry", vu[1], l, page);
      if (/^validity:/i.test(l)) f("validity", l.replace(/^validity:\s*/i, ""), l, page);
      if (/^payment terms:/i.test(l)) f("payment_terms", l.replace(/^payment terms:\s*/i, ""), l, page);
      if (/^description:/i.test(l)) f("scope", l.replace(/^description:\s*/i, ""), l, page);
      if (/work started|activated on/i.test(l)) f("other", "Work started", l, page);
    }
  }

  const project = email.subject.replace(/^((re|fwd?|fw):\s*)+/i, "").replace(/\s*[–—-]\s*can you help\??$/i, "").replace(/^(your|invoice\s+\S+:?)\s*/i, "").trim();
  return {
    isSupplierCommunication: !!sup || (!!ext && /₹|quote|invoice|proposal|order form/i.test(all)),
    supplier: sup ? { name: sup.name, domain: sup.domain, known: sup.known } : ext ? { name: domainOf(ext).split(".")[0].replace(/^\w/, (c) => c.toUpperCase()), domain: domainOf(ext), known: false } : null,
    filing: { project: project || "General", request: "NEW", requestType, confidence: "low", reason: "Basic extraction (rules): matched by thread, domain and subject." },
    facts,
    changesVsKnown: [],
    flags: low.includes("₹") || email.attachments.length ? [] : [{ type: "missing", message: "No amount found yet.", sendTo: "requester" }],
  };
}
