const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────

const transcriptEntrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: String,
      required: [true, 'Transcript timestamp is required'],
      trim: true,
    },
    speaker: {
      type: String,
      required: [true, 'Transcript speaker is required'],
      trim: true,
    },
    text: {
      type: String,
      required: [true, 'Transcript text is required'],
      trim: true,
    },
  },
  { _id: false }
);

const citationSchema = new mongoose.Schema(
  {
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const summaryItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    citations: [citationSchema],
  },
  { _id: false }
);

const analysisActionItemSchema = new mongoose.Schema(
  {
    task: { type: String, required: true },
    assignee: { type: String },
    dueDate: { type: Date },
    citations: [citationSchema],
  },
  { _id: false }
);

const decisionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    citations: [citationSchema],
  },
  { _id: false }
);

const followUpSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    citations: [citationSchema],
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    summary: [summaryItemSchema],
    actionItems: [analysisActionItemSchema],
    decisions: [decisionSchema],
    followUpSuggestions: [followUpSchema],
  },
  { _id: false }
);

// ── Main Meeting Schema ────────────────────────────────────────────

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    participants: {
      type: [String],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length > 0 &&
          arr.every((email) => /^\S+@\S+\.\S+$/.test(email)),
        message: 'Participants must be a non-empty array of valid email addresses',
      },
    },
    meetingDate: {
      type: Date,
      required: [true, 'Meeting date is required'],
    },
    transcript: {
      type: [transcriptEntrySchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Transcript must contain at least one entry',
      },
    },
    analysis: {
      type: analysisSchema,
      default: null,
    },
    analyzedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
meetingSchema.index({ createdBy: 1, createdAt: -1 });
meetingSchema.index({ meetingDate: -1 });

const Meeting = mongoose.model('Meeting', meetingSchema);

module.exports = Meeting;
