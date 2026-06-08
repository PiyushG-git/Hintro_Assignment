const logger = require('../utils/logger');

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Validates that every citation timestamp actually exists in the transcript.
 * Returns a filtered array with invalid citations removed.
 */
const validateCitations = (citations, validTimestamps) => {
  if (!Array.isArray(citations)) return [];
  return citations.filter((c) => {
    const valid = validTimestamps.has(c.timestamp);
    if (!valid) {
      logger.warn(`AI generated an invalid citation timestamp: ${c.timestamp} — removed`);
    }
    return valid;
  });
};

/**
 * Validates that all assignees in action items are speakers from the transcript.
 */
const validateAssignee = (assignee, validSpeakers) => {
  if (!assignee) return null;
  // Case-insensitive match
  const found = validSpeakers.find(
    (s) => s.toLowerCase() === assignee.toLowerCase()
  );
  return found || null;
};

/**
 * Analyzes a meeting transcript using Mistral AI.
 * Returns grounded insights with citations tied to transcript timestamps.
 *
 * @param {object} meeting - Mongoose Meeting document
 * @returns {Promise<object>} analysis result
 */
const analyzeMeeting = async (meeting) => {
  // Build transcript string for the prompt
  const transcriptLines = meeting.transcript
    .map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
    .join('\n');

  const validTimestamps = new Set(meeting.transcript.map((t) => t.timestamp));
  const validSpeakers = [...new Set(meeting.transcript.map((t) => t.speaker))];

  const systemPrompt = `You are a precise meeting analysis assistant. Your ONLY job is to extract information that is EXPLICITLY stated in the transcript.

STRICT RULES:
1. NEVER invent, infer, or hallucinate information not directly in the transcript.
2. NEVER create action items, decisions, or summaries for things not mentioned.
3. NEVER assign tasks to people who do not appear as speakers in the transcript.
4. EVERY item you generate MUST include at least one citation with a timestamp that EXACTLY matches one of these valid timestamps: [${[...validTimestamps].join(', ')}]
5. Assignees for action items MUST be one of these speakers: [${validSpeakers.join(', ')}]
6. If something is unclear or not mentioned, omit it rather than guessing.
7. Return ONLY valid JSON — no markdown, no explanation, no code fences.

OUTPUT SCHEMA (strict JSON):
{
  "summary": [
    {
      "text": "string — factual summary of what was discussed",
      "citations": [{ "timestamp": "exact timestamp from transcript" }]
    }
  ],
  "actionItems": [
    {
      "task": "string — specific action to be taken",
      "assignee": "string — MUST be a speaker name from the transcript or null",
      "dueDate": "ISO 8601 date string or null if not mentioned",
      "citations": [{ "timestamp": "exact timestamp from transcript" }]
    }
  ],
  "decisions": [
    {
      "text": "string — a decision that was explicitly made",
      "citations": [{ "timestamp": "exact timestamp from transcript" }]
    }
  ],
  "followUpSuggestions": [
    {
      "text": "string — follow-up suggestion based ONLY on what was discussed",
      "citations": [{ "timestamp": "exact timestamp from transcript" }]
    }
  ]
}`;

  const userPrompt = `Meeting Title: ${meeting.title}
Meeting Date: ${meeting.meetingDate}
Participants: ${meeting.participants.join(', ')}

TRANSCRIPT:
${transcriptLines}

Analyze this transcript strictly following the rules above. Extract only what is explicitly present. Return ONLY the raw JSON object.`;

  logger.info(`Starting Mistral analysis for meeting: ${meeting._id}`);

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || 'mistral-medium-latest',
      temperature: 0.1, // Low temperature for factual, grounded output
      response_format: { type: 'json_object' }, // Force JSON output
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    logger.error('Mistral API error', { status: response.status, body: errBody.slice(0, 300) });
    throw new Error(`Mistral API returned ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('Mistral API returned an empty response.');
  }

  let parsed;
  try {
    // Strip any accidental markdown code fences before parsing
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error('Mistral returned invalid JSON', { raw: rawText.slice(0, 500) });
    throw new Error('AI service returned malformed JSON. Please try again.');
  }

  // ── Post-generation validation & grounding ─────────────────────

  // Validate and filter citations in each section
  const sanitize = (items, hasAssignee = false) =>
    (items || []).map((item) => {
      const sanitized = {
        ...item,
        citations: validateCitations(item.citations, validTimestamps),
      };
      if (hasAssignee && item.assignee) {
        sanitized.assignee = validateAssignee(item.assignee, validSpeakers);
      }
      return sanitized;
    });

  const analysis = {
    summary: sanitize(parsed.summary),
    actionItems: sanitize(parsed.actionItems, true),
    decisions: sanitize(parsed.decisions),
    followUpSuggestions: sanitize(parsed.followUpSuggestions),
  };

  logger.info(`Mistral analysis complete for meeting: ${meeting._id}`, {
    summaryItems: analysis.summary.length,
    actionItems: analysis.actionItems.length,
    decisions: analysis.decisions.length,
    followUps: analysis.followUpSuggestions.length,
  });

  return analysis;
};

module.exports = { analyzeMeeting };
