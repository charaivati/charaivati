// app/admin/page.tsx — unified admin hub. Server-gated by ADMIN_EMAIL (mirrors
// app/admin/security/page.tsx). One place that links to every admin tool with a
// short "what to do here" note for each.
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;

type Tool = { href: string; title: string; what: string };
type Group = { heading: string; tools: Tool[] };

const GROUPS: Group[] = [
  {
    heading: "AI",
    tools: [
      {
        href: "/admin/context",
        title: "AI Context Files",
        what: "Set how the AI talks. Edit the chat, listener (Saathi) and council prompts — type an instruction and the AI rewrites a section, or edit the text directly. Changes go live everywhere within ~60s.",
      },
      {
        href: "/admin/reviews",
        title: "Profile Reviews",
        what: "Read the AI-compiled review of each user — summary, gaps, conflicts, and suggestions for the chat, a business page, and Saathi. Built automatically by the nightly reviewer.",
      },
      {
        href: "/admin/security",
        title: "AI Security Events",
        what: "Review guardrail events — messages the AI blocked or flagged. Check here if something looks off.",
      },
    ],
  },
  {
    heading: "Content & translations",
    tools: [
      { href: "/admin/translations", title: "Translations", what: "Manage tab translations across all languages." },
      { href: "/admin/help-links", title: "Help Links", what: "Create and assign help links to tabs." },
      { href: "/admin/page-of-content", title: "Pages & Dashboards", what: "Manage pages, dashboards and their tabs." },
      { href: "/admin/questions", title: "Idea Questions", what: "Edit the business idea-evaluation survey questions." },
    ],
  },
  {
    heading: "Accounts",
    tools: [
      { href: "/admin/users", title: "Create User", what: "Create a lite account with a temporary password the user changes on first login." },
    ],
  },
];

export default async function AdminHubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("charaivati.session")?.value ?? cookieStore.get("__Host-session")?.value;
  const payload = await verifySessionToken(token ?? null);
  if (!payload) notFound();
  const user = await db.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
  if (!ADMIN_EMAIL || !user?.email || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) notFound();

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: 4, color: "#f1f5f9" }}>Charaivati Admin</h1>
      <p style={{ color: "#94a3b8", marginBottom: 28, fontSize: "0.85rem" }}>
        Everything in one place. Tap a tool to open it.
      </p>

      {GROUPS.map((group) => (
        <section key={group.heading} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 12 }}>
            {group.heading}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {group.tools.map((t) => (
              <a
                key={t.href}
                href={t.href}
                style={{
                  display: "block", background: "#1e293b", border: "1px solid #334155",
                  borderRadius: 10, padding: 16, textDecoration: "none", color: "inherit",
                }}
              >
                <div style={{ color: "#7dd3fc", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t.title} →</div>
                <div style={{ color: "#94a3b8", fontSize: 12.5, lineHeight: 1.5 }}>{t.what}</div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
