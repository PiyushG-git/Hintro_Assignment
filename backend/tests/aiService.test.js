// aiService uses native fetch — mock it globally
const { analyzeMeeting } = require('../src/services/aiService');

const sampleMeeting = {
  _id: 'meeting-123',
  title: 'Sprint Planning',
  meetingDate: new Date('2026-05-20T10:00:00Z'),
  participants: ['alice@example.com'],
  transcript: [
    { timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' },
    { timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' },
  ],
};

const makeFetchResponse = (data, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => ({
    choices: [{ message: { content: JSON.stringify(data) } }],
  }),
  text: async () => JSON.stringify({ error: 'API Error' }),
});

describe('AI Service — analyzeMeeting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return analysis with grounded citations', async () => {
    const mockAnalysis = {
      summary: [{ text: 'Team discussed launch plans.', citations: [{ timestamp: '00:10' }] }],
      actionItems: [
        { task: 'Prepare release notes', assignee: 'Alice', dueDate: null, citations: [{ timestamp: '00:20' }] },
      ],
      decisions: [{ text: 'Launch next Friday.', citations: [{ timestamp: '00:10' }] }],
      followUpSuggestions: [],
    };

    global.fetch = jest.fn().mockResolvedValueOnce(makeFetchResponse(mockAnalysis));

    const result = await analyzeMeeting(sampleMeeting);

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('actionItems');
    expect(result).toHaveProperty('decisions');
    expect(result).toHaveProperty('followUpSuggestions');
    expect(result.summary[0].citations[0].timestamp).toBe('00:10');
  });

  it('should strip invalid citation timestamps (hallucination prevention)', async () => {
    const mockAnalysisWithBadCitations = {
      summary: [
        {
          text: 'Some insight.',
          citations: [
            { timestamp: '00:10' },  // Valid
            { timestamp: '99:99' },  // INVALID — not in transcript
          ],
        },
      ],
      actionItems: [],
      decisions: [],
      followUpSuggestions: [],
    };

    global.fetch = jest.fn().mockResolvedValueOnce(makeFetchResponse(mockAnalysisWithBadCitations));

    const result = await analyzeMeeting(sampleMeeting);

    // The invalid timestamp should have been removed
    expect(result.summary[0].citations).toHaveLength(1);
    expect(result.summary[0].citations[0].timestamp).toBe('00:10');
  });

  it('should nullify assignees not present in transcript speakers', async () => {
    const mockAnalysisWithFakeAssignee = {
      summary: [],
      actionItems: [
        {
          task: 'Do something',
          assignee: 'Charlie', // Charlie is NOT in the transcript speakers
          dueDate: null,
          citations: [{ timestamp: '00:10' }],
        },
      ],
      decisions: [],
      followUpSuggestions: [],
    };

    global.fetch = jest.fn().mockResolvedValueOnce(makeFetchResponse(mockAnalysisWithFakeAssignee));

    const result = await analyzeMeeting(sampleMeeting);

    // Charlie should have been nullified since he's not in the transcript
    expect(result.actionItems[0].assignee).toBeNull();
  });

  it('should throw an error if Mistral returns malformed JSON', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not valid json {{' } }],
      }),
    });

    await expect(analyzeMeeting(sampleMeeting)).rejects.toThrow(
      'AI service returned malformed JSON'
    );
  });

  it('should throw when Mistral API returns a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    });

    await expect(analyzeMeeting(sampleMeeting)).rejects.toThrow('Mistral API returned 429');
  });

  it('should handle empty transcript sections gracefully', async () => {
    const emptyAnalysis = {
      summary: [],
      actionItems: [],
      decisions: [],
      followUpSuggestions: [],
    };

    global.fetch = jest.fn().mockResolvedValueOnce(makeFetchResponse(emptyAnalysis));

    const result = await analyzeMeeting(sampleMeeting);

    expect(result.summary).toHaveLength(0);
    expect(result.actionItems).toHaveLength(0);
  });
});
