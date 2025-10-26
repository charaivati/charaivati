// lib/sendEmail.ts
import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

// Enforce email config in production — fail fast so deploys don't silently drop email.
if (process.env.NODE_ENV === "production") {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("EMAIL_USER, EMAIL_PASS and EMAIL_FROM must be set in production");
  }
}

let transporter: nodemailer.Transporter | null = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

type EmailOpts = { to: string; subject: string; text?: string; html?: string };

/**
 * sendEmail - send via configured transporter.
 * In dev, if transporter is not configured, we log to console so devs can click links.
 * In production, transporter must be configured (see guard above).
 */
export default async function sendEmail(opts: EmailOpts) {
  if (!transporter) {
    // DEV fallback: allow console log so devs can click the link locally
    // Do NOT rely on this in production.
    // eslint-disable-next-line no-console
    console.log("[sendEmail fallback - DEV ONLY]", opts);
    return;
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
