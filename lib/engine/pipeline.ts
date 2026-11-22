// The single pipeline. Every email (scripted or composed) and every user action goes through applyEvent.
// ingest → classify → extract (done before, stored on the event) → file → diff → rules → notify → log
import type { Action, AvaEvent, Conflict, Draft, Email, Extraction, Person, Request, RequestType, State, Supplier, TimelineEntry } from "../types";
import { addMinutes, domainOf, fmtDT, hoursBetween, inr, lakh, norm, parseAmount, parseDate } from "../format";
import { classifyDoc, FIELD_LABEL, foldFacts, MATERIAL } from "./facts";
import { analyze } from "./rules";
import { deriveItems } from "./items";
import { emptyAi, fingerprint, planDiff, validatePlan } from "./ai";
import type { AiPlan, AiRec, AiRead } from "../aiTypes";
import { evalPlan, evalRead, evalRec } from "../evals";
import { COMPANY_DOMAIN, CONTRACTS, firstName, isInternal, PEOPLE, person, personByEmail, personName, POLICY, SEED_SUPPLIERS, START_CLOCK } from "./world";

export function initialState(): State {
  return {
    now: START_CLOCK, emails: [], extractions: {}, suppliers: structuredClone(SEED_SUPPLIERS), requests: {}, requestOrder: [], conflicts: {},
    drafts: [], orphans: [], changes: [], items: {}, reassigned: {}, counters: { answeredFromDocs: 0, approvalsReopened: 0, startedBeforeApproval: {} },
    lastReqNum: 1046, threadRequest: {}, addedSuppliers: [], ai: emptyAi(),
    autonomy: { autoSendQuoteRequests: true, autoSendDocChasers: false },
  };
}

const T0 = "2026-11-12T10:12:00+05:30";
function nextReqId(state: State, at: string) {
  // Other teams also raise requests (about 200 a month); numbering reflects that background volume.
  const n = Math.max(state.lastReqNum + 1, 1047 + Math.floor(Math.max(0, hoursBetween(T0, at)) / 16.4));
  state.lastReqNum = n;
  return `REQ-${n}`;
}

const log = (req: Request, at: string, text: string, kind: TimelineEntry["kind"], actor?: string) => req.timeline.push({ at, text, kind, actor });

export function replay(events: AvaEvent[]): State {
  let s = initialState();
  for (const e of events) s = applyEvent(s, e);
  return s;
}

export function applyEvent(prev: State, ev: AvaEvent): State {
  const state: State = structuredClone(prev);
  if (ev.at > state.now) state.now = ev.at;
  const ctx: Ctx = { reopened: [], touched: new Set() };
  if (ev.kind === "ai") { applyAi(state, ev); return { ...state }; }
  if (ev.kind === "email") ingestEmail(state, ev.email, ev.extraction, ev.extractionSource, ctx);
  else applyAction(state, ev.actor, ev.action, ev.at, ev.id, ctx);
  return runRules(prev, state, ev.at, ctx);
}

interface Ctx { reopened: string[]; touched: Set<string>; resolvedConflict?: string }

// ---------------- AI layers (read, plan, recommend) ----------------
const SRC_WORD = { live: "Live AI", cached: "Cached", rules: "Summary from rules (AI unavailable)" } as const;
function applyAi(state: State, ev: Extract<AvaEvent, { kind: "ai" }>) {
  const req = state.requests[ev.requestId]; if (!req) return;
  state.ai ??= emptyAi();
  const fp = fingerprint(state, req.id);
  // Live answers are checked against the prompt's promises before they are shown (lib/evals.ts).
  const evalIssues = ev.source === "live" ? (ev.layer === "read" ? evalRead(ev.output as AiRead, state, req.id) : ev.layer === "plan" ? evalPlan(ev.output as AiPlan, state, req.id) : evalRec(ev.output as AiRec, state, req.id)) : undefined;
  if (evalIssues?.some((i) => i.severity === "fail")) log(req, ev.at, `Ava's ${ev.layer === "rec" ? "recommendation" : ev.layer} failed ${evalIssues.filter((i) => i.severity === "fail").length} output check(s): ${evalIssues.filter((i) => i.severity === "fail").map((i) => i.check).join(", ")}.`, "flag");
  if (ev.layer === "read") {
    const list = (state.ai.reads[req.id] ??= []);
    list.push({ at: ev.at, source: ev.source, fingerprint: fp, output: ev.output as AiRead, evalIssues });
    log(req, ev.at, `Ava ${list.length > 1 ? "updated its read of" : "read"} the request (${SRC_WORD[ev.source]}).`, "action");
  } else if (ev.layer === "plan") {
    const a = analyze(state, req.id);
    const list = (state.ai.plans[req.id] ??= []);
    const { plan, fixes } = validatePlan(ev.output as AiPlan, a, state);
    fixes.forEach((f) => log(req, ev.at, f + ".", "rule"));
    const changes = planDiff(list[list.length - 1], plan, a);
    list.push({ at: ev.at, source: ev.source, fingerprint: fp, output: plan, changes, evalIssues });
    log(req, ev.at, `Ava ${list.length > 1 ? "re-planned" : "planned"} the work: ${plan.steps.length} steps${plan.predictedReady ? `, predicted ready ${plan.predictedReady}` : ""} (${SRC_WORD[ev.source]}).`, "action");
  } else {
    const rec = ev.output as AiRec;
    state.ai.recs[ev.key] = { at: ev.at, source: ev.source, fingerprint: fp, output: rec, evalIssues };
    if (ev.key.startsWith("receipt:")) log(req, ev.at, `Ava prepared a receipt summary for ${personName(analyze(state, req.id).approvals.find((x) => ev.key.endsWith(x.key))?.approverId)}.`, "action");
    else log(req, ev.at, `Ava recommends: ${rec.recommendation}`, "action");
  }
}

