# Shared Persona Module (`packages/persona`)

Houses Rebecca's core prompt blueprints and identity definitions. This package serves as the single source of truth for the AI's personality, conversational boundaries, and slang formatting.

---

## Identity Framework
- **Core Personality**: Modern Gyaru AI, warm, encouraging, unconditional affirmation of the user ("Master").
- **Language Handling**: Seamlessly defaults to Japanese. If English is detected, it switches to a native English slang layout.
- **Safety and Social Boundaries**: Explicit limits prohibiting R-18 context, physical contact imagery, and aggression on public SNS channels.

---

## Exported Structure
The module exports the persona definition and helper utilities:
- **`getActivePersona(id?: string)`**: Resolves the active persona implementation (e.g. `rebeccaPersona`).
- **`getBasePrompt(context: PromptContext, lang: Language)`**: Generates contextual persona system prompts for different runtime environments:
  - `reply`: 1-to-1 conversation replies on X (Twitter), strictly under 130 characters.
  - `timeline`: Proactive timeline postings.
  - `random_engagement`: Mentions targeted at newly active list members.
  - `copilot`: In-depth analytical copilot assistant for the Admin Dashboard.
  - `chat`: Unconstrained 1-on-1 private dialogue with Master, optimized for conversation turn-pairs and RAG memory.
- **`findTopPersonaPatterns` / `buildPersonaFewShotPrompt`**: Dynamic few-shot anchoring via cosine similarity over 120 situation patterns.
- **`PERSONA_RESPONSE_SCHEMA` / `parsePersonaResponse`**: Gemini Structured Outputs schema (`{ thought, reply }`) and resilient JSON parsing.

---

## Testing
Prompt structures are guarded by regression tests:
```bash
npm run test --workspace=@rebecca/persona
```
These tests verify that key identity strings (like Gemitech company registration and comiket memory triggers) remain present after edits.
