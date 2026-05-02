// scripts/seed-ru.ts — Complete Russian (Русский) translation seed
// Covers: language record, nav, canvas, auth, and UI slugs.
// Run with: npx tsx scripts/seed-ru.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LOCALE = "ru";
const LANG = { name: "Russian", nativeName: "Русский", code: LOCALE };

const TRANSLATIONS: [string, string][] = [
  // ── Nav / layer labels ────────────────────────────────────────────────────
  ["layer-self",              "Я"],
  ["layer-society-home",      "Общество"],
  ["layer-nation-birth",      "Нация"],
  ["layer-earth",             "Земля"],
  ["layer-universe",          "Вселенная"],

  // ── Self tabs ─────────────────────────────────────────────────────────────
  ["self-personal",           "Личное"],
  ["self-social",             "Социальное"],
  ["self-learn",              "Учёба"],
  ["self-earn",               "Заработок"],

  // ── Society tabs ──────────────────────────────────────────────────────────
  ["soc-panchayat",           "Панчаят / Район"],
  ["soc-legislative",         "Законодательный округ"],
  ["soc-parliamentary",       "Парламентский округ"],
  ["soc-state",               "Штат"],

  // ── Nation tabs ───────────────────────────────────────────────────────────
  ["nat-legislature",         "Законодательная власть"],
  ["nat-executive",           "Исполнительная власть"],
  ["nat-judiciary",           "Судебная власть"],
  ["nat-media",               "СМИ"],

  // ── Earth tabs ────────────────────────────────────────────────────────────
  ["earth-worldview",         "Мировоззрение"],
  ["earth-humanstories",      "Истории людей"],
  ["earth-collab",            "Сотрудничество / Действие"],
  ["earth-knowledge",         "Знания / Инструменты"],

  // ── Universe tabs ─────────────────────────────────────────────────────────
  ["uni-spirit",              "Духовность"],
  ["uni-science",             "Наука"],
  ["uni-ideas",               "Идеи"],
  ["uni-other",               "Другое"],

  // ── Canvas block labels ───────────────────────────────────────────────────
  ["canvas-health",           "Здоровье"],
  ["canvas-goals",            "Цели"],
  ["canvas-skills",           "Навыки"],
  ["canvas-energy",           "Энергия"],
  ["canvas-environment",      "Окружение"],
  ["canvas-time",             "Время"],
  ["canvas-funds",            "Ресурсы"],
  ["canvas-network",          "Связи"],

  // ── Section headers ───────────────────────────────────────────────────────
  ["section-execution-plan",    "План действий"],
  ["section-daily-tasks",       "Ежедневные задачи"],
  ["section-project-timelines", "График проектов"],
  ["section-funds",             "Ресурсы и независимость"],

  // ── Goal archetype tabs ───────────────────────────────────────────────────
  ["archetype-learn",         "Учиться"],
  ["archetype-build",         "Создавать"],
  ["archetype-execute",       "Действовать"],
  ["archetype-connect",       "Соединяться"],

  // ── Status / empty-state strings ──────────────────────────────────────────
  ["status-no-goals",         "Целей пока нет"],
  ["status-not-set-up",       "Не настроено"],
  ["status-none-yet",         "Пока ничего"],
  ["status-no-tasks",         "Задач пока нет"],
  ["status-tap-to-view",      "Смотреть"],
  ["status-no-direction",     "Нет направления"],

  // ── Action buttons ────────────────────────────────────────────────────────
  ["action-add-goal",         "Добавить цель"],
  ["action-sign-in",          "Войти"],
  ["action-edit-health",      "Изменить данные здоровья"],
  ["action-regenerate",       "Пересоздать"],

  // ── Energy labels ─────────────────────────────────────────────────────────
  ["energy-high",             "Высокая энергия"],
  ["energy-moderate",         "Средняя"],
  ["energy-low",              "Низкая энергия"],

  // ── Drive strings ─────────────────────────────────────────────────────────
  ["drive-keep-moving",       "Двигайся вперёд"],
  ["drive-no-direction",      "Нет направления"],
  ["drive-sign-in-guest",     "Гостевой режим — войдите для синхронизации."],

  // ── Health block ──────────────────────────────────────────────────────────
  ["health-no-data",          "Нет данных о здоровье. Добавьте информацию для начала."],
  ["health-not-set",          "Не задано"],

  // ── Skills block ──────────────────────────────────────────────────────────
  ["skills-no-skills",        "Навыки пока не добавлены."],
  ["skills-add",              "Добавить навык"],
  ["skills-suggesting",       "Подбираем..."],
  ["skills-suggest",          "Предложить"],

  // ── Time block ────────────────────────────────────────────────────────────
  ["time-no-tasks",           "На этот день задач нет."],

  // ── Day abbreviations ─────────────────────────────────────────────────────
  ["day-mon",                 "Пн"],
  ["day-tue",                 "Вт"],
  ["day-wed",                 "Ср"],
  ["day-thu",                 "Чт"],
  ["day-fri",                 "Пт"],
  ["day-sat",                 "Сб"],
  ["day-sun",                 "Вс"],

  // ── Execution plan strings ────────────────────────────────────────────────
  ["exec-loading",            "Загрузка целей..."],
  ["exec-error",              "Не удалось загрузить планы."],
  ["exec-no-goals",           "Нет активных целей — создайте одну, чтобы увидеть план здесь."],
  ["exec-generating",         "Создаётся план действий..."],

  // ── AI / shared UI ────────────────────────────────────────────────────────
  ["ai-unavailable",          "Предложения ИИ временно недоступны — скоро вернёмся. Пока добавьте своё содержимое."],
  ["ai-badge",                "ИИ"],

  // ── Sahayak UI strings ────────────────────────────────────────────────────
  ["ui-video-tutorials",      "Видеоуроки"],
  ["ui-official-links",       "Официальные ссылки"],
  ["ui-loading-videos",       "Загрузка видео..."],
  ["ui-no-videos",            "Видео недоступны"],
  ["ui-loading-links",        "Загрузка ссылок..."],
  ["ui-no-links",             "Официальных ссылок нет"],
  ["ui-choose-language",      "Выбрать язык"],

  // ── Auth / login page ─────────────────────────────────────────────────────
  ["auth-welcome-title",      "Добро пожаловать"],
  ["auth-welcome-subtitle",   "Войдите или создайте аккаунт, чтобы продолжить"],
  ["auth-welcome-back",       "С возвращением!"],
  ["auth-create-title",       "Создайте аккаунт"],
  ["auth-email-label",        "Адрес эл. почты"],
  ["auth-email-placeholder",  "vy@primer.ru"],
  ["auth-email-hint",         "Проверим, есть ли у вас аккаунт, или поможем создать новый"],
  ["auth-continue-btn",       "Продолжить"],
  ["auth-checking",           "Проверяем..."],
  ["auth-password-label",     "Пароль"],
  ["auth-password-placeholder","Введите пароль"],
  ["auth-login-btn",          "Войти"],
  ["auth-logging-in",         "Выполняется вход..."],
  ["auth-diff-email",         "Использовать другую почту"],
  ["auth-name-label",         "Полное имя"],
  ["auth-name-placeholder",   "Иван Иванов"],
  ["auth-email-label-2",      "Эл. почта"],
  ["auth-password-hint",      "Не менее 8 символов"],
  ["auth-create-btn",         "Создать аккаунт"],
  ["auth-creating",           "Создаём аккаунт..."],
  ["auth-guest-btn",          "Пропустить (продолжить как гость)"],
  ["auth-guest-hint",         "Гостевой режим только для чтения — до входа в аккаунт."],
  ["auth-terms-prefix",       "Продолжая, вы соглашаетесь с нашими"],
  ["auth-terms-link",         "условиями использования"],
  ["auth-too-many-attempts",  "Слишком много попыток. Пожалуйста, подождите"],
];

