// prisma/seed-civic.js
// CIVIC-1 — seeds the civic Unit hierarchy (India → Assam → Guwahati East
// assembly → 2 wards) and 10 test issues across the two wards. Fixed IDs so
// the script is idempotent (upserts) and the test URLs are stable:
//   /local/civic-ward-chandmari   /local/civic-ward-beltola
// supporterCount values are seeded directly WITHOUT IssueSupport rows — this
// is test data for the board UI; real counts are transaction-kept by the API.
//
// Run standalone:  node prisma/seed-civic.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const UNITS = [
  { id: "civic-country-india", type: "country", name: "India", parentId: null },
  { id: "civic-state-assam", type: "state", name: "Assam", parentId: "civic-country-india" },
  { id: "civic-pc-gauhati", type: "parliamentary", name: "Gauhati", parentId: "civic-state-assam" },
  { id: "civic-ac-ghy-east", type: "assembly", name: "Guwahati East", parentId: "civic-pc-gauhati" },
  { id: "civic-ward-chandmari", type: "ward", name: "Ward 12 — Chandmari", parentId: "civic-ac-ghy-east" },
  { id: "civic-ward-beltola", type: "ward", name: "Ward 30 — Beltola", parentId: "civic-ac-ghy-east" },
];

const ISSUES = [
  // Ward 12 — Chandmari
  { id: "civic-issue-01", unitId: "civic-ward-chandmari", title: "Drainage near Chandmari market floods every monsoon", body: "The drain along the market road overflows after 20 minutes of rain. Shops lose stock and the road is impassable for two days at a time.", status: "active", supporterCount: 47 },
  { id: "civic-issue-02", unitId: "civic-ward-chandmari", title: "No streetlights on the lane behind the flyover", body: "The 400m stretch behind the flyover has had no working streetlights for 8 months. Unsafe for anyone walking after 7pm.", status: "active", supporterCount: 31 },
  { id: "civic-issue-03", unitId: "civic-ward-chandmari", title: "Garbage pickup skips the riverside colony", body: "Collection van covers the main road only. Riverside colony households have no pickup and waste ends up in the river.", status: "active", supporterCount: 18 },
  { id: "civic-issue-04", unitId: "civic-ward-chandmari", title: "Public tap at the corner park runs dry by 7am", body: "Around 40 households depend on it. Pressure drops to zero within an hour of supply starting.", status: "proposed", supporterCount: 6 },
  { id: "civic-issue-05", unitId: "civic-ward-chandmari", title: "Ward park cleanup drive", body: "The park was cleaned and benches repainted by a volunteer group of 25 residents.", status: "complete", supporterCount: 22, resolvedAt: "2026-05-14" },
  // Ward 30 — Beltola
  { id: "civic-issue-06", unitId: "civic-ward-beltola", title: "Potholes on Beltola-Basistha road service lane", body: "The service lane has a dozen deep potholes. Two-wheeler accidents reported every week during the rains.", status: "active", supporterCount: 53 },
  { id: "civic-issue-07", unitId: "civic-ward-beltola", title: "Stray cattle around the weekly market", body: "Cattle crowd the market entrance every Thursday, blocking the road and causing accidents.", status: "active", supporterCount: 14 },
  { id: "civic-issue-08", unitId: "civic-ward-beltola", title: "No pedestrian crossing near the girls' school", body: "Students cross a 4-lane road with no zebra crossing, signal, or speed breaker in either direction.", status: "proposed", supporterCount: 8 },
  { id: "civic-issue-09", unitId: "civic-ward-beltola", title: "Community pond de-silting", body: "The Beltola community pond was de-silted before the rains — completed with panchayat support.", status: "complete", supporterCount: 29, resolvedAt: "2026-04-02" },
  { id: "civic-issue-10", unitId: "civic-ward-beltola", title: "Demand for a second water tanker", body: "Superseded — piped supply was extended to the block, so the tanker demand no longer applies.", status: "archived", supporterCount: 11 },
];

async function main() {
  // Any real user can own the seed issues; prefer an obvious dev account.
  const author =
    (await prisma.user.findFirst({ where: { status: { not: "guest" } }, orderBy: { createdAt: "asc" } })) ||
    (await prisma.user.findFirst());
  if (!author) {
    console.error("No users in DB — create one account first, then re-run.");
    process.exit(1);
  }

  for (const u of UNITS) {
    await prisma.unit.upsert({
      where: { id: u.id },
      update: { name: u.name, type: u.type, parentId: u.parentId },
      create: u,
    });
  }
  console.log(`Seeded ${UNITS.length} units.`);

  for (const i of ISSUES) {
    const { resolvedAt, ...rest } = i;
    const data = {
      ...rest,
      authorId: author.id,
      scope: "ward",
      resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
    };
    await prisma.issue.upsert({
      where: { id: i.id },
      update: data,
      create: data,
    });
  }
  console.log(`Seeded ${ISSUES.length} issues (author: ${author.email || author.id}).`);
  console.log("Boards:  /local/civic-ward-chandmari   /local/civic-ward-beltola");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
