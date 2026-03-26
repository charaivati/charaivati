import React from "react";

export const metadata = {
  title: "Terms of Service — Charaivati",
  description: "Terms of Service for Charaivati",
};

export default function TermsOfServicePage() {
  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "auto", fontFamily: "system-ui, Roboto, Arial" }}>
      <h1>Terms of Service — Charaivati</h1>
      <p style={{ color: "#666" }}>
        Last updated: <strong>2026-02-05</strong>
      </p>

      <p>
        By using Charaivati (the “Service”), you agree to these Terms of Service.
        If you do not agree, please do not use the Service.
      </p>

      <h2>Use of the Service</h2>
      <ul>
        <li>You are responsible for activity under your account.</li>
        <li>You must not misuse, disrupt, or attempt unauthorized access to the Service.</li>
        <li>Guest mode is read-only and may have limited functionality.</li>
      </ul>

      <h2>Accounts</h2>
      <ul>
        <li>You must provide accurate information when registering.</li>
        <li>You are responsible for safeguarding your login credentials.</li>
        <li>We may suspend accounts that violate these terms.</li>
      </ul>

      <h2>Content</h2>
      <ul>
        <li>You retain ownership of content you submit.</li>
        <li>You grant us permission to store/process submitted content to provide the Service.</li>
        <li>You must not post unlawful or harmful content.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:charaivati.forward@gmail.com">charaivati.forward@gmail.com</a>
      </p>

      <footer style={{ marginTop: 40, color: "#666" }}>Charaivati — https://www.charaivati.com</footer>
    </main>
  );
}