async function main() {
  // 1. Upsert language record
  const existing = await prisma.language.findFirst({ where: { OR: [{ code: LANG.code }, { name: LANG.name }] } });
  if (existing) {
    await prisma.language.update({ where: { id: existing.id }, data: { code: LANG.code, name: LANG.name, nativeName: LANG.nativeName, enabled: true } });
    console.log(`Language updated: ${LANG.code} ${LANG.nativeName}`);
  } else {
    await prisma.language.create({ data: { code: LANG.code, name: LANG.name, nativeName: LANG.nativeName, enabled: true } });
    console.log(`Language created: ${LANG.code} ${LANG.nativeName}`);
  }

  // 2. Fetch all tab IDs by slug
  const slugs = TRANSLATIONS.map(([s]) => s);
  const tabs  = await prisma.tab.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(tabs.map(t => [t.slug, t.id]));

  console.log(`\nSeeding ${TRANSLATIONS.length} Russian translations...\n`);
  let done = 0, missing = 0;

  for (const [slug, title] of TRANSLATIONS) {
    const tabId = bySlug.get(slug);
    if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug}`); missing++; continue; }
    await prisma.tabTranslation.upsert({
      where:  { tabId_locale: { tabId, locale: LOCALE } },
      create: { tabId, locale: LOCALE, title, autoTranslated: false, status: "published" },
      update: { title, autoTranslated: false, status: "published" },
    });
    console.log(`  ✓  ${slug.padEnd(30)} →  ${title}`);
    done++;
  }

  console.log(`\n✅  Done: ${done} upserted, ${missing} slugs not found in DB`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
