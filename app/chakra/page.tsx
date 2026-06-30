import Link from "next/link";

export default function ChakraChooser() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Chakra Ascent</h1>
        <p className="mt-3 text-white/50 max-w-md mx-auto">
          A shadow figure in padmasana. Scroll, and energy rises up the spine —
          each chakra ignites from root to crown. Two takes, pick one.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
        <Link
          href="/chakra/svg"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/30 transition"
        >
          <div className="text-lg font-medium">SVG silhouette</div>
          <p className="mt-2 text-sm text-white/50">
            Hand-drawn dark figure with a glowing cosmic outline. Razor sharp, fast, AlienX-style.
          </p>
          <span className="mt-4 inline-block text-sm text-white/40 group-hover:text-white/80 transition">
            Open →
          </span>
        </Link>

        <Link
          href="/chakra/three"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/30 transition"
        >
          <div className="text-lg font-medium">3D figure</div>
          <p className="mt-2 text-sm text-white/50">
            A real 3D form with glowing orbs and point lights, gently alive as you scroll.
          </p>
          <span className="mt-4 inline-block text-sm text-white/40 group-hover:text-white/80 transition">
            Open →
          </span>
        </Link>
      </div>
    </main>
  );
}
