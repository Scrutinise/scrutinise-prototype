export interface LexMessage {
  role: 'lex' | 'user'
  content: string
  fieldUpdate?: {
    field: string
    value: string
    status: 'draft' | 'complete'
  }
  fallacyFlag?: boolean
}

export const LEX_JOURNEY_1_SCRIPT: LexMessage[] = [
  {
    role: 'lex',
    content: `I'm Lex, your researcher and guide. What's the challenge you want to fix?`
  },
  {
    role: 'user',
    content: 'People are living in cold, inefficient homes and paying huge energy bills because landlords and sellers have no incentive to improve them.'
  },
  {
    role: 'lex',
    content: `That's a clear starting point. "No incentive" is doing a lot of work in that sentence — let's be precise about it.

Is the problem that sellers and landlords genuinely don't know their properties are inefficient, or that they know and have calculated it's cheaper not to act?`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'Residential properties remain energy inefficient because sellers and landlords face no legal or financial incentive to improve them, resulting in high bills and poor living conditions for occupants.',
      status: 'draft'
    }
  },
  {
    role: 'user',
    content: "They know. An EPC survey is required when selling — they can see the rating. They just don't act because improving it costs money they'd rather not spend."
  },
  {
    role: 'lex',
    content: `Good — so this is an incentive problem, not an information problem. That matters for the solution design.

You've mentioned EPC ratings. The current system requires disclosure but not improvement. Your proposal is to change that — to make a minimum standard mandatory at point of sale.

I want to flag something before we go further. There's an argument embedded here that might need strengthening: you're assuming that a mandatory standard at point of sale will cause sellers to improve properties, rather than simply reducing the pool of sellable homes or pushing up prices for already-compliant properties. How would you address someone who makes that objection?`,
    fallacyFlag: true
  },
  {
    role: 'user',
    content: "That's fair. I'd say the grant scheme addresses the financial barrier, and the 2027 deadline gives time to prepare. Properties won't disappear from the market — they'll be improved."
  },
  {
    role: 'lex',
    content: `That's a reasonable response — the grant scheme does work against the price-shock objection, and a phased deadline is standard legislative practice.

Let me note that down and we'll move to the evidence base. What existing evidence supports the idea that mandatory standards at point of sale actually drive improvement — has this been tried anywhere?`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'Residential properties remain energy inefficient because sellers and landlords face no legal or financial incentive to improve them. EPC disclosure is required but improvement is not. A mandatory minimum standard at point of sale would create a direct incentive to upgrade, supported by a grant scheme to avoid market distortion.',
      status: 'complete'
    }
  },
  {
    role: 'user',
    content: 'The Netherlands has had minimum EPC requirements for social housing since 2020. Scotland has consulted on similar rules. The EU Energy Performance of Buildings Directive is pushing this direction across Europe.'
  },
  {
    role: 'lex',
    content: `Good — three relevant reference points. The Netherlands example is the strongest because it's implemented, not consulted on.

I'd want to know one more thing about the Dutch case: what happened to the market in the transition period? Did prices rise, did supply contract, or did it go smoothly? That evidence either strengthens or complicates your proposal.

For now, let me record the comparative evidence and we'll keep moving.`,
    fieldUpdate: {
      field: 'Evidence Base',
      value: 'Netherlands: mandatory EPC standards for social housing from 2020. Scotland: active consultation on similar measures. EU EPBD directive driving harmonisation. Further research needed on Dutch market impact during transition.',
      status: 'draft'
    }
  },
  {
    role: 'user',
    content: "I'll look into the Dutch transition data. What should we work on next?"
  },
  {
    role: 'lex',
    content: `The next thing I want to understand is your proposed solution in detail — not just "raise the minimum EPC standard" but the exact mechanism.

Specifically: who enforces it, what happens to a seller who can't or won't comply, and how does the grant scheme work — who qualifies, who administers it, and what's the funding source?

These aren't peripheral details. Parliamentary drafters will need all of this, and any gap here is an objection waiting to happen.`,
    fieldUpdate: {
      field: 'Evidence Base',
      value: 'Netherlands: mandatory EPC standards for social housing from 2020. Scotland: active consultation on similar measures. EU EPBD directive driving harmonisation. Dutch market impact during transition: TBC — further research required.',
      status: 'complete'
    }
  }
]

export const LEX_JOURNEY_4_SCRIPT: LexMessage[] = [
  {
    role: 'lex',
    content: `Welcome back. Last time we were working on your Evidence Base — we'd got as far as the Netherlands comparison. Shall we continue from there, or is there something you want to revisit first?`
  },
  {
    role: 'user',
    content: 'I want to revisit the Problem Statement — I think I can make it sharper.'
  },
  {
    role: 'lex',
    content: `Good instinct — the problem statement is the foundation everything else rests on. Open the summary panel and click the Problem Statement field. You'll see what we have so far. What specifically do you want to change?`
  },
  {
    role: 'user',
    content: 'I want to emphasise that this is a market failure, not just a behaviour problem.'
  },
  {
    role: 'lex',
    content: `That's a sharper framing and it's more defensible. "Market failure" is a recognised economic concept — it signals that this isn't about blaming individuals but about a structural gap that policy legitimately corrects.

Let me update the Problem Statement to reflect that.`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'The residential property market fails to price in energy efficiency because the costs of inefficiency fall on occupants, not sellers. This classic market failure — where the party making the decision does not bear the consequences — justifies regulatory intervention at point of sale.',
      status: 'complete'
    }
  }
]
