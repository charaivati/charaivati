// app/help/page.tsx
import React from "react";

export const metadata = {
  title: "Help — Features · Charaivati",
  description: "How Charaivati is structured: Layers, Tabs, Feature flags and how to preview hidden content",
};

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-black text-gray-100 p-6 sm:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Charaivati — Features & Layers</h1>
          <p className="text-gray-300">Overview of the project's structure, what each layer contains, and how feature visibility works.</p>
        </header>

        <section id="summary" className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Quick summary</h2>
          <div className="prose prose-invert text-sm text-gray-300">
            <p>
              Charaivati is organized into <strong>five hierarchical layers</strong> (Personal, Local/Society, National, Global/Earth,
              and Universal). Each layer exposes a set of <strong>tabs</strong> (features) — you can enable/disable tabs using
              feature flags. For QA and demos we allow a per-user local override so an individual visitor can reveal a hidden
              section in their browser without changing global settings.
            </p>
          </div>
        </section>

        <section id="features" className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">Layers & tabs — what they mean</h2>

          <div className="grid gap-6">
            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Personal (Self)</h3>
              <p className="text-sm text-gray-300">
                Focuses on the individual: profile, health, learning, earning, and social features. Typical tabs:{" "}
                <em>Personal / Social / Learn / Earn</em>.
              </p>
              <ul className="mt-2 text-sm text-gray-300">
                <li>Self: personal dashboard, steps, sleep, water, hobbies.</li>
                <li>Social: friends, pages, follows, discovery.</li>
                <li>Learn: courses, notes, streaks.</li>
                <li>Earn: market-study tools, business planning helpers (SWOT, BMC), and simple forecasting for MSMEs.</li>
              </ul>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Society (Local)</h3>
              <p className="text-sm text-gray-300">
                Local and state-level concerns. Tabs include local government, services, panchayat/ward level features and
                constituency views.
              </p>
              <ul className="mt-2 text-sm text-gray-300">
                <li>Local selection persisted in browser (region/state/ward).</li>
                <li>Useful for campaigns targeted to a specific constituency or community.</li>
              </ul>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Nation (Country-wide)</h3>
              <p className="text-sm text-gray-300">
                Features at the national level: legislature, executive, judiciary, media and national policy information.
                Example: the <strong>Justice Pending</strong> concept (show people denied justice) can be showcased here while
                hiding other nation-level tools.
              </p>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Earth (Global)</h3>
              <p className="text-sm text-gray-300">Global topics: climate, trade, global collaborations, tools and knowledge hubs.</p>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Universe (Beyond)</h3>
              <p className="text-sm text-gray-300">Cosmic/visualization experiences (3D renders), storytelling and exploration.</p>
            </article>
          </div>
        </section>

        <section id="visibility" className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">Feature visibility — server flags + local override</h2>
          <div className="p-6 bg-white/4 rounded-lg border border-white/6 text-sm text-gray-300">
            <p>
              We use a small feature-flag system stored in the database (table: <code>FeatureFlag</code>) to control which layers
              and tabs are visible by default to all users. Flags are read by the client through <code>/api/feature-flags</code>.
            </p>

            <h4 className="mt-4 font-semibold">Two layers of control</h4>
            <ul className="list-disc list-inside mt-2">
              <li>
                <strong>Global flag</strong> — stored server-side, affects everyone. Example key:{" "}
                <code>layer.society.panchayat</code>.
              </li>
              <li>
                <strong>Local override</strong> — stored in each user’s browser (<code>localStorage</code>) and only affects that
                browser. Useful for QA, demos and early-adopter previews. Triggered with the <em>Show current content</em> button.
              </li>
            </ul>

            <div className="mt-4">
              <strong>Important:</strong> local override is just a client-side convenience — it does not change server settings,
              does not modify the database, and does not grant extra permissions to secure APIs. If an API is protected, server
              auth still applies.
            </div>
          </div>
        </section>

        <section id="developer-notes" className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">Developer notes</h2>

          <div className="grid gap-4">
            <div className="p-4 bg-white/4 rounded border border-white/6 text-sm text-gray-300">
              <h4 className="font-semibold">Feature flags API</h4>
              <p className="mt-1">
                The client fetches flags from <code>/api/feature-flags</code>. The endpoint reads the <code>FeatureFlag</code> table
                via Prisma and returns a map keyed by flag keys (e.g. <code>layer.self.personal</code>).
              </p>
            </div>

            <div className="p-4 bg-white/4 rounded border border-white/6 text-sm text-gray-300">
              <h4 className="font-semibold">Seed & migrations</h4>
              <p className="mt-1">
                Use the existing seed scripts in <code>prisma/</code> or run <code>node scripts/seedFeatureFlags.js</code> to populate
                default flags. For schema changes, use Prisma migrations:
              </p>
              <pre className="mt-2 p-2 bg-black/50 rounded text-xs overflow-auto">npx prisma migrate dev --name add_feature_flags</pre>
              <p className="mt-1 text-xs text-gray-400">
                (Be careful when running <code>prisma db pull</code> — it overwrites your local schema file with what’s in the DB.)
              </p>
            </div>

            <div className="p-4 bg-white/4 rounded border border-white/6 text-sm text-gray-300">
              <h4 className="font-semibold">Local override key</h4>
              <p className="mt-1">
                The client-side override key is stored as:
                <br />
                <code>charaivati.feature.override:&lt;flagKey&gt;</code>
                <br />
                e.g. <code>charaivati.feature.override:layer.society.panchayat</code>
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Want a custom preview or early access?</h3>
              <p className="text-sm text-gray-300 mt-1">
                Use the <em>Show current content</em> button for a browser-local preview. For per-user server-controlled previews or
                admin tricks, we can add a temporary feature-flag or admin toggle.
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href="/contact"
                className="inline-block px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-sm font-medium"
                role="button"
              >
                Contact us
              </a>

              <a
                href="#features"
                className="inline-block px-4 py-2 rounded border border-white/10 text-sm text-gray-200"
                role="button"
              >
                Jump to features
              </a>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-white/6 text-sm text-gray-400">
          <div>Charaivati — experimental · Built with care</div>
          <div className="mt-1">If you want documentation, developer hooks, or to enable a temporary flag for a campaign — ask and we’ll add it.</div>
        </footer>
      </div>
    </main>
  );
}
