// app/(business)/business/plan/[token]/page.tsx
import React from "react";
import prisma from "../../../../../lib/prisma"; // <-- relative path to lib/prisma
import { notFound } from "next/navigation";

type Props = {
  params: { token: string };
};

export default async function Page({ params }: Props) {
  const token = params?.token;
  if (!token) return notFound();

  try {
    const plan = await prisma.businessPlan.findFirst({
      where: { retrievalToken: token },
      select: {
        id: true,
        title: true,
        dataJson: true,
        ownerEmail: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!plan) return notFound();

    const data = plan.dataJson ?? {};

    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>{plan.title ?? "Business plan"}</h1>
        <p style={{ color: "#666", marginBottom: 16 }}>
          Created: {new Date(plan.createdAt).toLocaleString()} — Status: {plan.status}
        </p>

        <section style={{ background: "#fff", padding: 18, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
          <h3>Plan data</h3>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(data, null, 2)}</pre>
        </section>

        {plan.ownerEmail && (
          <p style={{ marginTop: 16 }}>
            Owner email: <strong>{plan.ownerEmail}</strong>
          </p>
        )}
      </main>
    );
  } catch (err) {
    console.error("page /business/plan/[token] error:", err);
    // surface notFound so user sees 404 (or customize)
    return notFound();
  }
}