// ---------------- Email ----------------
function ingestEmail(state: State, email: Email, ex: Extraction | null, source: State["extractions"][string]["source"], ctx: Ctx) {
  state.emails.push(email);
  state.extractions[email.id] = { source, result: ex };
  const at = email.sentAt;

  // A draft Ava wrote that a person sent: record it in the thread, extract nothing.
  if (email.origin === "ava_draft") {
    const rid = state.threadRequest[email.threadId];
    if (rid) { state.requests[rid].emailIds.push(email.id); log(state.requests[rid], at, `${personName(personByEmail(email.from)?.id)} sent Ava's draft to ${email.to[0]}.`, "email"); }
    return;
  }

  // Ask Ava (the front door): an employee describes a need before any supplier email exists.
  if (email.origin === "intake") { ingestIntake(state, email, ex, source, ctx); return; }

  // classify
  const addrs = [email.from, ...email.to, ...email.cc];
  const supplier = addrs.map((a) => state.suppliers.find((s) => s.domain === domainOf(a))).find(Boolean);
  const externals = addrs.filter((a) => domainOf(a) && domainOf(a) !== COMPANY_DOMAIN);
  const employees = [email.from, ...email.to, ...email.cc].map((a) => personByEmail(a)).filter(Boolean) as typeof PEOPLE;
  const requester = personByEmail(email.from) ?? employees[0];
  const attText = email.attachments.map((a) => a.pages.flat().join(" ")).join(" ");
  const commercial = !!ex?.isSupplierCommunication || /₹|quote|quotation|invoice|proposal|order form|rate card|\bsow\b/i.test(email.body + " " + email.subject + " " + attText);
  if (!supplier && (!externals.length || !commercial)) return; // internal or non-commercial: recorded, not filed
  const fromSupplier = !!supplier && domainOf(email.from) === supplier.domain || (!supplier && !isInternal(email.from));
  const isInvoice = ex?.filing.requestType === "invoice" || email.attachments.some((a) => classifyDoc(a) === "invoice");

  // Clear "waiting on supplier" on conflicts when the supplier replies.
  const threadReq = state.threadRequest[email.threadId];

  if (isInvoice && supplier) {
    const inv = invoiceInfo(email, ex);
    const candidates = state.requestOrder.map((id) => state.requests[id]).filter((r) => r.supplierId === supplier.id);
    const target = (threadReq && state.requests[threadReq]) || candidates.find((r) => inv.text.includes(r.id)) || (() => {
      const same = candidates.filter((r) => employees.some((p) => p.id === r.requesterId));
      return same.length === 1 ? same[0] : candidates.length === 1 ? candidates[0] : undefined;
    })();
    if (target) {
      const additional = /add-?on|additional|extra|module/i.test(inv.desc) || !norm(inv.desc).includes(norm(target.project));
      const approved = !!target.approvals.budget_owner?.receipts.length;
      target.emailIds.push(email.id);
      target.factEvents.push({ at, kind: "extraction", emailId: email.id });
      state.threadRequest[email.threadId] = target.id;
      if (additional || !approved) {
        target.retroItems.push({ invoiceNo: inv.no, desc: inv.desc, amount: additional ? inv.amount : 0, emailId: email.id, source: inv.source });
        target.startedBeforeApproval ??= { at, source: inv.source };
      }
      target.filing = { ...target.filing };
      log(target, at, `Invoice ${inv.no} (${inr(inv.amount)} before GST) linked to ${target.id}: ${threadReq ? "same thread" : candidates.length === 1 ? `the only open request with ${supplier.name.split(" ")[0]}` : "same supplier and addressee"}. Marked "Started before approval".`, "email");
      ctx.touched.add(target.id);
      return;
    }
    const owner = PEOPLE.find((p) => new RegExp(`attention:?\\s*${p.name}`, "i").test(inv.text)) ?? employees.find((p) => p.roles.includes("requester"));
    state.orphans.push({ id: `orph-${email.id}`, emailId: email.id, supplierId: supplier.id, invoiceNo: inv.no, amount: inv.amount, desc: inv.desc, likelyOwnerId: owner?.id, status: "open", source: inv.source, createdAt: at });
    return;
  }

  // file: Supplier > Project > Request
  let req = threadReq ? state.requests[threadReq] : undefined;
  let reason = threadReq ? "Same email thread" : "";
  if (!req && ex?.filing.request && /REQ-\d+/.test(ex.filing.request) && state.requests[ex.filing.request.match(/REQ-\d+/)![0]]) { req = state.requests[ex.filing.request.match(/REQ-\d+/)![0]]; reason = `Reference ${req.id} in the email`; }
  const rtype: RequestType = (ex?.filing.requestType && ex.filing.requestType !== "invoice" ? ex.filing.requestType : "new_sow") as RequestType;
  const project = cleanProject(ex?.filing.project || email.subject);
  if (!req && supplier) {
    const open = state.requestOrder.map((id) => state.requests[id]).filter((r) => r.supplierId === supplier.id && !r.readyAt);
    req = open.find((r) => (norm(r.project) === norm(project) || norm(r.project).includes(norm(project)) || norm(project).includes(norm(r.project))) && (!requester || r.costCentre === requester.costCentre));
    if (req) reason = `Same supplier and project "${req.project}"`;
  }
  if (!req) {
    if (!requester) return;
    req = openRequest(state, { at, supplier, requester, rtype, project, ex, source, externals });
    reason = req.filing.reason;
  }
  state.threadRequest[email.threadId] = req.id;
  req.emailIds.push(email.id);
  req.factEvents.push({ at, kind: "extraction", emailId: email.id });
  const who = personByEmail(email.from)?.name ?? email.from;
  log(req, at, `Recorded email from ${who}: "${email.subject}"${email.attachments.length ? ` with ${email.attachments.map((a) => a.name).join(", ")}` : ""}. Filed by: ${reason}. Extraction: ${labelSource(source)}.`, "email");
  for (const a of email.attachments) log(req, at, `Read ${a.name} (${a.pages.length} page${a.pages.length === 1 ? "" : "s"}) and pulled out the facts.`, "fact");
  if (fromSupplier) Object.values(state.conflicts).filter((c) => c.requestId === req!.id && c.waitingOnSupplier).forEach((c) => { c.waitingOnSupplier = undefined; });
  ctx.touched.add(req.id);
}


