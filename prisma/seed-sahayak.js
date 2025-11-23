// prisma/seed-sahayak.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // define canonical sections + sample sub-tabs
  const tabs = [
    {
      slug: "epfo",
      title: "EPFO",
      description: "Help with Employees' Provident Fund Organisation",
      category: "Government Services",
      is_default: true,
      position: 10,
    },
    {
      slug: "epfo-check-balance",
      title: "Check EPF balance",
      description: "How to check your EPF balance",
      category: "EPFO",
      position: 11,
    },
    {
      slug: "irctc",
      title: "IRCTC",
      description: "Railway ticketing help and guides",
      category: "Government Services",
      is_default: true,
      position: 20,
    },
    {
      slug: "irctc-booking",
      title: "Book train tickets",
      description: "IRCTC registration and booking guides",
      category: "IRCTC",
      position: 21,
    },
    {
      slug: "ids",
      title: "Identity & Documents",
      description: "Aadhaar, PAN, Voter ID guides",
      category: "Government Services",
      is_default: true,
      position: 30,
    },
    {
      slug: "aadhar-download",
      title: "Aadhaar download",
      description: "How to download eAadhaar",
      category: "Identity & Documents",
      position: 31,
    },
    {
      slug: "health",
      title: "Health Services",
      description: "Ayushman Bharat and health-related help",
      category: "Government Services",
      is_default: true,
      position: 40,
    },
    {
      slug: "covid-vaccine",
      title: "COVID vaccination",
      description: "How to book COVID vaccine",
      category: "Health Services",
      position: 41,
    },
    {
      slug: "senior",
      title: "Senior Citizen Help",
      description: "Pension and senior citizen services",
      category: "Government Services",
      is_default: true,
      position: 50,
    },
    {
      slug: "senior-pension",
      title: "Pension schemes",
      description: "How to apply for pensions",
      category: "Senior Citizen Help",
      position: 51,
    },
  ];

  for (const t of tabs) {
    // upsert tab
    const tab = await prisma.tab.upsert({
      where: { slug: t.slug },
      update: {
        title: t.title,
        description: t.description,
        category: t.category,
        is_default: !!t.is_default,
        position: t.position ?? null,
      },
      create: {
        title: t.title,
        slug: t.slug,
        description: t.description,
        category: t.category,
        is_default: !!t.is_default,
        position: t.position ?? null,
      },
    });

    // upsert English translation (locale: en)
    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId: tab.id, locale: "en" } },
      update: {
        title: t.title,
        description: t.description,
        status: "published",
      },
      create: {
        tabId: tab.id,
        locale: "en",
        title: t.title,
        description: t.description,
        status: "published",
      },
    });

    console.log("ensured tab:", t.slug);
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
