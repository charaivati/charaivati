// app/admin/context/page.tsx
// Admin-only editor for ai-context/*.txt (incl. the Council prompts in COUNCIL.txt).
// Server gate lives in /api/admin/context; this client only shows/hides the UI.
// Per section: raw textarea edit OR plain-English instruction -> AI rewrite -> save.
"use client";
import { useState, useEffect, useCallback } from "react";

const SECTION_RE = /\[SECTION:\s*(\w+)\]([\s\S]*?)\[\/SECTION\]/g;

interface Section {
  name: string;
  start: number; // index of body (group 2) in fullText
  end: number;
}

// Parse [SECTION:...] spans so an edit can be spliced back in place (preserving
// preamble + ordering). Files with no sections are edited as one whole-file block.
function parseSections(text: string): Section[] {
  const out: Section[] = [];
  SECTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_RE.exec(text)) !== null) {
    const bodyStart = m.index + m[0].indexOf(m[2]);
    out.push({ name: m[1], start: bodyStart, end: bodyStart + m[2].length });
  }
  return out;
}

const card: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "14px",
  marginBottom: 16,
};
const ta: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 13,
  padding: "8px 10px",
  boxSizing: "border-box",
  lineHeight: 1.5,
};
const btn = (bg: string): React.CSSProperties => ({
  padding: "7px 14px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});
const label: React.CSSProperties = { fontSize: 12, color: "#94a3b8", marginBottom: 4, display: "block" };

export default function AdminContextPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState("");
  const [fullText, setFullText] = useState("");
  const [overridden, setOverridden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // per-section instruction text + busy flag + rewrite preview
  const [instr, setInstr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string>>({});

  // Probe the gate (200 => admin). Also gives us the file list.
  useEffect(() => {
    fetch("/api/admin/context", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 200) {
          const d = await r.json();
          setFiles(d.files ?? []);
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const loadFile = useCallback(async (f: string) => {
    setLoading(true);
    setStatus(null);
    setInstr({});
    setPreview({});
    try {
      const r = await fetch(`/api/admin/context?file=${encodeURIComponent(f)}`, { credentials: "include" });
      const d = await r.json();
      setFullText(d.fullText ?? "");
      setOverridden(!!d.overridden);
    } catch {
      setStatus({ ok: false, msg: "Failed to load file." });
    } finally {
      setLoading(false);
    }
  }, []);

  function pickFile(f: string) {
    setFile(f);
    if (f) loadFile(f);
  }

  // Splice a new section body into fullText at its current span.
  function setSectionText(sec: Section, value: string) {
    setFullText((prev) => prev.slice(0, sec.start) + value + prev.slice(sec.end));
  }

  async function rewrite(secName: string, currentBody: string) {
    const instruction = (instr[secName] ?? "").trim();
    if (!instruction || busy) return;
    setBusy(secName);
    setStatus(null);
    try {
      const r = await fetch("/api/admin/context/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: file, sectionName: secName, instruction, currentBody }),
      });
      const d = await r.json();
      if (r.ok) setPreview((p) => ({ ...p, [secName]: d.rewritten ?? "" }));
      else setStatus({ ok: false, msg: d.error ?? "Rewrite failed." });
    } catch {
      setStatus({ ok: false, msg: "Network error." });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const r = await fetch("/api/admin/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: file, body: fullText }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setOverridden(true);
        setStatus({ ok: true, msg: "Saved. Live within ~60s everywhere (instant on this server)." });
      } else {
        setStatus({ ok: false, msg: d.error ?? "Save failed." });
      }
    } catch {
      setStatus({ ok: false, msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === null) return <div style={{ padding: "2rem", color: "#94a3b8", fontFamily: "monospace" }}>Verifying…</div>;
  if (isAdmin === false) return <div style={{ padding: "2rem", color: "#f87171", fontFamily: "monospace" }}>Access denied.</div>;

  const sections = file ? parseSections(fullText) : [];

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4, color: "#f1f5f9" }}>Admin — AI Context Editor</h1>
      <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: "0.85rem", maxWidth: 700 }}>
        Edit the text that shapes the AI (chat, listener, council). Type an instruction and let the AI
        rewrite a section, or edit the textarea directly. Edits save to the shared database and take
        effect on localhost and production within ~60s.
      </p>

      <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={file}
          onChange={(e) => pickFile(e.target.value)}
          style={{ padding: "8px 12px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, fontSize: 14 }}
        >
          <option value="">Select a context file…</option>
          {files.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        {file && overridden && (
          <span style={{ fontSize: 12, color: "#fbbf24" }}>● DB override active (differs from shipped file)</span>
        )}
        {loading && <span style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</span>}
      </div>

      {status && (
        <p style={{ fontSize: 13, color: status.ok ? "#4ade80" : "#f87171", marginBottom: 16 }}>{status.msg}</p>
      )}

      {file && !loading && (
        <>
          {sections.length === 0 ? (
            <div style={card}>
              <label style={label}>Whole file (no [SECTION] blocks)</label>
              <textarea rows={24} style={ta} value={fullText} onChange={(e) => setFullText(e.target.value)} />
            </div>
          ) : (
            sections.map((sec) => {
              const body = fullText.slice(sec.start, sec.end);
              return (
                <div key={sec.name} style={card}>
                  <div style={{ fontWeight: 700, color: "#7dd3fc", marginBottom: 8 }}>[{sec.name}]</div>

                  <label style={label}>Section text (raw edit)</label>
                  <textarea
                    rows={Math.min(16, Math.max(3, Math.ceil(body.length / 70)))}
                    style={ta}
                    value={body}
                    onChange={(e) => setSectionText(sec, e.target.value)}
                  />

                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Or describe a change → AI rewrites this section</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={instr[sec.name] ?? ""}
                        onChange={(e) => setInstr((p) => ({ ...p, [sec.name]: e.target.value }))}
                        placeholder="e.g. add a rule: be extra concise when the user seems anxious"
                        style={{ ...ta, flex: 1, fontFamily: "inherit" }}
                      />
                      <button
                        onClick={() => rewrite(sec.name, body)}
                        disabled={busy === sec.name}
                        style={{ ...btn("#6366f1"), opacity: busy === sec.name ? 0.6 : 1, whiteSpace: "nowrap" }}
                      >
                        {busy === sec.name ? "Rewriting…" : "AI rewrite"}
                      </button>
                    </div>
                  </div>

                  {preview[sec.name] !== undefined && (
                    <div style={{ marginTop: 10, border: "1px solid #4338ca", borderRadius: 6, padding: 10, background: "#1e1b4b" }}>
                      <label style={label}>Proposed rewrite — review, then apply</label>
                      <textarea
                        rows={Math.min(16, Math.max(3, Math.ceil(preview[sec.name].length / 70)))}
                        style={ta}
                        value={preview[sec.name]}
                        onChange={(e) => setPreview((p) => ({ ...p, [sec.name]: e.target.value }))}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            setSectionText(sec, preview[sec.name]);
                            setPreview((p) => { const n = { ...p }; delete n[sec.name]; return n; });
                          }}
                          style={btn("#16a34a")}
                        >
                          Apply to section ↑
                        </button>
                        <button
                          onClick={() => setPreview((p) => { const n = { ...p }; delete n[sec.name]; return n; })}
                          style={btn("#475569")}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div style={{ position: "sticky", bottom: 0, padding: "14px 0", background: "#0f172a" }}>
            <button onClick={save} disabled={saving} style={{ ...btn("#D85A30"), padding: "10px 22px", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : `Save ${file}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
