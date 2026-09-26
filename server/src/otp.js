const crypto = require('crypto');
const nodemailer = require('nodemailer');

function generateCode() {
  // Real 6-digit numeric OTP, cryptographically random (not Math.random()).
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function activeChannel() {
  if (process.env.FONNTE_TOKEN) return 'whatsapp_fonnte';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) return 'sms_twilio';
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'email_smtp';
  return 'dev_console';
}

async function sendViaFonnte(phone, message) {
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: process.env.FONNTE_TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ target: phone, message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error('Fonnte send failed: ' + JSON.stringify(data));
  }
  return data;
}

async function sendViaTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: phone,
      From: process.env.TWILIO_FROM_NUMBER,
      Body: message,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Twilio send failed: ' + JSON.stringify(data));
  return data;
}

let smtpTransport = null;
function getSmtpTransport() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return smtpTransport;
}

async function sendViaEmail(email, message) {
  const transport = getSmtpTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Kode Verifikasi Park Gate',
    text: message,
  });
}

/**
 * Sends a real OTP over whichever channel is configured in .env.
 * Returns { channel, devCode } -- devCode is only ever populated when NO
 * real channel is configured, so you can still test locally; it is never
 * populated once you set real credentials.
 */
async function sendOtp({ phone, email, code }) {
  const message = `Park Gate: kode verifikasi kamu adalah ${code}. Berlaku 5 menit. Jangan bagikan kode ini ke siapa pun.`;
  const channel = activeChannel();

  if (channel === 'whatsapp_fonnte') {
    await sendViaFonnte(phone, message);
    return { channel };
  }
  if (channel === 'sms_twilio') {
    await sendViaTwilio(phone, message);
    return { channel };
  }
  if (channel === 'email_smtp') {
    if (!email) throw new Error('EMAIL_REQUIRED');
    await sendViaEmail(email, message);
    return { channel };
  }

  // Dev fallback -- no gateway configured yet.
  console.log(`\n[DEV OTP] No SMS/WhatsApp/Email gateway configured in .env.`);
  console.log(`[DEV OTP] Phone ${phone} -> code: ${code}\n`);
  return { channel: 'dev_console', devCode: code };
}

module.exports = { generateCode, hashCode, sendOtp, activeChannel };
