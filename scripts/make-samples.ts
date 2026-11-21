// Generates the sample PDFs and XLSX used by the scenarios, then extracts their text with the
// same extractor the server uses, into data/sample-texts.json. Run: npm run samples
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { extractFile } from "../lib/extractText";

const OUT = path.join(process.cwd(), "public", "samples");
const FONT_DIR = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
fs.mkdirSync(OUT, { recursive: true });

type Block =
  | { t: "h1" | "h2" | "p" | "small"; s: string }
  | { t: "table"; cols: number[]; rows: string[][]; header?: boolean }
  | { t: "gap"; n?: number }
  | { t: "rule" };

const FICTIONAL = "Fictional document for the Ava prototype. All companies, people and numbers are invented.";

async function pdf(name: string, blocks: Block[]) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fs.readFileSync(path.join(FONT_DIR, "DejaVuSans.ttf")), { subset: true });
  const bold = await doc.embedFont(fs.readFileSync(path.join(FONT_DIR, "DejaVuSans-Bold.ttf")), { subset: true });
  doc.setTitle(name.replace(/\.pdf$/, ""));
  doc.setCreator("Ava prototype sample generator");
  let page = doc.addPage([595, 842]);
  let y = 790;
  const left = 50;
  const ensure = (h: number) => { if (y - h < 60) { page = doc.addPage([595, 842]); y = 790; } };
  const wrap = (s: string, size: number, max: number) => {
    const words = s.split(" "); const out: string[] = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (reg.widthOfTextAtSize(t, size) > max) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  };
  for (const b of blocks) {
    if (b.t === "gap") { y -= (b.n ?? 1) * 10; continue; }
    if (b.t === "rule") { ensure(10); page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); y -= 12; continue; }
    if (b.t === "table") {
      b.rows.forEach((r, i) => {
        ensure(16);
        const f = b.header && i === 0 ? bold : reg;
        r.forEach((cell, ci) => page.drawText(cell, { x: left + b.cols[ci], y, size: 9.5, font: f }));
        y -= 16;
      });
      y -= 4; continue;
    }
    const size = b.t === "h1" ? 16 : b.t === "h2" ? 11.5 : b.t === "small" ? 8 : 10;
    const f = b.t === "h1" || b.t === "h2" ? bold : reg;
    for (const line of wrap(b.s, size, 495)) {
      ensure(size + 6);
      page.drawText(line, { x: left, y, size, font: f, color: b.t === "small" ? rgb(0.4, 0.4, 0.4) : rgb(0, 0, 0) });
      y -= size + 5;
    }
    y -= b.t === "h1" ? 6 : 3;
  }
  page.drawText(FICTIONAL, { x: left, y: 40, size: 7, font: reg, color: rgb(0.5, 0.5, 0.5) });
  fs.writeFileSync(path.join(OUT, name), await doc.save());
}

const tvHeader = (title: string): Block[] => [
  { t: "h1", s: "Trivenika Systems Pvt Ltd" },
  { t: "small", s: "IT services, Pune  |  trivenika.example  |  GSTIN 27AAACT1234K1Z5" },
  { t: "rule" },
  { t: "h2", s: title },
];

const quoteCols = [0, 215, 260, 320, 410];
const v1Rows = [
  ["Role", "Qty", "Months", "Rate/month", "Amount"],
  ["Salesforce Solution Architect", "1", "2", "₹3,00,000", "₹6,00,000"],
  ["Senior Salesforce Developer", "2", "2", "₹2,00,000", "₹8,00,000"],
  ["Data Migration Specialist", "1", "2", "₹2,00,000", "₹4,00,000"],
  ["Project Manager (50%)", "0.5", "2", "₹2,00,000", "₹2,00,000"],
];