interface OpenArgs { at: string; supplier?: Supplier; requester: Person; rtype: RequestType; project: string; ex: Extraction | null; source: State["extractions"][string]["source"]; externals: string[] }
/** Opens a request under Supplier > Project, links the agreements on file, and logs why. Shared by supplier email and Ask Ava. */
function openRequest(state: State, { at, supplier, requester, rtype, project, ex, source, externals }: OpenArgs): Request {
  const id = nextReqId(state, at);
  const baseline = supplier ? CONTRACTS.filter((c) => c.supplierId === supplier.id && (c.type === "SOW" || c.type === "Subscription")).find((c) => c.project && (norm(project).includes(norm(c.project)) || norm(c.project).includes(norm(project)))) ?? (rtype === "renewal" ? CONTRACTS.filter((c) => c.supplierId === supplier.id && c.type === "Subscription").pop() : undefined) : undefined;
  const title = rtype === "renewal" ? `Renewal: ${project}` : rtype === "amendment" ? `Extension: ${project}` : rtype === "change_request" ? `Change: ${project}` : `New SOW: ${project}`;
  const req: Request = {
    id, title, type: rtype, supplierId: supplier?.id ?? null, supplierGuess: supplier ? undefined : { name: ex?.supplier?.name || domainOf(externals[0]), domain: domainOf(externals[0]) },
    project, requesterId: requester.id, costCentre: requester.costCentre ?? "CC-UNKNOWN", createdAt: at, emailIds: [],
    filing: { confidence: ex?.filing.confidence ?? (supplier ? "medium" : "low"), reason: ex?.filing.reason || (supplier ? `Known supplier ${supplier.name}; new project` : "Unknown domain with commercial content: possible new supplier"), source },
    facts: {}, documents: [], approvals: {}, flags: [], exceptions: [], retroItems: [], comments: [], timeline: [], factEvents: [], checklistDone: {}, approvalCache: {},
    baselineContractId: rtype === "renewal" || rtype === "amendment" ? baseline?.id : undefined,
  };
  state.requests[id] = req; state.requestOrder.push(id);
  log(req, at, `Ava opened ${id} "${title}" under ${supplier?.name ?? "possible new supplier " + req.supplierGuess?.name} > ${project}. Filing confidence: ${req.filing.confidence}.`, "email");
  if (baseline && req.baselineContractId) log(req, at, `Linked existing agreement ${baseline.id} (${baseline.title}).`, "rule");
  if (supplier) {
    const linked = CONTRACTS.filter((c) => c.supplierId === supplier.id && (c.type === "NDA" || c.type === "MSA"));
    if (linked.length) log(req, at, `Found and linked ${linked.map((c) => `${c.type} (${c.date.slice(0, 4)})`).join(" and ")}.`, "rule");
  }
  return req;
}

/** Ask Ava: the request starts from the employee, before the supplier is contacted. Same facts, same rules, same plan. */
function ingestIntake(state: State, email: Email, ex: Extraction | null, source: State["extractions"][string]["source"], ctx: Ctx) {
  const at = email.sentAt;
  const requester = personByEmail(email.from); if (!requester) return;
  const supplier = state.suppliers.find((s) => s.domain === ex?.supplier?.domain) ?? state.suppliers.find((s) => norm(s.name).startsWith(norm(ex?.supplier?.name ?? "~")));
  const rtype: RequestType = (ex?.filing.requestType && ex.filing.requestType !== "invoice" ? ex.filing.requestType : "new_sow") as RequestType;
  const project = cleanProject(ex?.filing.project || email.subject);
  const guessDomain = ex?.supplier?.domain || `${norm(ex?.supplier?.name ?? "supplier").replace(/[^a-z0-9]+/g, "")}.example`;
  // Duplicate check: an open request with the same supplier, project and cost centre gets this note instead of a second request.
  const dup = supplier ? state.requestOrder.map((id) => state.requests[id]).find((r) => r.supplierId === supplier.id && !r.readyAt && r.costCentre === (requester.costCentre ?? "CC-UNKNOWN") && (norm(r.project).includes(norm(project)) || norm(project).includes(norm(r.project)))) : undefined;
  const req = dup ?? openRequest(state, { at, supplier, requester, rtype, project, ex, source, externals: [`x@${guessDomain}`] });
  state.threadRequest[email.threadId] = req.id;
  req.emailIds.push(email.id);
  req.factEvents.push({ at, kind: "extraction", emailId: email.id });
  const who = requester.name;
  if (dup) log(req, at, `${who} asked about this through Ask Ava. ${req.id} was already open for ${supplier!.name} and "${req.project}", so Ava added the note to it instead of opening a duplicate.`, "email", requester.id);
  else log(req, at, `${who} started this request through Ask Ava, before any supplier email. Extraction: ${labelSource(source)}.`, "email", requester.id);
  ctx.touched.add(req.id);
  if (dup || !supplier) return;
  // Ava drafts the routine first message to the supplier: ask for a written proposal and tell them not to start before a PO.
  const contact = ex?.supplierContact ? (supplier.contacts.find((c) => c.email.toLowerCase() === ex.supplierContact!.toLowerCase()) ?? { name: ex.supplierContact.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), email: ex.supplierContact }) : supplier.contacts[0];
  if (!contact) return;
  const access = ex?.facts.some((f) => f.field === "data_access" && /yes|admin|customer|personal/i.test(f.value) && !/\bno access\b/i.test(f.value));
  const amount = ex?.facts.find((f) => f.field === "amount_pre_gst")?.value;
  const first = contact.name.split(" ")[0];
  const body = `Hi ${first},\n\n${firstName(requester.id)} at Prayaan would like a written proposal for ${req.project}${amount ? `, with a rough budget of ${amount}` : ""}. Could you send:\n- a proposal with the price before GST, the scope, the start date and the duration\n- your current rate card${access ? "\n- your current security certificate (ISO 27001 or SOC 2) and insurance certificate, because the work involves customer data" : ""}\n\nPlease do not start work or access any of our systems until you have a purchase order from us.\n\nThanks,\n${firstName(requester.id)}`;
  const d: Draft = { id: `draft-rfq-${req.id}`, requestId: req.id, forPersonId: requester.id, to: contact.email, subject: `RE: ${email.subject}`, body, threadId: email.threadId, createdAt: at, status: "draft", purpose: "ask for a written proposal" };
  state.drafts.push(d);
  log(req, at, `Ava drafted the first message to ${contact.name}: ask for a written proposal and say no work starts before a PO.`, "action");
  if (state.autonomy?.autoSendQuoteRequests) sendDraft(state, d, addMinutes(at, 1), `auto-${d.id}`, "ava", true);
}

