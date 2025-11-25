// prisma/seed-help-links.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = [
    {
      pageSlug: "epfo",
      country: "India",
      title: "EPFO - Official Portal",
      url: "https://www.epfindia.gov.in/",
      notes: "Official EPFO portal",
    },
    {
      pageSlug: "irctc",
      country: "India",
      title: "IRCTC - Official",
      url: "https://www.irctc.co.in/",
      notes: "Booking & registration",
    },
    {
      pageSlug: "ids",
      country: "India",
      title: "Aadhaar - eAadhaar download",
      url: "https://eaadhaar.uidai.gov.in/",
      notes: "Aadhaar portal",
    },
    {
      pageSlug: "health",
      country: "India",
      title: "Ayushman Bharat",
      url: "https://www.pmjay.gov.in/",
      notes: "Health scheme",
    },
    {
      pageSlug: "senior",
      country: "India",
      title: "Senior citizen help",
      url: "https://www.india.gov.in/people-groups/senior-citizens",
      notes: "General resources",
    },
    // Example using the uploaded file path (you may transform to a URL in your pipeline)
    {
      pageSlug: "epfo",
      country: "All",
      title: "Sample image reference",
      url: "/mnt/data/497bae73-0ddd-4ca7-bc13-2a28e2875160.png",
      notes: "Local path included for your pipeline to convert.",
    },
  ];

  for (const r of rows) {
    await prisma.helpLink.upsert({
      where: { id: r.id ?? r.title }, // just to attempt id uniqueness; fallback will create new
      update: {
        url: r.url,
        country: r.country,
        title: r.title,
        notes: r.notes,
        pageSlug: r.pageSlug,
      },
      create: {
        pageSlug: r.pageSlug,
        country: r.country,
        title: r.title,
        url: r.url,
        notes: r.notes,
      },
    });
    console.log("ensured", r.title);
  }

  console.log("help-links seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
