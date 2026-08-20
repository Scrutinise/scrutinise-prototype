/**
 * stats-licence-register.ts — S10 §4.2. THE DECLARED USE CONTEXT, WITH A DATE AND AN OWNER.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS AND WHY IT IS NOT JUST A COMMENT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `STATS_USE_CONTEXT=non-commercial` is now set in Vercel. As the brief puts it: "a licence
 * declaration sitting as a bare string in a dashboard is a compliance obligation with no owner and
 * no date." Nobody can tell, from the dashboard alone, who decided it, when, on what basis, or
 * whether the running value is still the decided one.
 *
 * ⚠⚠ AND THE DIRECTION IS COUNTER-INTUITIVE, WHICH IS EXACTLY WHY IT NEEDS WRITING DOWN. The
 * restrictive setting is `commercial`, not `non-commercial`. `searchCatalogue`'s gate reads:
 *
 *     if (useContext === 'commercial' && row.commercialUseExcluded) → withhold
 *
 * so a series marked `commercialUseExcluded` is WITHHELD in a commercial context and PERMITTED in
 * a non-commercial one. Read quickly, "non-commercial" sounds like the cautious choice; it is the
 * permissive one. Getting this backwards would either hide half the store for no reason or expose
 * IMF series in a context the licence does not allow — and the second failure is legal rather than
 * cosmetic.
 *
 * ⚠ THE FIGURES S9 REPORTED WERE THE COMMERCIAL ARM. "40.6% of series, 50.2% of observations,
 * filtered before scoring" is what the gate withholds under `commercial`. Under the
 * `non-commercial` value now set in Vercel the withheld count is ZERO and the whole store is
 * searchable. Both numbers are correct; only one of them describes production, and S9 did not say
 * which. `scripts/measure-s10-stats.ts` measures both and prints them side by side.
 *
 * The check that keeps this honest is `scripts/check-s10-stats-licence.ts`: it asserts the DECLARED
 * context below and the RUNNING configuration (`statsUseContext()`) agree, and fails if they do
 * not. A register that cannot disagree with the deployment is not a register.
 */
import type { StatsUseContext } from './stats-catalogue'

export interface LicenceDecision {
  /** The use context this deployment declares. Must match `statsUseContext()` at runtime. */
  useContext: StatsUseContext
  /** ISO date the decision was taken. */
  decidedOn: string
  /** Who took it. A decision with no owner is not a decision. */
  decidedBy: string
  /** Why — the fact about the deployment that makes the context correct. */
  basis: string
  /** What would have to change for the decision to need re-taking. */
  revisitWhen: string
  /** Where the underlying licence terms are recorded. */
  termsRecordedIn: string
}

/**
 * ⚠ EDITING THIS IS A COMPLIANCE ACT, NOT A CONFIG CHANGE. Changing `useContext` here without
 * changing `STATS_USE_CONTEXT` in Vercel (or the reverse) makes the check fail, which is the
 * intended behaviour: the two must move together and someone must notice.
 */
export const STATS_LICENCE_DECISION: LicenceDecision = {
  useContext: 'non-commercial',
  decidedOn: '2026-08-20',
  decidedBy: 'Charlie (set STATS_USE_CONTEXT=non-commercial in Vercel; recorded here by CC-Search executing BRIEF_SEARCH_S10 §4.2)',
  basis:
    'scrutinise.org is a not-for-profit civic platform and does not sell, licence or resell the ' +
    'figures or any product derived from them. The IMF Copyright and Usage terms exclude COMMERCIAL ' +
    'use without written permission; they do not exclude this use. 2,329 of 5,733 series (40.6%, all ' +
    'IMF), carrying 50.2% of all observations, turn on this distinction.',
  revisitWhen:
    'Any of: the platform begins charging for access to figures or to anything derived from them; a ' +
    'commercial fork or white-label deployment is made; a partner is given a feed; or the IMF terms ' +
    'change. Each of those flips the correct value to `commercial`, which WITHHOLDS the IMF half.',
  termsRecordedIn: 'docs/LICENCE_COMPLIANCE.md and the stat_dataset.licence / commercialUseExcluded columns (the register proper).',
}
