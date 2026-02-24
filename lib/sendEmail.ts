import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

let transporter: nodemailer.Transporter | null = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

type EmailOpts = { to: string; subject: string; text?: string; html?: string };

export default async function sendEmail(opts: EmailOpts) {
  if (!transporter || !EMAIL_FROM) {
    console.log("[sendEmail fallback - provider not configured]", opts);
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