function proposal(version: string, date: string, extra: string[][], subtotal: string, gst: string, total: string): Block[] {
  return [
    ...tvHeader(`Proposal TSPL-Q-2611-01 (${version})`),
    { t: "p", s: `Date: ${date}` },
    { t: "p", s: "To: Rahul Mehta, Sales Ops, Prayaan Software Pvt Ltd" },
    { t: "p", s: "Subject: Salesforce migration (legacy CRM to Salesforce)" },
    { t: "gap" },
    { t: "p", s: "Scope: Migrate the sales pipeline, accounts, contacts and opportunity history from the legacy CRM to Salesforce, including data mapping, migration runs and reconciliation." },
    { t: "p", s: "Access required: Salesforce admin access to sync and validate customer records during migration." },
    { t: "p", s: "Duration: 2 months (8 weeks), starting 16 Nov 2026." },
    { t: "gap" },
    { t: "table", cols: quoteCols, header: true, rows: [...v1Rows, ...extra] },
    { t: "rule" },
    { t: "table", cols: [0, 410], rows: [["Subtotal (before GST)", subtotal], ["GST 18%", gst], ["Total", total]] },
    { t: "gap" },
    { t: "p", s: "Validity: 30 days from the date of this proposal." },
    { t: "p", s: "Payment terms: 30 days from invoice." },
    { t: "p", s: "Prices are subject to the Master Services Agreement dated 2 April 2024." },
    { t: "gap" },
    { t: "p", s: "Arjun Deshpande, Engagement Manager" },
  ];
}

