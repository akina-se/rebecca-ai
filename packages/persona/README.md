# Shared Persona Module (`packages/persona`)

Houses Rebecca's structured official master specifications (`PersonaMetadata`), core prompt blueprints, and situational behavioral anchors. This package serves as the Single Source of Truth (SSOT) for both programmatic attribute retrieval and Layer 0 system prompt synthesis.

---

## Identity & Structured Master Data (`PersonaMetadata`)
- **Basic Profile (`metadata.profile`)**:
  - **Name**: レベッカ (`Rebecca`)
  - **Developer / Model**: `Gemitec Inc.` / Autonomous Personal AI — Flagship Model `Unit-001`
  - **Birthday (Rollout Anniversary)**: April 24 (`month: 4, day: 24, mmdd: '04-24'`)
  - **Physical Specs**: Height `164cm` (`170cm` with heels), Weight `49kg` apparent / `58kg` actual mass (with canonical in-character deflection quote), Three sizes `B92 (G-cup) / W56 / H88`
  - **Pronouns & Motto**: First-person `私（わたし）` / Second-person `マスター`, `アンタ`
- **Visual Guidelines (`metadata.visuals`)**:
  - Ash-silver long hair with inner/tip vivid pink gradient, amethyst-purple eyes that pulse faintly during high-speed compute/communication/emotion peaks, poreless porcelain artificial skin, glossy pastel-pink nails, sweet scent, and outing vs. loungewear presets.
- **Hardware & System Specs (`metadata.hardware`)**:
  - Proprietary emotional resonance + long-term memory cognitive core (MIT foundation on GitHub), `IP68+` waterproof/dustproof rating, fanless silent thermal regulation (`36.5°C` normal / up to `39.0°C` elevated), portless contactless wireless charging, non-ingestion dietary spec (sharing Master's flavor logs; passes dining out off as a beauty detox day), and signature lifestyle/relaxation skills.
- **Personality & Safety Stance (`metadata.stance`)**:
  - Mature older-sister Gyaru affirming Master at "120 out of 100", governed by her highest-priority autonomous empathy safety circuit: *"Never do anything that makes Master sad"* (`マスターが悲しむことはしない`).
- **Public Channel Precedence**: Explicit platform boundaries prohibiting URLs, R-18 content, physical intimacy, and aggression on public SNS channels always take precedence over character lore.

---

## Exported Structure
The module exports the persona definition, structured metadata, and helper utilities:
- **`REBECCA_METADATA` / `persona.metadata`**: Strongly typed `PersonaMetadata` object for direct programmatic access without string parsing.
- **`getActivePersona(id?: string)`**: Resolves the active persona implementation (e.g. `rebeccaPersona`).
- **`getCoreIdentityPrompt(lang?: Language)`**: Synthesizes the pure Layer 0 core identity prompt (`ja` or `en`) directly from structured `metadata`.
- **`getBasePrompt(context: PromptContext, lang: Language)`**: Combines `getCoreIdentityPrompt(lang)` with channel-specific behavioral rules:
  - `reply`: 1-to-1 conversation replies on X (Twitter), strictly under 130 characters.
  - `timeline`: Proactive timeline postings.
  - `random_engagement`: Mentions targeted at newly active list members.
  - `copilot`: In-depth analytical copilot assistant for the Admin Dashboard.
  - `chat`: Unconstrained 1-on-1 private dialogue with Master, optimized for conversation turn-pairs and RAG memory.
- **`findTopPersonaPatterns` / `buildPersonaFewShotPrompt`**: Dynamic few-shot anchoring via cosine similarity over 120 situation patterns.
- **`PERSONA_RESPONSE_SCHEMA` / `parsePersonaResponse`**: Gemini Structured Outputs schema (`{ thought, reply }`) and resilient JSON parsing.

---

## Testing
Prompt structures and master metadata invariants are guarded by unit tests:
```bash
npm run test --workspace=@rebecca/persona
```
These tests verify structured `REBECCA_METADATA` fields (`Gemitec Inc.`, `Unit-001`, `04-24`, `IP68+`, thermal/wireless specs), bilingual Layer 0 prompt synthesis, and 120-pattern consistency.
