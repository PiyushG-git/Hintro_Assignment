const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
 * Analyzes a meeting transcript using Google Gemini AI.
 * Returns grounded insights with citations tied to transcript timestamps.
 *
 * @param {object} meeting - Mongoose Meeting document
 * @returns {Promise<object>} analysis result
 */
const analyzeMeeting = async (meeting) => {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1, // Low temperature for factual, grounded output
    },
  });

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
7. Return ONLY valid JSON matching the schema below.

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

Analyze this transcript strictly following the rules above. Extract only what is explicitly present.`;

  logger.info(`Starting Gemini analysis for meeting: ${meeting._id}`);

  const result = await model.generateContent([systemPrompt, userPrompt]);
  const rawText = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    logger.error('Gemini returned invalid JSON', { raw: rawText.slice(0, 500) });
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

  logger.info(`Gemini analysis complete for meeting: ${meeting._id}`, {
    summaryItems: analysis.summary.length,
    actionItems: analysis.actionItems.length,
    decisions: analysis.decisions.length,
    followUps: analysis.followUpSuggestions.length,
  });

  return analysis;
};

module.exports = { analyzeMeeting };
