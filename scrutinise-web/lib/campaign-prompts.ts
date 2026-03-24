/**
 * Campaign in a Box — prompt builders for four document types.
 * Each function takes a partial Idea object and the referral link,
 * and returns a complete prompt string for Gemini 2.5 Flash.
 */

interface IdeaForPrompt {
  title: string
  summaryDescription: string
  diagnosis: string | null
  rootCause: string | null
  guidingPolicy: string | null
  coherentActions: Array<{ title: string; summarySnippet: string | null }>
  research: Array<{ title: string; snippet: string; sourceType: string }>
  proposedWording: string | null
  govtArea: string
}

export function buildMpBriefingPrompt(idea: IdeaForPrompt, referralLink: string): string {
  const researchSummary = idea.research
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.title} — ${r.snippet} (${r.sourceType})`)
    .join('\n')

  const actions = idea.coherentActions
    .slice(0, 3)
    .map((a, i) => `${i + 1}. ${a.title}${a.summarySnippet ? `: ${a.summarySnippet}` : ''}`)
    .join('\n')

  return `You are drafting a one-page briefing for a Member of Parliament or their parliamentary researcher. This is not a campaign leaflet. It must read as parliamentary researcher quality: factual, concise, evidenced, and written in British English with no jargon and no exclamation marks.

Produce the briefing using exactly this structure:

SUBJECT: [One sentence summarising the policy ask]

WHAT THIS PROPOSES
[Two sentences describing what the idea proposes]

WHY IT MATTERS
[Three bullet points, each referencing specific evidence from the research below. Be precise — cite the source type where relevant.]

