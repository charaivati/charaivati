import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;

const TYPE_COLORS: Record<string, string> = {
  INPUT_BLOCKED: "#fca5a5",   // red-300
  INPUT_WARNED:  "#fde68a",   // yellow-200
  OUTPUT_BLOCKED: "#fdba74",  // orange-300
};

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function SecurityPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("charaivati.session")?.value
    ?? cookieStore.get("__Host-session")?.value;

  const payload = await verifySessionToken(token ?? null);
  if (!payload) notFound();

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  });

  if (!ADMIN_EMAIL || user?.email !== ADMIN_EMAIL) notFound();

  const events = await (db as any).guardrailEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem", color: "#f1f5f9" }}>
        AI Guardrail Events
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
        Last 50 events — most recent first
      </p>

      {events.length === 0 && (
        <p style={{ color: "#64748b" }}>No events recorded yet.</p>
      )}

      {events.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                {["Time", "Type", "User", "Reason", "Message", "IP"].map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev: any) => (
                <tr key={ev.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {timeAgo(new Date(ev.createdAt))}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>
                    <span style={{
                      background: TYPE_COLORS[ev.eventType] ?? "#e2e8f0",
                      color: "#0f172a",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      fontSize: "0.72rem",
                      fontWeight: "bold",
                    }}>
                      {ev.eventType}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8" }}>
                    {ev.userId ? truncate(ev.userId, 12) : "—"}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#cbd5e1" }}>
                    {truncate(ev.reason, 40)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#cbd5e1", maxWidth: "300px" }}>
                    {truncate(ev.userMessage, 80)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>
                    {ev.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
