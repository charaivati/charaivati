// app/contact/page.tsx
import React from "react";
import { Instagram, Phone, Mail } from "lucide-react";

export const metadata = {
  title: "Contact · Charaivati",
  description: "Get in touch with Charaivati — social, phone, and collaboration inquiries.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-gray-100 flex flex-col justify-center items-center px-6 py-16">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Get in touch</h1>
        <p className="text-gray-300 mb-8">
          Whether it’s collaboration, feedback, or curiosity — we’d love to hear from you.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 mt-8">
          {/* Instagram */}
          <a
            href="https://instagram.com/charaivati"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left group"
          >
            <div className="flex items-center gap-3 mb-3">
              <Instagram className="w-5 h-5 text-pink-400 group-hover:text-pink-300" />
              <h3 className="font-semibold text-white">Instagram</h3>
            </div>
            <p className="text-gray-400 text-sm">@charaivati</p>
            <p className="text-xs text-gray-500 mt-1">Follow for updates, visuals, and ideas.</p>
          </a>

          {/* Phone */}
          <div className="p-6 rounded-xl border border-white/10 bg-white/5 text-left">
            <div className="flex items-center gap-3 mb-3">
              <Phone className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Call / WhatsApp</h3>
            </div>
            <p className="text-gray-400 text-sm">+91 97062 82892</p>
            <p className="text-xs text-gray-500 mt-1">Available 10AM – 6PM IST</p>
          </div>
        </div>

        {/* Optional contact form placeholder */}
        <div className="mt-10 p-6 rounded-xl bg-white/5 border border-white/10 text-left">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Send a quick message</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            We’re working on a direct contact form. Meanwhile, DM on Instagram or call us directly.
          </p>
          <div className="flex justify-center">
            <a
              href="https://instagram.com/charaivati"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 rounded bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-sm font-medium"
            >
              Open Instagram
            </a>
          </div>
        </div>

        <footer className="mt-12 text-sm text-gray-500 border-t border-white/10 pt-6">
          <p>
            © {new Date().getFullYear()} <strong>Charaivati</strong> — built with purpose and imagination.
          </p>
          <p className="mt-1 text-gray-600 text-xs">
            Follow <a href="https://instagram.com/charaivati" className="text-pink-400 hover:text-pink-300">@charaivati</a> for daily updates.
          </p>
        </footer>
      </div>
    </main>
  );
}
