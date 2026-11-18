// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §3.1 / 339 / 340 — what a COST LINE carries for the Green Book shape beyond its figure (CostLine.appraisal jsonb). PURE; CLIENT-SAFE.
//
//   payer   who pays: Exchequer · a department · citizens · business · other, named. Not said = "payer not stated" (a Gap), never inferred.
//   onCost  340 — an employer on-cost uplift on a STAFF line (NI, pension…), with its source. Only the owner's (ACCEPTED) or Lex's with a
//           cited source (PROPOSED until the owner takes it). Without an accepted one the line reads "excludes employer costs".
//   ob      339 — a CAPITAL line's Table 1 project type; `lowered` = the owner's lower rate with a reason (the guidance allows it as risks are
//           managed, 3.12–3.15). Non-capital lines take NO uplift and the report prints why.
// ─────────────────────────────────────────────────────────────────────────────

export const PARTY_KINDS = ['EXCHEQUER', 'DEPARTMENT', 'CITIZENS', 'BUSINESS', 'OTHER'] as const
export type PartyKind = (typeof PARTY_KINDS)[number]
export const PARTY_WORD: Record<PartyKind, string> = { EXCHEQUER: 'the Exchequer', DEPARTMENT: 'a department', CITIZENS: 'citizens', BUSINESS: 'business', OTHER: 'other' }

/** Table 1's project types (2013 guidance) — the keys of OPTIMISM_BIAS_CAPEX_UPPER. Restated as a list so this file stays import-free;
 *  check:lex-26y asserts the two agree. Outsourcing is not here: its Table 1 figure is on operating expenditure (costing-params note). */
export const OB_TYPES = ['standard-buildings', 'non-standard-buildings', 'standard-civil', 'non-standard-civil', 'equipment-and-development'] as const
export type ObType = (typeof OB_TYPES)[number]
export const OB_TYPE_WORD: Record<ObType, string> = {
  'standard-buildings': 'standard buildings', 'non-standard-buildings': 'non-standard buildings', 'standard-civil': 'standard civil engineering',
  'non-standard-civil': 'non-standard civil engineering', 'equipment-and-development': 'equipment and development',
}

export interface Party { kind: PartyKind; name: string | null }
export interface OnCost { rate: number; source: string; by: 'OWNER' | 'LEX'; status: 'ACCEPTED' | 'PROPOSED' }
export interface ObChoice { type: ObType; lowered: { rate: number; reason: string } | null }
export interface LineAppraisal { payer: Party | null; onCost: OnCost | null; ob: ObChoice | null }

export const EMPTY_APPRAISAL: LineAppraisal = { payer: null, onCost: null, ob: null }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** The stored jsonb → the shape; anything malformed reads as "not said" (never as a figure). */
export function parseLineAppraisal(raw: unknown): LineAppraisal {
  if (!isObj(raw)) return EMPTY_APPRAISAL
  const p = isObj(raw.payer) && (PARTY_KINDS as readonly string[]).includes(String(raw.payer.kind))
    ? { kind: raw.payer.kind as PartyKind, name: typeof raw.payer.name === 'string' && raw.payer.name.trim() ? raw.payer.name.trim() : null } : null
  const oc = isObj(raw.onCost) && typeof raw.onCost.rate === 'number' && raw.onCost.rate >= 0 && raw.onCost.rate <= 2 && typeof raw.onCost.source === 'string' && raw.onCost.source.trim()
    ? { rate: raw.onCost.rate, source: raw.onCost.source.trim(), by: raw.onCost.by === 'LEX' ? 'LEX' as const : 'OWNER' as const, status: raw.onCost.status === 'PROPOSED' ? 'PROPOSED' as const : 'ACCEPTED' as const } : null
  let ob: ObChoice | null = null
  if (isObj(raw.ob) && (OB_TYPES as readonly string[]).includes(String(raw.ob.type))) {
    const lw = isObj(raw.ob.lowered) && typeof raw.ob.lowered.rate === 'number' && raw.ob.lowered.rate >= 0 && typeof raw.ob.lowered.reason === 'string' && raw.ob.lowered.reason.trim().length >= 3
      ? { rate: raw.ob.lowered.rate, reason: raw.ob.lowered.reason.trim() } : null
    ob = { type: raw.ob.type as ObType, lowered: lw }
  }
  return { payer: p, onCost: oc, ob }
}

/** A party in words: "a department (Cabinet Office)" / "business". */
export function partyWords(p: Party | null): string {
  if (!p) return 'not stated'
  return p.name ? `${PARTY_WORD[p.kind]} (${p.name})` : PARTY_WORD[p.kind]
}

/** "24%". */
export function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`
}
