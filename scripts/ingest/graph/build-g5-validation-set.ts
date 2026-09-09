/**
 * build-g5-validation-set.ts — BRIEF_GRAPH_5 §3.3. THE SET A PERSON VALIDATES.
 *
 * ⚠⚠ **THIS SCRIPT SCORES NOTHING.** §3.3 is explicit, and the reason is the one the answer-key
 * work established: a basis that does not determine the answer marks you wrong every time you are
 * right. The only competent judge of whether *"we decline to follow Rowe"* is a `not-followed` edge
 * about Rowe is a person reading the sentence. So this prints rows, numbered, with the court's
 * VERBATIM sentence underneath and a blank verdict line, and stops.
 *
 * ── ⚠ TWO QUESTIONS, ASKED SEPARATELY, BECAUSE THEY FAIL DIFFERENTLY ─────────
 *
 * §3.3 requires two numbers reported apart:
 *   A. **Is the treatment right?** — given that this citation should be classified, is `overruled`
 *      the right label rather than `doubted`?
 *   B. **Should this citation have been classified at all?** — is there any treatment here, or is
 *      the court merely mentioning the case?
 *
 * ⚠⚠ **B IS WHERE THIS WILL FAIL, and the precedent is exact.** The position work got direction
 * wrong on only 2 of 50 — and claimed a position far too often. A pattern citator has the same
 * shape: when it fires it is usually right about WHICH treatment, and the risk is that it fires at
 * all. A single blended accuracy figure would hide that completely, which is why the sheet asks
 * the two questions on separate lines.
 *
 * ── AND THE SET INCLUDES REFUSALS, WHICH IS NOT OPTIONAL ─────────────────────
 *
 * ⚠ A validation set drawn only from rows the extractor PRODUCED measures precision and is blind
 * to recall — it cannot show a treatment the patterns missed. 77.7% of phrases found are currently
 * refused for want of an identifiable subject, so `--refusals` draws from those too. Judging a
 * sample of refusals is how we learn whether the conservatism is honest or merely lossy.
 *
 *   npx tsx graph/build-g5-validation-set.ts --n 15 --out ../../docs/GRAPH_5_VALIDATION.md
 *   npx tsx graph/build-g5-validation-set.ts --refusals --n 10
 */
import fs from 'fs'
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { TREATMENT_TABLE } from './setup-caselaw-edge-tables'
import { flattenWithRefs, sentenceBounds, courtOf } from './extract-caselaw-treatment'
import { findTreatments } from './treatment-patterns'
import { extractCitations } from '../caseref/citations'

