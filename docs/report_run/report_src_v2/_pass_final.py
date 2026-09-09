import re,os
FILES=['01_front.md','02_framework.md','02a_twelve.md','02_register.md','03_part2.md',
       '07_bingham.md','04_part3.md','08_part4.md','09_part5_rest.md','06_part6_7.md']
# --- source-confidence marks become words. Charlie is colour blind and the marks were
# --- not legible as a scale in print; words carry the same information unambiguously.
MARKS=[('✔','[verified]'),('●','[corroborated, unchecked]'),('○','[single mention, unchecked]')]
LEGEND=[
 ("**✔ verified — the citation has been checked and the document exists**","**[verified] — the citation has been checked and the document exists**"),
 ("● named independently by two or more research passes, not yet checked",
  "[corroborated, unchecked] — named independently by more than one research pass, not yet checked against the source"),
 ("○ named once only, not yet checked — treat as a lead, not a citation",
  "[single mention, unchecked] — named once only; a lead, not a citation"),
]
for fn in FILES:
    t=open(fn,encoding='utf-8').read()
    for a,b in LEGEND: t=t.replace(a,b)
    for a,b in MARKS: t=t.replace(' '+a,' '+b).replace(a,b)
    open(fn,'w',encoding='utf-8').write(t)

# --- Part 7 becomes the single closing "Limitations of this analysis" section.
t=open('06_part6_7.md',encoding='utf-8').read()
i=t.find('# Part 7 · How this was made')
part6=t[:i].rstrip()+'\n'
limits = """# Part 7 · Limitations of this analysis

## 7 · Limitations of this analysis

Every limit on what this document can support is collected here, so that no claim elsewhere in it has to be qualified in place.

---

### How the analysis was produced

**Twelve separate runs, one per measure**, each searching the statute book, the parliamentary record, committee reports and court judgments, and each drafting a diagnosis and a plan from what it found. **No run was told what any other run found.**

Across the twelve: **1,100 pieces of evidence, 937 of them with a full citation and a working link, and 497 open challenges raised against the drafts.**

Alongside that, a separate search of the whole statute book for every provision that points at the Acts in question — which is where the counts in Part 4 come from.

**The rule everything is built on: every legal assertion has to resolve to an actual document. Where it cannot, that is said rather than filled.**

---

### What the record does not cover

**The record of court judgments used here begins in 2003**, because the free public record does not exist earlier. The National Archives has confirmed that the pre-2001 paper record will not be digitised, and the main free database does not permit bulk access.

**No citator was available for this pass.** A citator is the tool a lawyer uses to check whether a judgment has since been doubted, distinguished, followed or overruled. It cannot therefore be confirmed that no judgment cited here has since been treated adversely. That check takes a subscribing lawyer about ten minutes, and should be done before this argument is relied on.

**The record of Bills before Parliament stops at a point** — 6,574 records to 3 August 2026 — and the two Bills this report turns on are above it. They were found by hand.

---

### What the counts do and do not mean

**No count in this document is presented as complete.** Every figure is a count of what the index holds. Where a number is given for provisions, judgments or instruments, it means that many were retrieved and read, not that many exist.

**The three strengths of evidence are recorded separately and are never added together.** A provision named by identity, a provision named in text, and a provision reached through an enabling power are three different measurements, and a single total across them would be meaningless.

⚠ **Six of the twelve runs stopped at a spending limit** and asked six research questions rather than seven. Some of what those runs record as gaps are questions never asked rather than questions asked and unanswered, and the output does not distinguish the two.

**No cross-measure search was run.** Every run was asked about its own measure. Part 3's finding that the measures are separable is therefore evidence rather than proof: nothing was hunting for the links it did not find.

---

### The depth of this pass

**Three measures are worked in full** — the Human Rights Act, the Equality Act and the civil service — **and eight are summarised** in Part 5, with the Great Repeal itself tested in Part 3.

**This is a first pass.** Carrying the programme through would need planning, strategy and resourcing well beyond anything set out here.

---

### What would be done next

1. **Check the register with David.** Nothing downstream is safe until the twelve entries are confirmed.
2. **A cross-measure search**, to test Part 3's separability finding directly rather than by inference.
3. **The remaining measures worked to the depth of Part 4.**
4. **A citator check** on every judgment cited.
5. **Bills before Parliament brought up to date** and linked to the Acts they would amend, so that the question answered by hand here — has somebody already put this in a Bill? — can be answered directly.

---

*Scrutinise takes a proposal and works out what delivering it would actually require. It is free and non-partisan, and is available on identical terms to anyone.*
"""
open('06_part6.md','w',encoding='utf-8').write(part6)
open('13_part7_limitations.md','w',encoding='utf-8').write(limits)
os.remove('06_part6_7.md')
print("done")
