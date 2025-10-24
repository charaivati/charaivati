// app/api/user/register-temp/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer"; // reuse your existing nodemailer config if you have one

const SEND_EMAIL = false; // set true if you want to email the temp password instead of returning it

function makeTempPassword(len = 10) {
  // generate a random base64-like safe string (URL-safe)
  return randomBytes(Math.ceil(len * 0.75)).toString("base64").replace(/\+/g, "0").replace(/\//g, "0").slice(0, len);
}

async function sendTemppwEmail(to: string, temp: string) {
  // adapt to your existing transporter
  const transporter = nodemailer.createTransport(/* your SMTP options or reuse existing lib */);
  await transporter.sendMail({
    to,
    from: process.env.NM_FROM || "no-reply@example.com",
    subject: "Your temporary password",
    text: `Your temporary password: ${temp}\nPlease login and change it.`,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });

    // create a temp password
    const temp = makeTempPassword(12);
    const hash = await bcrypt.hash(temp, 10);

    // upsert user (create or update password)
    const existing = await prisma.user.findUnique({ where: { email } });
    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { email },
        data: { passwordHash: hash, emailVerified: existing.emailVerified ?? false },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: hash,
          name: null,
          verified: false,
          emailVerified: false,
        },
      });
    }

    if (SEND_EMAIL) {
      try {
        await sendTemppwEmail(email, temp);
        return NextResponse.json({ ok: true, message: "sent" });
      } catch (err) {
        console.error("email send failed", err);
        // fall back to returning the password once (warn)
        return NextResponse.json({ ok: true, tempPassword: temp, warning: "email failed; returning password in response" });
      }
    }

    // return temp password once (one-time)
    return NextResponse.json({ ok: true, tempPassword: temp });
  } catch (err) {
    console.error("register-temp error", err);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