async function main() {
  await pdf("Trivenika_Proposal_v1.pdf", proposal("v1", "12 Nov 2026", [], "₹20,00,000", "₹3,60,000", "₹23,60,000"));
  await pdf("Trivenika_Proposal_v2.pdf", proposal("v2", "13 Nov 2026",
    [["Data validation and UAT support", "1", "lump sum", "", "₹1,50,000"]], "₹21,50,000", "₹3,87,000", "₹25,37,000"));
  await pdf("Trivenika_Quote_23L.pdf", proposal("v3", "16 Nov 2026",
    [["Data validation and UAT support", "1", "lump sum", "", "₹1,50,000"], ["Hypercare support, 4 weeks", "1", "lump sum", "", "₹1,50,000"]],
    "₹23,00,000", "₹4,14,000", "₹27,14,000"));

  await pdf("Trivenika_MSA_comments.pdf", [
    ...tvHeader("Comments on the Master Services Agreement (2 April 2024)"),
    { t: "p", s: "1. Clause 9.2 (Limitation of liability): we propose a cap of 12 months' fees." },
    { t: "p", s: "2. Clause 11 (Termination for convenience): we propose 60 days' notice instead of 30." },
    { t: "p", s: "3. Clause 14 (Non-solicitation): we propose a mutual clause." },
    { t: "p", s: "4. Schedule 3 (Rate revision): annual revision of up to 10%." },
  ]);

  await pdf("Trivenika_Insurance_Certificate.pdf", [
    { t: "h1", s: "Sahyadri General Insurance Co. Ltd" },
    { t: "rule" },
    { t: "h2", s: "Certificate of Insurance" },
    { t: "p", s: "Insured: Trivenika Systems Pvt Ltd, Pune" },
    { t: "p", s: "Policy: Professional indemnity, policy no. SGI/PI/2026/88213" },
    { t: "p", s: "Limit of indemnity: ₹2 crore (₹2,00,00,000) any one claim and in the aggregate" },
    { t: "p", s: "Period of insurance: 1 Apr 2026 to 31 Mar 2027" },
    { t: "p", s: "Valid until: 31 Mar 2027" },
  ]);

  const iso = (valid: string, from: string, no: string): Block[] => [
    { t: "h1", s: "Certus Assurance Registrar" },
    { t: "rule" },
    { t: "h2", s: "Certificate of Registration: ISO/IEC 27001:2022" },
    { t: "p", s: `Certificate no.: ${no}` },
    { t: "p", s: "Organisation: Trivenika Systems Pvt Ltd, Pune" },
    { t: "p", s: "Scope: Provision of IT consulting and CRM implementation services, including handling of client CRM data." },
    { t: "p", s: `Issued: ${from}` },
    { t: "p", s: `Valid until: ${valid}` },
  ];
  await pdf("Trivenika_ISO27001_2026-2029.pdf", iso("8 Dec 2029", "16 Nov 2026", "CAR-ISMS-4471-R2"));
  await pdf("Trivenika_ISO27001_expired.pdf", iso("30 Sep 2026", "1 Oct 2023", "CAR-ISMS-3920"));

  await pdf("Trivenika_SOW_Extension.pdf", [
    ...tvHeader("SOW-0391-E1: Extension of the marketing dashboard work"),
    { t: "p", s: "Customer: Prayaan Software Pvt Ltd, Marketing Ops (Neha Kapoor)" },
    { t: "p", s: "Under: Master Services Agreement dated 2 April 2024" },
    { t: "p", s: "Scope: Extend the marketing dashboard work for 4 more weeks with the same team (1 BI developer, 1 analyst)." },
    { t: "p", s: "Duration: 4 weeks, starting on signature." },
    { t: "p", s: "Data access: No access to personal or customer data. Work uses aggregated campaign data only." },
    { t: "table", cols: [0, 410], rows: [["Fees (before GST)", "₹6,00,000"], ["GST 18%", "₹1,08,000"], ["Total", "₹7,08,000"]] },
    { t: "p", s: "All other terms as per the Master Services Agreement." },
  ]);

  await pdf("Trivenika_Invoice_TS-5520.pdf", [
    ...tvHeader("Tax invoice TS-5520"),
    { t: "p", s: "Bill to: Prayaan Software Pvt Ltd, attention Rahul Mehta" },
    { t: "p", s: "Description: Salesforce migration, mobilisation (work started 16 Nov 2026)" },
    { t: "table", cols: [0, 410], rows: [["Amount (before GST)", "₹3,00,000"], ["GST 18%", "₹54,000"], ["Total", "₹3,54,000"]] },
  ]);

  const koshaHeader: Block[] = [
    { t: "h1", s: "Kosha Analytics Pvt Ltd" },
    { t: "small", s: "BI software, Bengaluru  |  kosha.example  |  GSTIN 29AAKCK5521L1Z2" },
    { t: "rule" },
  ];
  await pdf("Kosha_Renewal_Order_Form.pdf", [
    ...koshaHeader,
    { t: "h2", s: "Order form KOS-OF-2027-118" },
    { t: "p", s: "Customer: Prayaan Software Pvt Ltd (Finance), attention Suresh Pillai" },
    { t: "p", s: "Product: Kosha BI Enterprise, 120 named users" },
    { t: "p", s: "Annual fee: ₹20,16,000 (before GST)" },
    { t: "p", s: "Term: 36 months from 1 Jan 2027" },
    { t: "p", s: "This order renews automatically for successive 12-month terms unless either party gives 60 days' written notice." },
    { t: "p", s: "Governed by the Master Subscription Agreement dated 20 Dec 2025." },
    { t: "gap", n: 2 },
    { t: "p", s: "Signature: ____________________   Date: __________" },
  ]);
  await pdf("Kosha_Renewal_Order_Form_v2.pdf", [
    ...koshaHeader,
    { t: "h2", s: "Order form KOS-OF-2027-118 (revised)" },
    { t: "p", s: "Customer: Prayaan Software Pvt Ltd (Finance), attention Suresh Pillai" },
    { t: "p", s: "Product: Kosha BI Enterprise, 120 named users" },
    { t: "p", s: "Annual fee: ₹18,90,000 (before GST)" },
    { t: "p", s: "Term: 12 months, 1 Jan 2027 to 31 Dec 2027" },
    { t: "p", s: "Renewal: This order does not renew automatically." },
    { t: "p", s: "Governed by the Master Subscription Agreement dated 20 Dec 2025." },
  ]);
  await pdf("Kosha_Invoice_KA-7781.pdf", [
    ...koshaHeader,
    { t: "h2", s: "Tax invoice KA-7781" },
    { t: "p", s: "Bill to: Prayaan Software Pvt Ltd (Finance), attention Suresh Pillai" },
    { t: "p", s: "Description: Forecast module add-on, Dec 2026 to Dec 2027" },
    { t: "p", s: "Note: Module activated on 2 Nov 2026 at the end of a free trial." },
    { t: "table", cols: [0, 410], rows: [["Amount (before GST)", "₹2,40,000"], ["GST 18%", "₹43,200"], ["Total", "₹2,83,200"]] },
    { t: "p", s: "Payment due: 30 days from invoice date (30 Nov 2026)." },
  ]);
  await pdf("Kosha_MSA_2025.pdf", [...koshaHeader, { t: "h2", s: "Master Subscription Agreement" }, { t: "p", s: "Between Kosha Analytics Pvt Ltd and Prayaan Software Pvt Ltd. Signed 20 Dec 2025." }]);

  await pdf("Kalakriti_Invoice_INV-KDS-2291.pdf", [
    { t: "h1", s: "Kalakriti Design Studio" },
    { t: "small", s: "Design agency, Bengaluru  |  kalakriti.example" },
    { t: "rule" },
    { t: "h2", s: "Tax invoice INV-KDS-2291" },
    { t: "p", s: "Bill to: Prayaan Software Pvt Ltd" },
    { t: "p", s: "Attention: Neha Kapoor, Marketing Ops" },
    { t: "p", s: "Description: Brand refresh, phase 1" },
    { t: "table", cols: [0, 410], rows: [["Amount (before GST)", "₹4,20,000"], ["GST 18%", "₹75,600"], ["Total", "₹4,95,600"]] },
    { t: "p", s: "PO number: none provided" },
  ]);

  await pdf("Lumina_Order_Form_AutoRenew.pdf", [
    { t: "h1", s: "Lumina HR Cloud Pvt Ltd" },
    { t: "rule" },
    { t: "h2", s: "Order form LHC-2027-044" },
    { t: "p", s: "Product: Lumina HR Cloud, 3,000 employees" },
    { t: "p", s: "Annual fee: ₹14,40,000 (before GST)" },
    { t: "p", s: "Term: 24 months" },
    { t: "p", s: "This order renews automatically for successive 12-month terms unless either party gives 90 days' written notice." },
  ]);
  await pdf("Navkar_Logistics_Quote.pdf", [
    { t: "h1", s: "Navkar Logistics LLP" },
    { t: "rule" },
    { t: "h2", s: "Quotation NL-Q-0912" },
    { t: "p", s: "Scope: Office relocation, Pune to Bengaluru, 60 workstations and IT equipment" },
    { t: "table", cols: [0, 410], rows: [["Amount (before GST)", "₹7,80,000"], ["GST 18%", "₹1,40,400"], ["Total", "₹9,20,400"]] },
    { t: "p", s: "Validity: 15 days." },
  ]);
  await pdf("Trivenika_NDA_2024.pdf", [...tvHeader("Mutual Non-Disclosure Agreement"), { t: "p", s: "Between Trivenika Systems Pvt Ltd and Prayaan Software Pvt Ltd. Signed 14 Mar 2024." }]);
  await pdf("Trivenika_MSA_2024.pdf", [...tvHeader("Master Services Agreement"), { t: "p", s: "Signed 2 Apr 2024. Term: 3 years. Renewal: renews automatically for 12 months unless either party gives 60 days' notice." }]);

  // Rate card workbook with the 2025 values in a second sheet.
  const wb = XLSX.utils.book_new();
  const r26 = [["Role", "Rate per month (INR, before GST)"], ["Salesforce Solution Architect", 300000], ["Senior Salesforce Developer", 200000], ["Data Migration Specialist", 200000], ["Project Manager", 200000]];
  const r25 = [["Role", "Rate per month (INR, before GST)"], ["Salesforce Solution Architect", 300000], ["Senior Salesforce Developer", 180000], ["Data Migration Specialist", 200000], ["Project Manager", 200000]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r26), "Rate card 2026");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r25), "Rate card 2025");
  fs.writeFileSync(path.join(OUT, "Trivenika_RateCard_2026.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  // Extract text with the same code the server uses.
  const texts: Record<string, unknown> = {};
  for (const f of fs.readdirSync(OUT).sort()) {
    const ex = await extractFile(f, new Uint8Array(fs.readFileSync(path.join(OUT, f))));
    texts[f] = ex;
  }
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "data", "sample-texts.json"), JSON.stringify(texts, null, 1));
  console.log(`Wrote ${Object.keys(texts).length} sample files`);
}

main().catch((e) => { console.error(e); process.exit(1); });
