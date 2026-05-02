// scripts/seed-auth-messages.ts
// Seeds dynamic auth status message slugs + translations for hi, bn, as, es, ru.
// These are the setMessage() strings inside login/register/guest handlers.
// Run with: npx tsx scripts/seed-auth-messages.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ── English Tab records ────────────────────────────────────────────────────────
const TABS = [
  { slug: "auth-msg-logging-in",        title: "Logging in...",                                             description: "Status: logging in" },
  { slug: "auth-msg-login-ok",          title: "Login successful! Redirecting...",                          description: "Status: login succeeded" },
  { slug: "auth-msg-login-fail",        title: "Login failed",                                              description: "Status: login error fallback" },
  { slug: "auth-msg-network-error",     title: "Network error. Please retry.",                              description: "Status: network failure" },
  { slug: "auth-msg-creating-account",  title: "Creating your account...",                                  description: "Status: register loading" },
  { slug: "auth-msg-account-ok",        title: "Account created! Let's get you started...",                 description: "Status: register succeeded" },
  { slug: "auth-msg-reg-fail",          title: "Registration failed",                                       description: "Status: register error fallback" },
  { slug: "auth-msg-creating-guest",    title: "Creating a guest session...",                               description: "Status: guest session loading" },
  { slug: "auth-msg-guest-ok",          title: "Guest session ready! Redirecting...",                       description: "Status: guest session ready" },
  { slug: "auth-msg-guest-fail",        title: "Unable to start guest session. Please try again.",          description: "Status: guest session failed" },
  { slug: "auth-msg-email-required",    title: "Please enter your email",                                   description: "Validation: email field empty" },
  { slug: "auth-msg-email-error",       title: "Error checking email. Please try again.",                   description: "Status: email check error" },
];