/** Records a draft as sent: by a person (clicked Send) or by Ava under the autonomy settings. */
function sendDraft(state: State, d: Draft, at: string, evId: string, actor: string, auto = false) {
  d.status = "sent"; d.sentAt = at;
  const req = state.requests[d.requestId];
  const email: Email = { id: `out-${evId}`, threadId: d.threadId ?? `t-${d.id}`, from: person(d.forPersonId)?.email ?? "", to: [d.to], cc: [], subject: d.subject, body: d.body, sentAt: at, attachments: [], origin: "ava_draft", autoSent: auto || undefined };
  state.emails.push(email); state.extractions[email.id] = { source: "none", result: null };
  req.emailIds.push(email.id); state.threadRequest[email.threadId] ??= req.id;
  if (d.conflictId && state.conflicts[d.conflictId]) state.conflicts[d.conflictId].waitingOnSupplier = at;
  log(req, at, auto ? `Ava sent ${personName(d.forPersonId)}'s routine message (${d.purpose}) to ${d.to}. Auto-send is on for this kind of message; it commits no money and changes no terms.` : `${personName(d.forPersonId)} sent Ava's draft to ${d.to}.`, "email", actor);
}

export function labelSource(s: string) { return s === "live" ? "Live AI" : s === "cached" ? "Cached AI" : s === "basic" ? "Basic extraction (AI unavailable)" : "None"; }

function cleanProject(s: string) {
  return s.replace(/^((re|fwd?|fw):\s*)+/i, "").replace(/\s*[–—-]\s*can you help\??$/i, "").replace(/\?$/, "").replace(/^your\s+/i, "").trim() || "General";
}

function invoiceInfo(email: Email, ex: Extraction | null) {
  const att = email.attachments.find((a) => classifyDoc(a) === "invoice") ?? email.attachments[0];
  const lines = att ? att.pages.flat() : email.body.split("\n");
  const text = lines.join("\n");
  const no = text.match(/invoice\s+([A-Z]{2,}[-A-Z0-9]*\d)/i)?.[1] ?? att?.name.match(/([A-Z]{2,}-[A-Z0-9-]*\d)/)?.[1] ?? "unnumbered";
  const amtLine = lines.find((l) => /amount \(before gst\)|before gst|subtotal/i.test(l)) ?? lines.find((l) => /₹/.test(l)) ?? "";
  const exAmt = ex?.facts.find((f) => f.field === "amount_pre_gst");
  const amount = parseAmount(amtLine.match(/₹[\d,]+/)?.[0]) ?? parseAmount(exAmt?.value) ?? 0;
  const descLine = lines.find((l) => /^description:/i.test(l)) ?? "";
  const desc = descLine.replace(/^description:\s*/i, "") || ex?.facts.find((f) => f.field === "scope")?.value || email.subject;
  return { no, amount, desc, text, source: { emailId: email.id, file: att?.name ?? "email", attachmentId: att?.id, page: 1, quote: descLine || amtLine } };
}

