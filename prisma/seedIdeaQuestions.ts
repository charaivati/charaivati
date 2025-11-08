// prisma/seedIdeaQuestions.ts
// Run with: npx ts-node prisma/seedIdeaQuestions.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ideaQuestions = [
  {
    order: 1,
    text: "What problem are you solving? (In one sentence)",
    type: "text",
    category: "problem",
    scoringDim: "problemClarity",
    helpText:
      "Be specific. E.g., 'Students waste 2 hours daily finding affordable study materials'",
    examples: "Problems, not solutions",
  },
  {
    order: 2,
    text: "Who suffers from this problem? (Who is your customer?)",
    type: "text",
    category: "market",
    scoringDim: "targetAudience",
    helpText: "Age, profession, location, income level, etc.",
    examples: "College students in metro cities, small shopkeepers, etc.",
  },
  {
    order: 3,
    text: "How big is this problem? (How many people have it?)",
    type: "select",
    category: "market",
    scoringDim: "marketNeed",
    options: JSON.stringify([
      { value: "small", label: "< 10,000 people" },
      { value: "medium", label: "10,000 - 1 lakh" },
      { value: "large", label: "1 lakh - 10 lakh" },
      { value: "xlarge", label: "> 10 lakh" },
    ]),
    helpText: "Be honest about the market size",
    examples: "Think about: India population, but filtered to your segment",
  },
  {
    order: 4,
    text: "How are people currently solving this problem?",
    type: "text",
    category: "market",
    scoringDim: "uniqueValue",
    helpText: "Existing solutions, workarounds, or 'doing nothing'",
    examples:
      "They use Google search, hire consultants, manually track, DIY solutions",
  },
  {
    order: 5,
    text: "How is your solution different? (What's your unfair advantage?)",
    type: "text",
    category: "market",
    scoringDim: "uniqueValue",
    helpText: "Speed, cost, quality, access, or convenience?",
    examples: "10x cheaper, 100x faster, more personal, AI-powered, etc.",
  },
  {
    order: 6,
    text: "Do you know anyone facing this problem? (Have you talked to them?)",
    type: "select",
    category: "market",
    scoringDim: "marketNeed",
    options: JSON.stringify([
      { value: "no", label: "No, not yet" },
      { value: "yes_informal", label: "Yes, informal chat" },
      { value: "yes_formal", label: "Yes, structured interviews (5+)" },
    ]),
    helpText:
      "Real customer feedback is gold. Even 5 conversations matter more than 1000 assumptions.",
    examples: "Talk to friends, family, or strangers in target demographic",
  },
  {
    order: 7,
    text: "Can you build this? (Honestly)",
    type: "select",
    category: "feasibility",
    scoringDim: "feasibility",
    options: JSON.stringify([
      { value: "no_skills", label: "No, I don't have skills" },
      { value: "partially", label: "Partially, need help" },
      { value: "yes", label: "Yes, I can build it" },
      { value: "can_hire", label: "No, but can hire someone" },
    ]),
    helpText: "This is about YOU right now. Not if you hire a team later.",
    examples: "Code, manufacture, design, write content, etc.",
  },
  {
    order: 8,
    text: "How much will it cost to build an MVP? (First working version)",
    type: "select",
    category: "feasibility",
    scoringDim: "feasibility",
    options: JSON.stringify([
      { value: "free", label: "Free / ₹0-5,000" },
      { value: "low", label: "₹5,000 - ₹50,000" },
      { value: "medium", label: "₹50,000 - ₹5,00,000" },
      { value: "high", label: "> ₹5,00,000" },
    ]),
    helpText: "Include your time as cost. Can you afford this?",
    examples: "Server, tools, materials, freelancers, your sweat equity",
  },
  {
    order: 9,
    text: "How will you make money? (Business model)",
    type: "select",
    category: "monetization",
    scoringDim: "monetization",
    options: JSON.stringify([
      { value: "subscription", label: "Subscription / Membership" },
      { value: "commission", label: "Commission / Marketplace" },
      { value: "freemium", label: "Freemium (Free + Paid)" },
      { value: "licensing", label: "Licensing / B2B" },
      { value: "ads", label: "Ads" },
      { value: "unsure", label: "Not sure yet" },
    ]),
    helpText: "How do you charge customers? Be realistic.",
    examples:
      "Monthly fee, per transaction fee, % of sales, one-time purchase",
  },
  {
    order: 10,
    text: "Can customers actually pay for this?",
    type: "select",
    category: "monetization",
    scoringDim: "monetization",
    options: JSON.stringify([
      {
        value: "no",
        label: "No, it's too niche/poor market",
      },
      { value: "maybe", label: "Maybe, if priced right" },
      {
        value: "yes",
        label: "Yes, they're already paying competitors",
      },
    ]),
    helpText:
      "Would you actually pay for this? Has someone else already validated this market?",
    examples:
      "Ask 3 people: 'Would you pay ₹X for this?' Look at competitors.",
  },
  {
    order: 11,
    text: "What's your biggest risk right now?",
    type: "text",
    category: "feasibility",
    scoringDim: "feasibility",
    helpText:
      "Be honest: market risk, technical risk, regulatory, competition, etc.",
    examples:
      "Competition from big players, customer acquisition, regulatory hurdles, technology complexity",
  },
  {
    order: 12,
    text: "What's the ONE thing you need to validate this idea in the next 30 days?",
    type: "text",
    category: "market",
    scoringDim: "marketNeed",
    helpText:
      "Interview 5 customers? Build MVP? Get first paying customer? Biggest blocker?",
    examples:
      "Talk to 10 potential customers, build prototype, get first sale, get vendor quotes",
  },
];

async function main() {
  console.log("🌱 Seeding IdeaQuestions...");

  // Clear existing questions (optional)
  await prisma.ideaQuestion.deleteMany({});

  // Seed questions
  for (const q of ideaQuestions) {
    const created = await prisma.ideaQuestion.create({
      data: {
        order: q.order,
        text: q.text,
        type: q.type,
        category: q.category,
        scoringDim: q.scoringDim,
        helpText: q.helpText,
        examples: q.examples,
        options: q.options ? JSON.parse(q.options) : null,
      },
    });
    console.log(`✅ Q${created.order}: ${created.text.substring(0, 50)}...`);
  }

  console.log("✨ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });