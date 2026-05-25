import React from "react";

export const metadata = {
  title: "Security — Charaivati",
  description: "Security vulnerability reporting and responsible disclosure policy for Charaivati",
};

export default function SecurityPage() {
  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "auto", fontFamily: "system-ui, Roboto, Arial" }}>
      <h1>Security</h1>
      <p>We take the security of Charaivati seriously.</p>

      <h2>Reporting a Vulnerability</h2>
      <p>If you discover a security vulnerability, please report it responsibly:</p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:security@charaivati.com">security@charaivati.com</a></li>
        <li><strong>Response time:</strong> We aim to respond within 48 hours.</li>
        <li>Please do not disclose publicly until we have had a chance to investigate and fix.</li>
      </ul>

      <h2>What to Include</h2>
      <ul>
        <li>Description of the vulnerability</li>
        <li>Steps to reproduce</li>
        <li>Potential impact</li>
        <li>Your contact information (optional)</li>
      </ul>

      <h2>Scope</h2>
      <ul>
        <li>charaivati.com and subdomains</li>
        <li>Charaivati Android app</li>
        <li>Charaivati APIs</li>
      </ul>

      <h2>Out of Scope</h2>
      <ul>
        <li>Social engineering attacks</li>
        <li>Denial of service attacks</li>
        <li>Issues in third-party services we use</li>
      </ul>

      <h2>Our Commitment</h2>
      <ul>
        <li>We will acknowledge your report within 48 hours</li>
        <li>We will keep you informed of our progress</li>
        <li>We will credit you (if you wish) when the issue is resolved</li>
      </ul>

      <p style={{ marginTop: 24 }}>
        Charaivati is built and maintained by a small team. We appreciate responsible
        disclosure and the security community's support.
      </p>

      <footer style={{ marginTop: 40, color: "#666" }}>Charaivati — https://www.charaivati.com</footer>
    </main>
  );
}
