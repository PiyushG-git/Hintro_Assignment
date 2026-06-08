# AI Approach

This document describes the AI integration strategy, prompt design, citation mechanism, and hallucination prevention approach used in the Hintro Meeting Intelligence Service.

---

## 1. LLM Provider

**Mistral AI** (`mistral-medium-latest`) via the Mistral REST API.

```js
const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` },
  body: JSON.stringify({
    model: process.env.MISTRAL_MODEL || 'mistral-medium-latest',
    temperature: 0.1,             // Low temperature = factual, consistent
    response_format: { type: 'json_object' }, // Forces structured JSON output
    messages: [ systemMessage, userMessage ],
  }),
});
```

---

## 2. Prompt Design

The prompt uses a **two-part structure**:

### System Prompt (Instruction Layer)
Defines strict constraints that the model MUST follow:

1. **Never hallucinate** — only use information explicitly in the transcript
2. **Timestamp validation** — every citation MUST use one of the valid timestamps listed
3. **Speaker validation** — assignees MUST be one of the transcript speakers
4. **Omit rather than guess** — if unclear, leave it out
5. **JSON schema** — exact structure to output

The valid timestamps and speakers are injected directly into the system prompt:
```
EVERY item you generate MUST include at least one citation with a timestamp
that EXACTLY matches one of these valid timestamps: [00:10, 00:20]
Assignees MUST be one of these speakers: [John, Alice]
```

### User Prompt (Data Layer)
Contains the actual meeting data:
- Meeting title and date
- Participants
- Full transcript formatted as `[timestamp] Speaker: text`

---

## 3. Citation Strategy

Citations work at two levels:

### Level 1: Prompt-level Grounding
The model is explicitly told to include `citations: [{ timestamp }]` for every generated insight. The valid timestamps are listed in the prompt so the model can reference them directly.

### Level 2: Post-generation Validation (Code-level)
After the model responds, every citation is validated in code:

```js
const validateCitations = (citations, validTimestamps) => {
  return citations.filter((c) => validTimestamps.has(c.timestamp));
};
```

If a model-generated timestamp doesn't exist in the original transcript, it is **silently removed** with a warning log. This is the safety net if the model ignores the instructions.

---

## 4. Hallucination Prevention

### 4.1 Invalid Citation Stripping
Any citation with a timestamp not present in the transcript is removed post-generation.

**Example:**
- Transcript timestamps: `[00:10, 00:20]`
- Model generates: `citations: [{ timestamp: "00:10" }, { timestamp: "99:99" }]`
- Result: `citations: [{ timestamp: "00:10" }]` ← `99:99` removed

### 4.2 Speaker Validation for Assignees
Action item assignees are validated against the list of transcript speakers:

```js
const validateAssignee = (assignee, validSpeakers) => {
  const found = validSpeakers.find(s => s.toLowerCase() === assignee.toLowerCase());
  return found || null;
};
```

If the model assigns a task to "Charlie" who never spoke in the transcript, the assignee becomes `null`.

### 4.3 Low Temperature
`temperature: 0.1` minimizes creative variation and keeps the model close to the source material.

### 4.4 JSON Mode
Using `response_format: { type: 'json_object' }` forces the model to output valid JSON, eliminating prose interpolation that could smuggle unverifiable claims.

---

## 5. Output Validation Strategy

| Validation | Layer | What it checks |
|---|---|---|
| JSON parsability | Code (try/catch) | Response is valid JSON |
| Citation timestamps | Code | All cited timestamps exist in transcript |
| Assignee speakers | Code | All assignees are transcript speakers |
| Schema structure | Zod (implicitly) | Response has required fields |

---

## 6. Known Limitations

1. **Long transcripts** — Mistral has a large context window but very long meetings (>1 hour) may still need chunking (not implemented).
2. **Ambiguous speakers** — If a speaker changes their name between turns (typo, nickname), speaker validation may produce false negatives.
3. **Timestamp format** — The current implementation treats timestamps as opaque strings. If transcripts use different formats (e.g., `00:10` vs `0:10`), they won't match. Normalizing format on ingest would mitigate this.
4. **Implicit decisions** — If a decision is implied but not explicitly stated, the model may correctly omit it (desirable) or may miss a genuinely explicit decision.
5. **Model API quota** — Free Mistral tier has RPM limits. Under load, analysis requests may fail with 429; proper retry logic would be needed for production.
