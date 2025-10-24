// lib/sendEmail.ts
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

type EmailOpts = { to: string; subject: string; text?: string; html?: string };

export default async function sendEmail(opts: EmailOpts) {
  if (!transporter) {
    // DEV fallback: log to console so you can click link while testing
    // (safe for local dev; do NOT use in production)
    // eslint-disable-next-line no-console
    console.log("[sendEmail fallback]", opts);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
