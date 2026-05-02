// scripts/seed-es.ts — Complete Spanish (Español) translation seed
// Covers: language record, nav, canvas, auth, and UI slugs.
// Run with: npx tsx scripts/seed-es.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LOCALE = "es";
const LANG = { name: "Spanish", nativeName: "Español", code: LOCALE };

const TRANSLATIONS: [string, string][] = [
  // ── Nav / layer labels ────────────────────────────────────────────────────
  ["layer-self",              "Yo"],
  ["layer-society-home",      "Sociedad"],
  ["layer-nation-birth",      "Nación"],
  ["layer-earth",             "Tierra"],
  ["layer-universe",          "Universo"],

  // ── Self tabs ─────────────────────────────────────────────────────────────
  ["self-personal",           "Personal"],
  ["self-social",             "Social"],
  ["self-learn",              "Aprender"],
  ["self-earn",               "Ganar"],

  // ── Society tabs ──────────────────────────────────────────────────────────
  ["soc-panchayat",           "Panchayat / Barrio"],
  ["soc-legislative",         "Circunscripción legislativa"],
  ["soc-parliamentary",       "Circunscripción parlamentaria"],
  ["soc-state",               "Estado"],

  // ── Nation tabs ───────────────────────────────────────────────────────────
  ["nat-legislature",         "Legislatura"],
  ["nat-executive",           "Ejecutivo"],
  ["nat-judiciary",           "Judicial"],
  ["nat-media",               "Medios"],

  // ── Earth tabs ────────────────────────────────────────────────────────────
  ["earth-worldview",         "Visión mundial"],
  ["earth-humanstories",      "Historias humanas"],
  ["earth-collab",            "Colaborar / Actuar"],
  ["earth-knowledge",         "Conocimiento / Herramientas"],

  // ── Universe tabs ─────────────────────────────────────────────────────────
  ["uni-spirit",              "Espiritualidad"],
  ["uni-science",             "Ciencia"],
  ["uni-ideas",               "Ideas"],
  ["uni-other",               "Otro"],

  // ── Canvas block labels ───────────────────────────────────────────────────
  ["canvas-health",           "Salud"],
  ["canvas-goals",            "Metas"],
  ["canvas-skills",           "Habilidades"],
  ["canvas-energy",           "Energía"],
  ["canvas-environment",      "Entorno"],
  ["canvas-time",             "Tiempo"],
  ["canvas-funds",            "Recursos"],
  ["canvas-network",          "Red"],

  // ── Section headers ───────────────────────────────────────────────────────
  ["section-execution-plan",    "Plan de acción"],
  ["section-daily-tasks",       "Tareas diarias"],
  ["section-project-timelines", "Cronograma de proyectos"],
  ["section-funds",             "Recursos e independencia"],

  // ── Goal archetype tabs ───────────────────────────────────────────────────
  ["archetype-learn",         "Aprender"],
  ["archetype-build",         "Construir"],
  ["archetype-execute",       "Ejecutar"],
  ["archetype-connect",       "Conectar"],

  // ── Status / empty-state strings ──────────────────────────────────────────
  ["status-no-goals",         "Aún sin metas"],
  ["status-not-set-up",       "Sin configurar"],
  ["status-none-yet",         "Aún nada"],
  ["status-no-tasks",         "Sin tareas aún"],
  ["status-tap-to-view",      "Ver"],
  ["status-no-direction",     "Sin dirección"],

  // ── Action buttons ────────────────────────────────────────────────────────
  ["action-add-goal",         "Añadir meta"],
  ["action-sign-in",          "Iniciar sesión"],
  ["action-edit-health",      "Editar datos de salud"],
  ["action-regenerate",       "Regenerar"],

  // ── Energy labels ─────────────────────────────────────────────────────────
  ["energy-high",             "Energía alta"],
  ["energy-moderate",         "Moderada"],
  ["energy-low",              "Energía baja"],

  // ── Drive strings ─────────────────────────────────────────────────────────
  ["drive-keep-moving",       "Sigue adelante"],
  ["drive-no-direction",      "Sin dirección"],
  ["drive-sign-in-guest",     "Modo invitado — inicia sesión para sincronizar."],

  // ── Health block ──────────────────────────────────────────────────────────
  ["health-no-data",          "Sin datos de salud. Añade tus detalles para empezar."],
  ["health-not-set",          "Sin configurar"],

  // ── Skills block ──────────────────────────────────────────────────────────
  ["skills-no-skills",        "Aún no hay habilidades añadidas."],
  ["skills-add",              "Añadir habilidad"],
  ["skills-suggesting",       "Sugiriendo..."],
  ["skills-suggest",          "Sugerir"],

  // ── Time block ────────────────────────────────────────────────────────────
  ["time-no-tasks",           "Sin tareas para este día."],

  // ── Day abbreviations ─────────────────────────────────────────────────────
  ["day-mon",                 "Lun"],
  ["day-tue",                 "Mar"],
  ["day-wed",                 "Mié"],
  ["day-thu",                 "Jue"],
  ["day-fri",                 "Vie"],
  ["day-sat",                 "Sáb"],
  ["day-sun",                 "Dom"],

  // ── Execution plan strings ────────────────────────────────────────────────
  ["exec-loading",            "Cargando metas..."],
  ["exec-error",              "No se pudieron cargar los planes."],
  ["exec-no-goals",           "Aún sin metas activas — crea una para ver tu plan aquí."],
  ["exec-generating",         "Generando plan de acción..."],

  // ── AI / shared UI ────────────────────────────────────────────────────────
  ["ai-unavailable",          "Las sugerencias de IA no están disponibles ahora — volvemos pronto. Mientras tanto, añade tu propio contenido."],
  ["ai-badge",                "IA"],

  // ── Sahayak UI strings ────────────────────────────────────────────────────
  ["ui-video-tutorials",      "Tutoriales en video"],
  ["ui-official-links",       "Enlaces oficiales"],
  ["ui-loading-videos",       "Cargando videos..."],
  ["ui-no-videos",            "No hay videos disponibles"],
  ["ui-loading-links",        "Cargando enlaces..."],
  ["ui-no-links",             "Sin enlaces oficiales configurados"],
  ["ui-choose-language",      "Elegir idioma"],

  // ── Auth / login page ─────────────────────────────────────────────────────
  ["auth-welcome-title",      "Bienvenido"],
  ["auth-welcome-subtitle",   "Inicia sesión o crea una cuenta para continuar"],
  ["auth-welcome-back",       "¡Bienvenido de nuevo!"],
  ["auth-create-title",       "Crea tu cuenta"],
  ["auth-email-label",        "Correo electrónico"],
  ["auth-email-placeholder",  "tú@ejemplo.com"],
  ["auth-email-hint",         "Veremos si tienes una cuenta o te ayudaremos a crear una"],
  ["auth-continue-btn",       "Continuar"],
  ["auth-checking",           "Verificando..."],
  ["auth-password-label",     "Contraseña"],
  ["auth-password-placeholder","Ingresa tu contraseña"],
  ["auth-login-btn",          "Iniciar sesión"],
  ["auth-logging-in",         "Iniciando sesión..."],
  ["auth-diff-email",         "Usar otro correo"],
  ["auth-name-label",         "Nombre completo"],
  ["auth-name-placeholder",   "Juan García"],
  ["auth-email-label-2",      "Correo"],
  ["auth-password-hint",      "Debe tener al menos 8 caracteres"],
  ["auth-create-btn",         "Crear cuenta"],
  ["auth-creating",           "Creando cuenta..."],
  ["auth-guest-btn",          "Omitir por ahora (Continuar como invitado)"],
  ["auth-guest-hint",         "El modo invitado es solo de lectura — hasta que inicies sesión."],
  ["auth-terms-prefix",       "Al continuar, aceptas nuestros"],
  ["auth-terms-link",         "términos de servicio"],
  ["auth-too-many-attempts",  "Demasiados intentos. Por favor espera"],
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

  console.log(`\nSeeding ${TRANSLATIONS.length} Spanish translations...\n`);
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