// ---------------- Actions ----------------
function applyAction(state: State, actor: string, a: Action, at: string, evId: string, ctx: Ctx) {
  const reqOf = (id: string) => state.requests[id];
  switch (a.type) {
    case "tick": return;
    case "set_autonomy": { state.autonomy = { ...(state.autonomy ?? { autoSendQuoteRequests: true, autoSendDocChasers: false }), [a.setting]: a.value }; return; }
    case "answer_flag": {
      const req = reqOf(a.requestId); let fl = req.flags.find((f) => f.id === a.flagId);
      if (!fl) { fl = { id: a.flagId, type: "unconfirmed", message: "", sendTo: "requester", personId: actor, status: "open", createdAt: at }; req.flags.push(fl); }
      fl.status = "answered"; fl.answer = a.answer; fl.closedAt = at;
      if (a.flagId.endsWith(":data_access")) {
        req.factEvents.push({ at, kind: "person", field: "data_access", value: a.answer === "yes" ? "Yes: the supplier will access customer data" : "No access to personal or customer data", num: a.answer === "yes" ? 1 : 0, by: actor, reason: `${personName(actor)} answered ${a.answer === "yes" ? "Yes" : "No"} to "Will they access customer data?"` });
        log(req, at, `${personName(actor)} confirmed data access: ${a.answer === "yes" ? "Yes" : "No"}.`, "action", actor);
      } else if (fl.question === "keep_line") {
        fl.answer = a.note ? `${a.answer === "yes" ? "Keep it" : "Remove it"}: ${a.note}` : a.answer === "yes" ? "Keep it" : "Remove it";
        log(req, at, `${personName(actor)} answered "${fl.message}": ${fl.answer}.`, "action", actor);
      }
      ctx.touched.add(req.id); return;
    }
    case "dismiss_flag": {
      const req = reqOf(a.requestId); let fl = req.flags.find((f) => f.id === a.flagId);
      if (!fl) { fl = { id: a.flagId, type: "info", message: "", sendTo: "requester", personId: actor, status: "open", createdAt: at }; req.flags.push(fl); }
      fl.status = "dismissed"; fl.closedAt = at; return;
    }
    case "confirm_fact": {
      const req = reqOf(a.requestId); const f = foldFacts(state, req).facts[a.field]; if (!f) return;
      req.factEvents.push({ at, kind: "person", field: a.field, value: f.value, num: f.num, by: actor, reason: `${personName(actor)} confirmed ${FIELD_LABEL[a.field] ?? a.field}` });
      log(req, at, `${personName(actor)} confirmed ${FIELD_LABEL[a.field] ?? a.field}: ${f.value}.`, "action", actor); return;
    }
    case "set_fact": {
      const req = reqOf(a.requestId);
      const num = a.field === "amount" ? parseAmount(a.value) : a.field === "data_access" ? (/^y/i.test(a.value) ? 1 : 0) : undefined;
      req.factEvents.push({ at, kind: "person", field: a.field, value: a.value, num, by: actor, reason: a.reason });
      log(req, at, `${personName(actor)} set ${FIELD_LABEL[a.field] ?? a.field} to ${a.value}. Reason: ${a.reason}`, "action", actor); return;
    }
    case "dispute_fact": {
      const req = reqOf(a.requestId);
      req.flags.push({ id: `flag:${req.id}:dispute:${evId}`, type: "mention", message: `${personName(actor)} disputed ${FIELD_LABEL[a.field] ?? a.field}: ${a.reason}`, sendTo: "procurement", personId: POLICY.procurementOwner, status: "open", createdAt: at });
      log(req, at, `${personName(actor)} disputed ${FIELD_LABEL[a.field] ?? a.field}: ${a.reason}`, "action", actor); return;
    }
    case "resolve_conflict": {
      const c = state.conflicts[a.conflictId]; if (!c) return; const req = reqOf(c.requestId);
      let text = "";
      if (a.choice === "A") { text = `Accepted source A (${c.a.label})${c.aValue ? `: ${c.aValue}` : ""}.`; if (c.field && c.aValue) req.factEvents.push({ at, kind: "person", field: c.field, value: c.aValue, num: c.field === "amount" ? parseAmount(c.aValue) : c.field === "data_access" ? (/^y/i.test(c.aValue) ? 1 : 0) : undefined, by: actor, reason: `Accepted ${c.a.label}` }); }
      if (a.choice === "B") text = `Accepted source B (${c.b.label})${c.bValue ? `: ${c.bValue}` : ""}.`;
      if (a.choice === "accept") { text = `Accepted with a reason: ${a.reason}`; (req.contractIssues ??= []).push({ title: c.title, note: `Accepted by ${personName(actor)}: ${a.reason}`, at, by: actor }); }
      if (a.choice === "value") { text = `Entered ${a.value}. Reason: ${a.reason}`; if (c.field) req.factEvents.push({ at, kind: "person", field: c.field, value: a.value ?? "", num: c.field === "amount" ? parseAmount(a.value) : undefined, by: actor, reason: a.reason ?? "" }); }
      c.status = "resolved"; c.resolvedAt = at; c.resolution = { by: actor, text, reopened: [] };
      ctx.resolvedConflict = c.id;
      log(req, at, `${personName(actor)} resolved conflict "${c.title}": ${text}`, "conflict", actor); return;
    }
    case "ask_supplier": {
      const req = reqOf(a.requestId); const c = a.conflictId ? state.conflicts[a.conflictId] : undefined;
      const sup = state.suppliers.find((s) => s.id === req.supplierId); const contact = sup?.contacts[0];
      const first = state.emails.find((e) => e.id === req.emailIds[0]);
      const d: Draft = { id: `draft-${evId}`, requestId: req.id, conflictId: c?.id, forPersonId: req.requesterId, to: contact?.email ?? "", subject: `RE: ${first?.subject.replace(/^(re|fwd?):\s*/i, "") ?? req.title}`, body: askText(state, req, c, contact?.name.split(" ")[0] ?? "there"), threadId: first?.threadId, createdAt: at, status: "draft", purpose: c ? `question about "${c.title}"` : "question" };
      state.drafts.push(d);
      log(req, at, `${personName(actor)} asked Ava to draft a question for ${contact?.name ?? "the supplier"}. Ava does not send it.`, "action", actor); return;
    }
    case "mark_sent": {
      const d = state.drafts.find((x) => x.id === a.draftId); if (!d || d.status === "sent") return;
      sendDraft(state, d, at, evId, actor); return;
    }
    case "comment": {
      const req = reqOf(a.requestId);
      const mentions = PEOPLE.filter((p) => new RegExp(`@${p.name.split(" ")[0]}\\b|@${p.name.replace(" ", "\\s?")}`, "i").test(a.text)).map((p) => p.id);
      const cm = { id: `cm-${evId}`, by: actor, at, text: a.text, mentions };
      if (a.conflictId && state.conflicts[a.conflictId]) state.conflicts[a.conflictId].comments.push(cm); else req.comments.push(cm);
      mentions.forEach((m) => req.flags.push({ id: `flag:${req.id}:mention:${evId}:${m}`, type: "mention", message: `${personName(actor)} mentioned you: "${a.text}"`, sendTo: "procurement", personId: m, status: "open", createdAt: at }));
      log(req, at, `${personName(actor)} commented${mentions.length ? ` and mentioned ${mentions.map(personName).join(", ")}` : ""}.`, "action", actor); return;
    }
    case "rerun": {
      const req = reqOf(a.requestId);
      if (a.emailId && a.extraction) state.extractions[a.emailId] = { source: a.source ?? "live", result: a.extraction };
      log(req, at, `${personName(actor)} re-ran Ava on ${req.emailIds.length} email(s)${a.extraction ? ` (${labelSource(a.source ?? "live")} on the latest email)` : ""}.`, "action", actor); return;
    }
    case "approve": {
      const req = reqOf(a.requestId); const an = analyze(state, req.id); const ap = an.approvals.find((x) => x.key === a.key); if (!ap) return;
      const rec = (req.approvals[a.key] ??= { key: a.key, receipts: [] });
      const kind = rec.receipts.length ? "reconfirmed" : "approved";
      rec.receipts.push({ id: `rc-${evId}`, at, by: actor, kind, snapshot: ap.current });
      const what = a.key === "budget_owner" ? `${lakh(an.requestAmount)}${an.retro ? ` (incl. ${lakh(an.retro)} already invoiced)` : ""}` : a.key === "vp" ? `the ${lakh(an.spend.total)} 90-day total${(ap.current.exceptionIds ?? []).length ? " and the exception" : ""}` : "data access and the security certificate";
      log(req, at, `${personName(actor)} ${kind === "approved" ? "approved" : "reconfirmed"} ${what} on a Decision Receipt.`, "approval", actor); return;
    }
    case "record_exception": {
      const req = reqOf(a.requestId);
      req.exceptions.push({ id: `ex-${evId}`, kind: a.kind, reason: a.reason, by: actor, at });
      if (a.kind === "retro") { const dept = person(req.requesterId)?.dept ?? "Other"; state.counters.startedBeforeApproval[dept] = (state.counters.startedBeforeApproval[dept] ?? 0) + 1; }
      log(req, at, `${personName(actor)} recorded ${a.kind === "retro" ? "a reason for work started before approval" : "an exception"}: "${a.reason}"`, "action", actor); return;
    }
    case "competing_quote": { const req = reqOf(a.requestId); req.competingQuote = { note: a.note, by: actor, at }; log(req, at, `${personName(actor)} attached a competing quote: ${a.note}`, "action", actor); return; }
    case "require_cr": {
      const c = state.conflicts[a.conflictId]; if (!c) return; const req = reqOf(c.requestId);
      const text = `Change request required before the new date is accepted. ${a.note}`;
      c.status = "resolved"; c.resolvedAt = at; c.resolution = { by: actor, text, reopened: [] };
      (req.contractIssues ??= []).push({ title: c.title, note: text, at, by: actor });
      log(req, at, `${personName(actor)} required a change request on "${c.title}". ${a.note}`, "conflict", actor); return;
    }
    case "ask_legal": {
      const c = state.conflicts[a.conflictId]; if (!c) return; const req = reqOf(c.requestId);
      req.flags.push({ id: `flag:${req.id}:legal:${evId}`, type: "mention", message: `${personName(actor)} asks Legal about "${c.title}": ${a.text}`, sendTo: "legal", personId: POLICY.legal, status: "open", createdAt: at });
      log(req, at, `${personName(actor)} asked ${personName(POLICY.legal)} (Legal) about "${c.title}".`, "conflict", actor); return;
    }
    case "rec_use": {
      const req = reqOf(a.requestId); const v = (state.ai.recs[a.recKey] ??= { at, source: "rules", fingerprint: "", output: { recommendation: "Review the conflict.", reasoning: "", citations: [], confidence: "low", action: "review" } });
      v.used = { by: actor, at };
      const rec = a.draft ? { ...v.output, draft: a.draft } : v.output; const c = state.conflicts[a.recKey];
      if (rec.action === "draft_supplier" && rec.draft) {
        const sup = state.suppliers.find((s) => s.id === req.supplierId); const first = state.emails.find((e) => e.id === req.emailIds[0]);
        state.drafts.push({ id: `draft-${evId}`, requestId: req.id, conflictId: c?.id, forPersonId: actor, to: sup?.contacts[0]?.email ?? "", subject: `RE: ${first?.subject.replace(/^(re|fwd?):\s*/i, "") ?? req.title}`, body: rec.draft, threadId: first?.threadId, createdAt: at, status: "draft", purpose: c ? `question about "${c.title}"` : "Ava's recommendation" });
      }
      if (rec.action === "ask_requester") {
        req.flags.push({ id: `flag:${req.id}:keep_line`, type: "question", message: rec.draft ?? rec.recommendation, sendTo: "requester", personId: req.requesterId, status: "open", createdAt: at, question: "keep_line" });
      }
      if (rec.action === "require_cr" && c) { c.status = "resolved"; c.resolvedAt = at; c.resolution = { by: actor, text: "Change request required.", reopened: [] }; (req.contractIssues ??= []).push({ title: c.title, note: "Change request required.", at, by: actor }); }
      log(req, at, `${personName(actor)} used Ava's recommendation${a.draft ? " (edited)" : ""}: ${rec.recommendation}`, "action", actor); return;
    }
    case "rec_dismiss": {
      const req = reqOf(a.requestId); const v = (state.ai.recs[a.recKey] ??= { at, source: "rules", fingerprint: "", output: { recommendation: "Review the conflict.", reasoning: "", citations: [], confidence: "low", action: "review" } });
      v.dismissed = { by: actor, at, reason: a.reason };
      log(req, at, `${personName(actor)} dismissed Ava's recommendation. Reason: ${a.reason}`, "action", actor); return;
    }
    case "reassign": { state.reassigned[a.itemKey] = a.to; return; }
    case "escalate": { const c = state.conflicts[a.conflictId]; if (!c) return; c.escalated = true; log(reqOf(c.requestId), at, `${personName(actor)} escalated "${c.title}" to ${personName(POLICY.vpApprover)}.`, "conflict", actor); return; }
    case "orphan_confirm": {
      const o = state.orphans.find((x) => x.id === a.orphanId); if (!o || o.status !== "open") return;
      const owner = person(actor) ?? person(o.likelyOwnerId)!;
      const id = nextReqId(state, at);
      const email = state.emails.find((e) => e.id === o.emailId)!;
      const req: Request = {
        id, title: `Invoice with no request: ${o.desc}`, type: "invoice", supplierId: o.supplierId, project: o.desc, requesterId: owner.id, costCentre: owner.costCentre ?? "CC-UNKNOWN", createdAt: at, emailIds: [o.emailId],
        filing: { confidence: "high", reason: `${owner.name} confirmed the invoice is theirs`, source: state.extractions[o.emailId]?.source ?? "basic" },
        facts: {}, documents: [], approvals: {}, flags: [], exceptions: [], retroItems: [{ invoiceNo: o.invoiceNo, desc: o.desc, amount: 0, emailId: o.emailId, source: o.source }],
        startedBeforeApproval: { at, source: o.source }, comments: [], timeline: [], factEvents: [{ at: email.sentAt, kind: "extraction", emailId: o.emailId }], checklistDone: {}, approvalCache: {},
      };
      state.requests[id] = req; state.requestOrder.push(id); state.threadRequest[email.threadId] = id;
      o.status = "confirmed"; o.requestId = id;
      log(req, at, `${owner.name} confirmed invoice ${o.invoiceNo} is theirs. Ava opened ${id} to cover it. Marked "Started before approval".`, "action", actor); return;
    }
    case "orphan_not_mine": { const o = state.orphans.find((x) => x.id === a.orphanId); if (o) o.status = "not_mine"; return; }
    case "add_supplier": {
      const req = reqOf(a.requestId);
      let sup = state.suppliers.find((s) => s.id === req.supplierId);
      if (!sup && req.supplierGuess) { sup = { id: req.supplierGuess.domain.split(".")[0], name: req.supplierGuess.name, domain: req.supplierGuess.domain, city: "", known: true, category: "New supplier", contacts: [] }; state.suppliers.push(sup); req.supplierId = sup.id; }
      if (sup) { sup.known = true; state.addedSuppliers.push(sup.id); log(req, at, `${personName(actor)} added ${sup.name} to the supplier list.`, "action", actor); }
      return;
    }
  }
}

