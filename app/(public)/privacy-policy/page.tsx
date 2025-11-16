// app/(public)/privacy-policy/page.tsx
import React from "react";

export const metadata = {
  title: "Privacy Policy — Charaivati",
  description: "Privacy Policy for Charaivati",
};

export default function PrivacyPolicyPage() {
  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "auto", fontFamily: "system-ui, Roboto, Arial" }}>
      <h1>Privacy Policy — Charaivati</h1>
      <p style={{ color: "#666" }}>Last updated: <strong>2025-11-16</strong></p>

      <p>
        Charaivati (“we”, “us”, or “our”) operates https://www.charaivati.com (the “Service”). This Privacy Policy describes what information we collect, how we use it, and your rights.
      </p>

      <h2>Information We Collect</h2>
      <ul>
        <li><strong>Account & profile data:</strong> email and public profile if you sign in.</li>
        <li><strong>OAuth data:</strong> Google Drive access only with your explicit consent.</li>
        <li><strong>Usage data:</strong> logs, device/browser information, IP address, and analytics.</li>
      </ul>

      <h2>How We Use Information</h2>
      <ul>
        <li>Provide and maintain the Service.</li>
        <li>Access Drive files only when you explicitly choose a feature requiring it.</li>
        <li>Security, fraud detection, debugging, and analytics.</li>
        <li>Respond to support requests.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        For questions: <a href="mailto:charaivati.forward@gmail.com">charaivati.forward@gmail.com</a>
      </p>

      <footer style={{ marginTop: 40, color: "#666" }}>Charaivati — https://www.charaivati.com</footer>
    </main>
  );
}
