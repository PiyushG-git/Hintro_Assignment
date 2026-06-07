const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Sends a reminder email for an overdue action item via SendGrid.
 *
 * @param {object} actionItem - ActionItem document
 * @returns {Promise<void>}
 */
const sendReminderEmail = async (actionItem) => {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || 'Hintro Reminders';

  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL environment variable is not set');
  }

  const dueDate = new Date(actionItem.dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `⚠️ Overdue Reminder: ${actionItem.task}`;

  const textBody = `
Hintro Action Item Reminder
===========================

This is a reminder that the following action item is overdue:

Task:       ${actionItem.task}
Assigned To: ${actionItem.assignee}
Due Date:   ${dueDate}
Status:     ${actionItem.status}
Meeting ID: ${actionItem.meetingId}

Please update the status of this action item at your earliest convenience.

---
Sent by Hintro Meeting Intelligence
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #ef4444; padding: 28px 32px; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; }
    .label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .value { font-size: 15px; color: #111827; margin-bottom: 20px; }
    .badge { display: inline-block; background: #fef2f2; color: #dc2626; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .footer { background: #f3f4f6; padding: 16px 32px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Overdue Action Item Reminder</h1>
    </div>
    <div class="body">
      <p style="color:#374151; margin-top:0;">This action item is past its due date and requires your attention.</p>
      
      <div class="label">Task</div>
      <div class="value">${actionItem.task}</div>

      <div class="label">Assigned To</div>
      <div class="value">${actionItem.assignee}</div>

      <div class="label">Due Date</div>
      <div class="value">${dueDate}</div>

      <div class="label">Current Status</div>
      <div class="value"><span class="badge">${actionItem.status}</span></div>

      <div class="label">Meeting Reference</div>
      <div class="value" style="font-family:monospace; font-size:13px;">${actionItem.meetingId}</div>
    </div>
    <div class="footer">
      Sent by Hintro Meeting Intelligence &mdash; AI-powered meeting follow-up
    </div>
  </div>
</body>
</html>
  `.trim();

  const msg = {
    to: fromEmail, // In a real app, this would be the assignee's email
    from: { email: fromEmail, name: fromName },
    subject,
    text: textBody,
    html: htmlBody,
  };

  await sgMail.send(msg);

  logger.info('Reminder email sent', {
    actionItemId: actionItem._id,
    assignee: actionItem.assignee,
    task: actionItem.task,
  });
};

module.exports = { sendReminderEmail };