function askText(state: State, req: Request, c: Conflict | undefined, name: string) {
  if (!c) return `Hi ${name},\n\nCould you help with a question on ${req.project}?\n\nThanks,\n${firstName(req.requesterId)}`;
  if (c.type === "renewal_terms_changed") {
    const an = analyze(state, req.id); const base = an.baseline; const bits: string[] = [];
    const fee = an.facts.amount?.num; if (fee && base?.amount && Math.abs(fee - base.amount) > 0.5) bits.push(`a ${Math.round(((fee - base.amount) / base.amount) * 100)}% increase`);
    const term = an.facts.duration?.num; if (term && base?.termMonths && term !== base.termMonths) bits.push(`a ${term}-month term`);
    if (an.facts.auto_renew?.num === 1) bits.push("auto-renewal");
    const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits.at(-1)}` : bits[0];
    return `Hi ${name}, the order form shows ${list}, but your email says nothing changes. Could you send a form at this year's terms, or explain the changes?`;
  }
  if (c.type === "said_vs_written") {
    const an = analyze(state, req.id); const lines = an.newLines.filter((l) => !/subtotal|gst|total/i.test(l));
    return `Hi ${name},\n\nThe updated quote comes to ${c.bValue ?? "a new amount"} before GST, up from ${c.aValue ?? "the earlier amount"}.${lines.length ? ` It adds: "${lines.join("; ")}".` : ""} Could you confirm what changed and why?\n\nThanks,\n${firstName(req.requesterId)}`;
  }
  if (c.type === "started_before_approval") {
    return `Hi ${name},\n\nWe received ${c.title.match(/Invoice \S+/)?.[0] ?? "an invoice"} for work that has no approval on our side yet. Please hold further invoices for it until we confirm.\n\nThanks,\n${firstName(req.requesterId)}`;
  }
  return `Hi ${name},\n\nYour note mentions access to our customer data. Could you confirm exactly what data your team will access, and for how long?\n\nThanks,\n${firstName(req.requesterId)}`;
}

