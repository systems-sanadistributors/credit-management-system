const nodemailer = require('nodemailer');
const { config } = require('../config/env');

let customTransporter = null;
let defaultTransporter = null;

function setTransporter(transporter) {
  customTransporter = transporter;
}

function getTransporter() {
  if (customTransporter) return customTransporter;
  if (!defaultTransporter) {
    defaultTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return defaultTransporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeSubject(subject) {
  return String(subject ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function buildEmailHtml({ heading, details, commentLabel, commentText, actionUrl }) {
  const rowsHtml = details
    .map(
      ([label, val]) =>
        `<tr>
          <td style="padding:8px 12px;border:1px solid #d4d4d8;background:#f4f4f5;font-weight:600;font-size:12px;color:#3f3f46;width:160px;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border:1px solid #d4d4d8;font-size:13px;color:#09090b;">${escapeHtml(val)}</td>
        </tr>`
    )
    .join('');

  const commentBlock = commentText
    ? `<div style="margin-top:16px;padding:12px;border:1px solid #d4d4d8;background:#fafafa;">
         <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#52525b;margin-bottom:4px;">${escapeHtml(commentLabel)}</div>
         <div style="font-size:13px;color:#09090b;">${escapeHtml(commentText)}</div>
       </div>`
    : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:2px solid #09090b;background:#ffffff;">
      <div style="background:#09090b;color:#ffffff;padding:14px 20px;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
        Sana Distribution — Sequential Approval Ledger
      </div>
      <div style="padding:20px;">
        <h2 style="margin:0 0 14px 0;font-size:18px;color:#09090b;">${escapeHtml(heading)}</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${rowsHtml}
        </table>
        ${commentBlock}
        <div style="margin-top:20px;">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#09090b;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
            Open Approval System
          </a>
        </div>
        <p style="margin-top:12px;font-size:11px;color:#71717a;">
          System Link: <a href="${escapeHtml(actionUrl)}" style="color:#09090b;">${escapeHtml(actionUrl)}</a>
        </p>
      </div>
    </div>
  `;
}

async function sendMailSafe({ to, subject, text, html }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return null;

  const cleanSubject = sanitizeSubject(subject);
  const fromHeader = config.smtp.from || `"Sana Distribution" <${config.smtp.user}>`;
  const toHeader = recipients.join(', ');

  if (!customTransporter && process.env.NODE_ENV === 'test') {
    return { messageId: 'test-mock-smtp-id', to: toHeader };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: fromHeader,
      to: toHeader,
      subject: cleanSubject,
      text,
      html,
    });
    if (!customTransporter) {
      console.log(
        `[EMAIL] Sent via SMTP (${config.smtp.user} -> ${toHeader}) | id: ${info.messageId}`
      );
    }
    return info;
  } catch (err) {
    console.error(`[EMAIL] SMTP delivery failed (${toHeader}):`, err.message);
    return null;
  }
}

async function verifySmtp() {
  if (process.env.NODE_ENV === 'test') return true;
  try {
    await getTransporter().verify();
    console.log(`[SMTP] Ready (${config.smtp.host}:${config.smtp.port})`);
    return true;
  } catch (err) {
    console.error('[SMTP] Verification failed:', err.message);
    return false;
  }
}

async function notifyOnFormCreated(form) {
  const shortId = String(form._id).slice(-6).toUpperCase();
  const actionUrl = config.clientUrl;
  const subject = `[Sana Approval] New Form #${shortId} Awaiting Person 2 Review`;
  const text = [
    `Person 1 submitted a new form: ${form.title} (#${shortId}).`,
    `Channel: ${form.channel} | Credit Limit: ${form.creditLimit} | Credit Type: ${form.creditType}`,
    `Current Stage: Stage 2 (Awaiting Person 2)`,
    `Open the system: ${actionUrl}`,
  ].join('\n');

  const html = buildEmailHtml({
    heading: `New Form #${shortId} Submitted by Person 1`,
    details: [
      ['Form Title', form.title],
      ['Record ID', `#${shortId}`],
      ['Channel', form.channel],
      ['Credit Limit', String(form.creditLimit)],
      ['Credit Type', form.creditType],
      ['Current Stage', 'Stage 2 (Awaiting Person 2)'],
    ],
    actionUrl,
  });

  return sendMailSafe({
    to: config.emails[2],
    subject,
    text,
    html,
  });
}

async function notifyOnFormEdited(form) {
  const shortId = String(form._id).slice(-6).toUpperCase();
  const actionUrl = config.clientUrl;
  const allCheckers = [config.emails[2], config.emails[3], config.emails[4]];
  const subject = `[Sana Approval] Form #${shortId} Edited by Person 1 (Stage Reset to 2)`;
  const text = [
    `Person 1 edited form ${form.title} (#${shortId}).`,
    `All prior approvals were cleared and the form has been reset to Stage 2 (Person 2).`,
    `Open the system: ${actionUrl}`,
  ].join('\n');

  const html = buildEmailHtml({
    heading: `Form #${shortId} Edited & Reset by Person 1`,
    details: [
      ['Form Title', form.title],
      ['Record ID', `#${shortId}`],
      ['Action', 'Edited by Person 1 (isUpdated = true)'],
      ['Stage Reset', 'Reset to Stage 2 (Prior approvals cleared)'],
    ],
    actionUrl,
  });

  return sendMailSafe({
    to: allCheckers,
    subject,
    text,
    html,
  });
}

async function notifyOnFormDeleted(form) {
  const shortId = String(form._id).slice(-6).toUpperCase();
  const actionUrl = config.clientUrl;
  const allCheckers = [config.emails[2], config.emails[3], config.emails[4]];
  const subject = `[Sana Approval] Form #${shortId} Deleted by Person 1`;
  const text = [
    `Person 1 permanently deleted form ${form.title} (#${shortId}).`,
    `Open the system: ${actionUrl}`,
  ].join('\n');

  const html = buildEmailHtml({
    heading: `Form #${shortId} Deleted by Person 1`,
    details: [
      ['Form Title', form.title],
      ['Record ID', `#${shortId}`],
      ['Action', 'Deleted by Person 1'],
      ['Previous Stage', `Stage ${form.currentStage} (${form.status})`],
    ],
    actionUrl,
  });

  return sendMailSafe({
    to: allCheckers,
    subject,
    text,
    html,
  });
}

async function notifyOnFormReviewed(form, { actorRole, action, comment }) {
  const shortId = String(form._id).slice(-6).toUpperCase();
  const actionUrl = config.clientUrl;
  const decisionLabel = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  const nextRecipientRole = actorRole === 4 ? 1 : actorRole + 1;
  const recipientEmail = config.emails[nextRecipientRole];

  const subject = `[Sana Approval] Form #${shortId} ${decisionLabel} by Person ${actorRole}`;
  const text = [
    `Person ${actorRole} ${decisionLabel} form ${form.title} (#${shortId}).`,
    `Person ${actorRole} Comment: ${comment}`,
    `Current Stage: Stage ${form.currentStage} | Status: ${form.status}`,
    `Open the system: ${actionUrl}`,
  ].join('\n');

  const html = buildEmailHtml({
    heading: `Form #${shortId} ${decisionLabel} by Person ${actorRole}`,
    details: [
      ['Form Title', form.title],
      ['Record ID', `#${shortId}`],
      ['Reviewed By', `Person ${actorRole}`],
      ['Decision', decisionLabel],
      ['Current Stage', `Stage ${form.currentStage}`],
      ['Form Status', form.status],
    ],
    commentLabel: `Person ${actorRole} Comment`,
    commentText: comment,
    actionUrl,
  });

  return sendMailSafe({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

async function notifyPerson5Credit(form) {
  const shortId = String(form._id).slice(-6).toUpperCase();
  const actionUrl = config.clientUrl;
  const subject = `[Sana Approval] Approved Credit Package #${shortId} — ${form.cName} (${form.bName})`;

  const details = [
    ['Record ID', `#${shortId}`],
    ['Form Title', form.title],
    ['C. name', form.cName],
    ['B. name', form.bName],
    ['Channel', form.channel],
    ['CNIC #', form.cnicNo],
    ['NTN #', form.ntnNo],
    ['Mobile #', form.mobileNo],
    ['Address', form.address],
    ['Days', form.days],
    ['Credit limit', Number(form.creditLimit || 0).toLocaleString()],
    ['Credit type', form.creditType],
    ['Security Cheque', form.chequeStatus],
  ];

  if (form.chequeStatus === 'Yes') {
    details.push(['C. no.', form.chequeNo]);
    details.push([
      'C. Amount',
      Number(form.chequeAmount || 0).toLocaleString(),
    ]);
    if (form.bankName) {
      details.push(['Bank name', form.bankName]);
    }
    if (form.bankBranch) {
      details.push(['Bank Branch', form.bankBranch]);
    }
    if (form.chequePicture && !form.chequePicture.startsWith('data:')) {
      details.push(['C. Picture', form.chequePicture]);
    }
  }

  if (form.shopPicture && !form.shopPicture.startsWith('data:')) {
    details.push(['Shop Picture', form.shopPicture]);
  }

  const approvalSummary = (form.comments || [])
    .map((c) => `Person ${c.role} (${c.action}): ${c.comment}`)
    .join('\n');

  const text = [
    `Approved Credit Package #${shortId}`,
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    'Approvals:',
    approvalSummary || 'None',
    '',
    `Open the system: ${actionUrl}`,
  ].join('\n');

  const html = buildEmailHtml({
    heading: `Approved Credit Details — #${shortId}`,
    details,
    commentLabel: 'Sequential Approvals (Persons 2–4)',
    commentText: approvalSummary || 'All stages approved.',
    actionUrl,
  });

  return sendMailSafe({
    to: config.emails[5],
    subject,
    text,
    html,
  });
}

module.exports = {
  setTransporter,
  verifySmtp,
  notifyOnFormCreated,
  notifyOnFormEdited,
  notifyOnFormDeleted,
  notifyOnFormReviewed,
  notifyPerson5Credit,
};
