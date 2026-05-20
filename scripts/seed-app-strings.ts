// scripts/seed-app-strings.ts
// Seeds Tab records for app/app/home and app/app/orders UI strings.
// GST modal: translates headings/buttons only — legal paragraph bodies left hardcoded.
// Run with: npx tsx scripts/seed-app-strings.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STRINGS = [
  // ─── Home page — dedication ───────────────────────────────────────────────
  { slug: "app-home-dedication-1",    title: "To my younger self",                               description: "Home dedication — first phrase" },
  { slug: "app-home-dedication-2",    title: "who wanted to start a business.",                  description: "Home dedication — continuation" },
  { slug: "app-home-dedication-3",    title: "To my friend",                                     description: "Home dedication — second phrase" },
  { slug: "app-home-dedication-4",    title: "whose father's clothing store needed help.",        description: "Home dedication — continuation" },
  { slug: "app-home-dedication-5",    title: "To everyone who stopped because of paperwork.",    description: "Home dedication — closing phrase" },

  // ─── Home page — hero ────────────────────────────────────────────────────
  { slug: "app-home-tag",             title: "Igniting Ideas, Empowering Dreams",                description: "Home page tag chip above headline" },
  { slug: "app-home-headline",        title: "Start, Build and Share the Initiative You Always Wanted.", description: "Home page main headline" },
  { slug: "app-home-tap-start",       title: "Tap to get started",                              description: "Home page subline below headline" },

  // ─── Home page — cards ───────────────────────────────────────────────────
  { slug: "app-home-card-initiatives",  title: "My Initiatives",         description: "Home card title — user's own initiatives" },
  { slug: "app-home-card-initiative-1", title: "Create a Store",         description: "Home card list item" },
  { slug: "app-home-card-initiative-2", title: "Run a Service",          description: "Home card list item" },
  { slug: "app-home-card-initiative-3", title: "Share a Cause",          description: "Home card list item" },
  { slug: "app-home-card-initiative-4", title: "Build a Community",      description: "Home card list item" },
  { slug: "app-home-card-explore",      title: "Explore & Buy",          description: "Home card title — browse stores" },
  { slug: "app-home-card-explore-1",    title: "Browse Stores",          description: "Home card list item" },
  { slug: "app-home-card-explore-2",    title: "Save Products",          description: "Home card list item" },
  { slug: "app-home-card-explore-3",    title: "Support Initiatives",    description: "Home card list item" },
  { slug: "app-home-card-explore-4",    title: "Connect & Collaborate",  description: "Home card list item" },

  // ─── Home page — CTA ─────────────────────────────────────────────────────
  { slug: "app-home-cta-tagline",     title: "Just start. The rest follows.",     description: "Home page CTA tagline" },
  { slug: "app-home-cta-btn",         title: "Begin Your Initiative",             description: "Home page primary CTA button" },
  { slug: "app-home-no-gst",          title: "No GST needed to start.",           description: "Home footer note about GST" },
  { slug: "app-home-see-details",     title: "See full details",                  description: "GST modal trigger link" },

  // ─── Home page — GST modal headings + buttons (legal body NOT translated) ─
  { slug: "app-home-gst-modal-title", title: "GST & Selling on Charaivati",       description: "GST modal title" },
  { slug: "app-home-gst-no-need",     title: "You don't need GST if:",            description: "GST modal section heading — no GST needed" },
  { slug: "app-home-gst-need",        title: "You need GST if:",                  description: "GST modal section heading — GST required" },
  { slug: "app-home-gst-good-to-know",title: "Good to know",                      description: "GST modal section heading — tips" },
  { slug: "app-home-gst-register-btn",title: "Register on GST Portal →",          description: "GST modal register button" },
  { slug: "app-home-gst-disclaimer",  title: "General information only, not legal advice. Verify at gst.gov.in for your specific case.", description: "GST modal disclaimer" },

  // ─── Orders page — headings + tabs ───────────────────────────────────────
  { slug: "app-orders-heading",       title: "Orders",                            description: "Orders page heading (desktop)" },
  { slug: "app-orders-tab-my",        title: "My Orders",                         description: "Orders tab — buyer view" },
  { slug: "app-orders-tab-store",     title: "Store Orders",                      description: "Orders tab — seller view" },
  { slug: "app-orders-tab-tracking",  title: "Tracking",                          description: "Orders tab — live tracking" },

  // ─── Orders page — states ────────────────────────────────────────────────
  { slug: "app-orders-loading",          title: "Loading...",                               description: "Orders loading state" },
  { slug: "app-orders-empty-my",         title: "No orders yet.",                           description: "Buyer orders empty state" },
  { slug: "app-orders-empty-store",      title: "No store orders yet.",                     description: "Seller orders empty state" },
  { slug: "app-orders-empty-tracking",   title: "No active deliveries being tracked.",      description: "Tracking tab empty state" },
  { slug: "app-orders-no-gps",           title: "Delivery partner hasn't started GPS yet.", description: "Tracking map overlay when no GPS" },

  // ─── Orders page — actions ───────────────────────────────────────────────
  { slug: "app-orders-manage-all",    title: "Manage all orders →",     description: "Link to full store orders view" },
  { slug: "app-orders-manage",        title: "Manage →",                description: "Per-order manage link" },
  { slug: "app-orders-full-view",     title: "Full View →",             description: "Tracking card link to order detail" },
  { slug: "app-orders-track",         title: "Track 📍",                description: "Track button on out-for-delivery orders" },

  // ─── Orders page — delivery status labels ────────────────────────────────
  { slug: "app-orders-status-pending",          title: "Pending",          description: "Delivery status: pending" },
  { slug: "app-orders-status-confirmed",        title: "Confirmed",        description: "Delivery status: confirmed" },
  { slug: "app-orders-status-processing",       title: "Processing",       description: "Delivery status: processing" },
  { slug: "app-orders-status-out-for-delivery", title: "Out for Delivery", description: "Delivery status: out for delivery" },
  { slug: "app-orders-status-delivered",        title: "Delivered",        description: "Delivery status: delivered" },
  { slug: "app-orders-status-cancelled",        title: "Cancelled",        description: "Delivery status: cancelled" },
];

async function main() {
  console.log(`Seeding ${STRINGS.length} Tab records...\n`);
  let created = 0, updated = 0;
  for (const s of STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-app" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description, category: "ui-app", is_default: false, is_custom: false } });
      console.log(`  + ${s.slug}`);
      created++;
    }
  }
  console.log(`\nDone: ${created} created, ${updated} updated`);
  console.log("Run seed-translations.ts to auto-translate all enabled languages.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