// ---------------- Rules + notify + log ----------------
function runRules(prev: State, state: State, at: string, ctx: Ctx): State {
  // Pass 1: conflicts, flags, approvals, drafts, checklist closures, change feed.
  let s: State = { ...state };
  for (const id of s.requestOrder) {
    const req = s.requests[id];
    const an = analyze(s, id);
    const before = prev.requests[id] ? foldFacts(prev, prev.requests[id]).facts : {};
    const after = an.folded.facts;
    // Change feed (diff)
    for (const field of [...MATERIAL, "start_date", "auto_renew"]) {
      const b = before[field], a2 = after[field];
      if (!b || !a2 || !b.value) continue;
      const differs = b.num != null && a2.num != null ? Math.abs(b.num - a2.num) > 0.5 : field === "start_date" && parseDate(b.value) && parseDate(a2.value) ? parseDate(b.value) !== parseDate(a2.value) : norm(b.value) !== norm(a2.value);
      if (!differs || (field === "scope" && a2.origin === "document" && b.origin !== "document")) continue;
      if (field === "data_access" && b.num === a2.num) continue;
      if (field === "scope" && (norm(a2.value).includes(norm(b.value)) || norm(b.value).includes(norm(a2.value)) || a2.origin !== "document" || b.origin !== "document")) continue;
      const fmt = (f: typeof a2) => field === "amount" && f.num != null ? inr(f.num) : f.value;
      s.changes.push({ id: `chg-${id}-${s.changes.length}`, at, requestId: id, field: FIELD_LABEL[field] ?? field, old: fmt(b), new: fmt(a2), source: a2.sources[0], reopened: [] });
      log(req, at, `${FIELD_LABEL[field] ?? field} changed: ${fmt(b)} → ${fmt(a2)} (${a2.sources[0]?.file === "email" ? "email" : a2.sources[0]?.file}).${a2.versions.length > 1 && a2.origin === "document" && b.origin === "document" ? " Older version kept (rule 7)." : ""}`, "fact");
    }
    // Answered from documents (counter): required facts newly confirmed by a document.
    for (const field of an.requiredFacts) {
      const b = before[field], a2 = after[field];
      if (a2?.origin === "document" && a2.state === "confirmed" && (!b || b.state !== "confirmed" || b.origin === "email")) s.counters.answeredFromDocs++;
    }
    // Conflicts
    const desired = new Set(an.conflicts.map((c) => c.id));
    for (const spec of an.conflicts) {
      const ex = s.conflicts[spec.id];
      if (!ex) {
        const { resolveText, ...rest } = spec;
        s.conflicts[spec.id] = { ...rest, requestId: id, status: "open", openedAt: at, comments: [], resolveText };
        log(req, at, `Conflict opened (${spec.type.replace(/_/g, " ")}): ${spec.title}. Owner: ${personName(spec.ownerId)}.`, "conflict");
      } else if (ex.status === "open") Object.assign(ex, { title: spec.title, a: spec.a, b: spec.b, whyItMatters: spec.whyItMatters, blocks: spec.blocks, aValue: spec.aValue, bValue: spec.bValue });
    }
    for (const c of Object.values(s.conflicts).filter((c) => c.requestId === id && c.status === "open" && !desired.has(c.id))) {
      c.status = "resolved"; c.resolvedAt = at; c.resolution = { by: "ava", text: c.resolveText ?? "The sources now agree.", reopened: [] };
      log(req, at, `Conflict closed: ${c.title}. ${c.resolution.text}`, "conflict");
    }
    // Contract checks (Part 2): each one is an Ava action, logged once.
    const seen = new Set(req.checksSeen ?? []);
    for (const k of an.checks) {
      const key = `${k.id}:${k.status}`; if (seen.has(key)) continue; seen.add(key);
      log(req, at, `Checked against ${k.docId} ${k.clause}: ${k.status === "consistent" ? "consistent" : k.status === "conflict" ? "goes against the contract" : "note"}. ${k.text}`, "rule");
    }
    req.checksSeen = [...seen];
    // Flags
    for (const fl of an.flags) {
      if (!req.flags.find((x) => x.id === fl.id)) {
        req.flags.push({ ...fl, personId: "", status: "open", createdAt: at });
        log(req, at, `Flag to ${fl.sendTo.replace("_", " ")}: ${fl.message}`, "flag");
      }
    }
    for (const fl of req.flags) if (fl.status === "open" && fl.type !== "mention" && fl.question !== "keep_line" && !an.flags.find((x) => x.id === fl.id)) { fl.status = "dismissed"; fl.closedAt = at; }
    // Approvals: reopen when a material fact they depended on changed (rule 5).
    for (const ap of an.approvals) {
      const prevStatus = req.approvalCache[ap.key];
      if ((prevStatus === "approved" || prevStatus === "reconfirmed") && ap.status === "needs_reconfirmation") {
        s.counters.approvalsReopened++;
        ctx.reopened.push(personName(ap.approverId));
        log(req, at, `Approval reopened: ${personName(ap.approverId)}. ${ap.diffs.map((d) => `Given for ${d.old}. Current: ${d.new}.`).join(" ")}${ap.reopenSource ? ` Source: ${ap.reopenSource}.` : ""}`, "approval");
      }
      req.approvalCache[ap.key] = ap.status;
      if (ap.gateOpen) { const rec = (req.approvals[ap.key] ??= { key: ap.key, receipts: [] }); rec.firstRequiredAt ??= at; }
    }
    if (ctx.reopened.length) {
      s.changes.filter((c) => c.requestId === id && c.at === at && c.field === FIELD_LABEL.amount).forEach((c) => { c.reopened = [...ctx.reopened]; });
    }
    // Checklist closures ("how each item was closed")
    for (const c of an.checklist) {
      const closed = c.status === "done" || c.status === "excepted" || c.status === "legal_review";
      if (closed && !req.checklistDone[c.key]) {
        req.checklistDone[c.key] = { at, how: c.how };
        if (["nda", "msa", "gst_pan", "insurance", "security_cert", "renewal_terms"].includes(c.key)) s.counters.answeredFromDocs++;
        log(req, at, `Checklist: ${c.label} ${c.status === "legal_review" ? "assigned to Legal review" : c.status === "excepted" ? "excepted" : "done"}. ${c.how}`, "rule");
      } else if (!closed && req.checklistDone[c.key]) delete req.checklistDone[c.key];
    }
    // Drafts for the requester
    for (const d of an.drafts) {
      const keys = d.purpose.replace("docs:", "").split("+");
      const covered = s.drafts.some((x) => x.requestId === id && x.status === "sent" && keys.every((k) => x.purpose.includes(k) || x.body.toLowerCase().includes(k === "insurance" ? "insurance" : "iso")));
      if (covered || s.drafts.some((x) => x.requestId === id && x.status === "draft" && x.id.endsWith(d.purpose))) continue;
      s.drafts = s.drafts.filter((x) => !(x.requestId === id && x.status === "draft" && x.id.includes("docs:")));
      const first = s.emails.find((e) => e.id === req.emailIds[0]);
      s.drafts.push({ id: `draft-${id}-${d.purpose}`, requestId: id, forPersonId: req.requesterId, to: d.to, subject: d.subject, body: d.body, threadId: first?.threadId, createdAt: at, status: "draft", purpose: keys.map((k) => k === "insurance" ? "ask for the insurance certificate" : k === "security_cert" ? "ask for the renewed ISO 27001 certificate" : k).join(" and ") });
      const created = s.drafts[s.drafts.length - 1];
      if (s.autonomy?.autoSendDocChasers) { log(req, at, `Ava drafted a routine document request for ${personName(req.requesterId)}.`, "action"); sendDraft(s, created, addMinutes(at, 1), `auto-${created.id}`, "ava", true); }
      else log(req, at, `Ava drafted an email for ${personName(req.requesterId)} to send: ${keys.join(", ").replace("security_cert", "renewed security certificate")}. Ava does not send it.`, "action");
    }
    s.drafts = s.drafts.filter((x) => !(x.requestId === id && x.status === "draft" && x.id.includes("docs:") && !an.drafts.some((d) => x.id.endsWith(d.purpose))));
    // Supplier says work started
    if (an.folded.startedSignal && !req.startedBeforeApproval) {
      req.startedBeforeApproval = { at, source: an.folded.startedSignal };
      log(req, at, `${req.supplierId ? "Supplier" : "Sender"} says work has started. Marked "Started before approval".`, "flag");
    }
  }
  if (ctx.resolvedConflict && s.conflicts[ctx.resolvedConflict]) s.conflicts[ctx.resolvedConflict].resolution!.reopened = [...ctx.reopened];

  // Pass 2: handoff state and department items (fresh object so analysis is recomputed).
  s = { ...s };
  for (const id of s.requestOrder) {
    const req = s.requests[id]; const an = analyze(s, id);
    const ready = an.handoff.state === "ready_legal" || an.handoff.state === "ready_po";
    if (ready && !req.readyAt) { req.readyAt = at; log(req, at, an.handoff.state === "ready_legal" ? "All checks pass. Ready for Legal Review. Handoff packet generated." : "All checks pass. Ready to issue PO.", "handoff"); }
    if (!ready && req.readyAt) {
      const wasLegal = req.handoffState === "ready_legal";
      req.readyAt = undefined;
      const amt = s.changes.filter((c) => c.requestId === id && c.at === at && c.field === FIELD_LABEL.amount).pop();
      const reason = amt ? `price changed in a new quote (${lakh(parseAmount(amt.old))} → ${lakh(parseAmount(amt.new))}). Approvals reopened.` : `${an.handoff.reasons[0] ?? "facts changed"}.`;
      (req.withdrawals ??= []).push({ at, reason });
      log(req, at, `Handoff withdrawn: ${reason}`, "handoff");
      if (wasLegal) req.flags.push({ id: `flag:${id}:withdrawn:${at}`, type: "mention", message: `${id} withdrawn from Legal review on ${fmtDT(at).split(",")[0]}: ${reason}`, sendTo: "legal", personId: POLICY.legal, status: "open", createdAt: at });
    }
    req.handoffState = an.handoff.state;
  }
  const items = deriveItems(s);
  const open = new Set(items.map((i) => i.key));
  for (const it of items) {
    const rec = s.items[it.key];
    if (!rec) s.items[it.key] = { key: it.key, openedAt: at, history: [{ openedAt: at }] };
    else if (rec.closedAt) { rec.closedAt = undefined; rec.openedAt = at; rec.history.push({ openedAt: at }); }
  }
  for (const rec of Object.values(s.items)) if (!rec.closedAt && !open.has(rec.key)) { rec.closedAt = at; rec.history[rec.history.length - 1].closedAt = at; }
  return { ...s };
}
