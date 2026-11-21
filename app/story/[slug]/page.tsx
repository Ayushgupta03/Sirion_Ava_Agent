"use client";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { Card, Empty, PageTitle } from "@/components/ui";

const A = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">{children}</a>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-3 max-w-3xl text-[14.5px] leading-relaxed text-slate-800">{children}</p>;
const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-6 text-[16px] font-semibold">{children}</h2>;

const STAKE = [
  ["Requester (Rahul, Neha, Suresh)", "Get the supplier started fast. Not be blamed.", "Wants speed; control steps feel like delay. May under-report data access or split purchases to stay under limits.", "Writes normal email. Answers one Yes/No question. Gets a draft to send. Sees status in plain words."],
  ["Procurement (Karan, request owner)", "Complete, correctly routed requests. Competitive prices.", "Asks for quotes and exceptions the requester sees as friction.", "Owns every request. Sees conflicts, exceptions, the Unsorted tray and handoff control."],
  ["Legal (Farah)", "Requests that arrive complete, so review starts on substance.", "Wants every agreement reviewed; the business wants fewer reviews.", "Receives a handoff packet with confirmed facts, signed receipts and open notes. DPA assigned during review."],
  ["Finance (Suresh, Deepa)", "Spend within budget, invoices that match agreed prices.", "Invoices arrive before approvals exist.", "Invoices with no request are caught and linked. Early starts are recorded, not hidden."],
  ["InfoSec and Privacy (Meera)", "Know which suppliers touch customer data, with valid certificates.", "Reviews add days; requesters may not mention data access.", "Ava spots data access in attachments and asks the requester. Certificate dates are checked against the engagement."],
  ["Approvers (Ananya, Vikram)", "Approve with the right facts, once.", "Approvals given on old facts stay valid in email.", "Decision Receipts record what was approved and reopen when facts change."],
  ["Supplier (external)", "Start work and get paid on time.", "Prices and terms change between email and attachment.", "Never sees Ava's flags. Receives questions sent by a person."],
  ["Employees generally (privacy)", "Their mail is not read beyond its purpose.", "Ava reads supplier mail.", "Scope is limited to supplier domains. Employees can see what Ava captured from their mail."],
];

