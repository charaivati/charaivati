// scripts/seed-login-strings.ts
// Seeds all login / auth page UI strings as Tab records (category: "ui-auth").
// Run with: npx tsx scripts/seed-login-strings.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LOGIN_STRINGS = [
  // ── Page titles / headings ────────────────────────────────────────────────
  { slug: "auth-welcome-title",    title: "Welcome",                                          description: "Main heading on the login/register page" },
  { slug: "auth-welcome-subtitle", title: "Sign in or create an account to continue",         description: "Subheading below the welcome title" },
  { slug: "auth-welcome-back",     title: "Welcome Back!",                                    description: "Heading shown when the user's email is recognised" },
  { slug: "auth-create-title",     title: "Create Your Account",                              description: "Heading on the registration step" },

  // ── Email step ────────────────────────────────────────────────────────────
  { slug: "auth-email-label",      title: "Email Address",                                    description: "Label for the email input field" },
  { slug: "auth-email-placeholder",title: "you@example.com",                                  description: "Placeholder text inside the email field" },
  { slug: "auth-email-hint",       title: "We'll check if you have an account or help you create one", description: "Helper text below email field" },
  { slug: "auth-continue-btn",     title: "Continue",                                         description: "Primary button to proceed from email step" },
  { slug: "auth-checking",         title: "Checking...",                                      description: "Loading state for email check button" },

  // ── Login step ────────────────────────────────────────────────────────────
  { slug: "auth-password-label",   title: "Password",                                         description: "Label for the password input" },
  { slug: "auth-password-placeholder", title: "Enter your password",                          description: "Placeholder inside the password field" },
  { slug: "auth-login-btn",        title: "Login",                                            description: "Submit button on the login step" },
  { slug: "auth-logging-in",       title: "Logging in...",                                    description: "Loading state for the login button" },
  { slug: "auth-diff-email",       title: "Use different email",                              description: "Back button to change the email" },

  // ── Register step ─────────────────────────────────────────────────────────
  { slug: "auth-name-label",       title: "Full Name",                                        description: "Label for the name input on registration" },
  { slug: "auth-name-placeholder", title: "John Doe",                                         description: "Placeholder inside the name field" },
  { slug: "auth-email-label-2",    title: "Email",                                            description: "Shorter email label used on the register step" },
  { slug: "auth-password-hint",    title: "Must be at least 8 characters",                   description: "Validation hint below the password field" },
  { slug: "auth-create-btn",       title: "Create Account",                                   description: "Submit button on the registration step" },
  { slug: "auth-creating",         title: "Creating account...",                              description: "Loading state for the create account button" },

  // ── Guest / footer ────────────────────────────────────────────────────────
  { slug: "auth-guest-btn",        title: "Skip for now (Continue as guest)",                 description: "Button to enter guest mode without registering" },
  { slug: "auth-guest-hint",       title: "Guest mode is read-only until you log in or register.", description: "Hint below the guest button" },
  { slug: "auth-terms-prefix",     title: "By continuing, you agree to our",                 description: "Text before the terms link" },
  { slug: "auth-terms-link",       title: "terms of service",                                 description: "Clickable link label for terms" },
  { slug: "auth-too-many-attempts",title: "Too many attempts. Please wait",                  description: "Cooldown notice after multiple failed logins" },
];

async function main() {
  console.log(`Seeding ${LOGIN_STRINGS.length} login UI strings...\n`);
  let created = 0, updated = 0;
  for (const s of LOGIN_STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-auth" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description, category: "ui-auth", is_default: false, is_custom: false } });
      console.log(`  + ${s.slug}`);
      created++;
    }
  }
  console.log(`\nDone: ${created} created, ${updated} updated`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
