// app/welcome/[id]/page.tsx
import { prisma } from "@/lib/prisma";

export default async function WelcomePage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({ where: { id: params.id } });

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h1>User not found</h1>
        <p>We could not find this user. Maybe registration failed.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>Welcome, {user.name || user.email} 👋</h1>
        <p style={{ opacity: 0.9 }}>
          Thanks for joining — we saved your details. Your registered email/phone is {user.email || user.phone}.
        </p>
      </div>
    </div>
  );
}