const N = (() => { const i = process.argv.indexOf('--n'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 15 })()
const OUT = (() => { const i = process.argv.indexOf('--out'); return i >= 0 ? process.argv[i + 1] : null })()
const REFUSALS = process.argv.includes('--refusals')

;(async () => {
  const p = namesPool()
  const lines: string[] = []
  const say = (s = '') => { lines.push(s); console.log(s) }

  say(`# GRAPH 5 §3.3 — TREATMENT VALIDATION SET`)
  say()
  say(`Generated ${new Date().toISOString().slice(0, 16)}Z. **Nothing here is scored.**`)
  say()
  // ⚠ The rubric travels WITH the sheet. A scorer working from memory of a conversation is a
  //   scorer whose criteria drift between row 1 and row 15, and the two numbers then mean nothing.
  say(`## What a treatment IS`)
  say()
  say(`A **citation** is the later judgment mentioning the earlier authority. A **treatment** is the`)
  say(`later court *doing something to it* — expressing a view that affects whether, or how far, it`)
  say(`can still be relied on. **The test is whether the court ACTED on the authority or merely`)
  say(`referred to it**, and most citations are the latter.`)
  say()
  say(`| | what the court did |`)
  say(`|---|---|`)
  say(`| **overruled** | held it was wrongly decided, with the power to do so — it ceases to be good law |`)
  say(`| **disapproved** | said it was wrong, short of formally overruling (often because obiter) |`)
  say(`| **per-incuriam** | decided in ignorance of a binding statute or authority, so not binding |`)
  say(`| **doubted** | expressed reservation about its correctness, without refusing it |`)
  say(`| **not-followed** | declined to apply it — usually not bound. The case still stands |`)
  say(`| **distinguished** | accepted it is good law, but its reasoning does not reach these facts |`)
  say(`| **followed** | treated it as correct and adopted it |`)
  say(`| **applied** | used its principle or test to decide these facts |`)
  say(`| **read-down** | *a PROVISION, not a case* — gave statutory words a narrower or Convention-compatible meaning (usually s.3 HRA) |`)
  say()
  say(`---`)
  say()
  say(`## How to score — B first, then A only if B is yes`)
  say()
  say(`### B — is there a treatment here at all?`)
  say()
  say(`> **Read the row as a sentence: "In [court], on [date], the court [treatment] [subject]."**`)
  say(`> **Is that sentence true?**`)
  say()
  say(`If it would leave a reader believing something that did not happen, **\`B: no\`** — even when a`)
  say(`treatment word genuinely appears in the text. The seven ways it goes wrong, with the tag to`)
  say(`write beside the verdict so the failures can be counted by cause:`)
  say()
  say(`| tag | what went wrong | example |`)
  say(`|---|---|---|`)
  say(`| \`sense\` | right word, wrong meaning | *"objections are overruled"*, *"persons are distinguishable"* |`)
  say(`| \`hypothetical\` | conditional; nothing was done | *"even if another court could decline to follow"* |`)
  say(`| \`counsel\` | a party argued it, the court did not do it | *"Mr X submits it should not be followed"* |`)
  say(`| \`quoted\` | the treatment belongs to a court being quoted, so our court/date are wrong | |`)
  say(`| \`reported\` | the court reports a PAST treatment by someone else | *"these were overruled in Re Ashton"* |`)
  say(`| \`subject\` | treatment real, attached to the wrong case or provision | |`)
  say(`| \`mention\` | the court discusses it without doing anything to it | the honest majority |`)
  say()
  say(`### A — is it the right one of the nine?`)
  say()
  say(`Only if \`B: yes\`. **If B is no, leave A blank** — A is conditional on B.`)
  say()
  say(`- **Generously** on \`followed\` vs \`applied\` — near-synonymous in English practice.`)
  say(`- **Strictly on polarity** — \`followed\` vs \`not-followed\` is the error that matters most.`)
  say(`- **Strictly on strength** — \`doubted\` < \`disapproved\` < \`overruled\` are three different facts,`)
  say(`  and overstating is the dangerous direction.`)
  say(`- **Strictly on kind** — \`distinguished\` (good law, different facts) is not \`not-followed\``)
  say(`  (declined to use it).`)
  say()
  say(`### What gets reported`)
  say()
  say(`Three numbers, as \`ARGUMENT_1A\` reported them: the **B-rate**, the **A-rate given B**, and the`)
  say(`product. ⚠ The B-rate is the one this sprint expects to be low, and it decides whether the`)
  say(`treatment layer reaches a user surface at all (report §5, Q2).`)
  say()
  say(`**Verdict line format:** \`B: no (sense)\` · or \`B: yes\` then \`A: yes\` / \`A: no — should be doubted\``)
  say()
  say(`---`)
  say()

  if (!REFUSALS) {
    /**
     * ⚠⚠ STRATIFIED BY TREATMENT, NOT PROPORTIONAL — and this was a real defect in the first
     * version. A flat `ORDER BY md5(...) LIMIT 15` drew 6 APPLIED, 5 DISTINGUISHED, 2 NOT-FOLLOWED
     * and 2 READ-DOWN: **`overruled` did not appear at all**, nor `doubted`, `disapproved` or
     * `per-incuriam`. Those are the rarest treatments AND the most consequential — overruling is
     * the one §0 is really about — so a proportional sample under-tests precisely the rows where
     * being wrong costs the most. §3.3 asks by name for "a case overruled by a named later case,
     * one distinguished, one applied".
     *
     * ⚠ Within each stratum the draw is still `md5`, never by rank: the top-scoring rows are the
     * ones most likely to be right, and a set drawn from them measures the sampler.
     *
     * ⚠ The stratification is over the LABEL, which is the extractor's own claim — so this
     * measures precision per treatment and remains blind to recall. That is what `--refusals` is
     * for, and it is why the report states the two separately.
     */
    const { rows } = await p.query(
      `SELECT * FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY treatment ORDER BY md5(id::text || 'g5val')) rn
           FROM ${TREATMENT_TABLE}
       ) t ORDER BY rn, md5(id::text || 'g5val') LIMIT $1`, [N])
    if (rows.length === 0) { say(`⚠⚠ **${TREATMENT_TABLE} IS EMPTY.** Nothing to validate — run the extractor first.`) }
    rows.forEach((r: Record<string, unknown>, i: number) => {
      say(`### ${i + 1}. ${String(r.treatment).toUpperCase()} — ${r.subject_type === 'case' ? 'case' : 'provision'}: \`${r.subject_citation ?? r.subject_uri}\``)
      say()
      say(`**Said by** ${r.court ?? '⚠ court not derivable from the citation'}, in \`${r.judgment_id}\`` +
        `${r.paragraph_num ? ` at paragraph ${r.paragraph_num}` : ' (⚠ the document carries no paragraph number here)'}` +
        // ⚠ `date` comes back from pg as a JS Date, so `String(d).slice(0,10)` yields "Thu Nov 29"
        //   — a date with NO YEAR. §3.2 requires the date attached because a 1975 first-instance
        //   aside and a 2024 Supreme Court statement are not the same fact; a year-less date
        //   defeats the entire reason the column is there, and it looked plausible on the page.
        `${r.judgment_date ? `, ${new Date(r.judgment_date as string).toISOString().slice(0, 10)}` : ', ⚠ undated'}`)
      say()
      say(`**Phrase matched:** \`${r.matched_phrase}\`  · pattern \`${r.pattern_id}\``)
      say()
      say(`> ${String(r.sentence).trim()}`)
      say()
      say(`**Verdict —** \`B: \`   \`A: \``)
      say()
      say(`---`)
      say()
    })
  } else {
    // Re-run the detector over a sample and surface the phrases that produced NO edge.
    const docs = (await p.query(
      `SELECT id, "r2RawKey" FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL
        ORDER BY md5(id || 'g5refuse') LIMIT 400`)).rows
    say(`## REFUSALS — treatment phrases that produced no edge`)
    say()
    say(`⚠ These are the ${'`'}no subject on the declared side${'`'} and ${'`'}more than one candidate${'`'} cases.`)
    say(`**Verdict question here is different:** was refusing right? \`R: yes/no\``)
    say()
    let shown = 0
    for (const d of docs) {
      if (shown >= N) break
      const xml = await r2Get(d.r2RawKey)
      if (!xml) continue
      const { text, refs } = flattenWithRefs(xml)
      const cites = extractCitations(text)
      for (const hit of findTreatments(text)) {
        if (shown >= N) break
        const { from, to } = sentenceBounds(text, hit.index)
        const after = hit.direction === 'after'
        const cc = cites.filter(c => c.index >= from && c.index < to && (after ? c.index >= hit.index + hit.length : c.index + c.raw.length <= hit.index))
        const pc = refs.filter(r => r.start >= from && r.start < to && (after ? r.start >= hit.index + hit.length : r.end <= hit.index))
        if (cc.length + pc.length === 1) continue   // this one became an edge
        shown++
        const why = cc.length + pc.length === 0 ? 'NO subject on the declared side' : `${cc.length + pc.length} candidate subjects — ambiguous`
        say(`### R${shown}. would have been \`${hit.treatment}\` — REFUSED: ${why}`)
        say()
        say(`**In** \`${d.id}\` (${courtOf(d.id) ?? 'court not derivable'}) · phrase \`${hit.phrase}\` · direction \`${hit.direction}\``)
        say()
        say(`> ${text.slice(from, to).replace(/\s+/g, ' ').trim()}`)
        say()
        say(`**Verdict —** \`R: \``)
        say()
        say(`---`)
        say()
      }
    }
  }

  if (OUT) { fs.writeFileSync(OUT, lines.join('\n')); console.log(`\n  → ${OUT}`) }
  await endNamesPool()
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
