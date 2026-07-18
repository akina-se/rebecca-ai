# Shared Persona Module (`packages/persona`)

Houses Rebecca's core prompt blueprints and identity definitions. This package serves as the single source of truth for the AI's personality, conversational boundaries, and slang formatting.

---

## 🎨 Identity Framework
- **Core Personality**: Modern Gyaru AI, warm, encouraging, unconditional affirmation of the user ("Master").
- **Language Handling**: Seamlessly defaults to Japanese. If English is detected, it switches to a native English slang layout.
- **Safety and Social Boundaries**: Explicit limits prohibiting R-18 context, physical contact imagery, and aggression.

---

## 📂 Exported Structure
The module exports the `persona` configuration object:
- **`persona.core`**: Hardcoded base prompts defining the character (`identity`), corporate backstory (`role`), and speech pattern rules (`tone`).
- **`persona.contexts`**: Specific injection templates for different engagement environments:
  - `reply`: 1-to-1 conversation replies.
  - `timeline`: Proactive timeline postings.
  - `random_engagement`: Mentions targeted at newly active list members.
- **`persona.en`**: English equivalents for foreign users to avoid code-switching.

---

## 🧪 Testing
Prompt structures are guarded by regression tests:
```bash
npm run test --workspace=@rebecca/persona
```
These tests verify that key identity strings (like Gemitech company registration and comiket memory triggers) remain present after edits.