const PAGES: Record<string, { title: string; body: ReactNode }> = {
  why: { title: "Why intake", body: <>
    <P>Intake is where the data and routing for every later stage are created or lost. The brief names two intake failures directly: requests get lost and approvals stall.</P>
    <P>Many downstream losses, such as unreviewed renewals and invoices that don't match agreed prices, start with terms that were never captured at the start.</P>
    <P>We chose to go deep on one stage. Ava stops at the handoff: Ready for Legal Review or Ready to issue PO.</P>
  </> },
  problem: { title: "The problem", body: <>
    <P>Contract requests start in email, many deals never reach a contract, and the facts that matter are scattered across threads and attachments.</P>
    <P>We believe the main cause is human: the official process feels slow and punishing, so people route around it. The pilot will test this.</P>
    <H>Evidence (industry data)</H>
    <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-[14px]">
      <li>49% of legal teams still manage contracts with email and shared folders. <A href="https://spotdraft.com/benchmarking-report-2025">SpotDraft, 2025 Contracting Efficiency Benchmarking Report</A></li>
      <li>Intake costs 15 to 30 minutes per request before work begins. <A href="https://www.legalontech.com/post/in-house-legal-productivity">LegalOn</A></li>
      <li>Requests arrive without the basics, so legal teams chase people to fill gaps. <A href="https://legalontech.com/post/fixing-in-house-legals-biggest-hidden-bottleneck">LegalOn</A></li>
      <li>Streamlining intake and request management is a top legal-ops priority, at 54%. <A href="https://www.checkbox.ai/2025-insights-report/redefining-legal-intake">Checkbox, 2025 Insights report</A></li>
      <li>Nearly 30% of indirect spend is off-contract (The Hackett Group, cited by <A href="https://www.esker.com/blog/source-to-pay/what-is-maverick-spend/">Esker</A>).</li>
      <li>The average business loses almost 9% of value a year to poor contract management. <A href="https://info.worldcc.com/contract-management-aug-2025">WorldCC, 2025</A></li>
    </ul>
    <H>Who it affects</H>
    <P>Requesters lose days to back-and-forth. Procurement and Legal start reviews with missing facts. Finance pays invoices nobody approved. InfoSec learns about data access late.</P>
    <H>Hypotheses to test</H>
    <ul className="max-w-3xl list-disc space-y-1 pl-5 text-[14px]"><li>People under-report data access.</li><li>People split purchases to stay under limits.</li><li>People delay approvals out of fear of blame.</li></ul>
  </> },
  stakeholders: { title: "Stakeholders", body: <>
    <P>The central conflict is speed against control. Ava makes the controlled path the fastest one.</P>
    <Card className="mt-3 overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="border-b border-slate-100 text-left text-[12px] text-slate-500">{["Stakeholder", "What they want", "Where they conflict", "How Ava helps"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
      <tbody>{STAKE.map((r) => <tr key={r[0]} className="border-b border-slate-50 align-top">{r.map((c, i) => <td key={i} className={i === 0 ? "px-3 py-2 font-medium" : "px-3 py-2"}>{c}</td>)}</tr>)}</tbody></table></Card>
    <H>How their experiences connect</H>
    <P>One event log feeds every view. When Rahul answers Yes to data access, an item appears for Meera (InfoSec) and a DPA item for Farah (Legal). When a PDF changes the price, Ananya's and Vikram's receipts reopen and Karan's request shows a blocked banner. When intake completes, Farah receives the packet.</P>
  </> },
  metrics: { title: "Metrics", body: <>
    <H>North star</H>
    <P>The share of in-scope supplier requests that reach Ready for Legal Review or Ready to issue PO, complete and correctly routed, within 1 business day of the first email (proposed pilot target).</P>
    <P>Measured against a regular sample of supplier email, so missed requests count.</P>
    <H>Long-term business result</H><P>Governed Spend Coverage: the share of supplier spend that went through a complete, approved request.</P>
    <H>Supporting metrics</H>
    <ul className="max-w-3xl list-disc space-y-1 pl-5 text-[14px]"><li>Routing errors</li><li>Reviewer follow-ups after handoff</li><li>Filing accuracy</li><li>Checklist items resolved from documents</li><li>Department waiting time</li><li>Fast-path share</li></ul>
    <H>Rethink if</H>
    <ul className="max-w-3xl list-disc space-y-1 pl-5 text-[14px]"><li>Reviewers override routing on more than 20% of requests.</li><li>More than 10% of filed items are moved to another project.</li><li>Fewer than half of “invoice with no request” cards are confirmed.</li><li>Reviewers keep asking follow-up questions after handoff.</li><li>Employees object to Ava reading supplier mail.</li></ul>
  </> },
  assumptions: { title: "Assumptions", body: <>
    <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-[14px]">
      <li>3,000 employees, about 2,500 suppliers, about 200 requests a month.</li>
      <li>Microsoft 365 or Google Workspace mail access approved by IT and Legal. Email with suppliers is treated as business correspondence; employees are told Ava exists. In production Ava would connect through their standard mail-access interfaces.</li>
      <li>Supplier list in the ERP.</li>
      <li>Slack or Teams for notifications.</li>
      <li>Approval limits: cumulative spend before GST, per supplier and cost centre, over a rolling 90 days. Above ₹25,00,000 needs VP approval and a competing quote or authorized exception. Budget owner approval is always required.</li>
      <li>Procurement owns requests until handoff.</li>
      <li>Email, ERP and e-signature are simulated in this prototype.</li>
      <li>Extraction: live AI when a key is set; cached AI results for the scripted emails; a rules-based extractor when AI is unavailable. Policy is plain code in every case.</li>
    </ul>
  </> },
  sirion: { title: "Ava and Sirion", body: <>
    <P>Ava is a standalone agent owned by the company. Her handoff packet can go to any contract management system, including Sirion.</P>
    <H>What Sirion publicly shows</H>
    <ul className="max-w-3xl list-disc space-y-1 pl-5 text-[14px]"><li>Agents for search, drafting, issue detection, redlining and extraction.</li><li>Obligation and invoice agents after signature.</li><li>Self-service intake with forms.</li></ul>
    <H>Ava differs in four ways</H>
    <ul className="max-w-3xl list-disc space-y-1 pl-5 text-[14px]"><li>She records supplier email and attachments without anyone submitting anything.</li><li>She files by supplier, project and request before a contract exists.</li><li>She reads quotes and certificates.</li><li>Approvals reopen when facts change.</li></ul>
    <P>This comparison uses public material only.</P>
  </> },
};

export default function StoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const p = PAGES[slug];
  if (!p) return <Empty>Not found.</Empty>;
  return <div><PageTitle title={p.title} />{p.body}</div>;
}
