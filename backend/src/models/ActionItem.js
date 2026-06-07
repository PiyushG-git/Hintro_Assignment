const mongoose = require('mongoose');

const ACTION_ITEM_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

const citationSchema = new mongoose.Schema(
  {
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const reminderSchema = new mongoose.Schema(
  {
    sentAt: { type: Date, required: true, default: Date.now },
    channel: { type: String, default: 'email' },
    message: { type: String },
  },
  { _id: false }
);

const actionItemSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting ID is required'],
    },
    task: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
      maxlength: [500, 'Task description cannot exceed 500 characters'],
    },
    assignee: {
      type: String,
      required: [true, 'Assignee is required'],
      trim: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ACTION_ITEM_STATUSES,
        message: `Status must be one of: ${ACTION_ITEM_STATUSES.join(', ')}`,
      },
      default: 'PENDING',
    },
    citations: {
      type: [citationSchema],
      default: [],
    },
    reminders: {
      type: [reminderSchema],
      default: [],
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: isOverdue
actionItemSchema.virtual('isOverdue').get(function () {
  return this.status !== 'COMPLETED' && this.dueDate < new Date();
});

// Indexes for common filter queries
actionItemSchema.index({ meetingId: 1 });
actionItemSchema.index({ status: 1 });
actionItemSchema.index({ assignee: 1 });
actionItemSchema.index({ dueDate: 1, status: 1 });

const ActionItem = mongoose.model('ActionItem', actionItemSchema);

module.exports = ActionItem;
module.exports.ACTION_ITEM_STATUSES = ACTION_ITEM_STATUSES;
