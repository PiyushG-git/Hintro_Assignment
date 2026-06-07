// Mock the @google/generative-ai module
jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    _mockGenerateContent: mockGenerateContent,
  };
});

const { analyzeMeeting } = require('../src/services/aiService');
const { _mockGenerateContent } = require('@google/generative-ai');

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

const makeGeminiResponse = (data) => ({
  response: {
    text: () => JSON.stringify(data),
  },
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

    _mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse(mockAnalysis));

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
            { timestamp: '00:10' },           // Valid
            { timestamp: '99:99' },           // INVALID — not in transcript
          ],
        },
      ],
      actionItems: [],
      decisions: [],
      followUpSuggestions: [],
    };

    _mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse(mockAnalysisWithBadCitations));

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

    _mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse(mockAnalysisWithFakeAssignee));

    const result = await analyzeMeeting(sampleMeeting);

    // Charlie should have been nullified since he's not in the transcript
    expect(result.actionItems[0].assignee).toBeNull();
  });

  it('should throw an error if Gemini returns malformed JSON', async () => {
    _mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => 'not valid json {{' },
    });

    await expect(analyzeMeeting(sampleMeeting)).rejects.toThrow(
      'AI service returned malformed JSON'
    );
  });

  it('should handle empty transcript sections gracefully', async () => {
    const emptyAnalysis = {
      summary: [],
      actionItems: [],
      decisions: [],
      followUpSuggestions: [],
    };

    _mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse(emptyAnalysis));

    const result = await analyzeMeeting(sampleMeeting);

    expect(result.summary).toHaveLength(0);
    expect(result.actionItems).toHaveLength(0);
  });
});
