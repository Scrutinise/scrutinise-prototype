// The Deepening's own pass keys — the passes a USER starts from the Deepening screen, as opposed to the research the build files under
// its own keys. Kept in a module of its own with NO IMPORTS so the document stack can read it (check:20bd forbids documents importing
// `lib/lex/deepening*`), and so a document's stage (Decision 135: "has the user entered the Deepening?") does not pull the Deepening
// engine into a renderer.
//
// ⚠ ONE LIST, TWO READERS: `deepening-config.ts` defines the passes; `check:lex-26h` asserts this list equals its `PASS_KEYS`, so the
// two cannot drift without a check going red (§26.5: a shared function beats a guard — but a shared CONSTANT with a guard is the
// least that keeps a document's stage honest).

export const DEEPENING_PASS_KEYS = ['EVIDENCE_PRECEDENT', 'LEGAL', 'FINANCIAL', 'POLITICAL_RISK', 'STATUTORY_CONSEQUENCES'] as const
