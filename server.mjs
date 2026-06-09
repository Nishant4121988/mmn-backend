import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json());

const otpStore = new Map();
const PORT = process.env.PORT || 3011;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeOtp(key, code, payload = {}) {
  otpStore.set(key, {
    code,
    payload,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
}

function readOtp(key, code) {
  const row = otpStore.get(key);
  if (!row || row.expiresAt < Date.now() || row.code !== code) return null;
  otpStore.delete(key);
  return row;
}

async function sendMail({ to, subject, text }) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'contact@macromicronews.com',
    to,
    subject,
    text
  });
}

// ─── Contact ────────────────────────────────────────────────
app.post('/api/mmn/contact/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const code = makeCode();
    storeOtp(`contact:${email}`, code);

    await sendMail({
      to: email,
      subject: 'Macro Micro News — Your verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`
    });

    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send verification code.' });
  }
});

app.post('/api/mmn/contact/verify-submit', async (req, res) => {
  try {
    const { email, subject, message, verificationCode } = req.body;
    const row = readOtp(`contact:${email}`, verificationCode);

    if (!row) return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });

    await sendMail({
      to: 'contact@macromicronews.com',
      subject: `[Contact] ${subject}`,
      text: `From: ${email}\n\n${message}`
    });

    res.json({ success: true, message: 'Message submitted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit message.' });
  }
});

// ─── Report ─────────────────────────────────────────────────
app.post('/api/mmn/report/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const code = makeCode();
    storeOtp(`report:${email}`, code);

    await sendMail({
      to: email,
      subject: 'Macro Micro News — Your report verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nPlease also check your spam folder if you do not see this email.\n\nIf you did not request this, please ignore this email.`
    });

    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send verification code.' });
  }
});

app.post('/api/mmn/report/verify-submit', async (req, res) => {
  try {
    const { email, subject, message, verificationCode, postUrl } = req.body;
    const row = readOtp(`report:${email}`, verificationCode);

    if (!row) return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });

    await sendMail({
      to: 'contact@macromicronews.com',
      subject: `[Report] ${subject}`,
      text: `Reporter email: ${email}\nArticle URL: ${postUrl || 'not provided'}\n\n${message}`
    });

    res.json({ success: true, message: 'Report submitted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit report.' });
  }
});

// ─── Health ──────────────────────────────────────────────────
app.get('/api/mmn/health', (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MMN backend running on port ${PORT}`);
});
