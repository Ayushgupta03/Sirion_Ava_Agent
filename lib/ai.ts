// Server-only: the AI extraction call. The model extracts facts with quotes; code decides policy.
import { stripQuoted } from "./quoted";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Extraction } from "./types";

const Src = z.object({ file: z.string(), page: z.number().int().optional().nullable(), quote: z.string() });
export const ExtractionSchema = z.object({
  isSupplierCommunication: z.boolean(),
  supplier: z.object({ name: z.string(), domain: z.string(), known: z.boolean() }).nullable(),
  filing: z.object({
    project: z.string(), request: z.string(),
    requestType: z.enum(["new_sow", "amendment", "renewal", "change_request", "invoice", "other"]),
    confidence: z.enum(["high", "medium", "low"]), reason: z.string(),
  }),
  facts: z.array(z.object({
    field: z.enum(["amount_pre_gst", "gst", "total", "start_date", "duration", "scope", "data_access", "payment_terms", "validity", "supplier_entity", "renewal_date", "notice_period", "certificate_expiry", "other"]),
    value: z.string(), state: z.enum(["confirmed", "unconfirmed", "contradicted"]), source: Src,
  })),
  changesVsKnown: z.array(z.object({ field: z.string(), old: z.string(), new: z.string(), source: Src })).default([]),
  flags: z.array(z.object({ type: z.string(), message: z.string(), sendTo: z.enum(["requester", "procurement", "infosec", "legal", "finance", "budget_owner", "vp"]) })).default([]),
  draftForRequester: z.string().optional().nullable(),
});

export const SYSTEM_PROMPT = `You are Ava, a contract intake agent for Prayaan Software Pvt Ltd (India). You read one email between an employee and a supplier, plus the text of its attachments, and return the facts a contract request needs.

Return ONLY a JSON object matching this TypeScript type, with no prose and no code fences:
{
  "isSupplierCommunication": boolean,
  "supplier": { "name": string, "domain": string, "known": boolean } | null,
  "filing": { "project": string, "request": "REQ-xxxx" | "NEW", "requestType": "new_sow" | "amendment" | "renewal" | "change_request" | "invoice" | "other", "confidence": "high" | "medium" | "low", "reason": string },
  "facts": [ { "field": "amount_pre_gst" | "gst" | "total" | "start_date" | "duration" | "scope" | "data_access" | "payment_terms" | "validity" | "supplier_entity" | "renewal_date" | "notice_period" | "certificate_expiry" | "other", "value": string, "state": "confirmed" | "unconfirmed" | "contradicted", "source": { "file": "email" | "<attachment name>", "page": number, "quote": string } } ],
  "changesVsKnown": [ { "field": string, "old": string, "new": string, "source": { "file": string, "page": number, "quote": string } } ],
  "flags": [ { "type": "missing" | "unconfirmed" | "contradicted" | "expiring" | "rate_increase" | "other", "message": string, "sendTo": "requester" | "procurement" | "infosec" | "legal" | "finance" | "budget_owner" | "vp" } ],
  "draftForRequester": string (optional)
}

Rules:
- Extract only what the text says. Never invent numbers.
- Every fact must carry an exact quote copied from its source (the email body or one attachment line). Keep quotes short: one line or sentence.
- If unsure, mark the fact unconfirmed. Amounts a person gives as "about" or "rough budget" are unconfirmed. Amounts in a supplier quote, order form or SOW are confirmed.
- amount_pre_gst is the amount before GST (subtotal, annual fee, or fees before GST). Use Indian number formatting for ₹ (₹21,50,000).
- If a supplier mentions access to customer records, personal data or admin access to a customer system, add a data_access fact with state "unconfirmed". If a document says there is no access to personal or customer data, add data_access "No access to personal or customer data", confirmed.
- For automatic renewal clauses use field "notice_period" and quote the clause. If a form says it does not renew automatically, add field "other" with value "Does not renew automatically".
- If an email says the price or terms do not change ("same price", "nothing changes"), add field "other" with value "Nothing changes" and quote it.
- If the supplier says work has started, add field "other" with value "Work started" and quote it.
- For certificates and insurance, add certificate_expiry with the "valid until" date.
- Never decide approvals or routing; code does that. Flags only describe what you saw.
- Filing: if the email continues an open request listed in context, return its id; otherwise "NEW". Project is a short name such as "Salesforce migration".`;

export async function extractWithAI(input: { email: any; attachments: { name: string; text: string }[]; context: any }): Promise<Extraction> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("No ANTHROPIC_API_KEY"), { code: "NO_KEY" });
  const client = new Anthropic({ apiKey: key });
  const model = process.env.AVA_MODEL || "claude-sonnet-5-5";
  const user = JSON.stringify({ email: { ...input.email, body: stripQuoted(String(input.email?.body ?? "")) }, attachments: input.attachments, context: input.context }, null, 1);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model, max_tokens: 4000, system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: attempt === 0 ? user : `${user}\n\nYour previous answer was not valid JSON for the schema. Return only the JSON object.` }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    try {
      const parsed = ExtractionSchema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
      return { ...parsed, facts: parsed.facts.map((f) => ({ ...f, source: { ...f.source, page: f.source.page ?? undefined } })), draftForRequester: parsed.draftForRequester ?? undefined } as Extraction;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
