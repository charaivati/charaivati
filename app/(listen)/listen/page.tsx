// /listen — the Listener (Saathi) page (CONSULT-2). Route group with no layout:
// inherits the root layout only (no nav shell, no bottom tabs). Mobile-first —
// this page will later ship as a standalone Capacitor app. Guest-first entry,
// English chrome for v1 (no i18n infra — logged in TECH_DEBT.md); the AI replies
// in the user's language via the lang cookie, handled server-side.

import ListenChat from "@/components/listen/ListenChat";

export const metadata = {
  title: "Saathi — someone to talk to",
  description: "A calm space to talk things through, in your own language.",
};

export default function ListenPage() {
  return (
    <main className="h-dvh bg-black text-white">
      <ListenChat />
    </main>
  );
}
