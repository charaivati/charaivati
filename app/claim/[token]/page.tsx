// app/claim/[token]/page.tsx
// Server component — validates the invite token and renders either an error or a Join form.
// Setting Referrer-Policy: no-referrer on this route via next.config.mjs headers is required to
// prevent the raw token from leaking in the Referer header when the user clicks the join button.
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token";
import { claimInvite } from "./actions";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { token: rawToken } = await params;

  const tokenHash = hashToken(decodeURIComponent(rawToken));

  const invite = await (db as any).invite.findFirst({
    where: {
      tokenHash,
      status: "pending",
      expiresAt: { gte: new Date() },
      attempts: { lt: 5 },
    },
    select: { id: true, email: true, inviterId: true },
  });

  if (!invite) {
    return (
      <main style={styles.wrap}>
        <div style={styles.card}>
          <p style={styles.logo}>चरैवेति · Charaivati</p>
          <h1 style={styles.h1}>This invite link is invalid or has expired.</h1>
          <p style={styles.body}>
            Ask your friend to send a fresh invite.
          </p>
        </div>
      </main>
    );
  }

  const inviter = await db.user.findUnique({
    where: { id: invite.inviterId },
    select: { name: true },
  });
  const inviterName = inviter?.name ?? "A friend";

  const action = claimInvite.bind(null, rawToken);

  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <p style={styles.logo}>चरैवेति · Charaivati</p>
        <h1 style={styles.h1}>You're invited</h1>
        <p style={styles.body}>
          <strong>{inviterName}</strong> has invited you to join Charaivati —
          a platform for personal growth, community action, and economic participation.
        </p>
        <form action={action}>
          <button type="submit" style={styles.btn}>
            Join Charaivati →
          </button>
        </form>
        <p style={styles.fine}>
          By joining you agree to our{" "}
          <a href="/privacy" style={styles.link}>Privacy Policy</a> and{" "}
          <a href="/terms" style={styles.link}>Terms of Service</a>.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f4f5",
    padding: "1rem",
  },
  card: {
    background: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e4e4e7",
    padding: "2rem",
    maxWidth: "440px",
    width: "100%",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  logo: {
    fontSize: "13px",
    color: "#71717a",
    letterSpacing: "0.04em",
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  h1: {
    fontSize: "22px",
    fontWeight: 500,
    color: "#18181b",
    marginTop: 0,
    marginBottom: "0.75rem",
  },
  body: {
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#52525b",
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  btn: {
    display: "inline-block",
    padding: "13px 28px",
    background: "#D85A30",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    textAlign: "center",
  },
  fine: {
    fontSize: "12px",
    color: "#a1a1aa",
    marginTop: "1rem",
    marginBottom: 0,
  },
  link: { color: "#71717a" },
};
