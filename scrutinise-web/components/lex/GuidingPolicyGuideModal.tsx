'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-L §8 — "HOW TO WRITE A GUIDING POLICY."
//
// §8: a button at the top of the Guiding Policy section, in the same colour, font and popup
// style as "How this works" (components/lex/HowItWorksModal.tsx). Content, per the brief:
//   - what a guiding policy is, and what it is not;
//   - the test in §7c, as the centrepiece;
//   - that a guiding policy rules things out — and one ruling out nothing is not yet a policy;
//   - the difference between one approach with several parts and a list of approaches;
//   - why it matters: it is what makes the coherent actions coherent.
//
// ⚠ PARAPHRASE AND CITE; DO NOT REPRODUCE PASSAGES FROM THE BOOK. Everything below is written
// in this product's own words, crediting Rumelt by name and title rather than quoting him.
// ─────────────────────────────────────────────────────────────────────────────

export default function GuidingPolicyGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to write a Guiding Policy"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900 flex-1">How to write a Guiding Policy</h2>
          <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-zinc-700 text-lg leading-none px-1">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">What a guiding policy is</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              A guiding policy is your overall approach to the obstacle in your diagnosis — the
              direction you have chosen, not the detail of how you will get there. It is a
              signpost, not a route map.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">What it is not</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              It is not the goal restated in different words ("improve accountability" is what
              you want, not how you will get it), and it is not a coherent action — the specific,
              concrete thing you would <span className="italic">do</span>. A step you would carry
              out belongs under Coherent Actions, once you have a policy for it to carry out.
            </p>
          </div>

          {/* ⚠⚠ §7c/§8 — THE TEST, AS THE CENTREPIECE. This is the sort's own prompt, and the
              guide and the sort must say the same thing. */}
          <div className="rounded-xl border-2 border-zinc-900 bg-zinc-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
              The test
            </p>
            <p className="text-sm text-zinc-900 leading-relaxed">
              If it is a single action, it is a coherent action. If it is a principle you can test
              an action against, to know whether the action fits, it is a guiding policy.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">It has to rule something out</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              A guiding policy closes doors as well as opening them. One that would let you do
              almost anything and still call it consistent with the policy is not yet a policy —
              it is a good intention. If you cannot say what it rules out, that is the sign it
              needs more work, not a sign it is broad-minded.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">One approach with parts, or a list of approaches?</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              A single approach can have more than one property — "individually attributable and
              externally visible" is one design with two features, not two policies joined by
              "and". A list of approaches, by contrast, is genuinely several different directions
              competing for the same choice ("centralise oversight" versus "devolve it" versus
              "leave it be"). The difference is whether the parts could be pursued separately and
              still make sense on their own; if not, it is one approach.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">Why it matters</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              A guiding policy is what makes your coherent actions <span className="italic">coherent</span>.
              Without one, a list of actions is just a list — each one might be reasonable on its
              own, but nothing says they add up to a single, defensible strategy. The policy is
              the reason a reader can tell your actions were chosen together, on purpose.
            </p>
          </div>

          <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-100">
            These tests follow Richard Rumelt&rsquo;s <span className="italic">Good Strategy Bad
            Strategy</span>, in this product&rsquo;s own words rather than his.
          </p>
        </div>

        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-200 bg-zinc-50">
          <button onClick={onClose} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
