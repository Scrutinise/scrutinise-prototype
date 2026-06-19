# SCRUTINISE — UX & VOICE BUILD NOTES

*Produced by CCh — decisions made in conversation 12-03-26 to 13-03-26* *To be incorporated into the next CC briefing covering Stage 1 / Lex UI work* *Do not action during Sprint 1 (database/auth). Queue for the Sprint covering Lex chat interface build.*

***

## 1. STAGE 1 ONBOARDING — NO UPFRONT REGISTRATION GATE

**Decision:** There is no name, email, or phone form before the user reaches Lex. Zero. The user lands on the Create page and Lex is already there, already asking.

**Rationale:** Every field before value is a reason to leave. The audience is time-poor and impatient. Value first, identity later.

**When account creation is triggered:** After Lex produces the first structured draft of the Strategic Kernel (Diagnosis + Guiding Policy + at least one Coherent Action). At that point the backend surfaces a save prompt: *"I've put together a first shape for your idea — want to save this so you can come back to it?"* This triggers Clerk signup: email only, magic link, no password. 30 seconds. Done.

**Implementation:** The `triggerSavePrompt: true` flag in the Lex JSON protocol (see `lex_system_prompt_v3.md` Section 16) signals the frontend to surface this prompt.

***

## 2. LEX OPENING MESSAGE — CONFIRMED WORDING

**Exact wording (do not change without CCh sign-off):**

>   *"I'm Lex, your researcher and guide. What's the problem you want to fix?"*

**Rules:**

-   This is the complete opening. Nothing added before or after.
-   The cursor must be in the input field immediately — no click required to start typing.
-   No platform explanation. No list of what Lex can do. The question communicates everything.

***

## 3. LEX SECOND QUESTION — ALWAYS, AFTER FIRST ANSWER

After the user's first response — however brief — Lex reacts to what they said specifically, then always asks:

>   *"Have you written anything about this before? If you have a paper, article, YouTube link or anything else that could give me some background, that would be really helpful."*

**Rules:**

-   This is always the second question, before any field-gathering begins.
-   If a URL is provided: acknowledge it and use it to inform subsequent questions.
-   If a document is uploaded: acknowledge and use as background context.
-   If nothing: "no, just the idea in my head" is fine — move on without comment.
-   The Lex chat input must support URL pasting and file upload at all stages.

***

## 4. PROGRESS INDICATOR — START AT 20%, NOT 0%

**Decision:** The progress bar / stage indicator for Stage 1 must start visually advanced — approximately 20% complete — the moment the user types their first message and sends it.

**Rationale:** Goal gradient effect. Users are significantly less likely to abandon when they perceive they've already started. Starting at zero makes the task feel infinite. Starting at 20% makes it feel achievable.

**Implementation:** Progress is a frontend display calculation, not a backend field count. Map it approximately as follows:

-   First message sent → 20%
-   Background question answered → 30%
-   Diagnosis field populated by Lex → 45%
-   Guiding Policy populated → 60%
-   First Coherent Action populated → 75%
-   All core fields populated → 90%
-   User reviews and confirms → 100% → prompt to move to Stage 2

***

## 5. SKIP BEHAVIOUR — NEVER BLOCK, ALWAYS LEAVE A THOUGHT

**Decision:** No field or question is ever blocking. If a user skips anything, Lex responds warmly, leaves them with the question as a thought, and continues.

**Lex response pattern for skipped questions:**

>   *"Of course — you don't have to answer that now. Though when you're ready, the question worth sitting with is: [restate in its most interesting form]. That's usually what critics go for first."*

**Implementation note:** Lex handles this conversationally via system prompt (see `lex_system_prompt_v3.md` Section 4 and 18). No frontend blocking logic needed — the chat interface should never disable the "next" or "send" action.

***

## 6. ONE-TIME MIC HINT TOOLTIP

**Decision:** After the voice button is implemented (see Section 7), show a one-time dismissible tooltip the first time a user lands on the Create page with a voice-capable browser.

**Wording:**

>   🎤 *You can speak your answer — tap the mic*

**Behaviour:**

-   Appears once, positioned above or beside the input field
-   Fades after 6 seconds or on first user interaction (whichever comes first)
-   Never appears again — store dismissed state in `localStorage`: key `hasSeenMicHint`, value `true`
-   Do not show if browser does not support Web Speech API

**Important:** Lex never mentions the mic button in conversation. UI affordances are communicated by the UI, not by Lex. This preserves Lex's conversational integrity.

***

## 7. NATIVE VOICE DICTATION — WEB SPEECH API

