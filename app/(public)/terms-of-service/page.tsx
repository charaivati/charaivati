import React from "react";

export const metadata = {
  title: "Terms of Service — Charaivati",
  description: "Terms of Service for Charaivati",
};

export default function TermsOfServicePage() {
  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "auto", fontFamily: "system-ui, Roboto, Arial" }}>
      <h1>Terms of Service — Charaivati</h1>
      <p style={{ color: "#666" }}>Last updated: <strong>2025-11-16</strong></p>

      <p>
        These Terms govern your use of the Charaivati platform at https://www.charaivati.com.  
        By using the Service, you agree to these Terms.
      </p>

      <h2>Use of Service</h2>
      <p>You agree to use the Service lawfully and responsibly.</p>

      <h2>User Content</h2>
      <p>You retain ownership of your content. Charaivati only processes it to operate the platform.</p>

      <h2>Contact</h2>
      <p>Questions: <a href="mailto:charaivati.forward@gmail.com">charaivati.forward@gmail.com</a></p>

      <footer style={{ marginTop: 40, color: "#666" }}>Charaivati — https://www.charaivati.com</footer>
    </main>
  );
}
