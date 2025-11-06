// app/api/business/plan/analyze/route.ts
import { NextResponse } from "next/server";

function analyze(data: any) {
  const risks: string[] = [];
  const suggestions: string[] = [];

  const idea = data;

  if (!idea.founderInfo || (typeof idea.founderInfo === "string" && idea.founderInfo.trim().length < 10)) {
    risks.push("Founder capacity/time unclear.");
    suggestions.push("Specify weekly hours and core skills to understand capability gaps.");
  }

  if (!idea.market || (typeof idea.market === "string" && idea.market.trim().length < 6)) {
    risks.push("Unclear customer segment.");
    suggestions.push("Talk to 5 potential customers and record their problem statements.");
  }

  if (!idea.competitors || idea.competitors.trim().length === 0) {
    risks.push("No competition / substitute scan.");
    suggestions.push("List 3 substitutes and check pricing/foot traffic for each.");
  }

  if (!idea.prototype) {
    risks.push("No prototype validated.");
    suggestions.push("Sell a minimal pack or sample to one customer this week and record evidence.");
  } else {
    if (!idea.price || idea.price <= 0) {
      risks.push("Pricing not set.");
      suggestions.push("Estimate price and test willingness on 5 customers.");
    }
  }

  // add customer-first rule: if fundingLevel none and no revenue path
  if ((!idea.fundingLevel || idea.fundingLevel === "none") && (!idea.price || idea.price <= 0)) {
    risks.push("No immediate revenue path for a no-fund founder.");
    suggestions.push("Design a micro-offer that can be sold in 1–7 days (sample, service).");
  }

  return { topRisks: risks, suggestions };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ideaData } = body;
    if (!ideaData) return NextResponse.json({ error: "missing ideaData" }, { status: 400 });

    const result = analyze(ideaData);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "internal" }, { status: 500 });
  }
}
