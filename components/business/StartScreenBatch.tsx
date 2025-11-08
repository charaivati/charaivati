// components/business/StartScreenBatch.tsx
"use client";

import { useState } from "react";

interface StartScreenBatchProps {
  onStart: (
    title: string,
    description: string,
    email: string,
    phone: string
  ) => void;
  loading: boolean;
  error?: string;
}

export default function StartScreenBatch({
  onStart,
  loading,
  error,
}: StartScreenBatchProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const canSubmit = title.trim() && description.trim() && email.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Validate Your Business Idea
        </h1>
        <p className="text-slate-400 mb-8">
          Answer all 12 questions to get a comprehensive evaluation. You can edit your answers anytime.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart(title, description, email, phone);
          }}
          className="space-y-6"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Name (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Business Idea (2-3 sentences)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what problem you're solving and for whom"
              rows={4}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition"
          >
            {loading ? "Starting..." : "Start Validation"}
          </button>
        </form>
      </div>
    </div>
  );
}