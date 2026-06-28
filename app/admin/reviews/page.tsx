// app/admin/reviews/page.tsx — read-only admin view of per-user profile reviews.
// Probe-gate mirrors app/admin/users/page.tsx; server is the real gate.
"use client";
import { useState, useEffect } from "react";

interface Review {
  userId: string;
  email: string | null;
  body: string;
  updatedAt: string;
}

export default function AdminReviewsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    fetch("/api/admin/reviews", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 200) {
          const d = await r.json();
          setReviews(d.reviews ?? []);
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === null) return <div style={{ padding: "2rem", color: "#94a3b8", fontFamily: "monospace" }}>Verifying…</div>;
  if (isAdmin === false) return <div style={{ padding: "2rem", color: "#f87171", fontFamily: "monospace" }}>Access denied.</div>;

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4, color: "#f1f5f9" }}>Admin — Profile Reviews</h1>
      <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: "0.85rem" }}>
        AI-compiled per-user reviews (latest 100). Built by the profile-review reviewer.
      </p>
      {reviews.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>No reviews yet — run the reviewer cron.</p>
      ) : (
        reviews.map((r) => (
          <div key={r.userId} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#7dd3fc", fontSize: 13 }}>{r.email ?? r.userId}</span>
              <span style={{ color: "#64748b", fontSize: 11 }}>{new Date(r.updatedAt).toLocaleString()}</span>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>{r.body}</pre>
          </div>
        ))
      )}
    </div>
  );
}
