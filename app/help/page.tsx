import React from "react";

export const metadata = {
  title: "Help — Features · Charaivati",
  description: "How Charaivati is structured across layers and tabs.",
};

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-black text-gray-100 p-6 sm:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Charaivati — Features & Layers</h1>
          <p className="text-gray-300">Overview of the project structure and what each layer contains.</p>
        </header>

        <section id="summary" className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Quick summary</h2>
          <div className="prose prose-invert text-sm text-gray-300">
            <p>
              Charaivati is organized into <strong>five hierarchical layers</strong> (Personal, Local/Society,
              National, Global/Earth, and Universal). Each layer contains focused <strong>tabs</strong>
              designed for exploration and action.
            </p>
          </div>
        </section>

        <section id="features" className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">Layers & tabs — what they mean</h2>

          <div className="grid gap-6">
            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Personal (Self)</h3>
              <p className="text-sm text-gray-300">
                Focuses on the individual: profile, health, learning, earning, and social features.
              </p>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Society (Local)</h3>
              <p className="text-sm text-gray-300">
                Local and state-level concerns including panchayat, constituency, and community context.
              </p>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Nation (Country-wide)</h3>
              <p className="text-sm text-gray-300">
                National institutions and governance topics such as legislature, executive, judiciary, and media.
              </p>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Earth (Global)</h3>
              <p className="text-sm text-gray-300">Global topics: climate, collaboration, knowledge and action.</p>
            </article>

            <article className="p-6 bg-white/4 rounded-lg border border-white/6">
              <h3 className="text-lg font-semibold">Universe (Beyond)</h3>
              <p className="text-sm text-gray-300">Cosmic visual exploration and storytelling experiences.</p>
            </article>
          </div>
        </section>

        <footer className="pt-8 border-t border-white/6 text-sm text-gray-400">
          <div>Charaivati — experimental · Built with care</div>
        </footer>
      </div>
    </main>
  );
}
