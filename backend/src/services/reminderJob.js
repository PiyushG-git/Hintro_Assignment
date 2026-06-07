const cron = require('node-cron');
const ActionItem = require('../models/ActionItem');
const { sendReminderEmail } = require('./emailService');
const logger = require('../utils/logger');

const COOLDOWN_HOURS = parseInt(process.env.REMINDER_COOLDOWN_HOURS || '24', 10);
const CRON_EXPRESSION = process.env.REMINDER_CRON || '0 * * * *'; // Default: every hour

/**
 * Core reminder logic — can be called independently (e.g. in tests or manual trigger).
 * Finds all overdue action items, sends reminders, and records history.
 */
const processReminders = async () => {
  const jobId = `reminder-job-${Date.now()}`;
  logger.info('Reminder job started', { jobId });

  try {
    const now = new Date();
    const cooldownCutoff = new Date(now - COOLDOWN_HOURS * 60 * 60 * 1000);

    // Find overdue items that either haven't been reminded or are past cooldown
    const overdueItems = await ActionItem.find({
      status: { $ne: 'COMPLETED' },
      dueDate: { $lt: now },
      $or: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { $lt: cooldownCutoff } },
      ],
    });

    logger.info(`Found ${overdueItems.length} overdue item(s) needing reminders`, { jobId });

    let sent = 0;
    let failed = 0;

    for (const item of overdueItems) {
      try {
        await sendReminderEmail(item);

        const message = `Reminder: ${item.task} | Assigned To: ${item.assignee} | Due Date: ${item.dueDate.toISOString().split('T')[0]}`;

        await ActionItem.findByIdAndUpdate(item._id, {
          lastReminderSentAt: now,
          $push: {
            reminders: {
              sentAt: now,
              channel: 'email',
              message,
            },
          },
        });

        sent++;
        logger.info(`Reminder sent for action item: ${item._id}`, {
          jobId,
          task: item.task,
          assignee: item.assignee,
        });
      } catch (err) {
        failed++;
        logger.error(`Failed to send reminder for action item: ${item._id}`, {
          jobId,
          error: err.message,
        });
      }
    }

    logger.info('Reminder job completed', { jobId, sent, failed, total: overdueItems.length });
  } catch (err) {
    logger.error('Reminder job encountered a fatal error', { jobId, error: err.message });
  }
};

/**
 * Starts the scheduled reminder cron job.
 */
const start = () => {
  if (!cron.validate(CRON_EXPRESSION)) {
    logger.error(`Invalid cron expression: "${CRON_EXPRESSION}". Reminder job not started.`);
    return;
  }

  logger.info(`Reminder job scheduled with cron: "${CRON_EXPRESSION}"`);

  cron.schedule(CRON_EXPRESSION, async () => {
    await processReminders();
  });
};

module.exports = { start, processReminders };
