// app/api/business/plan/generate/route.ts
import { NextResponse } from "next/server";

function buildBMC(ideaData: any) {
  return {
    valueProposition: `${ideaData.title ?? "Idea"} — ${ideaData.description ?? ""}`,
    customerSegments: ideaData.market ?? "Local customers",
    channels: ideaData.prototype ? "In-person, WhatsApp, local retailer" : "Market test, local promotion",
    customerRelationships: "Direct selling, small follow-up, repeat purchase",
    revenueStreams: ideaData.price ? `Sale at ${ideaData.price} per unit` : "To be defined",
    keyResources: ideaData.prototype ? "Prototype, raw materials, small cart" : "Time, learning",
    keyActivities: "Customer interviews, small sales experiments, production",
    keyPartners: "Local suppliers, shopkeepers, mentors",
    costStructure: "Raw materials, packaging, transport, small stall/carrier",
  };
}

function buildSWOT(ideaData: any, analysis: any) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];

  strengths.push("Purpose: " + (ideaData.corePurpose ?? "unspecified"));
  if (ideaData.prototype) strengths.push("Prototype exists");
  if (analysis?.topRisks && analysis.topRisks.length === 0) strengths.push("Initial checks look OK");

  if (!ideaData.founderInfo || (typeof ideaData.founderInfo === "string" && ideaData.founderInfo.length < 10))
    weaknesses.push("Founder capacity undefined");
  if (!ideaData.market) weaknesses.push("Undefined market");

  opportunities.push("Local adoption, quick feedback loops");
  if (ideaData.price && ideaData.price < 100) opportunities.push("Low price -> impulse buys");

  threats.push("Competition or substitutes");
  threats.push("Cashflow if sales do not start quickly");

  return { strengths, weaknesses, opportunities, threats };
}

function buildPhases(ideaData: any) {
  const phase1 = {
    name: "Phase 1 — Prototype / Validation",
    description: "Minimal spend to validate one paying customer",
    costs: {
      sampleMaterials: 1000,
      packaging: 200,
      marketing: 200,
      contingency: 200,
    },
    expectedRevenue: ideaData.price ? ideaData.price * 10 : null,
    target: "10 sales / 1 repeat customer",
  };

  const phase2 = {
    name: "Phase 2 — Small Production",
    description: "Increase volume and consistent supply",
    costs: {
      rawMaterialsMonthly: 8000,
      packagingMonthly: 1000,
      stallOrTransport: 2000,
      helperWages: 5000,
    },
    expectedRevenueMonthly: ideaData.price ? ideaData.price * 300 : null,
    target: "Sustain monthly revenue with positive margin",
  };

  return { phase1, phase2 };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ideaData, analysis } = body;
    if (!ideaData) return NextResponse.json({ error: "missing ideaData" }, { status: 400 });

    const bmc = buildBMC(ideaData);
    const swot = buildSWOT(ideaData, analysis);
    const phases = buildPhases(ideaData);

    return NextResponse.json({ bmc, swot, phases });
  } catch (err: any) {
    console.error("Plan generate error:", err);
    return NextResponse.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}
