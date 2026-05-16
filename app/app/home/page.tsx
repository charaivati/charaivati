"use client";

import { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [gstModalOpen, setGstModalOpen] = useState(false);

  return (
    <div style={{
      background: "#0F172A", minHeight: "100vh",
      maxWidth: 390, margin: "0 auto",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>

      {/* Dedication — white, bold, all-caps */}
      <section style={{ background: "#fff", padding: "20px 20px 28px" }}>
        <p style={{
          fontSize: 17, fontWeight: 800, lineHeight: 1.5,
          color: "#0F172A", textAlign: "center", margin: 0,
          textTransform: "uppercase", letterSpacing: "0.02em",
        }}>
          <span style={{ color: "#6366f1" }}>To my younger self</span>,{" "}
          who wanted to start a business.{" "}
          <span style={{ color: "#6366f1" }}>To my friend</span>,{" "}
          whose father&apos;s clothing store needed help.{" "}
          To everyone who stopped because of{" "}
          <span style={{ color: "#6366f1" }}>paperwork.</span>
        </p>
      </section>

      {/* Network visual */}
      <section style={{
        background: "linear-gradient(160deg, #1E1B4B 0%, #312E81 40%, #1E3A5F 70%, #0F172A 100%)",
        minHeight: 180, position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.3) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }} />
        {/* Radial glow */}
        <div style={{
          position: "absolute",
          width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        }} />
        {/* Connector lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1="28%" y1="50%" x2="50%" y2="50%"
            stroke="rgba(99,102,241,0.35)" strokeWidth="1" strokeDasharray="5 4" />
          <line x1="50%" y1="50%" x2="72%" y2="50%"
            stroke="rgba(99,102,241,0.35)" strokeWidth="1" strokeDasharray="5 4" />
          <line x1="50%" y1="20%" x2="50%" y2="50%"
            stroke="rgba(99,102,241,0.25)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50%" y1="50%" x2="50%" y2="80%"
            stroke="rgba(99,102,241,0.25)" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
        {/* Nodes */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 28, alignItems: "center" }}>
          {[
            { icon: "🛍️", size: 44 },
            { icon: "🌐", size: 64 },
            { icon: "🤝", size: 44 },
          ].map(({ icon, size }, i) => (
            <div key={i} style={{
              width: size, height: size, borderRadius: "50%",
              background: "rgba(99,102,241,0.18)",
              border: `${i === 1 ? 2 : 1}px solid rgba(99,102,241,${i === 1 ? 0.7 : 0.4})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: i === 1 ? 28 : 20,
              boxShadow: i === 1 ? "0 0 24px rgba(99,102,241,0.3)" : "none",
            }}>
              {icon}
            </div>
          ))}
        </div>
      </section>

      {/* Hero text + two-column cards */}
      <section style={{ background: "#0F172A", padding: "20px 16px 0" }}>

        {/* Tag */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <span style={{
            border: "1px solid rgba(99,102,241,0.5)",
            color: "#A5B4FC", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.15em", padding: "5px 14px",
            textTransform: "uppercase",
          }}>
            Igniting Ideas, Empowering Dreams
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 26, fontWeight: 900, lineHeight: 1.2,
          color: "#fff", margin: "0 0 10px",
          textTransform: "uppercase", textAlign: "center",
        }}>
          Start,{" "}
          <span style={{ color: "#818CF8" }}>Build</span> and{" "}
          <span style={{ color: "#818CF8" }}>Share</span>{" "}
          the Initiative You Always Wanted.
        </h1>

        <p style={{ textAlign: "center", color: "#64748B", fontSize: 13, margin: "0 0 20px" }}>
          Tap to get started
        </p>

        {/* Two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🚀</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>My Initiatives</span>
            </div>
            {["Create a Store", "Run a Service", "Share a Cause", "Build a Community"].map((item) => (
              <p key={item} style={{ fontSize: 12, color: "#374151", margin: "0 0 5px", lineHeight: 1.4 }}>
                {item}
              </p>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🌍</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Explore & Buy</span>
            </div>
            {["Browse Stores", "Save Products", "Support Initiatives", "Connect & Collaborate"].map((item) => (
              <p key={item} style={{ fontSize: 12, color: "#374151", margin: "0 0 5px", lineHeight: 1.4 }}>
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{
        background: "#060B18",
        borderTop: "1px solid #1E293B",
        padding: "20px 16px 36px",
      }}>
        <p style={{
          textAlign: "center", fontSize: 11, fontWeight: 700,
          color: "#475569", letterSpacing: "0.12em",
          textTransform: "uppercase", margin: "0 0 14px",
        }}>
          Just start. The rest follows.
        </p>

        <Link
          href="/app/initiatives"
          style={{
            display: "block", textAlign: "center",
            background: "#6366f1", color: "#fff",
            padding: "18px 24px", borderRadius: 12,
            fontSize: 18, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          Begin Your Initiative
        </Link>

        <p style={{ fontSize: 11, color: "#475569", textAlign: "center", margin: "16px 0 0" }}>
          No GST needed to start.{" "}
          <button
            onClick={() => setGstModalOpen(true)}
            style={{
              fontSize: 11, color: "#818CF8",
              background: "none", border: "none",
              cursor: "pointer", padding: 0,
              textDecoration: "underline",
            }}
          >
            See full details
          </button>
        </p>
      </section>

      {/* GST Modal */}
      {gstModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end",
          }}
          onClick={() => setGstModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxHeight: "80vh",
              background: "#fff", borderRadius: "20px 20px 0 0",
              padding: 24, overflowY: "auto",
            }}
          >
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                GST & Selling on Charaivati
              </h3>
              <button
                onClick={() => setGstModalOpen(false)}
                style={{
                  fontSize: 22, background: "none", border: "none",
                  cursor: "pointer", color: "#6B7280", lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: 10, padding: 12, marginBottom: 20,
            }}>
              <p style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.6, margin: 0 }}>
                Charaivati does not process payments. Buyers pay sellers directly
                (Cash on Delivery). This means we are a listing platform, not an
                e-commerce operator under GST law.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#16A34A", margin: "0 0 8px" }}>
                ✓ You don&apos;t need GST if:
              </p>
              {[
                "You sell goods only within your state",
                "Yearly turnover under ₹40 lakhs (goods) or ₹20 lakhs (services)",
                "You're just starting out",
              ].map((item, i) => (
                <p key={i} style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", paddingLeft: 12 }}>
                  • {item}
                </p>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", margin: "0 0 8px" }}>
                ⚠ You need GST if:
              </p>
              {[
                "Your turnover crosses the limits above",
                "You sell to customers in other states",
                "You voluntarily want to claim tax credits",
              ].map((item, i) => (
                <p key={i} style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", paddingLeft: 12 }}>
                  • {item}
                </p>
              ))}
            </div>

            <div style={{
              background: "#F0FDF4", borderRadius: 10,
              padding: 12, marginBottom: 20,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#15803D", margin: "0 0 6px" }}>
                💡 Good to know
              </p>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 8px" }}>
                You can start your store now and add GST details later when required.
              </p>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                Voluntary registration lets you claim tax credits and appear more
                credible to larger buyers.
              </p>
            </div>

            <a
              href="https://www.gst.gov.in"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "block", textAlign: "center",
                padding: 12, borderRadius: 10,
                background: "#6366f1", color: "#fff",
                textDecoration: "none", fontSize: 14,
                fontWeight: 600, marginBottom: 12,
              }}
            >
              Register on GST Portal →
            </a>

            <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
              General information only, not legal advice.
              Verify at gst.gov.in for your specific case.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
