// prisma/seed-help-links.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = [
    { pageSlug: "epfo", slugTags: ["epfo"], country: "India", title: "EPFO - Official Portal", url: "https://www.epfindia.gov.in/", notes: "Official EPFO portal" },
    { pageSlug: "irctc", slugTags: ["irctc"], country: "India", title: "IRCTC - Official", url: "https://www.irctc.co.in/", notes: "Booking & registration" },
    { pageSlug: "ids", slugTags: ["ids", "aadhar"], country: "India", title: "Aadhaar - eAadhaar download", url: "https://eaadhaar.uidai.gov.in/", notes: "Aadhaar portal" },
    { pageSlug: "health", slugTags: ["health"], country: "India", title: "Ayushman Bharat", url: "https://www.pmjay.gov.in/", notes: "Health scheme" },
    { pageSlug: "senior", slugTags: ["senior"], country: "India", title: "Senior citizen help", url: "https://www.india.gov.in/people-groups/senior-citizens", notes: "General resources" },
    // Example using your uploaded local file — pipeline can convert this path to a public URL later
    { pageSlug: "epfo", slugTags: ["epfo"], country: "All", title: "Sample image reference", url: "/mnt/data/497bae73-0ddd-4ca7-bc13-2a28e2875160.png", notes: "Local path included for pipeline conversion" },
  ];

  for (const r of rows) {
    try {
      await prisma.helpLink.create({ data: r });
      console.log("inserted", r.title);
    } catch (e) {
      console.warn("seed: failed to insert", r.title, e?.message || e);
    }
  }

  console.log("help-links seed done");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
