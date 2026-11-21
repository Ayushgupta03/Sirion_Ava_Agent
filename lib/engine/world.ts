// Read-only access to the seeded world: people, suppliers, existing contracts, policy.
import seed from "@/data/seed.json";
import type { Person, Role, SeedContract, State, Supplier } from "../types";
import { domainOf } from "../format";

export const PEOPLE = seed.people as Person[];
export const CONTRACTS = seed.contracts as SeedContract[];
export const POLICY = seed.policy;
export const COST_CENTRES = seed.costCentres as { id: string; name: string; budgetOwner: string }[];
export const SEED_SUPPLIERS = seed.suppliers as Supplier[];
export const START_CLOCK = seed.startClock;
export const COMPANY_DOMAIN = seed.company.domain;

export const person = (id?: string) => PEOPLE.find((p) => p.id === id);
export const personName = (id?: string) => person(id)?.name ?? id ?? "Unknown";
export const firstName = (id?: string) => personName(id).split(" ")[0];
export const personByEmail = (addr: string) => PEOPLE.find((p) => addr.toLowerCase().includes(p.email.toLowerCase()));
export const isInternal = (addr: string) => domainOf(addr) === COMPANY_DOMAIN;

export function supplierByDomain(state: State, domain: string) {
  return state.suppliers.find((s) => s.domain === domain);
}
export const supplierById = (state: State, id?: string | null) => state.suppliers.find((s) => s.id === id);

export function budgetOwnerFor(cc: string) {
  return COST_CENTRES.find((c) => c.id === cc)?.budgetOwner ?? "ananya";
}

export function roleOwner(role: Role, requesterId: string, cc: string): string {
  switch (role) {
    case "requester": return requesterId;
    case "procurement": return POLICY.procurementOwner;
    case "infosec": return POLICY.infosec;
    case "legal": return POLICY.legal;
    case "finance": return POLICY.finance;
    case "budget_owner": return budgetOwnerFor(cc);
    case "vp": return POLICY.vpApprover;
  }
}

export const contractsFor = (supplierId: string | null) => CONTRACTS.filter((c) => c.supplierId === supplierId);

export function displayAddr(addr: string, state?: State) {
  const p = personByEmail(addr); if (p) return p.name;
  if (state) for (const s of state.suppliers) { const c = s.contacts.find((c) => c.email === addr.toLowerCase()); if (c) return `${c.name} (${s.name.split(" ")[0]})`; }
  if (addr === "ap@prayaan.example") return "Accounts payable";
  return addr;
}