WHAT WE ARE ASKING YOU TO DO
[One concrete parliamentary action: a Private Member's Bill, a written question, a select committee referral, or an amendment to a current Bill. Be specific.]

FOR MORE INFORMATION
${referralLink}

Word limit: 400 words. British English only. No passive voice where active is available. No exclamation marks. No bullet points in the "What this proposes" section.

---

IDEA DETAILS:
Title: ${idea.title}
Government area: ${idea.govtArea}
Summary: ${idea.summaryDescription}
Challenge (diagnosis): ${idea.diagnosis ?? 'Not specified'}
Root cause: ${idea.rootCause ?? 'Not specified'}
Guiding policy: ${idea.guidingPolicy ?? 'Not specified'}

Proposed coherent actions:
${actions || 'None specified'}

Research evidence:
${researchSummary || 'No research items provided'}

${idea.proposedWording ? `Proposed legislative wording:\n${idea.proposedWording}` : ''}

Now produce the briefing.`
}

export function buildOnePagerPrompt(idea: IdeaForPrompt, referralLink: string): string {
  const researchSummary = idea.research
    .slice(0, 3)
    .map(r => `- ${r.title}: ${r.snippet}`)
    .join('\n')

  return `You are writing a public-facing one-pager for a policy idea. It will be shared with press, campaign supporters, and posted online. Tone: clear, confident, non-partisan. British English. No passive voice.

Produce the one-pager using exactly this structure:

HEADLINE
[Maximum 10 words. No question marks.]

THE CHALLENGE
[One paragraph, maximum 60 words. State the problem plainly.]

OUR SOLUTION
[One paragraph, maximum 60 words. State what the idea proposes.]

WHY NOW
[One paragraph, maximum 40 words. Reference any relevant research or case studies to show urgency.]

WHAT YOU CAN DO
• Vote on this idea at Scrutinise
• Share the link with your MP
• Follow for updates as this idea develops

LEARN MORE
${referralLink}

Published on Scrutinise — the platform helping citizens develop policy ideas into Parliament-ready legislation.

Word limit: 300 words total. No jargon. No exclamation marks. No passive voice.

---

IDEA DETAILS:
Title: ${idea.title}
Government area: ${idea.govtArea}
Summary: ${idea.summaryDescription}
Challenge: ${idea.diagnosis ?? 'Not specified'}
Root cause: ${idea.rootCause ?? 'Not specified'}
Solution: ${idea.guidingPolicy ?? 'Not specified'}

Research:
${researchSummary || 'No research items provided'}

Now produce the one-pager.`
}

export function buildPressReleasePrompt(idea: IdeaForPrompt, referralLink: string): string {
  const researchSummary = idea.research
    .slice(0, 4)
    .map(r => `- ${r.title}: ${r.snippet} (${r.sourceType})`)
    .join('\n')

  const keyFacts = idea.research
    .slice(0, 3)
    .map(r => `• ${r.title}: ${r.snippet}`)
    .join('\n')

  return `You are drafting a press release for campaign organisers to adapt and distribute. Use inverted pyramid structure. Active voice throughout. British English. Journalistic register.

Produce the press release using exactly this structure:

FOR IMMEDIATE RELEASE

[HEADLINE — active voice, maximum 12 words]

[SUBHEADLINE — one sentence]

[LEAD PARAGRAPH — who, what, where, when, why. All five elements must appear.]

[QUOTE — from "a spokesperson for the campaign". Begin: "A spokesperson said:" — the owner will personalise this before distributing. Keep it 2–3 sentences, quotable, non-jargonistic.]

[BACKGROUND — one paragraph covering policy context and key evidence from the research. Cite source types.]

ABOUT ${idea.title.toUpperCase()} ON SCRUTINISE
This idea was developed on Scrutinise, a not-for-profit platform enabling citizens to develop policy ideas into Parliament-ready legislation. Learn more: ${referralLink}

ENDS

NOTES TO EDITORS
${keyFacts}

[Add: "For further information, contact [NAME] at [EMAIL]."]

IMPORTANT INSTRUCTION TO THE OWNER: Personalise the spokesperson quote before distributing. Replace "[NAME]" and "[EMAIL]" in the notes section.

Word limit: 500 words. No passive voice. No exclamation marks.

---

IDEA DETAILS:
Title: ${idea.title}
Government area: ${idea.govtArea}
Summary: ${idea.summaryDescription}
Challenge: ${idea.diagnosis ?? 'Not specified'}
Root cause: ${idea.rootCause ?? 'Not specified'}
Proposed solution: ${idea.guidingPolicy ?? 'Not specified'}

Research evidence:
${researchSummary || 'No research items provided'}

Now produce the press release.`
}

export function buildSocialKitPrompt(idea: IdeaForPrompt, referralLink: string): string {
  const coreSummary = `${idea.summaryDescription} ${idea.diagnosis ? `The challenge: ${idea.diagnosis}` : ''} ${idea.guidingPolicy ? `The solution: ${idea.guidingPolicy}` : ''}`.trim()

  return `You are creating a social media kit for a policy campaign. Produce four clearly labelled items. Tone: accessible, shareable, factual — not polemical. British English. No aggressive language.

---

TWITTER/X THREAD (5 tweets)

Write 5 tweets numbered 1/5 to 5/5. Each tweet must be maximum 280 characters including the number prefix. The final tweet (5/5) must include this exact URL: ${referralLink}

[Write 5 tweets here]

---

LINKEDIN POST

150–200 words. Professional tone. End with: "${referralLink}" and 3–5 relevant hashtags (e.g. #UKPolicy #Parliament #[GovtArea]).

[Write LinkedIn post here]

---

INSTAGRAM CAPTION

80–100 words. Start with a strong hook (first line is the most important). Use emoji sparingly (maximum 3). End with 5 relevant hashtags on a new line.

[Write Instagram caption here]

---

WHATSAPP FORWARD MESSAGE

Maximum 60 words. Casual, friendly tone as if written by a person sharing something they care about. End with: ${referralLink}

[Write WhatsApp message here]

---

IDEA DETAILS:
Title: ${idea.title}
Government area: ${idea.govtArea}
Core summary: ${coreSummary}
Challenge: ${idea.diagnosis ?? 'Not specified'}
Solution: ${idea.guidingPolicy ?? 'Not specified'}

Now produce all four items.`
}