// ── Translations per locale ────────────────────────────────────────────────────
const LOCALES: Record<string, Record<string, string>> = {
  hi: {
    "auth-msg-logging-in":        "लॉग इन हो रहा है...",
    "auth-msg-login-ok":          "लॉग इन सफल! रीडायरेक्ट हो रहे हैं...",
    "auth-msg-login-fail":        "लॉग इन विफल",
    "auth-msg-network-error":     "नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।",
    "auth-msg-creating-account":  "खाता बन रहा है...",
    "auth-msg-account-ok":        "खाता बन गया! शुरू करते हैं...",
    "auth-msg-reg-fail":          "पंजीकरण विफल",
    "auth-msg-creating-guest":    "अतिथि सत्र बन रहा है...",
    "auth-msg-guest-ok":          "अतिथि सत्र तैयार! रीडायरेक्ट हो रहे हैं...",
    "auth-msg-guest-fail":        "अतिथि सत्र शुरू नहीं हो सका। कृपया पुनः प्रयास करें।",
    "auth-msg-email-required":    "कृपया अपना ईमेल दर्ज करें",
    "auth-msg-email-error":       "ईमेल जाँचने में त्रुटि। कृपया पुनः प्रयास करें।",
  },
  bn: {
    "auth-msg-logging-in":        "লগ ইন হচ্ছে...",
    "auth-msg-login-ok":          "লগ ইন সফল! রিডাইরেক্ট হচ্ছে...",
    "auth-msg-login-fail":        "লগ ইন ব্যর্থ",
    "auth-msg-network-error":     "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।",
    "auth-msg-creating-account":  "অ্যাকাউন্ট তৈরি হচ্ছে...",
    "auth-msg-account-ok":        "অ্যাকাউন্ট তৈরি! শুরু করা যাক...",
    "auth-msg-reg-fail":          "নিবন্ধন ব্যর্থ",
    "auth-msg-creating-guest":    "অতিথি সেশন তৈরি হচ্ছে...",
    "auth-msg-guest-ok":          "অতিথি সেশন প্রস্তুত! রিডাইরেক্ট হচ্ছে...",
    "auth-msg-guest-fail":        "অতিথি সেশন শুরু হয়নি। আবার চেষ্টা করুন।",
    "auth-msg-email-required":    "অনুগ্রহ করে ইমেইল লিখুন",
    "auth-msg-email-error":       "ইমেইল যাচাইয়ে সমস্যা। আবার চেষ্টা করুন।",
  },
  as: {
    "auth-msg-logging-in":        "লগ ইন হৈ আছে...",
    "auth-msg-login-ok":          "লগ ইন সফল! ৰিডাইৰেক্ট হৈছে...",
    "auth-msg-login-fail":        "লগ ইন বিফল",
    "auth-msg-network-error":     "নেটৱৰ্ক সমস্যা। পুনৰ চেষ্টা কৰক।",
    "auth-msg-creating-account":  "একাউণ্ট বনাই আছে...",
    "auth-msg-account-ok":        "একাউণ্ট বনিল! আৰম্ভ কৰো...",
    "auth-msg-reg-fail":          "পঞ্জীয়ন বিফল",
    "auth-msg-creating-guest":    "অতিথি ছেছন বনাই আছে...",
    "auth-msg-guest-ok":          "অতিথি ছেছন সাজু! ৰিডাইৰেক্ট হৈছে...",
    "auth-msg-guest-fail":        "অতিথি ছেছন আৰম্ভ কৰিব পৰা নগ'ল। পুনৰ চেষ্টা কৰক।",
    "auth-msg-email-required":    "অনুগ্ৰহ কৰি আপোনাৰ ইমেইল দিয়ক",
    "auth-msg-email-error":       "ইমেইল পৰীক্ষাত সমস্যা। পুনৰ চেষ্টা কৰক।",
  },
  es: {
    "auth-msg-logging-in":        "Iniciando sesión...",
    "auth-msg-login-ok":          "¡Sesión iniciada! Redirigiendo...",
    "auth-msg-login-fail":        "Error al iniciar sesión",
    "auth-msg-network-error":     "Error de red. Por favor intenta de nuevo.",
    "auth-msg-creating-account":  "Creando tu cuenta...",
    "auth-msg-account-ok":        "¡Cuenta creada! Empecemos...",
    "auth-msg-reg-fail":          "Registro fallido",
    "auth-msg-creating-guest":    "Creando sesión de invitado...",
    "auth-msg-guest-ok":          "¡Sesión de invitado lista! Redirigiendo...",
    "auth-msg-guest-fail":        "No se pudo iniciar la sesión de invitado. Intenta de nuevo.",
    "auth-msg-email-required":    "Por favor ingresa tu correo",
    "auth-msg-email-error":       "Error al verificar el correo. Intenta de nuevo.",
  },
  ru: {
    "auth-msg-logging-in":        "Выполняется вход...",
    "auth-msg-login-ok":          "Вход выполнен! Перенаправляем...",
    "auth-msg-login-fail":        "Ошибка входа",
    "auth-msg-network-error":     "Ошибка сети. Попробуйте ещё раз.",
    "auth-msg-creating-account":  "Создаём аккаунт...",
    "auth-msg-account-ok":        "Аккаунт создан! Начинаем...",
    "auth-msg-reg-fail":          "Ошибка регистрации",
    "auth-msg-creating-guest":    "Создаём гостевую сессию...",
    "auth-msg-guest-ok":          "Гостевая сессия готова! Перенаправляем...",
    "auth-msg-guest-fail":        "Не удалось начать гостевую сессию. Попробуйте ещё раз.",
    "auth-msg-email-required":    "Пожалуйста, введите ваш email",
    "auth-msg-email-error":       "Ошибка проверки email. Попробуйте ещё раз.",
  },
};

async function main() {
  // 1. Seed Tab records
  console.log("Seeding Tab records...");
  for (const tab of TABS) {
    const existing = await prisma.tab.findUnique({ where: { slug: tab.slug } });
    if (existing) {
      await prisma.tab.update({ where: { id: existing.id }, data: { title: tab.title, description: tab.description, category: "ui-auth" } });
    } else {
      await prisma.tab.create({ data: { slug: tab.slug, title: tab.title, description: tab.description, category: "ui-auth", is_default: false, is_custom: false } });
      console.log(`  + ${tab.slug}`);
    }
  }

  // 2. Seed translations
  const slugs = TABS.map(t => t.slug);
  const tabs  = await prisma.tab.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(tabs.map(t => [t.slug, t.id]));

  for (const [locale, map] of Object.entries(LOCALES)) {
    console.log(`\nSeeding [${locale}]...`);
    for (const [slug, title] of Object.entries(map)) {
      const tabId = bySlug.get(slug);
      if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug}`); continue; }
      await prisma.tabTranslation.upsert({
        where:  { tabId_locale: { tabId, locale } },
        create: { tabId, locale, title, autoTranslated: false, status: "published" },
        update: { title, autoTranslated: false, status: "published" },
      });
      console.log(`  ✓  [${locale}] ${slug.padEnd(30)} →  ${title}`);
    }
  }

  console.log("\n✅ Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
