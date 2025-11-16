import React from "react";

export const metadata = {
  title: "Security Policy — Charaivati",
  description: "Security policy and reporting information for Charaivati",
};

export default function SecurityPage() {
  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "auto", fontFamily: "system-ui, Roboto, Arial" }}>
      <h1>Security Policy — Charaivati</h1>
      <p style={{ color: "#666" }}>Last updated: <strong>2025-11-16</strong></p>

      <h2>Supported Versions</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd" }}>Version</th>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd" }}>Supported</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: "6px 8px" }}>5.1.x</td><td style={{ padding: "6px 8px" }}>✅</td></tr>
          <tr><td style={{ padding: "6px 8px" }}>5.0.x</td><td style={{ padding: "6px 8px" }}>❌</td></tr>
          <tr><td style={{ padding: "6px 8px" }}>4.0.x</td><td style={{ padding: "6px 8px" }}>✅</td></tr>
          <tr><td style={{ padding: "6px 8px" }}>{"< 4.0"}</td><td style={{ padding: "6px 8px" }}>❌</td></tr>
        </tbody>
      </table>

      <h2>Reporting a Vulnerability</h2>
      <p>
        Report to <a href="mailto:charaivati.forward@gmail.com">charaivati.forward@gmail.com</a>.  
        We acknowledge within 48 hours.
      </p>

      <h2>Coordinated Disclosure</h2>
      <p>We follow CVD and publish advisories through GitHub when needed.</p>

      <footer style={{ marginTop: 40, color: "#666" }}>Charaivati — https://www.charaivati.com</footer>
    </main>
  );
}
