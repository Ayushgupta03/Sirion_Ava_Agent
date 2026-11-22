// Server-only: Ava's read, plan and recommendations (Part 7). Validated with zod, retried once, then the caller falls back.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { promptVersionOf } from "./promptVersion";

const Cite = z.object({ type: z.enum(["email", "doc", "clause"]), id: z.string(), quote: z.string().optional().nullable() });
export const ReadSchema = z.object({ sentences: z.array(z.object({ text: z.string(), citations: z.array(Cite).min(1) })).min(1).max(4), risks: z.array(z.string()).default([]) });
export const PlanSchema = z.object({
  steps: z.array(z.object({ id: z.string(), title: z.string(), ownerId: z.string(), source: z.enum(["policy", "ava"]), reason: z.string().optional().nullable(), dependsOn: z.array(z.string()).default([]), status: z.enum(["done", "in_progress", "blocked", "todo"]).default("todo"), eta: z.string().optional().nullable() })),
  criticalPath: z.array(z.string()).default([]), predictedReady: z.string(), predictionReason: z.string(), changesSinceLast: z.array(z.string()).default([]),
});
export const RecSchema = z.object({ recommendation: z.string(), reasoning: z.string(), citations: z.array(Cite).default([]), confidence: z.enum(["high", "medium", "low"]), draft: z.string().optional().nullable(), action: z.enum(["draft_supplier", "ask_requester", "require_cr", "ask_legal", "review"]).optional().nullable() });

const RULES = `You are Ava, the contract intake agent for Prayaan Software Pvt Ltd (India).
Rules for every answer:
- Use only the sources given in the input. Never add facts.
- Cite every factual claim: {"type":"email","id":"<email id>"}, {"type":"doc","id":"<attachment id or contract id>"} or {"type":"clause","id":"<contract id> <clause>"}, with a short exact quote where you have one.
- Never compute money or dates. Use only the numbers in numbersFromCode, commitments, conflicts and facts.
- Never decide or recommend that an approval be given. Approvals belong to people.
- Plain, short sentences. Names, numbers and dates. No sentence over 30 words.
- Never use these words: seamless, powerful, leverage, unlock, cutting-edge, empower, game-changer, revolutionary, intelligent, smart.
- Predictions that use supplierHistory must end with "Based on sample history in this prototype."
Return only one JSON object, no prose and no code fences.`;

const TASK = {
  read: `Write Ava's read of this request: at most 4 sentences on what the deal is, what is risky and why. Shape: {"sentences":[{"text":string,"citations":[...]}],"risks":[string]}`,
  plan: `Write the work plan. Include every item in requiredSteps with source "policy" and the given id and ownerId. Add your own steps with source "ava" and a one-line reason. Owners must be ids from people. Give dependsOn ids, status, an eta like "Tue 17 Nov", the criticalPath (ids), predictedReady (a date like "Tue 17 Nov"), a one-sentence predictionReason that cites supplier history or the current blocker, and changesSinceLast compared with previousPlan. Shape: {"steps":[{"id","title","ownerId","source","reason","dependsOn":[],"status","eta"}],"criticalPath":[],"predictedReady":string,"predictionReason":string,"changesSinceLast":[string]}`,
  recommend: `Recommend what the owner should do about this one conflict or decision. One-sentence recommendation, at most 2 sentences of reasoning with citations, a confidence (high, medium or low), and an optional ready draft email the person can send (never sent by you). Shape: {"recommendation":string,"reasoning":string,"citations":[...],"confidence":"high"|"medium"|"low","draft"?:string,"action"?:"draft_supplier"|"ask_requester"|"require_cr"|"ask_legal"|"review"}`,
} as const;

/** Changes whenever RULES or any task prompt changes. Returned by the routes and stored on every live output. */
export const PROMPT_VERSION = promptVersionOf(RULES + JSON.stringify(TASK));
export const modelName = () => process.env.AVA_MODEL || "claude-sonnet-5-5";

export async function runLayer(layer: keyof typeof TASK, input: unknown) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("No ANTHROPIC_API_KEY"), { code: "NO_KEY" });
  const client = new Anthropic({ apiKey: key });
  const model = modelName();
  const schema = layer === "read" ? ReadSchema : layer === "plan" ? PlanSchema : RecSchema;
  const user = `${TASK[layer]}\n\nInput:\n${JSON.stringify(input)}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({ model, max_tokens: 3000, system: RULES, messages: [{ role: "user", content: attempt === 0 ? user : `${user}\n\nYour previous answer did not match the shape. Return only the JSON object.` }] });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    try { return schema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1))); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