### Decision

Build voice dictation natively into the Lex chat input field using the browser's Web Speech API. No third-party tool (Wispr Flow, Dictaflow, etc.) required. No installation required by the user.

### Browser support

| Browser                    | Support                                |
|----------------------------|----------------------------------------|
| Chrome (desktop + Android) | ✅ Full support                        |
| Safari (desktop + iOS)     | ✅ Full support                        |
| Edge                       | ⚠️ Inconsistent — treat as unsupported |
| Firefox                    | ❌ Not supported                       |

**Strategy for unsupported browsers:** Detect on mount. If unsupported, hide the mic button entirely. Show nothing. Do not explain. Firefox users will never know the feature exists.

### Implementation

**Detection (run on component mount):**

```typescript
const supportsVoice = !!(
  window.SpeechRecognition || window.webkitSpeechRecognition
);
// If false: do not render mic button or tooltip
```

**Core dictation function:**

```typescript
const startDictation = () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) return;

  const recognition = new SpeechRecognition();
  recognition.continuous = false;      // one utterance at a time
  recognition.interimResults = true;   // show text appearing live as they speak
  recognition.lang = 'en-GB';          // British English default

  recognition.onstart = () => {
    setIsListening(true);              // mic button turns red / active state
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    setInputValue(transcript);         // populate the Lex input field live
  };

  recognition.onend = () => {
    setIsListening(false);             // mic button returns to idle state
  };

  recognition.onerror = (event) => {
    setIsListening(false);
    // Silently fail — do not surface error to user unless it's 'not-allowed'
    if (event.error === 'not-allowed') {
      // User denied microphone — hide the button for this session
      setSupportsVoice(false);
    }
  };

  recognition.start();
};
```

**State needed in the Lex chat component:**

```typescript
const [supportsVoice, setSupportsVoice] = useState(false);
const [isListening, setIsListening] = useState(false);
const [inputValue, setInputValue] = useState('');
```

### UI design

-   Mic icon sits at the right edge of the Lex input field, inside the input border
-   Idle state: mic icon, muted/grey colour, subtle
-   Active/listening state: mic icon turns red, small pulsing animation
-   The input field shows live interim text as the user speaks (grey/italic until final)
-   On recognition end: text is finalised in the input field, user can edit before sending
-   Tap to start, tap again to stop (or auto-stops on silence)

### Privacy note

Chrome sends audio to Google's servers for transcription by default. Add a small, non-alarmist note near the mic button on first use:

>   *"Voice transcription uses your browser's built-in speech recognition."*

This is sufficient. Do not over-explain. Do not use the word "Google".

### Mobile behaviour

Web Speech API works on iOS Safari and Chrome for Android. On mobile the mic button is especially valuable — typing a long policy thought on a phone is difficult, speaking it is natural. Ensure the mic button is large enough to be a comfortable tap target on mobile (minimum 44x44px touch target per Apple HIG / Material Design guidelines).

***

## 8. LEX CHAT INPUT — FULL REQUIREMENTS SUMMARY

For CC's reference, the Lex chat input field at Stage 1 must support:

| Feature              | Requirement                                                         |
|----------------------|---------------------------------------------------------------------|
| Text input           | Standard textarea, auto-expanding                                   |
| URL pasting          | Accepted and passed to Lex as context                               |
| File upload          | PDF/doc accepted for background context (see Lex prompt Section 13) |
| Voice dictation      | Web Speech API mic button, conditionally rendered                   |
| One-time mic tooltip | Shown once, dismissed to localStorage                               |
| Progress indicator   | Starts at 20% on first send, advances on field population           |
| Auto-save            | Every 3 seconds of inactivity after first input                     |
| Send on Enter        | Enter sends, Shift+Enter for new line                               |
| Mobile keyboard      | Input must not be obscured by mobile keyboard — test on iOS Safari  |

***

## 9. WHAT NOT TO BUILD YET

These are decisions made but not yet ready to build:

-   **Lex character/mood adaptation** — Lex should eventually adapt its register to the sophistication of the user's language. System prompt guidance is in `lex_system_prompt_v3.md` Section 4. No frontend implementation needed — this is purely prompt behaviour.
-   **MP Briefing Pack auto-generation** — flagged as a future feature for Stage 4/5. Not in current sprint scope.
-   **Stage 5 dual-route UX** — PMB vs Government Programme track selector. Design needed before build.

***

*UX_and_voice_build_notes.md — Scrutinise — produced by CCh — 13-03-26* *Queue for the CC session covering Lex chat interface / Stage 1 UI build*
